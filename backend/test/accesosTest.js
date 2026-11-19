/**
 * Matriz de accesos por rol (pedido de la directiva, 16-11-2026) y verificación antes de desplegar:
 *  - Login de la directiva solo por RUT; RUT de socias con letras rechazado
 *  - Secretaria y Directora: sin Tesorería ni auditoría; Inicio sin secciones financieras
 *  - Noticias y buzón: Admin, Presidenta, Secretaria y Directora (Tesorera y Delegada no)
 *  - Informe mensual: toda la directiva y las delegadas; socias no
 */
import assert from 'node:assert';

const { default: app } = await import('../src/server.js');
const { pool: dbPool, query } = await import('../src/config/db.js');

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
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, body: type.includes('json') ? await res.json() : await res.arrayBuffer() };
}

async function login(rut) {
  const { status, body } = await call('POST', '/auth/login', null, { identifier: rut, password: 'Admin123!' });
  assert.strictEqual(status, 200, `login ${rut}: ${body.message}`);
  return body.data.token;
}

// RUTs de admin.sql (base de pruebas)
const tokens = {
  ADMIN: await login('17.260.651-2'),
  PRESIDENTA: await login('13.963.291-5'),
  TESORERA: await login('16.947.343-9'),
  SECRETARIA: await login('11.354.669-7'),
  DIRECTORA: await login('20.081.109-7'),
  DELEGADA: await login('17.890.123-1')
};

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
await test('Login de la directiva con correo institucional se rechaza (solo RUT)', async () => {
  const { status, body } = await call('POST', '/auth/login', null, { identifier: 'tesorera@vtftemuco.cl', password: 'Admin123!' });
  assert.strictEqual(status, 401);
  assert.match(body.message, /RUT/);
});

// Auditoría H-015: el portal no revela quién está en el padrón ni cómo es la clave inicial
await test('Login de socia responde igual con RUT fuera del padrón y con clave incorrecta', async () => {
  const fuera = await call('POST', '/socia/login', null, { rut: '12.345.678-5', password: '123456' });
  const claveMala = await call('POST', '/socia/login', null, { rut: '12.930.893-1', password: '000000' });
  assert.strictEqual(fuera.status, 401);
  assert.strictEqual(claveMala.status, 401);
  assert.strictEqual(fuera.body.message, claveMala.body.message);
  assert.doesNotMatch(claveMala.body.message, /6 dígitos|padrón/i);
});

await test('Login de socia con letras en el RUT se rechaza', async () => {
  const { status } = await call('POST', '/socia/login', null, { rut: '20.081.1O9-7', password: '200811' });
  assert.strictEqual(status, 401);
});

