/**
 * Pruebas de los bloqueantes de despliegue (09-11-2026):
 *  - Login con el dominio oficial @vtftemuco.cl
 *  - Solo el correo exacto @vtftemuco.cl o el RUT: sin otros dominios ni alias
 *  - Cambio de contraseña de la directiva con política mínima
 *  - En producción, sin MySQL, la API responde 503 en vez de datos de memoria
 *
 * Se ejecuta en modo memoria (MySQL apuntando a un puerto cerrado) para no depender de la base local.
 */
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';
process.env.DB_PORT = '1';
process.env.DB_HOST = '127.0.0.1';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { default: app } = await import('../src/server.js');
const { validatePasswordPolicy } = await import('../src/services/authService.js');

const server = app.listen(0);
const baseUrl = `http://localhost:${server.address().port}/api`;

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    Error: ${err.message}`);
    failed++;
  }
}

const post = async (url, body, token) => {
  const res = await fetch(`${baseUrl}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.json() };
};

await test('POST /api/auth/login acepta tesorera@vtftemuco.cl', async () => {
  const { status, body } = await post('/auth/login', { identifier: 'tesorera@vtftemuco.cl', password: 'Admin123!' });
  assert.strictEqual(status, 200);
  assert.strictEqual(body.data.user.role.code, 'TESORERA');
});

await test('POST /api/auth/login acepta presidenta@vtftemuco.cl', async () => {
  const { status, body } = await post('/auth/login', { identifier: 'presidenta@vtftemuco.cl', password: 'Admin123!' });
  assert.strictEqual(status, 200);
  assert.strictEqual(body.data.user.role.code, 'PRESIDENTA');
});

for (const variante of [
  'tesorera@gmail.com',
  'tesorera@vtf.cl',
  'tesorera@asociacionvtf.cl',
  'tesoreria@vtftemuco.cl',
  'alejandra.sias@vtftemuco.cl'
]) {
  await test(`POST /api/auth/login rechaza la variante ${variante}`, async () => {
    const { status } = await post('/auth/login', { identifier: variante, password: 'Admin123!' });
    assert.strictEqual(status, 401);
  });
}

await test('POST /api/auth/login acepta el RUT con o sin puntos', async () => {
  for (const rut of ['13.918.472-6', '139184726']) {
    const { status } = await post('/auth/login', { identifier: rut, password: 'Admin123!' });
    assert.strictEqual(status, 200, rut);
  }
});

await test('validatePasswordPolicy rechaza claves cortas, sin números, la inicial y el RUT', async () => {
  assert.ok(validatePasswordPolicy('abc12', '16.947.343-9'));
  assert.ok(validatePasswordPolicy('soloLetrasLargas', '16.947.343-9'));
  assert.ok(validatePasswordPolicy('Admin123!', '16.947.343-9'));
  assert.ok(validatePasswordPolicy('16.947.343-9', '16.947.343-9'));
  assert.strictEqual(validatePasswordPolicy('Tesoreria2026', '16.947.343-9'), null);
});

await test('POST /api/auth/cambiar-clave exige la clave actual y luego permite entrar con la nueva', async () => {
  const login = await post('/auth/login', { identifier: 'secretaria@vtftemuco.cl', password: 'Admin123!' });
  const token = login.body.data.token;

  const wrong = await post('/auth/cambiar-clave', { currentPassword: 'otra', newPassword: 'Secretaria2026' }, token);
  assert.strictEqual(wrong.status, 400);

  const weak = await post('/auth/cambiar-clave', { currentPassword: 'Admin123!', newPassword: 'corta' }, token);
  assert.strictEqual(weak.status, 400);

  const ok = await post('/auth/cambiar-clave', { currentPassword: 'Admin123!', newPassword: 'Secretaria2026' }, token);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.data.user.mustChangePassword, false);

  const oldPass = await post('/auth/login', { identifier: 'secretaria@vtftemuco.cl', password: 'Admin123!' });
  assert.strictEqual(oldPass.status, 401);
  const newPass = await post('/auth/login', { identifier: 'secretaria@vtftemuco.cl', password: 'Secretaria2026' });
  assert.strictEqual(newPass.status, 200);
});

await test('GET /api/health informa el estado de la base de datos', async () => {
  const res = await fetch(`${baseUrl}/health`);
  const body = await res.json();
  assert.strictEqual(body.database.conectada, false);
  assert.ok(body.database.error);
});

// Proceso aparte en modo producción: sin MySQL nunca debe responder con datos de memoria
await test('En producción sin MySQL: health avisa y el login responde 503', async () => {
  const port = 40000 + Math.floor(Math.random() * 10000);
  const child = spawn(process.execPath, ['app.cjs'], {
    cwd: backendRoot,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), DB_HOST: '127.0.0.1', DB_PORT: '1', JWT_SECRET: 'x'.repeat(40) },
    stdio: 'ignore'
  });
  try {
    const prodUrl = `http://127.0.0.1:${port}/api`;
    let health = null;
    for (let i = 0; i < 50 && !health; i++) {
      await new Promise((r) => setTimeout(r, 200));
      health = await fetch(`${prodUrl}/health`).then((r) => r.json()).catch(() => null);
    }
    assert.ok(health, 'el servidor de producción no arrancó');
    assert.strictEqual(health.database.conectada, false);

    const res = await fetch(`${prodUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'tesorera@vtftemuco.cl', password: 'Admin123!' })
    });
    assert.strictEqual(res.status, 503);
    assert.strictEqual((await res.json()).code, 'DATABASE_UNAVAILABLE');
  } finally {
    child.kill();
  }
});

// La clave JWT por defecto está en el repositorio: en producción la app no debe arrancar con ella
await test('En producción sin JWT_SECRET propio la app no arranca', async () => {
  for (const secret of ['', 'vtf-gestion-super-secret-key-2026-production-ready']) {
    const port = 40000 + Math.floor(Math.random() * 10000);
    const child = spawn(process.execPath, ['app.cjs'], {
      cwd: backendRoot,
      // JWT_SECRET definido (aunque vacío) impide que dotenv lo tome del .env local
      env: { ...process.env, NODE_ENV: 'production', PORT: String(port), DB_HOST: '127.0.0.1', DB_PORT: '1', JWT_SECRET: secret },
      stdio: 'ignore'
    });
    const code = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill();
        resolve('sigue corriendo');
      }, 8000);
      child.on('exit', (c) => {
        clearTimeout(timer);
        resolve(c);
      });
    });
    assert.notStrictEqual(code, 0, `con JWT_SECRET="${secret}" la app debía negarse a arrancar`);
    assert.notStrictEqual(code, 'sigue corriendo', `con JWT_SECRET="${secret}" la app arrancó igual`);
  }
});

// Fechas en hora de Chile: a las 23:30 del 9 de noviembre en Chile (02:30 UTC del día 10)
await test('hoyChile usa la fecha de Chile, no la de UTC', async () => {
  const { hoyChile } = await import('../src/utils/fecha.js');
  assert.strictEqual(hoyChile(new Date('2026-11-10T02:30:00Z')), '2026-11-09');
  assert.strictEqual(hoyChile(new Date('2026-11-10T12:00:00Z')), '2026-11-10');
});

console.log(`\n[RESULTADOS BLOQUEANTES] ${passed} pasados, ${failed} fallidos`);
server.closeAllConnections?.();
server.close();
process.exitCode = failed > 0 ? 1 : 0;
