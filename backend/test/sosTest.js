/**
 * Pruebas de V5 — Solicitudes S.O.S en línea.
 * Una socia pide el S.O.S desde su portal y Admin o Tesorera lo aprueban (crea el crédito
 * S.O.S con sus cuotas) o lo rechazan con motivo.
 */
import assert from 'node:assert';
import bcrypt from 'bcryptjs';

const { default: app } = await import('../src/server.js');
const { pool: dbPool, query, waitForDatabase, isDatabaseReady } = await import('../src/config/db.js');

await waitForDatabase();
if (!isDatabaseReady()) {
  console.error('sosTest requiere MySQL: ejecútelo con "npm test".');
  process.exit(1);
}

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

async function call(method, url, token, body) {
  const res = await fetch(`${baseUrl}${url}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json() };
}

async function loginDirectiva(rut) {
  const { status, body } = await call('POST', '/auth/login', null, { identifier: rut, password: 'Admin123!' });
  assert.strictEqual(status, 200, `login ${rut}: ${body.message}`);
  return body.data.token;
}

// Dos socias activas sin créditos ni cuenta de directiva, con clave personal ya definida
const CLAVE_SOCIA = 'ClaveSocia2026!';
const socias = await query(
  `SELECT s.id, s.rut, s.nombres FROM socias s
   WHERE s.estado = 'ACTIVA' AND NOT EXISTS (SELECT 1 FROM creditos c WHERE c.socia_id = s.id)
     AND NOT EXISTS (SELECT 1 FROM administradores a WHERE a.rut = s.rut)
   ORDER BY s.id DESC LIMIT 2`
);
assert.strictEqual(socias.length, 2, 'se necesitan 2 socias activas sin créditos');
const hash = await bcrypt.hash(CLAVE_SOCIA, 10);
await query('UPDATE socias SET password = ?, primer_ingreso = 0 WHERE id IN (?, ?)', [hash, socias[0].id, socias[1].id]);

async function loginSocia(rut) {
  const { status, body } = await call('POST', '/socia/login', null, { rut, password: CLAVE_SOCIA });
  assert.strictEqual(status, 200, `login socia ${rut}: ${body.message}`);
  return body.data.token;
}

const [X, Y] = socias;
const SOCIA_X = await loginSocia(X.rut);
const SOCIA_Y = await loginSocia(Y.rut);
const TESORERA = await loginDirectiva('16.947.343-9');
const PRESIDENTA = await loginDirectiva('13.963.291-5');
const SECRETARIA = await loginDirectiva('11.354.669-7');

const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
const [anioHoy, mesHoy] = [Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7))];
const mesSiguiente = mesHoy === 12 ? `${anioHoy + 1}-01` : `${anioHoy}-${String(mesHoy + 1).padStart(2, '0')}`;
const mesPasado = mesHoy === 1 ? `${anioHoy - 1}-12` : `${anioHoy}-${String(mesHoy - 1).padStart(2, '0')}`;

const SOLICITUD = { monto: 90000, cuotas: 3, motivo: 'Gastos médicos urgentes de mi hijo' };

// ---------------------------------------------------------------------------
await test('Solo una socia puede pedir S.O.S; la directiva no usa ese endpoint', async () => {
  assert.strictEqual((await call('POST', '/socia/sos', null, SOLICITUD)).status, 401);
  assert.strictEqual((await call('POST', '/socia/sos', TESORERA, SOLICITUD)).status, 403);
});

await test('Todo es obligatorio: monto, cuotas de 1 a 4 y motivo', async () => {
  assert.strictEqual((await call('POST', '/socia/sos', SOCIA_X, { ...SOLICITUD, monto: undefined })).status, 400);
  assert.strictEqual((await call('POST', '/socia/sos', SOCIA_X, { ...SOLICITUD, cuotas: 5 })).status, 400);
  assert.strictEqual((await call('POST', '/socia/sos', SOCIA_X, { ...SOLICITUD, cuotas: 0 })).status, 400);
  assert.strictEqual((await call('POST', '/socia/sos', SOCIA_X, { ...SOLICITUD, motivo: '   ' })).status, 400);
  assert.strictEqual((await call('POST', '/socia/sos', SOCIA_X, { ...SOLICITUD, monto: 100001 })).status, 400);
});

let solicitudX;
await test('La socia envía su S.O.S con sus datos del padrón y queda pendiente', async () => {
  const res = await call('POST', '/socia/sos', SOCIA_X, SOLICITUD);
  assert.strictEqual(res.status, 201, res.body.message);
  solicitudX = res.body.data;
  assert.deepStrictEqual([solicitudX.sociaRut, solicitudX.estado, solicitudX.monto, solicitudX.cuotas], [X.rut, 'PENDIENTE', 90000, 3]);
  assert.ok(solicitudX.sociaNombre.includes(X.nombres.split(' ')[0]));
});

await test('Una segunda solicitud mientras la primera sigue pendiente se rechaza (409)', async () => {
  assert.strictEqual((await call('POST', '/socia/sos', SOCIA_X, SOLICITUD)).status, 409);
});

await test('Cada socia ve solo sus solicitudes', async () => {
  assert.strictEqual((await call('GET', '/socia/sos', SOCIA_X)).body.data.length, 1);
  assert.strictEqual((await call('GET', '/socia/sos', SOCIA_Y)).body.data.length, 0);
});

await test('La bandeja la ven Tesorera y Presidenta (con el conteo de pendientes); la Secretaria no', async () => {
  const res = await call('GET', '/creditos/sos?estado=PENDIENTE', TESORERA);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.pendientes >= 1);
  assert.ok(res.body.data.some((s) => s.id === solicitudX.id));
  assert.strictEqual((await call('GET', '/creditos/sos', PRESIDENTA)).status, 200);
  assert.strictEqual((await call('GET', '/creditos/sos', SECRETARIA)).status, 403);
});

await test('La Presidenta no puede aprobar ni rechazar (solo lectura)', async () => {
  assert.strictEqual((await call('POST', `/creditos/sos/${solicitudX.id}/aprobar`, PRESIDENTA, { valorCuota: 30000, primeraCuota: mesSiguiente })).status, 403);
  assert.strictEqual((await call('POST', `/creditos/sos/${solicitudX.id}/rechazar`, PRESIDENTA, { motivo: 'No' })).status, 403);
});

await test('Aprobar valida el mes de la primera cuota', async () => {
  const res = await call('POST', `/creditos/sos/${solicitudX.id}/aprobar`, TESORERA, { valorCuota: 30000, primeraCuota: mesPasado });
  assert.strictEqual(res.status, 400);
});

await test('Aprobar rechaza cuotas que suman más del tope de $100.000', async () => {
  const res = await call('POST', `/creditos/sos/${solicitudX.id}/aprobar`, TESORERA, { valorCuota: 40000, primeraCuota: mesSiguiente });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /no puede pasar de \$100\.000/);
});

await test('Aprobar crea el crédito S.O.S con sus cuotas y la socia ve la respuesta', async () => {
  const res = await call('POST', `/creditos/sos/${solicitudX.id}/aprobar`, TESORERA, { valorCuota: 30000, primeraCuota: mesSiguiente, respuesta: 'Transferencia el viernes' });
  assert.strictEqual(res.status, 200, res.body.message);
  const [credito] = await query(
    `SELECT c.monto_total, c.monto_cuota, c.total_cuotas, c.estado, c.origen, cv.codigo FROM creditos c
     JOIN convenios cv ON cv.id = c.convenio_id WHERE c.id = ?`,
    [res.body.data.creditoId]
  );
  assert.deepStrictEqual(
    [credito.codigo, credito.monto_total, credito.monto_cuota, credito.total_cuotas, credito.estado, credito.origen],
    ['SOS', 90000, 30000, 3, 'vigente', 'MANUAL']
  );
  const cuotas = await query(`SELECT estado FROM cuotas_credito WHERE credito_id = ?`, [res.body.data.creditoId]);
  assert.deepStrictEqual(cuotas.map((q) => q.estado), ['pendiente', 'pendiente', 'pendiente']);

  const [mia] = (await call('GET', '/socia/sos', SOCIA_X)).body.data;
  assert.deepStrictEqual([mia.estado, mia.respuesta, mia.creditoId], ['APROBADA', 'Transferencia el viernes', res.body.data.creditoId]);
  // Ya revisada: no se puede aprobar ni rechazar de nuevo
  assert.strictEqual((await call('POST', `/creditos/sos/${solicitudX.id}/rechazar`, TESORERA, { motivo: 'Duplicado' })).status, 409);
});

await test('Rechazar exige motivo y la socia puede volver a pedir', async () => {
  const sol = (await call('POST', '/socia/sos', SOCIA_Y, { monto: 50000, cuotas: 1, motivo: 'Reparación de mi vivienda' })).body.data;
  assert.strictEqual((await call('POST', `/creditos/sos/${sol.id}/rechazar`, TESORERA, {})).status, 400);
  const res = await call('POST', `/creditos/sos/${sol.id}/rechazar`, TESORERA, { motivo: 'Fondo sin saldo este mes' });
  assert.strictEqual(res.status, 200, res.body.message);
  const [mia] = (await call('GET', '/socia/sos', SOCIA_Y)).body.data;
  assert.deepStrictEqual([mia.estado, mia.respuesta], ['RECHAZADA', 'Fondo sin saldo este mes']);
  assert.strictEqual((await call('POST', '/socia/sos', SOCIA_Y, { monto: 30000, cuotas: 2, motivo: 'Reparación de mi vivienda' })).status, 201);
});

await test('Envíos y revisiones quedan en la auditoría', async () => {
  const [{ n }] = await query(`SELECT COUNT(*) AS n FROM auditoria WHERE accion IN ('SOS_SOLICITADO', 'SOS_APROBADO', 'SOS_RECHAZADO')`);
  assert.ok(Number(n) >= 5, `se esperaban al menos 5 registros y hay ${n}`);
});

console.log(`\n[RESULTADOS S.O.S] ${passed} pasados, ${failed} fallidos`);
server.closeAllConnections?.();
server.close();
await dbPool?.end().catch(() => {});
process.exitCode = failed > 0 ? 1 : 0;
