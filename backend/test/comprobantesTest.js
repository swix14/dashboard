import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Carpeta temporal para que las pruebas no ensucien backend/uploads
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtf-uploads-test-'));
process.env.UPLOADS_DIR = uploadsDir;

const { default: app } = await import('../src/server.js');

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

  const tesoreraToken = await login('tesorera@vtf.cl');
  const presidentaToken = await login('yerthie.sayago@vtf.cl');

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

  console.log(`\n[RESULTADOS] ${passed} pasados, ${failed} fallidos`);
  server.close();
  fs.rmSync(uploadsDir, { recursive: true, force: true });
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
