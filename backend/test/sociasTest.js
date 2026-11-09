import assert from 'node:assert';
import app from '../src/server.js';
import { pool as dbPool } from "../src/config/db.js";

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

  const secretariaToken = await login('secretaria@vtftemuco.cl');
  const directoraToken = await login('directora@vtftemuco.cl');
  const delegadaToken = await login('delegada@vtftemuco.cl');
  const auth = (token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

  // 1. Resumen del padrón coincide con la realidad institucional
  await test('GET /api/socias/resumen informa 280 socias (276 activas, 4 suspendidas)', async () => {
    const res = await fetch(`${baseUrl}/socias/resumen`, { headers: auth(secretariaToken) });
    assert.strictEqual(res.status, 200);
    const { data } = await res.json();
    assert.strictEqual(data.totalSocias, 280);
    assert.strictEqual(data.sociasActivas, 276);
    assert.strictEqual(data.sociasSuspendidas, 4);
    assert.strictEqual(data.totalJardines, 23);
    assert.strictEqual(data.recaudacionMensualEsperada, 276 * 4000);
  });

  // 2. Las socias suspendidas no generan cobro de cuota
  await test('GET /api/socias?estado=SUSPENDIDA devuelve cuota mensual 0', async () => {
    const res = await fetch(`${baseUrl}/socias?estado=SUSPENDIDA`, { headers: auth(secretariaToken) });
    const { data } = await res.json();
    assert.strictEqual(data.length, 4);
    assert.ok(data.every((s) => s.cuotaMensual === 0));
  });

  // 3. Filtro de crédito SI
  await test('GET /api/socias?credito=SI solo devuelve socias con crédito activo', async () => {
    const res = await fetch(`${baseUrl}/socias?credito=SI`, { headers: auth(secretariaToken) });
    const { data } = await res.json();
    assert.ok(data.length > 0);
    assert.ok(data.every((s) => s.tieneCredito && s.creditosActivos.length > 0));
  });

  // 4. Catálogo de jardines con una delegada por jardín
  await test('GET /api/socias/jardines devuelve 23 jardines, cada uno con delegada', async () => {
    const res = await fetch(`${baseUrl}/socias/jardines`, { headers: auth(directoraToken) });
    assert.strictEqual(res.status, 200);
    const { data } = await res.json();
    assert.strictEqual(data.length, 23);
    assert.ok(data.every((j) => j.delegada));
  });

  // 5. Delegada no puede ver el padrón (privacidad de deudas)
  await test('GET /api/socias denegado con 403 para Delegada', async () => {
    const res = await fetch(`${baseUrl}/socias`, { headers: auth(delegadaToken) });
    assert.strictEqual(res.status, 403);
  });

  // 6. Secretaria incorpora una socia con RUT válido
  let nuevaSociaId = '';
  await test('POST /api/socias Secretaria crea socia (201)', async () => {
    const res = await fetch(`${baseUrl}/socias`, {
      method: 'POST',
      headers: auth(secretariaToken),
      body: JSON.stringify({
        rut: '11111111-1',
        firstName: 'Socia',
        lastName: 'De Prueba',
        cargo: 'TECNICO',
        jardinId: 'jar-5'
      })
    });
    assert.strictEqual(res.status, 201);
    const { data } = await res.json();
    assert.strictEqual(data.rut, '11.111.111-1');
    assert.strictEqual(data.estado, 'ACTIVA');
    nuevaSociaId = data.id;
  });

  // 7. RUT duplicado rechazado
  await test('POST /api/socias con RUT duplicado retorna 409', async () => {
    const res = await fetch(`${baseUrl}/socias`, {
      method: 'POST',
      headers: auth(secretariaToken),
      body: JSON.stringify({
        rut: '11.111.111-1',
        firstName: 'Otra',
        lastName: 'Persona',
        cargo: 'TECNICO',
        jardinId: 'jar-5'
      })
    });
    assert.strictEqual(res.status, 409);
  });

  // 8. RUT inválido rechazado
  await test('POST /api/socias con RUT inválido retorna 400', async () => {
    const res = await fetch(`${baseUrl}/socias`, {
      method: 'POST',
      headers: auth(secretariaToken),
      body: JSON.stringify({
        rut: '11.111.111-2',
        firstName: 'Rut',
        lastName: 'Malo',
        cargo: 'TECNICO',
        jardinId: 'jar-5'
      })
    });
    assert.strictEqual(res.status, 400);
  });

  // 9. Directora solo puede ver (no modificar socias)
  await test('POST /api/socias denegado con 403 para Directora', async () => {
    const res = await fetch(`${baseUrl}/socias`, {
      method: 'POST',
      headers: auth(directoraToken),
      body: JSON.stringify({ rut: '22222222-2', firstName: 'X', lastName: 'Y', cargo: 'TECNICO', jardinId: 'jar-1' })
    });
    assert.strictEqual(res.status, 403);
  });

  // 10. Traslado de jardín sin motivo rechazado
  await test('PUT /api/socias/:id traslado sin motivo retorna 400', async () => {
    const res = await fetch(`${baseUrl}/socias/${nuevaSociaId}`, {
      method: 'PUT',
      headers: auth(secretariaToken),
      body: JSON.stringify({ jardinId: 'jar-6' })
    });
    assert.strictEqual(res.status, 400);
  });

  // 11. Traslado con motivo queda en el historial
  await test('PUT /api/socias/:id traslado con motivo registra historial', async () => {
    const res = await fetch(`${baseUrl}/socias/${nuevaSociaId}`, {
      method: 'PUT',
      headers: auth(secretariaToken),
      body: JSON.stringify({ jardinId: 'jar-6', motivoTraslado: 'Cambio de domicilio' })
    });
    assert.strictEqual(res.status, 200);
    const { data } = await res.json();
    assert.strictEqual(data.jardin.id, 'jar-6');
    assert.strictEqual(data.historialJardin.length, 1);
    assert.strictEqual(data.historialJardin[0].motivo, 'Cambio de domicilio');
  });

  // 12. Suspender socia deja su cuota en 0
  await test('PUT /api/socias/:id suspender deja cuota mensual en 0', async () => {
    const res = await fetch(`${baseUrl}/socias/${nuevaSociaId}`, {
      method: 'PUT',
      headers: auth(secretariaToken),
      body: JSON.stringify({ estado: 'SUSPENDIDA' })
    });
    const { data } = await res.json();
    assert.strictEqual(data.estado, 'SUSPENDIDA');
    assert.strictEqual(data.cuotaMensual, 0);
  });

  // 13. Socia inexistente
  await test('GET /api/socias/:id inexistente retorna 404', async () => {
    const res = await fetch(`${baseUrl}/socias/no-existe`, { headers: auth(secretariaToken) });
    assert.strictEqual(res.status, 404);
  });

  console.log(`\n[RESULTADOS] ${passed} pasados, ${failed} fallidos`);
  server.closeAllConnections?.();
  server.close();
  // Cerrar MySQL antes de salir: salir con process.exit y sockets abiertos rompe libuv en Windows
  await dbPool?.end().catch(() => {});
  process.exitCode = failed > 0 ? 1 : 0;
}

runTests();
