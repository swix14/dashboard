/**
 * Pruebas del padrón de socias (V3, 100% MySQL).
 * Corre sobre la base de prueba creada por test/run.js con el padrón real de data.sql
 * (277 socias, 23 jardines, 8 sin jardín y 22 con cargo SIN DATO).
 */
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { default: app } = await import('../src/server.js');
const { pool: dbPool, query, waitForDatabase, isDatabaseReady } = await import('../src/config/db.js');

await waitForDatabase();
if (!isDatabaseReady()) {
  console.error('sociasTest requiere MySQL: ejecútelo con "npm test" (crea la base de prueba).');
  process.exit(1);
}

const server = app.listen(0);
const baseUrl = `http://localhost:${server.address().port}/api`;
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

async function login(identifier) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: 'Admin123!' })
  });
  return (await res.json()).data.token;
}

const secretaria = await login('11.354.669-7');
const directora = await login('20.081.109-7');
const delegada = await login('17.890.123-1');
const tesorera = await login('16.947.343-9');
const headers = (token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
const api = async (method, url, token, body) => {
  const res = await fetch(`${baseUrl}${url}`, { method, headers: headers(token), body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
};

// RUT válido que no está en el padrón (cuerpo 11.111.112 -> DV calculado)
const RUT_NUEVA = '11.111.112-K';

await test('GET /api/socias/resumen refleja el padrón real de MySQL', async () => {
  const { status, body } = await api('GET', '/socias/resumen', tesorera);
  assert.strictEqual(status, 200);
  const d = body.data;
  assert.strictEqual(d.totalSocias, 277);
  assert.strictEqual(d.sociasActivas, 277);
  assert.strictEqual(d.sociasSuspendidas, 0);
  assert.strictEqual(d.totalJardines, 23);
  assert.strictEqual(d.sociasSinJardin, 8);
  assert.strictEqual(d.sociasSinCargo, 22);
  const [{ n }] = await query(
    "SELECT COUNT(DISTINCT socia_id) AS n FROM creditos WHERE estado = 'vigente'"
  );
  assert.strictEqual(d.sociasConCredito, Number(n));
  assert.strictEqual(d.valorCuotaMensual, 4000);
});

await test('GET /api/socias pagina en el servidor (20 por página, total 277)', async () => {
  const p1 = await api('GET', '/socias?page=1&limit=20', secretaria);
  const p2 = await api('GET', '/socias?page=2&limit=20', secretaria);
  assert.strictEqual(p1.body.total, 277);
  assert.strictEqual(p1.body.data.length, 20);
  assert.notStrictEqual(p1.body.data[0].id, p2.body.data[0].id);
});

await test('GET /api/socias?limit=0 devuelve el padrón completo (exportación)', async () => {
  const { body } = await api('GET', '/socias?limit=0', secretaria);
  assert.strictEqual(body.data.length, 277);
});

await test('Búsqueda por RUT con o sin puntos y por nombre de jardín', async () => {
  const conPuntos = await api('GET', `/socias?search=${encodeURIComponent('20.081.109')}`, secretaria);
  const sinPuntos = await api('GET', '/socias?search=20081109', secretaria);
  assert.strictEqual(conPuntos.body.data[0]?.rut, '20.081.109-7');
  assert.strictEqual(sinPuntos.body.data[0]?.rut, '20.081.109-7');
  const jardin = await api('GET', `/socias?search=${encodeURIComponent('Los Físicos')}&limit=0`, secretaria);
  assert.strictEqual(jardin.body.total, 20);
});

await test('Filtros por jardín, cargo, crédito y "sin jardín"', async () => {
  const sinJardin = await api('GET', '/socias?jardinId=SIN_JARDIN&limit=0', secretaria);
  assert.strictEqual(sinJardin.body.total, 8);
  const asist = await api('GET', '/socias?cargo=ASISTENTE&limit=0', secretaria);
  assert.ok(asist.body.data.every((s) => s.cargo === 'ASISTENTE'));
  const conCredito = await api('GET', '/socias?credito=SI&limit=0', tesorera);
  assert.ok(conCredito.body.data.length > 0 && conCredito.body.data.every((s) => s.tieneCredito));
  const sinCredito = await api('GET', '/socias?credito=NO&limit=0', tesorera);
  assert.strictEqual(conCredito.body.total + sinCredito.body.total, 277);
});

await test('GET /api/socias/jardines devuelve los 23 jardines con conteos', async () => {
  const { body } = await api('GET', '/socias/jardines', secretaria);
  assert.strictEqual(body.data.length, 23);
  assert.strictEqual(body.data.find((j) => j.name === 'Los Físicos').totalSocias, 20);
});

await test('GET /api/socias denegado con 403 para Delegada', async () => {
  const { status } = await api('GET', '/socias', delegada);
  assert.strictEqual(status, 403);
});

let nuevaId = null;
await test('POST /api/socias crea la socia en MySQL con datos normalizados', async () => {
  const { status, body } = await api('POST', '/socias', secretaria, {
    rut: '11111112k',
    nombres: '  maría   josé ',
    apellidoPaterno: 'pérez',
    apellidoMaterno: 'soto',
    cargo: 'ASISTENTE',
    jardinId: 8,
    celular: '9 1234 5678',
    correo: 'Maria.Perez@Example.cl'
  });
  assert.strictEqual(status, 201, body.message);
  nuevaId = body.data.id;
  assert.strictEqual(body.data.rut, RUT_NUEVA);
  assert.strictEqual(body.data.nombres, 'MARÍA JOSÉ');
  assert.strictEqual(body.data.estado, 'ACTIVA');
  assert.strictEqual(body.data.celular, '+56912345678');
  assert.strictEqual(body.data.correo, 'maria.perez@example.cl');
  assert.strictEqual(body.data.jardin.name, 'Los Físicos');
});

await test('La socia creada persiste tras reiniciar el backend (otro proceso)', async () => {
  // Proceso nuevo = sin estado en memoria: solo puede verla si quedó en MySQL
  const port = 41000 + Math.floor(Math.random() * 8000);
  const child = spawn(process.execPath, ['app.cjs'], {
    cwd: backendRoot,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development' },
    stdio: 'ignore'
  });
  try {
    const url = `http://127.0.0.1:${port}/api`;
    let ok = false;
    for (let i = 0; i < 50 && !ok; i++) {
      await new Promise((r) => setTimeout(r, 200));
      ok = await fetch(`${url}/health`).then((r) => r.ok).catch(() => false);
    }
    assert.ok(ok, 'el segundo backend no arrancó');
    const loginRes = await fetch(`${url}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '11.354.669-7', password: 'Admin123!' })
    });
    const token = (await loginRes.json()).data.token;
    const res = await fetch(`${url}/socias/${nuevaId}`, { headers: headers(token) });
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).data.rut, RUT_NUEVA);
  } finally {
    child.kill();
  }
});

await test('POST /api/socias con RUT duplicado (con otro formato) retorna 409', async () => {
  const { status } = await api('POST', '/socias', secretaria, {
    rut: '11.111.112-k',
    nombres: 'Otra',
    apellidoPaterno: 'Persona',
    cargo: 'EDUCADORA',
    jardinId: 1
  });
  assert.strictEqual(status, 409);
});

await test('POST /api/socias valida RUT, celular y jardín', async () => {
  const base = { nombres: 'Ana', apellidoPaterno: 'Rojas', cargo: 'EDUCADORA', jardinId: 1 };
  assert.strictEqual((await api('POST', '/socias', secretaria, { ...base, rut: '12.345.678-0' })).status, 400);
  assert.strictEqual((await api('POST', '/socias', secretaria, { ...base, rut: '11.111.113-8', celular: '123' })).status, 400);
  assert.strictEqual((await api('POST', '/socias', secretaria, { ...base, rut: '11.111.113-8', jardinId: 999 })).status, 400);
});

// Desde el 16-11-2026 la Directora tiene los permisos de la Secretaria: pasa la autorización
// (un jardín inexistente da 400 de validación, no 403, y así no se altera el padrón de prueba)
await test('POST /api/socias permitido para Directora (mismos permisos que la Secretaria)', async () => {
  const { status } = await api('POST', '/socias', directora, {
    rut: '11.111.113-8',
    nombres: 'Ana',
    apellidoPaterno: 'Rojas',
    cargo: 'EDUCADORA',
    jardinId: 999
  });
  assert.strictEqual(status, 400);
});

// La Secretaria (y la Directora) ven solo la ficha personal: el backend no les envía créditos
await test('Secretaria no recibe datos de créditos en resumen, listado ni ficha', async () => {
  const resumen = await api('GET', '/socias/resumen', secretaria);
  assert.strictEqual(resumen.status, 200);
  assert.strictEqual(resumen.body.data.sociasConCredito, undefined);
  assert.strictEqual(resumen.body.data.saldoCreditosPendiente, undefined);

  // El filtro por crédito se ignora: devuelve el padrón completo y sin la columna de crédito
  const lista = await api('GET', '/socias?credito=SI&limit=0', secretaria);
  const todas = await api('GET', '/socias?limit=0', tesorera);
  assert.strictEqual(lista.body.total, todas.body.total);
  assert.ok(lista.body.data.every((s) => s.tieneCredito === undefined && s.creditosActivos === undefined));

  const conCredito = await api('GET', '/socias?credito=SI&limit=1', tesorera);
  const id = conCredito.body.data[0].id;
  const fichaSecretaria = await api('GET', `/socias/${id}`, secretaria);
  assert.strictEqual(fichaSecretaria.body.data.creditos, undefined);
  assert.strictEqual(fichaSecretaria.body.data.descuentoMensualCreditos, undefined);
  const fichaDirectora = await api('GET', `/socias/${id}`, directora);
  assert.strictEqual(fichaDirectora.body.data.creditos, undefined);
  const fichaTesorera = await api('GET', `/socias/${id}`, tesorera);
  assert.ok(Array.isArray(fichaTesorera.body.data.creditos) && fichaTesorera.body.data.creditos.length > 0);
});

await test('PUT traslado sin motivo retorna 400 y no altera ningún dato (transaccional)', async () => {
  const antes = await api('GET', `/socias/${nuevaId}`, secretaria);
  const { status } = await api('PUT', `/socias/${nuevaId}`, secretaria, { jardinId: 3, cargo: 'EDUCADORA' });
  assert.strictEqual(status, 400);
  const despues = await api('GET', `/socias/${nuevaId}`, secretaria);
  assert.strictEqual(despues.body.data.jardin.id, antes.body.data.jardin.id);
  assert.strictEqual(despues.body.data.cargo, 'ASISTENTE');
  assert.strictEqual(despues.body.data.historialJardin.length, 0);
});

await test('PUT traslado con motivo registra el historial', async () => {
  const { status, body } = await api('PUT', `/socias/${nuevaId}`, secretaria, {
    jardinId: 3,
    motivoTraslado: 'Reubicación por cierre de sala'
  });
  assert.strictEqual(status, 200);
  assert.strictEqual(body.data.jardin.name, 'Cerro Ñielol');
  assert.strictEqual(body.data.historialJardin.length, 1);
  assert.strictEqual(body.data.historialJardin[0].jardinAnterior, 'Los Físicos');
  assert.strictEqual(body.data.historialJardin[0].motivo, 'Reubicación por cierre de sala');
});

// La pantalla reenvía esDelegada: true sin tocar; aun así la marca no viaja al jardín nuevo
await test('PUT traslado de una delegada le quita la marca aunque el formulario la envíe', async () => {
  const marcada = await api('PUT', `/socias/${nuevaId}`, secretaria, { esDelegada: true });
  assert.strictEqual(marcada.body.data.esDelegada, true);
  const antes = marcada.body.data.jardin.id;
  const { status, body } = await api('PUT', `/socias/${nuevaId}`, secretaria, {
    jardinId: antes === 1 ? 2 : 1,
    esDelegada: true,
    motivoTraslado: 'Traslado de prueba de delegada'
  });
  assert.strictEqual(status, 200);
  assert.strictEqual(body.data.esDelegada, false);
});

await test('PUT suspender deja la cuota en 0 y la socia sale de las activas', async () => {
  const { body } = await api('PUT', `/socias/${nuevaId}`, secretaria, { estado: 'SUSPENDIDA' });
  assert.strictEqual(body.data.cuotaMensual, 0);
  const resumen = await api('GET', '/socias/resumen', secretaria);
  assert.strictEqual(resumen.body.data.sociasSuspendidas, 1);
});

await test('DELETE retira (baja lógica): no aparece ni cuenta, pero conserva créditos', async () => {
  // Socia real con créditos en data.sql
  const [conCredito] = await query(
    "SELECT s.id, COUNT(c.id) AS creditos FROM socias s JOIN creditos c ON c.socia_id = s.id GROUP BY s.id LIMIT 1"
  );
  const sinMotivo = await fetch(`${baseUrl}/socias/${conCredito.id}`, { method: 'DELETE', headers: headers(secretaria), body: '{}' });
  assert.strictEqual(sinMotivo.status, 400);

  const { status, body } = await api('DELETE', `/socias/${conCredito.id}`, secretaria, { motivo: 'Renuncia voluntaria' });
  assert.strictEqual(status, 200);
  assert.strictEqual(body.data.estado, 'RETIRADA');
  assert.strictEqual(body.data.creditos.length, Number(conCredito.creditos));

  const lista = await api('GET', '/socias?limit=0', secretaria);
  assert.ok(!lista.body.data.some((s) => s.id === conCredito.id));
  const retiradas = await api('GET', '/socias?estado=RETIRADA', secretaria);
  assert.ok(retiradas.body.data.some((s) => s.id === conCredito.id));

  // Reactivar desde la edición
  const react = await api('PUT', `/socias/${conCredito.id}`, secretaria, { estado: 'ACTIVA' });
  assert.strictEqual(react.body.data.estado, 'ACTIVA');
  assert.strictEqual(react.body.data.motivoRetiro, null);
});

await test('El borrado físico de una socia con créditos está bloqueado en la base', async () => {
  const [conCredito] = await query('SELECT socia_id FROM creditos LIMIT 1');
  await assert.rejects(() => query('DELETE FROM socias WHERE id = ?', [conCredito.socia_id]));
});

await test('Socia suspendida no puede entrar al portal ni usar un token previo', async () => {
  const rut = '20.081.109-7';
  const loginOk = await fetch(`${baseUrl}/socia/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rut, password: '200811' })
  });
  const token = (await loginOk.json()).data.token;
  await query("UPDATE socias SET estado = 'SUSPENDIDA' WHERE rut = ?", [rut]);
  try {
    const login = await fetch(`${baseUrl}/socia/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut, password: '200811' })
    });
    assert.strictEqual(login.status, 401);
    const usoToken = await fetch(`${baseUrl}/socia/buzon/mis-mensajes`, { headers: { Authorization: `Bearer ${token}` } });
    assert.ok([401, 403].includes(usoToken.status), `status ${usoToken.status}`);
  } finally {
    await query("UPDATE socias SET estado = 'ACTIVA' WHERE rut = ?", [rut]);
  }
});

await test('GET /api/socias/:id inexistente retorna 404 y un id no numérico 400', async () => {
  assert.strictEqual((await api('GET', '/socias/999999', secretaria)).status, 404);
  // Auditoría H-019: el id se valida antes de llegar a la base
  assert.strictEqual((await api('GET', '/socias/abc', secretaria)).status, 400);
});

console.log(`\n[RESULTADOS] ${passed} pasados, ${failed} fallidos`);
server.closeAllConnections?.();
server.close();
await dbPool?.end().catch(() => {});
process.exitCode = failed > 0 ? 1 : 0;
