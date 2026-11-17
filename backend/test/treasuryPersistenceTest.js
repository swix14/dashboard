import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Carpeta temporal de uploads para aislamiento de prueba
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtf-treasury-test-'));
process.env.UPLOADS_DIR = uploadsDir;

const { default: app } = await import('../src/server.js');
const { pool: dbPool } = await import('../src/config/db.js');
const { TreasuryService } = await import('../src/services/treasuryService.js');

// Servidor de pruebas en puerto efímero
const server = app.listen(0);
const port = server.address().port;
const baseUrl = `http://localhost:${port}/api`;

console.log(`[TEST PERSISTENCIA] Servidor de prueba iniciado en ${baseUrl}`);

async function login(identifier) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: 'Admin123!' })
  });
  const body = await res.json();
  return body.data.token;
}

const PDF_MAGIC = '%PDF-1.4\n% Recibo contable auditado\n';

async function runPersistenceSuite() {
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  const tesoreraToken = await login('16.947.343-9');

  // 1. Guardar egreso con archivo PDF y persistir en MySQL
  let savedId = null;
  await test('Subir comprobante de egreso y guardar metadatos en MySQL', async () => {
    const form = new FormData();
    form.append('tipo', 'EGRESO');
    form.append('fecha', '2026-10-28');
    form.append('descripcion', 'Pago de suministros con factura electrónica');
    form.append('centroCosto', 'ASOCIACION');
    form.append('categoria', 'OTROS');
    form.append('monto', '89000');
    form.append('metodo', 'Transferencia Bancaria');
    form.append('comprobante', new Blob([PDF_MAGIC], { type: 'application/pdf' }), 'factura_suministros.pdf');

    const res = await fetch(`${baseUrl}/tesoreria/movimientos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tesoreraToken}` },
      body: form
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.id);
    assert.strictEqual(body.data.comprobante, 'factura_suministros.pdf');
    assert.ok(body.data.comprobanteArchivo);
    assert.strictEqual(body.data.comprobanteArchivo.mimeType, 'application/pdf');
    savedId = body.data.id;
  });

  // 2. Recuperar movimiento simulando reinicio: consultar MySQL directamente
  await test('getMovementById recupera metadata comprobanteArchivo desde MySQL', async () => {
    const mov = await TreasuryService.getMovementById(savedId);
    assert.ok(mov, 'El movimiento debe existir en MySQL');
    assert.ok(mov.comprobanteArchivo, 'comprobanteArchivo no debe ser null tras consulta a MySQL');
    assert.strictEqual(mov.comprobanteArchivo.mimeType, 'application/pdf');
    assert.ok(mov.comprobanteArchivo.storedName, 'storedName debe estar persistido');
    assert.strictEqual(mov.monto, 89000);
  });

  // 3. Descarga exitosa vía endpoint HTTP utilizando metadata de MySQL
  await test('GET /api/tesoreria/movimientos/:id/comprobante descarga el archivo persistido', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/movimientos/${savedId}/comprobante`, {
      headers: { Authorization: `Bearer ${tesoreraToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
    const content = await res.text();
    assert.strictEqual(content, PDF_MAGIC);
  });

  // 4. Asientos SALDO_APERTURA consultables en getMovements
  await test('getMovements lista asientos SALDO_APERTURA', async () => {
    const movements = await TreasuryService.getMovements({ tipo: 'SALDO_APERTURA' });
    assert.ok(Array.isArray(movements));
    assert.ok(movements.length >= 2, 'Deben existir al menos los dos asientos de apertura 2026');
    const asoc = movements.find((m) => m.centroCosto === 'ASOCIACION');
    const cena = movements.find((m) => m.centroCosto === 'CENA ANUAL');
    assert.ok(asoc);
    assert.ok(cena);
    assert.strictEqual(Number(asoc.monto), 5103000);
    assert.strictEqual(Number(cena.monto), 8856000);
  });

  // 5. Corrección de movimientos: editar y anular
  const presidentaToken = await login('13.963.291-5');
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const resumen = async () => (await (await fetch(`${baseUrl}/tesoreria/resumen`, { headers: auth(tesoreraToken) })).json()).data;
  const formEdicion = (campos, archivo) => {
    const form = new FormData();
    const base = { fecha: '2026-10-28', descripcion: 'Pago de suministros (monto corregido)', centroCosto: 'ASOCIACION', categoria: 'OTROS', monto: '95000', metodo: 'Transferencia Bancaria' };
    for (const [k, v] of Object.entries({ ...base, ...campos })) form.append(k, v);
    if (archivo) form.append('comprobante', new Blob([PDF_MAGIC], { type: 'application/pdf' }), archivo);
    return form;
  };
  const editar = (id, token, form) => fetch(`${baseUrl}/tesoreria/movimientos/${id}`, { method: 'PUT', headers: auth(token), body: form });
  const anular = (id, token, motivo) =>
    fetch(`${baseUrl}/tesoreria/movimientos/${id}/anular`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo })
    });

  await test('La Presidenta no puede editar ni anular movimientos (solo lectura)', async () => {
    assert.strictEqual((await editar(savedId, presidentaToken, formEdicion())).status, 403);
    assert.strictEqual((await anular(savedId, presidentaToken, 'prueba')).status, 403);
  });

  await test('Editar corrige monto y descripción, conserva el comprobante y ajusta los saldos', async () => {
    const antes = await resumen();
    const res = await editar(savedId, tesoreraToken, formEdicion());
    const body = await res.json();
    assert.strictEqual(res.status, 200, body.message);
    assert.strictEqual(body.data.monto, 95000);
    assert.strictEqual(body.data.comprobante, 'factura_suministros.pdf', 'sin archivo nuevo se mantiene el comprobante');
    assert.ok(body.data.editadoPor, 'queda registrado quién editó');
    const despues = await resumen();
    assert.strictEqual(despues.totalEgresos - antes.totalEgresos, 6000);
    assert.strictEqual(antes.saldoAsociacion - despues.saldoAsociacion, 6000);
  });

  await test('Editar con un archivo nuevo reemplaza el comprobante', async () => {
    const res = await editar(savedId, tesoreraToken, formEdicion({}, 'factura_corregida.pdf'));
    const body = await res.json();
    assert.strictEqual(res.status, 200, body.message);
    assert.strictEqual(body.data.comprobante, 'factura_corregida.pdf');
    assert.strictEqual(body.data.comprobanteArchivo.originalName, 'factura_corregida.pdf');
  });

  await test('Los saldos de apertura no se pueden editar ni anular', async () => {
    const [apertura] = await TreasuryService.getMovements({ tipo: 'SALDO_APERTURA' });
    assert.strictEqual((await editar(apertura.id, tesoreraToken, formEdicion())).status, 409);
    assert.strictEqual((await anular(apertura.id, tesoreraToken, 'no corresponde')).status, 409);
  });

  await test('Anular exige motivo, saca el monto de los saldos y deja el movimiento en el libro', async () => {
    assert.strictEqual((await anular(savedId, tesoreraToken, '')).status, 400);
    const antes = await resumen();
    const res = await anular(savedId, tesoreraToken, 'Registrado dos veces');
    assert.strictEqual(res.status, 200, (await res.json()).message);
    const despues = await resumen();
    assert.strictEqual(antes.totalEgresos - despues.totalEgresos, 95000);
    assert.strictEqual(antes.totalMovimientos - despues.totalMovimientos, 1);
    const enLibro = (await TreasuryService.getMovements({})).find((m) => m.id === savedId);
    assert.ok(enLibro, 'el movimiento anulado sigue en el libro');
    assert.deepStrictEqual([enLibro.anulado, enLibro.motivoAnulacion], [true, 'Registrado dos veces']);
    // Un anulado ya no se modifica
    assert.strictEqual((await anular(savedId, tesoreraToken, 'otra vez')).status, 409);
    assert.strictEqual((await editar(savedId, tesoreraToken, formEdicion())).status, 409);
  });

  await test('Un movimiento inexistente responde 404', async () => {
    assert.strictEqual((await anular(99999999, tesoreraToken, 'no existe')).status, 404);
  });

  console.log(`\n[RESULTADOS PERSISTENCIA] ${passed} pasados, ${failed} fallidos`);
  server.closeAllConnections?.();
  server.close();
  // Cerrar MySQL antes de salir: salir con process.exit y sockets abiertos rompe libuv en Windows
  await dbPool?.end().catch(() => {});
  fs.rmSync(uploadsDir, { recursive: true, force: true });
  process.exitCode = failed > 0 ? 1 : 0;
}

runPersistenceSuite();