// ---------------------------------------------------------------------------
// Matriz endpoint × rol (status esperado)
// ---------------------------------------------------------------------------
const MATRIZ = [
  // [descripción, método, url, roles permitidos]
  ['Resumen de Tesorería', 'GET', '/tesoreria/resumen', ['ADMIN', 'PRESIDENTA', 'TESORERA']],
  ['Movimientos de Tesorería', 'GET', '/tesoreria/movimientos', ['ADMIN', 'PRESIDENTA', 'TESORERA']],
  ['Auditoría reciente', 'GET', '/dashboard/audit-recent', ['ADMIN', 'PRESIDENTA', 'TESORERA']],
  ['Padrón de socias', 'GET', '/socias?limit=1', ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA']],
  ['Buzón de la directiva', 'GET', '/socia/buzon/admin', ['ADMIN', 'PRESIDENTA', 'SECRETARIA', 'DIRECTORA']],
  ['Informe mensual', 'GET', '/reportes/mensual?anio=2026&mes=10', ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA', 'DELEGADA']],
  ['Balance Anual en PDF', 'GET', '/reportes/anual/pdf?anio=2026', ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA', 'DELEGADA']],
  // La cuenta DELEGADA de la consola no ve los demás jardines (D2)
  ['Cifras por jardín', 'GET', '/reportes/jardines', ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA']]
];

for (const [descripcion, method, url, permitidos] of MATRIZ) {
  await test(`Matriz: ${descripcion} (${permitidos.join(', ')})`, async () => {
    for (const [rol, token] of Object.entries(tokens)) {
      const { status } = await call(method, url, token);
      const esperado = permitidos.includes(rol) ? 200 : 403;
      assert.strictEqual(status, esperado, `${rol} recibió ${status} (esperado ${esperado})`);
    }
  });
}

await test('Sin sesión, los endpoints protegidos responden 401', async () => {
  for (const url of ['/tesoreria/resumen', '/socias', '/socia/buzon/admin', '/reportes/mensual']) {
    assert.strictEqual((await call('GET', url)).status, 401, url);
  }
});

// ---------------------------------------------------------------------------
// Inicio por rol
// ---------------------------------------------------------------------------
await test('Inicio de Secretaria y Directora sin saldos, pagos a Federación, tareas, alertas ni recaudación', async () => {
  for (const rol of ['SECRETARIA', 'DIRECTORA']) {
    const { body } = await call('GET', '/dashboard/metrics', tokens[rol]);
    const d = body.data;
    assert.strictEqual(d.secciones.finanzas, false, rol);
    assert.strictEqual(d.fondoComunSaldo, undefined, rol);
    assert.strictEqual(d.inicio.saldoTotal, undefined, rol);
    assert.strictEqual(d.inicio.ultimosPagosFederacion, undefined, rol);
    assert.strictEqual(d.inicio.proximasTareas, undefined, rol);
    assert.strictEqual(d.inicio.alertas, undefined, rol);
    assert.strictEqual(d.inicio.graficos.recaudacionMensual, undefined, rol);
  }
});

await test('Inicio de Tesorera y Presidenta con secciones financieras', async () => {
  for (const rol of ['TESORERA', 'PRESIDENTA']) {
    const { body } = await call('GET', '/dashboard/metrics', tokens[rol]);
    assert.strictEqual(body.data.secciones.finanzas, true, rol);
    assert.ok(body.data.inicio.graficos.recaudacionMensual, rol);
  }
});

// Antes había tres tareas fijas (con una "deuda morosa" inventada) y el gráfico contaba suspendidas
await test('Inicio: tareas calculadas desde la base y gráfico de créditos solo con socias activas', async () => {
  const { body } = await call('GET', '/dashboard/metrics', tokens.TESORERA);
  const { proximasTareas, graficos, sociasActivas, ultimosPagosFederacion } = body.data.inicio;
  assert.ok(Array.isArray(proximasTareas));
  assert.ok(proximasTareas.every((t) => !String(t.id).startsWith('task-')));
  assert.ok(proximasTareas.every((t) => t.id !== 'buzon'), 'la Tesorera no atiende el buzón');
  assert.strictEqual(graficos.estadoSociasCreditos.totalActivas, sociasActivas);
  assert.ok(ultimosPagosFederacion.every((p) => Number.isInteger(p.id) && typeof p.tieneArchivo === 'boolean'));
});

// ---------------------------------------------------------------------------
// Noticias y buzón
// ---------------------------------------------------------------------------
await test('Secretaria publica y elimina una noticia; Tesorera no puede publicar', async () => {
  const noticia = { titulo: 'Asamblea de prueba', contenido: 'Contenido de la noticia de prueba.', categoria: 'COMUNICADO' };
  assert.strictEqual((await call('POST', '/socia/noticias', tokens.TESORERA, noticia)).status, 403);

  const creada = await call('POST', '/socia/noticias', tokens.SECRETARIA, noticia);
  assert.strictEqual(creada.status, 201, creada.body.message);
  const publicas = await call('GET', '/socia/noticias');
  assert.ok(publicas.body.data.some((n) => n.id === creada.body.data.id));

  assert.strictEqual((await call('DELETE', `/socia/noticias/${creada.body.data.id}`, tokens.DELEGADA)).status, 403);
  assert.strictEqual((await call('DELETE', `/socia/noticias/${creada.body.data.id}`, tokens.DIRECTORA)).status, 200);
  assert.strictEqual((await call('DELETE', `/socia/noticias/${creada.body.data.id}`, tokens.DIRECTORA)).status, 404);
});

await test('Noticia con categoría inválida o sin contenido responde 400', async () => {
  const mala = await call('POST', '/socia/noticias', tokens.PRESIDENTA, { titulo: 'Hola', contenido: 'x', categoria: 'OTRA' });
  assert.strictEqual(mala.status, 400);
});

await test('La directiva lee un mensaje del buzón y cambia su estado', async () => {
  const result = await query(
    `INSERT INTO buzon_mensajes (socia_rut, socia_nombre, socia_jardin, tipo, asunto, mensaje, estado)
     VALUES ('20.081.109-7', 'Socia Prueba', 'Los Físicos', 'CONSULTA', 'Consulta de prueba', 'Mensaje de prueba', 'PENDIENTE')`
  );
  const id = result.insertId;

  const lista = await call('GET', '/socia/buzon/admin', tokens.SECRETARIA);
  assert.ok(lista.body.data.some((m) => m.id === id && m.estado === 'PENDIENTE'));

  assert.strictEqual((await call('PATCH', `/socia/buzon/${id}/estado`, tokens.TESORERA, { estado: 'LEIDO' })).status, 403);
  assert.strictEqual((await call('PATCH', `/socia/buzon/${id}/estado`, tokens.SECRETARIA, { estado: 'ARCHIVADO' })).status, 400);
  assert.strictEqual((await call('PATCH', `/socia/buzon/${id}/estado`, tokens.SECRETARIA, { estado: 'RESPONDIDO' })).status, 200);
  const [row] = await query('SELECT estado FROM buzon_mensajes WHERE id = ?', [id]);
  assert.strictEqual(row.estado, 'RESPONDIDO');

  // Sin adjunto: 404 claro, nunca un archivo ajeno
  assert.strictEqual((await call('GET', `/socia/buzon/${id}/adjunto`, tokens.SECRETARIA)).status, 404);
});

// ---------------------------------------------------------------------------
// Informe mensual
// ---------------------------------------------------------------------------
await test('Informe mensual cuadra con los movimientos del mes en MySQL', async () => {
  const [mesConDatos] = await query(
    `SELECT YEAR(fecha) AS anio, MONTH(fecha) AS mes FROM movimientos_tesoreria
     WHERE tipo <> 'SALDO_APERTURA' AND YEAR(fecha) <= 2026 ORDER BY fecha DESC LIMIT 1`
  );
  if (!mesConDatos) return; // base sin movimientos: nada que cuadrar
  const { anio, mes } = mesConDatos;
  const [esperado] = await query(
    `SELECT COUNT(*) AS cantidad,
            COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN monto END), 0) AS egresos,
            COALESCE(SUM(CASE WHEN tipo = 'EGRESO' AND centro_costo = 'FEDERACION' THEN monto END), 0) AS federacion
     FROM movimientos_tesoreria
     -- Los movimientos anulados quedan en el libro pero no cuentan en el informe
     WHERE tipo <> 'SALDO_APERTURA' AND anulado = 0 AND YEAR(fecha) = ? AND MONTH(fecha) = ?`,
    [anio, mes]
  );

  const { status, body } = await call('GET', `/reportes/mensual?anio=${anio}&mes=${mes}`, tokens.DELEGADA);
  assert.strictEqual(status, 200);
  assert.strictEqual(body.data.cantidadMovimientos, Number(esperado.cantidad));
  assert.strictEqual(body.data.totalEgresos, Number(esperado.egresos));
  assert.strictEqual(body.data.pagoFederacion, Number(esperado.federacion));
  assert.strictEqual(typeof body.data.totalDisponible, 'number');
});

await test('Informe mensual rechaza meses inválidos y exporta Excel', async () => {
  assert.strictEqual((await call('GET', '/reportes/mensual?anio=2026&mes=13', tokens.TESORERA)).status, 400);
  const excel = await call('GET', '/reportes/mensual/excel?anio=2026&mes=10', tokens.DELEGADA);
  assert.strictEqual(excel.status, 200);
  assert.match(excel.headers.get('content-type'), /spreadsheetml/);
  // Un .xlsx es un ZIP: empieza con PK
  assert.strictEqual(Buffer.from(excel.body).subarray(0, 2).toString(), 'PK');
});

// ---------------------------------------------------------------------------
// Balance Anual (V7)
// ---------------------------------------------------------------------------
const { ReporteService } = await import('../src/services/reporteService.js');

await test('Balance Anual cuadra con MySQL, excluye anulados y los fondos cierran', async () => {
  // Un movimiento anulado grande no debe aparecer en ninguna cifra
  await query(
    `INSERT INTO movimientos_tesoreria (correlativo, fecha, tipo, centro_costo, categoria, descripcion, metodo, monto, responsable, anulado, motivo_anulacion)
     VALUES ('MOV-TEST-ANULADO', '2026-06-15', 'INGRESO', 'ASOCIACION', 'ASOCIACION', 'Ingreso anulado de prueba', 'Efectivo', 9999999, 'Prueba', 1, 'Prueba')`
  );
  try {
    const [esperado] = await query(
      `SELECT COUNT(*) AS cantidad,
              COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN monto END), 0) AS egresos,
              COALESCE(SUM(CASE WHEN tipo = 'EGRESO' AND centro_costo = 'FEDERACION' THEN monto END), 0) AS federacion
       FROM movimientos_tesoreria WHERE tipo <> 'SALDO_APERTURA' AND anulado = 0 AND YEAR(fecha) = 2026`
    );
    // Corte al 31-12: el año completo
    const b = await ReporteService.getBalanceAnual(2026, '2026-12-31');
    assert.strictEqual(b.enCurso, false);
    assert.strictEqual(b.meses.length, 12);
    assert.strictEqual(b.cantidadMovimientos, Number(esperado.cantidad));
    assert.strictEqual(b.totalIngresos, Number(esperado.ingresos));
    assert.strictEqual(b.totalEgresos, Number(esperado.egresos));
    assert.strictEqual(b.pagoFederacion, Number(esperado.federacion));

    // Cada fondo: inicial + ingresos − egresos = final; el total disponible es la suma de ambos
    for (const f of Object.values(b.fondos)) assert.strictEqual(f.saldoInicial + f.ingresos - f.egresos, f.saldoFinal);
    assert.strictEqual(b.fondos.asociacion.saldoFinal + b.fondos.cenaAnual.saldoFinal, b.saldoFinal);
    assert.strictEqual(b.meses[11].saldoAcumulado, b.saldoFinal);
    // Meses y categorías suman lo mismo que el año
    assert.strictEqual(b.meses.reduce((s, m) => s + m.ingresos, 0), b.totalIngresos);
    assert.strictEqual(b.egresosPorCategoria.reduce((s, c) => s + c.monto, 0), b.totalEgresos);

    // Año en curso: corte a la fecha indicada y solo los meses transcurridos
    const enCurso = await ReporteService.getBalanceAnual(2026, '2026-03-10');
    assert.strictEqual(enCurso.enCurso, true);
    assert.strictEqual(enCurso.hasta, '2026-03-10');
    assert.strictEqual(enCurso.meses.length, 3);
  } finally {
    await query("DELETE FROM movimientos_tesoreria WHERE correlativo = 'MOV-TEST-ANULADO'");
  }
});

await test('Balance Anual en PDF: archivo válido, auditoría y años inválidos', async () => {
  const [antes] = await query("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'BALANCE_ANUAL_PDF'");
  const pdf = await call('GET', '/reportes/anual/pdf?anio=2026', tokens.DELEGADA);
  assert.strictEqual(pdf.status, 200);
  assert.match(pdf.headers.get('content-type'), /application\/pdf/);
  assert.match(pdf.headers.get('content-disposition'), /balance-anual-2026\.pdf/);
  assert.strictEqual(Buffer.from(pdf.body).subarray(0, 5).toString(), '%PDF-');
  const [despues] = await query("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'BALANCE_ANUAL_PDF'");
  assert.strictEqual(Number(despues.n), Number(antes.n) + 1);

  for (const anio of ['2019', '2999', 'abc']) {
    assert.strictEqual((await call('GET', `/reportes/anual/pdf?anio=${anio}`, tokens.TESORERA)).status, 400, anio);
  }
  // Sin movimientos registrados hasta ese año
  assert.strictEqual((await call('GET', '/reportes/anual/pdf?anio=2020', tokens.TESORERA)).status, 404);
  assert.strictEqual((await call('GET', '/reportes/anual/pdf?anio=2026')).status, 401);
});

// ---------------------------------------------------------------------------
// H-017: aislamiento entre socias (A no ve lo de B) y socias fuera de la directiva
// ---------------------------------------------------------------------------
const { default: bcrypt } = await import('bcryptjs');
const CLAVE_SOCIA = 'SociaPrueba2026';
const RUT_A = '12.930.893-1';
const RUT_B = '16.673.126-7';
await query('UPDATE socias SET primer_ingreso = 0, password = ? WHERE rut IN (?, ?)', [
  bcrypt.hashSync(CLAVE_SOCIA, 10),
  RUT_A,
  RUT_B
]);
async function loginSocia(rut) {
  const { status, body } = await call('POST', '/socia/login', null, { rut, password: CLAVE_SOCIA });
  assert.strictEqual(status, 200, `login socia ${rut}: ${body.message}`);
  return body.data.token;
}
const sociaA = await loginSocia(RUT_A);
const sociaB = await loginSocia(RUT_B);

await test('Socia A no ve los mensajes del buzón de la socia B', async () => {
  const form = new FormData();
  form.append('tipo', 'CONSULTA');
  form.append('asunto', 'Mensaje privado de A');
  form.append('mensaje', 'Solo la socia A y la directiva deben verlo.');
  const enviado = await fetch(`${baseUrl}/socia/buzon`, { method: 'POST', headers: { Authorization: `Bearer ${sociaA}` }, body: form });
  assert.strictEqual(enviado.status, 201);

  const deA = await call('GET', '/socia/buzon/mis-mensajes', sociaA);
  const deB = await call('GET', '/socia/buzon/mis-mensajes', sociaB);
  assert.ok(deA.body.data.some((m) => m.asunto === 'Mensaje privado de A'));
  assert.ok(!deB.body.data.some((m) => m.asunto === 'Mensaje privado de A'));
});

await test('Una socia no accede a datos de la directiva ni de otras socias', async () => {
  const [{ id }] = await query('SELECT id FROM socias WHERE rut = ?', [RUT_B]);
  const [msg] = await query('SELECT id FROM buzon_mensajes ORDER BY id DESC LIMIT 1');
  for (const [method, url] of [
    ['GET', `/socias/${id}`],
    ['GET', '/socias?limit=1'],
    ['GET', '/socia/buzon/admin'],
    ['GET', `/socia/buzon/${msg.id}/adjunto`],
    ['PATCH', `/socia/buzon/${msg.id}/estado`],
    ['GET', '/tesoreria/resumen'],
    ['GET', '/reportes/mensual'],
    ['GET', '/reportes/anual/pdf'],
    ['GET', '/reportes/jardines'],
    ['GET', '/socia/mi-jardin'],
    ['GET', '/dashboard/audit-recent']
  ]) {
    const { status } = await call(method, url, sociaA, method === 'PATCH' ? { estado: 'LEIDO' } : undefined);
    assert.strictEqual(status, 403, `${method} ${url} respondió ${status}`);
  }
});

await test('Solo las socias escriben en el buzón: la directiva recibe 403 y no se guarda nada', async () => {
  const [antes] = await query('SELECT COUNT(*) AS n FROM buzon_mensajes');
  const form = new FormData();
  form.append('tipo', 'CONSULTA');
  form.append('asunto', 'Mensaje desde una cuenta de la directiva');
  form.append('mensaje', 'Este mensaje no debe quedar en el buzón de socias.');
  const res = await fetch(`${baseUrl}/socia/buzon`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.SECRETARIA}` }, body: form });
  assert.strictEqual(res.status, 403);
  const [despues] = await query('SELECT COUNT(*) AS n FROM buzon_mensajes');
  assert.strictEqual(Number(despues.n), Number(antes.n));
});

await test('Al recargar (/auth/me) la socia conserva apellidos y marca de delegada', async () => {
  const [s] = await query('SELECT nombres, apellido_paterno, apellido_materno, es_delegada FROM socias WHERE rut = ?', [RUT_A]);
  const { status, body } = await call('GET', '/auth/me', sociaA);
  assert.strictEqual(status, 200);
  const u = body.data.user;
  assert.strictEqual(u.nombres, s.nombres);
  assert.strictEqual(u.apellidoPaterno, s.apellido_paterno || '');
  assert.strictEqual(u.apellidoMaterno, s.apellido_materno || '');
  assert.strictEqual(u.esDelegada, Boolean(s.es_delegada));
});

// ---------------------------------------------------------------------------
// V7: cifras por jardín (directiva) y "Mi jardín" (delegada en el portal)
// ---------------------------------------------------------------------------
await test('Cifras por jardín cuadran con MySQL', async () => {
  const { status, body } = await call('GET', '/reportes/jardines', tokens.SECRETARIA);
  assert.strictEqual(status, 200);
  const d = body.data;
  const [activos] = await query('SELECT COUNT(*) AS n FROM jardines WHERE activo = 1');
  assert.strictEqual(d.jardines.length, Number(activos.n));

  const [esperado] = await query(
    `SELECT COUNT(*) AS activas FROM socias s JOIN jardines j ON j.id = s.jardin_id WHERE s.estado = 'ACTIVA' AND j.activo = 1`
  );
  assert.strictEqual(d.totales.activas, Number(esperado.activas));
  assert.strictEqual(d.totales.aporteMensual, d.totales.activas * d.cuotaSocial);

  // Un jardín con créditos vigentes: socias distintas, no créditos
  const [conCredito] = await query(
    `SELECT s.jardin_id, COUNT(DISTINCT c.socia_id) AS socias FROM creditos c JOIN socias s ON s.id = c.socia_id
     WHERE c.estado = 'vigente' AND s.estado <> 'RETIRADA' AND s.jardin_id IS NOT NULL
     GROUP BY s.jardin_id ORDER BY socias DESC LIMIT 1`
  );
  if (conCredito) {
    const j = d.jardines.find((x) => x.id === conCredito.jardin_id);
    assert.strictEqual(j.creditos.sociasConCredito, Number(conCredito.socias));
    assert.ok(j.creditos.porEmpresa.every((e) => e.socias <= j.creditos.sociasConCredito));
  }
});

await test('Mi jardín: solo la socia marcada como delegada, solo su jardín y sin datos individuales', async () => {
  const [socia] = await query('SELECT id, jardin_id FROM socias WHERE rut = ?', [RUT_A]);
  // Sin la marca: no entra a "Mi jardín" ni a los reportes
  assert.strictEqual((await call('GET', '/socia/mi-jardin', sociaA)).status, 403);
  assert.strictEqual((await call('GET', '/reportes/mensual', sociaA)).status, 403);

  await query('UPDATE socias SET es_delegada = 1 WHERE id = ?', [socia.id]);
  try {
    const login = await call('POST', '/socia/login', null, { rut: RUT_A, password: CLAVE_SOCIA });
    assert.strictEqual(login.body.data.socia.esDelegada, true);

    const mio = await call('GET', '/socia/mi-jardin', sociaA);
    assert.strictEqual(mio.status, 200, mio.body.message);
    assert.strictEqual(mio.body.data.jardin.id, socia.jardin_id);
    // Decisión D2: ni RUT, ni nombres, ni montos de deudas
    const texto = JSON.stringify(mio.body.data);
    assert.doesNotMatch(texto, /\d{1,2}\.\d{3}\.\d{3}-[\dkK]/);
    // ("nombre" sí aparece: es el del jardín y el de cada empresa)
    assert.doesNotMatch(texto, /"(saldo\w*|monto\w*|rut|nombres|apellido\w*|socia_?id)"\s*:/i);

    // Con la marca ve el informe mensual y el Balance Anual, pero no los demás jardines
    assert.strictEqual((await call('GET', '/reportes/mensual?anio=2026&mes=10', sociaA)).status, 200);
    assert.strictEqual((await call('GET', '/reportes/anual/pdf?anio=2026', sociaA)).status, 200);
    assert.strictEqual((await call('GET', '/reportes/jardines', sociaA)).status, 403);
    // Las cuentas de la directiva no tienen "Mi jardín" (es del portal)
    assert.strictEqual((await call('GET', '/socia/mi-jardin', tokens.TESORERA)).status, 403);
  } finally {
    await query('UPDATE socias SET es_delegada = 0 WHERE id = ?', [socia.id]);
  }
  // Quitada la marca, pierde el acceso de inmediato (con la misma sesión)
  assert.strictEqual((await call('GET', '/socia/mi-jardin', sociaA)).status, 403);
  assert.strictEqual((await call('GET', '/reportes/anual/pdf?anio=2026', sociaA)).status, 403);
});

// ---------------------------------------------------------------------------
// H-019 / H-020 / H-026: validación estricta y SQL siempre parametrizado
// ---------------------------------------------------------------------------
await test('Cargas de inyección SQL no alteran las consultas', async () => {
  const total = (await call('GET', '/socias?limit=0', tokens.TESORERA)).body.total;
  const inyeccion = await call('GET', `/socias?limit=0&search=${encodeURIComponent("' OR 1=1 -- ")}`, tokens.TESORERA);
  assert.strictEqual(inyeccion.status, 200);
  assert.ok(inyeccion.body.total < total, 'el filtro con comillas no debe devolver todo el padrón');

  assert.strictEqual((await call('GET', `/socias?jardinId=${encodeURIComponent('1 OR 1=1')}`, tokens.TESORERA)).status, 400);
  assert.strictEqual((await call('GET', `/socias/${encodeURIComponent('1 OR 1=1')}`, tokens.TESORERA)).status, 400);
  assert.strictEqual((await call('GET', `/tesoreria/movimientos?tipo=${encodeURIComponent("INGRESO' --")}`, tokens.TESORERA)).status, 400);
  assert.strictEqual((await call('GET', '/tesoreria/movimientos?fechaDesde=2026-13', tokens.TESORERA)).status, 400);
  // La tabla sigue intacta
  assert.strictEqual((await call('GET', '/socias?limit=0', tokens.TESORERA)).body.total, total);
});

await test('Montos sobre el tope y mensajes inválidos del buzón responden 400', async () => {
  const form = new FormData();
  for (const [k, v] of Object.entries({
    tipo: 'INGRESO',
    fecha: '2026-10-20',
    descripcion: 'Monto fuera de rango',
    centroCosto: 'ASOCIACION',
    monto: '100000001',
    metodo: 'TRANSFERENCIA'
  })) {
    form.append(k, v);
  }
  const res = await fetch(`${baseUrl}/tesoreria/movimientos`, { method: 'POST', headers: { Authorization: `Bearer ${tokens.TESORERA}` }, body: form });
  assert.strictEqual(res.status, 400);

  const malo = new FormData();
  malo.append('tipo', 'SPAM');
  malo.append('asunto', 'x');
  malo.append('mensaje', 'y');
  const buzon = await fetch(`${baseUrl}/socia/buzon`, { method: 'POST', headers: { Authorization: `Bearer ${sociaA}` }, body: malo });
  assert.strictEqual(buzon.status, 400);
});

// ---------------------------------------------------------------------------
// H-008: la directiva restablece la clave de una socia desde el padrón
// ---------------------------------------------------------------------------
await test('La directiva restablece la clave de una socia: vuelve a los 6 dígitos y cierra sus sesiones', async () => {
  const [{ id }] = await query('SELECT id FROM socias WHERE rut = ?', [RUT_B]);
  // La sesión previa de la socia debe quedar antes del corte (se toleran tokens del mismo segundo)
  await new Promise((r) => setTimeout(r, 1100));

  // Sin permiso: delegada y socia
  assert.strictEqual((await call('POST', `/socias/${id}/restablecer-clave`, tokens.DELEGADA)).status, 403);
  assert.strictEqual((await call('POST', `/socias/${id}/restablecer-clave`, sociaA)).status, 403);
  assert.strictEqual((await call('POST', '/socias/99999999/restablecer-clave', tokens.SECRETARIA)).status, 404);
  assert.strictEqual((await call('POST', '/socias/abc/restablecer-clave', tokens.SECRETARIA)).status, 400);

  const reset = await call('POST', `/socias/${id}/restablecer-clave`, tokens.SECRETARIA);
  assert.strictEqual(reset.status, 200, reset.body.message);

  // La sesión abierta de la socia ya no vale y su clave anterior tampoco
  assert.strictEqual((await call('GET', '/socia/buzon/mis-mensajes', sociaB)).status, 401);
  const vieja = await call('POST', '/socia/login', null, { rut: RUT_B, password: CLAVE_SOCIA });
  assert.strictEqual(vieja.status, 401);

  // Entra con los 6 primeros dígitos del RUT y debe crear una clave nueva
  const inicial = await call('POST', '/socia/login', null, { rut: RUT_B, password: '166731' });
  assert.strictEqual(inicial.status, 200, inicial.body.message);
  assert.strictEqual(inicial.body.data.socia.primerIngreso, true);

  const [auditoria] = await query(
    "SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'SOCIA_PASSWORD_RESET' AND detalles LIKE ?",
    [`%${RUT_B}%`]
  );
  assert.ok(Number(auditoria.n) >= 1, 'el restablecimiento queda en la auditoría');
});

await test('Cambio voluntario de clave de la socia exige la clave actual', async () => {
  const sinActual = await call('POST', '/socia/cambiar-clave', sociaA, { nuevaClave: 'OtraClave2026' });
  assert.strictEqual(sinActual.status, 400);
  const mala = await call('POST', '/socia/cambiar-clave', sociaA, { nuevaClave: 'OtraClave2026', claveActual: 'equivocada' });
  assert.strictEqual(mala.status, 400);
  const igual = await call('POST', '/socia/cambiar-clave', sociaA, { nuevaClave: CLAVE_SOCIA, claveActual: CLAVE_SOCIA });
  assert.strictEqual(igual.status, 400);
  const ok = await call('POST', '/socia/cambiar-clave', sociaA, { nuevaClave: 'OtraClave2026', claveActual: CLAVE_SOCIA });
  assert.strictEqual(ok.status, 200, ok.body.message);
  const nuevo = await call('POST', '/socia/login', null, { rut: RUT_A, password: 'OtraClave2026' });
  assert.strictEqual(nuevo.status, 200);
});

// ---------------------------------------------------------------------------
// Suplencia de Tesorería: el Admin activa a la Directora cuando la Tesorera no está
// ---------------------------------------------------------------------------
await test('Suplencia: solo el Admin ve y cambia el interruptor', async () => {
  for (const rol of ['TESORERA', 'PRESIDENTA', 'DIRECTORA', 'SECRETARIA']) {
    assert.strictEqual((await call('GET', '/tesoreria/suplencia', tokens[rol])).status, 403, `${rol} no ve la suplencia`);
    assert.strictEqual((await call('PUT', '/tesoreria/suplencia', tokens[rol], { activa: true })).status, 403, `${rol} no la activa`);
  }
  const estado = await call('GET', '/tesoreria/suplencia', tokens.ADMIN);
  assert.strictEqual(estado.status, 200);
  assert.strictEqual(estado.body.data.activa, false);
  assert.strictEqual(estado.body.data.candidatas.length, 1, 'hay una sola Directora activa');
  assert.strictEqual((await call('PUT', '/tesoreria/suplencia', tokens.ADMIN, { activa: 'si' })).status, 400);
});

await test('Suplencia: activa, la Directora opera como Tesorera; desactivada, pierde el acceso', async () => {
  const directora = tokens.DIRECTORA;
  assert.strictEqual((await call('GET', '/tesoreria/resumen', directora)).status, 403);
  assert.strictEqual((await call('GET', '/creditos/periodo?mes=3&anio=2027', directora)).status, 403);

  const activar = await call('PUT', '/tesoreria/suplencia', tokens.ADMIN, { activa: true });
  assert.strictEqual(activar.status, 200, activar.body.message);
  assert.strictEqual(activar.body.data.activa, true);
  assert.ok(activar.body.data.suplente.nombre);

  // Rige en la siguiente petición, sin volver a iniciar sesión
  const me = await call('GET', '/auth/me', directora);
  assert.strictEqual(me.body.data.user.suplenteTesoreria, true);
  assert.strictEqual((await call('GET', '/tesoreria/resumen', directora)).status, 200);
  assert.strictEqual((await call('GET', '/creditos/periodo?mes=3&anio=2027', directora)).status, 200);
  assert.strictEqual((await call('GET', '/dashboard/audit-recent', directora)).status, 200);
  // Conserva lo suyo de Directora y la Tesorera sigue operando
  assert.strictEqual((await call('GET', '/socias?limit=1', directora)).status, 200);
  assert.strictEqual((await call('GET', '/tesoreria/resumen', tokens.TESORERA)).status, 200);
  // Sigue sin poder tocar el interruptor
  assert.strictEqual((await call('PUT', '/tesoreria/suplencia', directora, { activa: false })).status, 403);

  const [registro] = await query("SELECT accion FROM auditoria WHERE accion LIKE 'SUPLENCIA_TESORERIA_%' ORDER BY id DESC LIMIT 1");
  assert.strictEqual(registro.accion, 'SUPLENCIA_TESORERIA_ACTIVADA');

  const desactivar = await call('PUT', '/tesoreria/suplencia', tokens.ADMIN, { activa: false });
  assert.strictEqual(desactivar.status, 200);
  assert.strictEqual(desactivar.body.data.activa, false);
  assert.strictEqual((await call('GET', '/tesoreria/resumen', directora)).status, 403);
  assert.strictEqual((await call('GET', '/auth/me', directora)).body.data.user.suplenteTesoreria, false);
});

// ---------------------------------------------------------------------------
// H-005: cambiar la contraseña cierra las demás sesiones (va al final: cambia la clave del admin)
// ---------------------------------------------------------------------------
await test('Cambiar la contraseña cierra las otras sesiones y mantiene la actual', async () => {
  const otraSesion = await login('17.260.651-2');
  const actual = tokens.ADMIN;
  // Los tokens de este mismo segundo se toleran: se espera para que la otra sesión quede antes del corte
  await new Promise((r) => setTimeout(r, 1100));
  const cambio = await call('POST', '/auth/cambiar-clave', actual, { currentPassword: 'Admin123!', newPassword: 'AdminNueva2026' });
  assert.strictEqual(cambio.status, 200, cambio.body.message);
  assert.strictEqual((await call('GET', '/auth/me', actual)).status, 200);
  assert.strictEqual((await call('GET', '/auth/me', otraSesion)).status, 401);
  // Un ingreso nuevo con la clave nueva funciona
  const nuevo = await call('POST', '/auth/login', null, { identifier: '17.260.651-2', password: 'AdminNueva2026' });
  assert.strictEqual(nuevo.status, 200);
  assert.strictEqual((await call('GET', '/auth/me', nuevo.body.data.token)).status, 200);
});

console.log(`\n[RESULTADOS ACCESOS] ${passed} pasados, ${failed} fallidos`);
server.closeAllConnections?.();
server.close();
await dbPool?.end().catch(() => {});
process.exitCode = failed > 0 ? 1 : 0;
