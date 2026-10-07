import assert from 'node:assert';
import app from '../src/server.js';

// Servidor de pruebas en puerto efímero
const server = app.listen(0);
const port = server.address().port;
const baseUrl = `http://localhost:${port}/api`;

console.log(`[TEST] Servidor de prueba iniciado en ${baseUrl}`);

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

  // 1. Healthcheck
  await test('GET /api/health retorna 200 y status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
  });

  // 2. Login con credenciales inválidas
  await test('POST /api/auth/login con credenciales erróneas retorna 401', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'tesorera@vtf.cl', password: 'PasswordIncorrecta' })
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  // 3. Login exitoso de Tesorera por email
  let tesoreraToken = '';
  await test('POST /api/auth/login Tesorera exitoso con JWT retornado', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'tesorera@vtf.cl', password: 'Admin123!' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.token);
    assert.strictEqual(body.data.user.role.code, 'TESORERA');
    tesoreraToken = body.data.token;
  });

  // 4. Login exitoso de Delegada por RUT
  let delegadaToken = '';
  await test('POST /api/auth/login Delegada por RUT exitoso', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '17.890.123-1', password: 'Admin123!' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.role.code, 'DELEGADA');
    delegadaToken = body.data.token;
  });

  // 5. GET /api/auth/me con token válido
  await test('GET /api/auth/me retorna datos de usuario autenticado', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${tesoreraToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.user.role.code, 'TESORERA');
  });

  // 6. GET /api/dashboard/metrics para Tesorera (incluye métricas de directiva)
  await test('GET /api/dashboard/metrics Tesorera contiene nivel de acceso directo', async () => {
    const res = await fetch(`${baseUrl}/dashboard/metrics`, {
      headers: { Authorization: `Bearer ${tesoreraToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.nivelAcceso, 'DIRECTIVA_ADMINISTRATIVA');
    assert.strictEqual(body.data.puedeGestionarFinanzas, true);
  });

  // 7. GET /api/dashboard/audit-recent permitido para Tesorera
  await test('GET /api/dashboard/audit-recent permitido para Tesorera (200)', async () => {
    const res = await fetch(`${baseUrl}/dashboard/audit-recent`, {
      headers: { Authorization: `Bearer ${tesoreraToken}` }
    });
    assert.strictEqual(res.status, 200);
  });

  // 8. GET /api/dashboard/audit-recent denegado para Delegada (403 Forbidden)
  await test('GET /api/dashboard/audit-recent denegado con 403 para Delegada', async () => {
    const res = await fetch(`${baseUrl}/dashboard/audit-recent`, {
      headers: { Authorization: `Bearer ${delegadaToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  console.log(`\n[RESULTADOS] ${passed} pasados, ${failed} fallidos`);
  server.close();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
