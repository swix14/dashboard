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

  const tesoreraToken = await login('tesorera@vtf.cl');

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

  console.log(`\n[RESULTADOS PERSISTENCIA] ${passed} pasados, ${failed} fallidos`);
  server.close();
  // Cerrar MySQL antes de salir: process.exit con sockets abiertos rompe libuv en Windows
  await dbPool?.end().catch(() => {});
  fs.rmSync(uploadsDir, { recursive: true, force: true });
  process.exit(failed > 0 ? 1 : 0);
}

runPersistenceSuite();

