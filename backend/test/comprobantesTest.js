import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Carpeta temporal para que las pruebas no ensucien backend/uploads
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtf-uploads-test-'));
process.env.UPLOADS_DIR = uploadsDir;

const { default: app } = await import('../src/server.js');
const { pool: dbPool } = await import('../src/config/db.js');

// Servidor de pruebas en puerto efímero
const server = app.listen(0);
const port = server.address().port;
const baseUrl = `http://localhost:${port}/api`;

console.log(`[TEST] Servidor de prueba iniciado en ${baseUrl}`);

async function login(identifier) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: 'Admin123!' })
  });
  const body = await res.json();
  return body.data.token;
}

function buildEgresoForm(file) {
  const form = new FormData();
  form.append('tipo', 'EGRESO');
  form.append('fecha', '2026-10-20');
  form.append('descripcion', 'Compra de insumos con boleta adjunta');
  form.append('centroCosto', 'ASOCIACION');
  form.append('categoria', 'OTROS');
  form.append('monto', '35000');
  form.append('metodo', 'Efectivo');
  if (file) form.append('comprobante', file.blob, file.name);
  return form;
}

const PDF_CONTENT = '%PDF-1.4\n% comprobante de prueba\n';

async function runTests() {
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

  const tesoreraToken = await login('tesorera@vtftemuco.cl');
  const presidentaToken = await login('presidenta@vtftemuco.cl');

  // 1. Egreso sin archivo rechazado
  await test('POST /api/tesoreria/movimientos egreso sin archivo retorna 400', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/movimientos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tesoreraToken}` },
      body: buildEgresoForm(null)
    });
    assert.strictEqual(res.status, 400);
  });

  // 2. Egreso con nombre de archivo escrito a mano (sin archivo real) rechazado
  await test('POST /api/tesoreria/movimientos egreso con solo nombre de texto retorna 400', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/movimientos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tesoreraToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'EGRESO',
        fecha: '2026-10-20',
        descripcion: 'Egreso sin respaldo real',
        centroCosto: 'ASOCIACION',
        categoria: 'OTROS',
        monto: 10000,
        metodo: 'Efectivo',
        comprobante: 'boleta_inventada.pdf'
      })
    });
    assert.strictEqual(res.status, 400);
  });

  // 3. Formato no permitido
  await test('POST /api/tesoreria/movimientos con archivo .exe retorna 400', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/movimientos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tesoreraToken}` },
      body: buildEgresoForm({
        blob: new Blob(['MZ'], { type: 'application/x-msdownload' }),
        name: 'virus.exe'
      })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(fs.readdirSync(uploadsDir).length, 0);
  });

  // 4. Egreso con PDF válido
  let movimientoId = '';
  await test('POST /api/tesoreria/movimientos egreso con PDF retorna 201 y guarda archivo', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/movimientos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tesoreraToken}` },
      body: buildEgresoForm({
        blob: new Blob([PDF_CONTENT], { type: 'application/pdf' }),
        name: 'boleta_librería.pdf'
      })
    });
    assert.strictEqual(res.status, 201);
    const { data } = await res.json();
    assert.strictEqual(data.monto, 35000);
    assert.strictEqual(data.comprobante, 'boleta_librería.pdf');
    assert.strictEqual(data.comprobanteArchivo.mimeType, 'application/pdf');
    assert.strictEqual(fs.readdirSync(uploadsDir).length, 1);
    movimientoId = data.id;
  });

  // 5. Presidenta (solo lectura) puede descargar el comprobante
  await test('GET /api/tesoreria/movimientos/:id/comprobante descarga el archivo original', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/movimientos/${movimientoId}/comprobante`, {
      headers: { Authorization: `Bearer ${presidentaToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(await res.text(), PDF_CONTENT);
  });

  // 6. Presidenta no puede registrar movimientos
  await test('POST /api/tesoreria/movimientos denegado con 403 para Presidenta', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/movimientos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${presidentaToken}` },
      body: buildEgresoForm({
        blob: new Blob([PDF_CONTENT], { type: 'application/pdf' }),
        name: 'boleta.pdf'
      })
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(fs.readdirSync(uploadsDir).length, 1);
  });

  // 7. Registro histórico sin archivo digital
  await test('GET comprobante de movimiento histórico sin archivo retorna 404', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/movimientos/mov-001/comprobante`, {
      headers: { Authorization: `Bearer ${tesoreraToken}` }
    });
    assert.strictEqual(res.status, 404);
  });

  // 8. Validación Zod: Rechazo de montos con decimales (CLP es entero)
  await test('POST /api/tesoreria/movimientos con monto decimal retorna 400', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/movimientos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tesoreraToken}` },
      body: (() => {
        const form = new FormData();
        form.append('tipo', 'INGRESO');
        form.append('fecha', '2026-10-25');
        form.append('descripcion', 'Aporte con decimales no permitido');
        form.append('centroCosto', 'ASOCIACION');
        form.append('monto', '15000.75');
        form.append('metodo', 'Transferencia Bancaria');
        return form;
      })()
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  // 9. Validación Zod: Rechazo de fecha inexistente en el calendario (ej: 30 de febrero)
  await test('POST /api/tesoreria/movimientos con fecha 2026-02-30 retorna 400', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/movimientos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tesoreraToken}` },
      body: (() => {
        const form = new FormData();
        form.append('tipo', 'INGRESO');
        form.append('fecha', '2026-02-30');
        form.append('descripcion', 'Fecha imposible en febrero');
        form.append('centroCosto', 'ASOCIACION');
        form.append('monto', '10000');
        form.append('metodo', 'Transferencia Bancaria');
        return form;
      })()
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  // 10. Resumen financiero calcula correctamente con asientos SALDO_APERTURA
  await test('GET /api/tesoreria/resumen incluye saldos y centros de costo oficiales', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/resumen`, {
      headers: { Authorization: `Bearer ${tesoreraToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.saldoTotal > 0);
    assert.ok(body.data.saldoAsociacion > 0);
    assert.ok(body.data.saldoCenaAnual > 0);
    assert.strictEqual(body.data.centrosCosto.length, 4);
  });

  // 11. Correlativo atómico consecutivo sin colisiones
  await test('POST /api/tesoreria/movimientos genera correlativo atómico en orden', async () => {
    const res = await fetch(`${baseUrl}/tesoreria/movimientos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tesoreraToken}` },
      body: (() => {
        const form = new FormData();
        form.append('tipo', 'INGRESO');
        form.append('fecha', '2026-10-26');
        form.append('descripcion', 'Ingreso prueba correlativo');
        form.append('centroCosto', 'ASOCIACION');
        form.append('monto', '50000');
        form.append('metodo', 'Transferencia Bancaria');
        return form;
      })()
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.data.correlativo.startsWith('MOV-2026-'));
  });

  console.log(`\n[RESULTADOS] ${passed} pasados, ${failed} fallidos`);
  server.closeAllConnections?.();
  server.close();
  // Cerrar MySQL antes de salir: salir con process.exit y sockets abiertos rompe libuv en Windows
  await dbPool?.end().catch(() => {});
  fs.rmSync(uploadsDir, { recursive: true, force: true });
  process.exitCode = failed > 0 ? 1 : 0;
}

runTests();
