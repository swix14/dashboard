/**
 * Pruebas de V4 — Créditos y Convenios.
 * Genera una planilla "Maestra Créditos" ficticia con el mismo formato que la real
 * (encabezado en la fila 2 desde la columna B, hojas SOS, ISIMUNDO, Optica y Hoja1 resumen)
 * para un período futuro que no choca con los datos de ejemplo.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtf-creditos-'));
process.env.UPLOADS_DIR = uploadsDir;

const { default: app } = await import('../src/server.js');
const { pool: dbPool, query, waitForDatabase, isDatabaseReady } = await import('../src/config/db.js');

await waitForDatabase();
if (!isDatabaseReady()) {
  console.error('creditosTest requiere MySQL: ejecútelo con "npm test".');
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
  const isForm = body instanceof FormData;
  const res = await fetch(`${baseUrl}${url}`, {
    method,
    headers: { ...(isForm || !body ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: isForm ? body : body ? JSON.stringify(body) : undefined
  });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}

async function login(rut) {
  const { status, body } = await call('POST', '/auth/login', null, { identifier: rut, password: 'Admin123!' });
  assert.strictEqual(status, 200, `login ${rut}: ${body.message}`);
  return body.data.token;
}

const TESORERA = await login('16.947.343-9');
const PRESIDENTA = await login('13.963.291-5');
const SECRETARIA = await login('11.354.669-7');
const DIRECTORA = await login('20.081.109-7');
const DELEGADA = await login('17.890.123-1');

// Tres socias activas sin créditos para la planilla ficticia
const libres = await query(
  `SELECT s.id, s.rut, s.nombres, s.apellido_paterno FROM socias s
   WHERE s.estado = 'ACTIVA' AND NOT EXISTS (SELECT 1 FROM creditos c WHERE c.socia_id = s.id)
   ORDER BY s.id LIMIT 3`
);
assert.strictEqual(libres.length, 3, 'se necesitan 3 socias sin créditos');
const [A, B, C] = libres;
// Mismo cuerpo de RUT con otro dígito verificador (error típico de la planilla de la empresa)
const rutMalDv = (rut) => rut.replace(/-(.)$/, (_, dv) => `-${dv === '0' ? '1' : '0'}`);

const PERIODO = { mes: 3, anio: 2027 };

/** Planilla ficticia. opciones.cuotaSosMayo cambia una cuota pendiente para probar actualizaciones */
async function planilla({ cuotaSosMayo = 30000 } = {}) {
  const wb = new ExcelJS.Workbook();
  const sos = wb.addWorksheet('SOS');
  sos.getRow(2).values = [null, 'Rut', 'Apellido Paterno', 'Apellido Materno', 'Nombres', 'Febrero', 'Marzo', 'Abril', 'Mayo'];
  sos.getRow(3).values = [null, A.rut, A.apellido_paterno, '', A.nombres, 30000, 30000, 30000, cuotaSosMayo];
  // Crédito de 2 cuotas que termina en marzo: queda en "última cuota" hasta verificar marzo
  sos.getRow(4).values = [null, rutMalDv(B.rut), B.apellido_paterno, '', B.nombres, 25000, 25000, null, null];
  sos.getRow(5).values = [null, '11.111.111-1', 'NO', 'EXISTE', 'PERSONA', 10000, 10000, null, null];

  const isi = wb.addWorksheet('ISIMUNDO');
  isi.getRow(2).values = [null, 'Rut', 'Nombre', 'Primer Apellido', 'Segundo Apellido', 'Nº Credito', 'Fecha Otorgamiento',
    'Fecha Termino Credito', 'Monto Prestado', 'Valor Cuota', 'Número Total Cuotas', 'Fecha Vencimiento', 'Cuotas Pagadas'];
  isi.getRow(3).values = [null, C.rut, C.nombres, C.apellido_paterno, '', 'T-900', new Date(Date.UTC(2027, 0, 5)),
    new Date(Date.UTC(2027, 5, 30)), 60000, 10000, 6, new Date(Date.UTC(2027, 2, 31)), "'2"];

  const optica = wb.addWorksheet('Optica');
  optica.getRow(2).values = [null, 'Rut', 'Apellido Paterno', 'Apellido Materno', 'Nombres', 'Cuotas', 'Valor Cuota',
    new Date(Date.UTC(2027, 2, 1)), new Date(Date.UTC(2027, 3, 1))];
  optica.getRow(3).values = [null, A.rut, A.apellido_paterno, '', A.nombres, 3, 15000, 15000, 15000];

  const hoja1 = wb.addWorksheet('Hoja1');
  hoja1.getRow(2).values = [null, 'RUT', 'APELLIDO PATERNO', 'NOMBRES', 'CUOTA ASOCIACION', 'DESCUENTO SOS', 'DESCUENTO ISIMUNDO', 'DESCUENTO OPTICA', 'TOTAL'];
  hoja1.getRow(3).values = [null, A.rut, A.apellido_paterno, A.nombres, 4000, 30000, null, 15000, 49000];
  hoja1.getRow(4).values = [null, B.rut, B.apellido_paterno, B.nombres, 4000, 25000, null, null, 29000];
  hoja1.getRow(5).values = [null, C.rut, C.apellido_paterno, C.nombres, 4000, null, 10000, null, 14000];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function formPlanilla(buffer, periodo = PERIODO) {
  const form = new FormData();
  form.append('mes', String(periodo.mes));
  form.append('anio', String(periodo.anio));
  form.append('planilla', new Blob([buffer]), 'Maestra Creditos.xlsx');
  return form;
}

const PDF = Buffer.from('%PDF-1.4\n% comprobante de prueba\n%%EOF\n');
function formPagos(empresas, periodo = PERIODO, contenido = PDF) {
  const form = new FormData();
  form.append('mes', String(periodo.mes));
  form.append('anio', String(periodo.anio));
  for (const e of empresas) form.append(`comprobante_${e}`, new Blob([contenido], { type: 'application/pdf' }), `pago-${e}.pdf`);
  return form;
}

const creditosDe = (sociaId) =>
  query(
    `SELECT c.id, cv.codigo, c.total_cuotas, c.cuotas_pagadas, c.estado FROM creditos c JOIN convenios cv ON cv.id = c.convenio_id
     WHERE c.socia_id = ? ORDER BY cv.orden`,
    [sociaId]
  );
const cuotasDe = (creditoId) =>
  query('SELECT numero_cuota, monto, mes_cobro, anio_cobro, estado FROM cuotas_credito WHERE credito_id = ? ORDER BY numero_cuota', [creditoId]);

// ---------------------------------------------------------------------------
await test('Permisos: Tesorera y Presidenta ven Créditos; Secretaria, Directora y Delegada no', async () => {
  assert.strictEqual((await call('GET', '/creditos/resumen', TESORERA)).status, 200);
  assert.strictEqual((await call('GET', '/creditos/resumen', PRESIDENTA)).status, 200);
  for (const t of [SECRETARIA, DIRECTORA, DELEGADA]) {
    assert.strictEqual((await call('GET', '/creditos/resumen', t)).status, 403);
    assert.strictEqual((await call('GET', '/creditos', t)).status, 403);
  }
  assert.strictEqual((await call('GET', '/creditos/resumen', null)).status, 401);
});

await test('Presidenta no puede cargar planillas ni verificar pagos (solo lectura)', async () => {
  const buf = await planilla();
  assert.strictEqual((await call('POST', '/creditos/importar/previsualizar', PRESIDENTA, formPlanilla(buf))).status, 403);
  assert.strictEqual((await call('POST', '/creditos/pagos/verificar', PRESIDENTA, formPagos(['SOS']))).status, 403);
});

await test('Resumen con las 5 empresas, incluida Abogada', async () => {
  const { body } = await call('GET', '/creditos/resumen', TESORERA);
  assert.deepStrictEqual(body.data.map((e) => e.codigo), ['SOS', 'ISIMUNDO', 'OPTICA', 'DENTAL', 'ABOGADA']);
});

await test('Vista previa: lee las hojas, detecta errores y no modifica la base', async () => {
  const [{ n: antes }] = await query('SELECT COUNT(*) AS n FROM creditos');
  const { status, body } = await call('POST', '/creditos/importar/previsualizar', TESORERA, formPlanilla(await planilla()));
  assert.strictEqual(status, 200, body.message);
  const d = body.data;
  assert.strictEqual(d.resumen.nuevos, 4);
  assert.strictEqual(d.resumen.errores, 1, 'la persona fuera del padrón es un error');
  assert.ok(d.advertencias.some((a) => a.includes('dígito verificador')), 'avisa el RUT con otro dígito verificador');
  const sos = d.empresas.find((e) => e.codigo === 'SOS');
  assert.strictEqual(sos.aPagar, 55000, 'el monto a pagar sale de la hoja resumen');
  const [{ n: despues }] = await query('SELECT COUNT(*) AS n FROM creditos');
  assert.strictEqual(despues, antes);
});

await test('Mes inválido o sin archivo responde 400', async () => {
  assert.strictEqual((await call('POST', '/creditos/importar/previsualizar', TESORERA, formPlanilla(await planilla(), { mes: 13, anio: 2027 }))).status, 400);
  const sinArchivo = new FormData();
  sinArchivo.append('mes', '3');
  sinArchivo.append('anio', '2027');
  assert.strictEqual((await call('POST', '/creditos/importar/previsualizar', TESORERA, sinArchivo)).status, 400);
});

await test('Aplicar: crea créditos, cuotas con su estado y el monto A PAGAR por empresa', async () => {
  const { status, body } = await call('POST', '/creditos/importar/aplicar', TESORERA, formPlanilla(await planilla()));
  assert.strictEqual(status, 200, body.message);
  assert.strictEqual(body.data.resumen.nuevos, 4);
  assert.ok(fs.existsSync(path.join(uploadsDir, body.data.archivoGuardado)), 'la planilla queda guardada');
  assert.ok(body.data.archivoGuardado.startsWith('creditos/planillas/2027/03/'));

  const creditosA = await creditosDe(A.id);
  assert.deepStrictEqual(creditosA.map((c) => c.codigo), ['SOS', 'OPTICA']);
  const sosA = await cuotasDe(creditosA[0].id);
  // Febrero (antes del mes cargado) queda descontada; marzo en adelante pendientes
  assert.deepStrictEqual(sosA.map((q) => q.estado), ['descontada', 'pendiente', 'pendiente', 'pendiente']);
  assert.strictEqual(creditosA[0].cuotas_pagadas, 1);

  // Óptica: 3 cuotas aunque la planilla solo muestre 2 meses (la tercera sigue en mayo)
  const opticaA = await cuotasDe(creditosA[1].id);
  assert.strictEqual(opticaA.length, 3);
  assert.deepStrictEqual([opticaA[2].mes_cobro, opticaA[2].anio_cobro], [5, 2027]);

  // ISIMUNDO: la empresa informa 2 pagadas; la 3ª vence en marzo
  const [isiC] = await creditosDe(C.id);
  const isi = await cuotasDe(isiC.id);
  assert.strictEqual(isi.length, 6);
  assert.strictEqual(isi.filter((q) => q.estado === 'descontada').length, 2);
  assert.deepStrictEqual([isi[2].mes_cobro, isi[2].anio_cobro], [3, 2027]);

  // B se asignó por el cuerpo del RUT aunque la planilla traía otro dígito verificador
  assert.strictEqual((await creditosDe(B.id)).length, 1);

  const pagos = await query(
    `SELECT cv.codigo, p.monto_a_pagar FROM pagos_convenio p JOIN convenios cv ON cv.id = p.convenio_id
     WHERE p.mes = 3 AND p.anio = 2027 ORDER BY cv.orden`
  );
  assert.deepStrictEqual(pagos.map((p) => [p.codigo, p.monto_a_pagar]), [['SOS', 55000], ['ISIMUNDO', 10000], ['OPTICA', 15000]]);
});

await test('Subir dos veces la misma planilla no duplica nada', async () => {
  const [{ n: antes }] = await query('SELECT COUNT(*) AS n FROM cuotas_credito');
  const { body } = await call('POST', '/creditos/importar/aplicar', TESORERA, formPlanilla(await planilla()));
  assert.strictEqual(body.data.resumen.nuevos, 0);
  assert.strictEqual(body.data.resumen.actualizados, 0);
  const [{ n: despues }] = await query('SELECT COUNT(*) AS n FROM cuotas_credito');
  assert.strictEqual(despues, antes);
});

await test('Historial: filtros por empresa, estado y búsqueda; ficha con monto pendiente', async () => {
  const sos = await call('GET', '/creditos?convenio=SOS&search=' + encodeURIComponent(A.rut), TESORERA);
  assert.strictEqual(sos.status, 200);
  assert.strictEqual(sos.body.data.length, 1);
  assert.strictEqual(sos.body.data[0].totalCuotas, 4);

  const ultima = await call('GET', '/creditos?estado=ULTIMA_CUOTA&search=' + encodeURIComponent(B.nombres.split(' ')[0]), TESORERA);
  assert.ok(ultima.body.data.some((c) => c.rut === B.rut), 'el crédito de B está en su última cuota');

  const ficha = await call('GET', `/creditos/${sos.body.data[0].id}`, TESORERA);
  assert.strictEqual(ficha.body.data.montoPendiente, 90000);
  assert.strictEqual(ficha.body.data.cuotas.length, 4);

  assert.strictEqual((await call('GET', '/creditos?convenio=OTRA', TESORERA)).status, 400);
  assert.strictEqual((await call('GET', '/creditos/abc', TESORERA)).status, 400);
  assert.strictEqual((await call('GET', '/creditos/99999999', TESORERA)).status, 404);
});

await test('Verificación: exige planilla cargada del mes y un comprobante válido', async () => {
  const sinPlanilla = await call('POST', '/creditos/pagos/verificar', TESORERA, formPagos(['SOS'], { mes: 4, anio: 2027 }));
  assert.strictEqual(sinPlanilla.status, 400);
  assert.match(sinPlanilla.body.message, /primero cargue la planilla/i);
  const falso = await call('POST', '/creditos/pagos/verificar', TESORERA, formPagos(['SOS'], PERIODO, Buffer.from('<html>no es pdf</html>')));
  assert.strictEqual(falso.status, 400);
  const vacio = await call('POST', '/creditos/pagos/verificar', TESORERA, formPagos([]));
  assert.strictEqual(vacio.status, 400);
});

await test('Verificar el pago descuenta las cuotas del mes, cierra créditos pagados y guarda el comprobante', async () => {
  const { status, body } = await call('POST', '/creditos/pagos/verificar', TESORERA, formPagos(['SOS', 'ISIMUNDO']));
  assert.strictEqual(status, 200, body.message);
  const sos = body.data.find((d) => d.empresa === 'SOS');
  assert.strictEqual(sos.montoPagado, 55000);
  assert.strictEqual(sos.cuotasDescontadas, 2);

  const [sosB] = await creditosDe(B.id);
  assert.strictEqual(sosB.estado, 'finalizado', 'la última cuota de B se pagó en marzo');
  const [sosA] = await creditosDe(A.id);
  assert.strictEqual(sosA.cuotas_pagadas, 2);

  const archivos = fs.readdirSync(path.join(uploadsDir, 'creditos', 'comprobantes', '2027', '03', 'SOS'));
  assert.strictEqual(archivos.length, 1, 'el comprobante de SOS queda en su propia carpeta');
  assert.ok(fs.existsSync(path.join(uploadsDir, 'creditos', 'comprobantes', '2027', '03', 'ISIMUNDO')));

  const resumen = await call('GET', '/creditos/resumen', TESORERA);
  const tarjeta = resumen.body.data.find((e) => e.codigo === 'SOS');
  assert.deepStrictEqual([tarjeta.ultimoPago.monto, tarjeta.ultimoPago.mes], [55000, 3]);

  const descarga = await call('GET', `/creditos/pagos/${tarjeta.ultimoPago.id}/comprobante`, PRESIDENTA);
  assert.strictEqual(descarga.status, 200);
  assert.ok(descarga.body.subarray(0, 5).toString() === '%PDF-');
});

await test('Un pago ya verificado no se puede verificar de nuevo ni cambiar su monto', async () => {
  const otra = await call('POST', '/creditos/pagos/verificar', TESORERA, formPagos(['SOS']));
  assert.strictEqual(otra.status, 409);
  const { body } = await call('POST', '/creditos/importar/aplicar', TESORERA, formPlanilla(await planilla()));
  assert.ok(body.data.advertencias.some((a) => a.includes('ya fue verificado')));
  const [p] = await query(
    `SELECT monto_a_pagar FROM pagos_convenio p JOIN convenios cv ON cv.id = p.convenio_id WHERE cv.codigo = 'SOS' AND p.mes = 3 AND p.anio = 2027`
  );
  assert.strictEqual(p.monto_a_pagar, 55000);
});

await test('Una planilla corregida ajusta las cuotas pendientes y nunca las descontadas', async () => {
  const { body } = await call('POST', '/creditos/importar/aplicar', TESORERA, formPlanilla(await planilla({ cuotaSosMayo: 45000 })));
  assert.strictEqual(body.data.resumen.actualizados, 1);
  const [sosA] = await creditosDe(A.id);
  const cuotas = await cuotasDe(sosA.id);
  assert.deepStrictEqual(cuotas.map((q) => [q.monto, q.estado]), [
    [30000, 'descontada'],
    [30000, 'descontada'],
    [30000, 'pendiente'],
    [45000, 'pendiente']
  ]);
});

await test('Un crédito pagado se muestra un mes y después sale del historial', async () => {
  const [sosB] = await creditosDe(B.id);
  const visible = await call('GET', '/creditos?estado=PAGADO&convenio=SOS', TESORERA);
  assert.ok(visible.body.data.some((c) => c.id === sosB.id));
  await query('UPDATE creditos SET fecha_finalizacion = DATE_SUB(CURDATE(), INTERVAL 40 DAY) WHERE id = ?', [sosB.id]);
  const oculto = await call('GET', '/creditos?estado=PAGADO&convenio=SOS', TESORERA);
  assert.ok(!oculto.body.data.some((c) => c.id === sosB.id));
});

// ---------------------------------------------------------------------------
// Créditos ingresados a mano (sin planilla)
const [D] = await query(
  `SELECT s.id, s.rut FROM socias s
   WHERE s.estado = 'ACTIVA' AND NOT EXISTS (SELECT 1 FROM creditos c WHERE c.socia_id = s.id)
   ORDER BY s.id LIMIT 1`
);
const nuevoSos = { sociaId: D.id, empresa: 'SOS', valorCuota: 20000, totalCuotas: 5, primeraCuota: '2027-06', cuotasPagadas: 2 };
let manualId;

await test('Manual: la Presidenta no puede ingresar ni modificar créditos', async () => {
  assert.strictEqual((await call('POST', '/creditos', PRESIDENTA, nuevoSos)).status, 403);
  assert.strictEqual((await call('POST', '/creditos', SECRETARIA, nuevoSos)).status, 403);
});

await test('Manual: valida ISIMUNDO sin N° de crédito y cuotas pagadas mayores al total', async () => {
  const isi = await call('POST', '/creditos', TESORERA, { ...nuevoSos, empresa: 'ISIMUNDO' });
  assert.strictEqual(isi.status, 400);
  assert.match(isi.body.message, /N° de crédito/);
  assert.strictEqual((await call('POST', '/creditos', TESORERA, { ...nuevoSos, cuotasPagadas: 5 })).status, 400);
  assert.strictEqual((await call('POST', '/creditos', TESORERA, { ...nuevoSos, primeraCuota: '2027-13' })).status, 400);
});

await test('Manual: nuevo crédito genera su calendario con las cuotas ya pagadas descontadas', async () => {
  const { status, body } = await call('POST', '/creditos', TESORERA, nuevoSos);
  assert.strictEqual(status, 201, body.message);
  manualId = body.data.id;
  const cuotas = await cuotasDe(manualId);
  assert.deepStrictEqual(cuotas.map((q) => [q.mes_cobro, q.estado]), [
    [6, 'descontada'], [7, 'descontada'], [8, 'pendiente'], [9, 'pendiente'], [10, 'pendiente']
  ]);
  const ficha = await call('GET', `/creditos/${manualId}`, TESORERA);
  assert.strictEqual(ficha.body.data.origen, 'MANUAL');
  assert.strictEqual(ficha.body.data.cuotasPagadas, 2);
  assert.strictEqual(ficha.body.data.montoPendiente, 60000);
});

await test('Manual: usa la misma clave que la planilla (no se duplica)', async () => {
  assert.strictEqual((await call('POST', '/creditos', TESORERA, nuevoSos)).status, 409);
  // A ya tiene el SOS de la planilla que parte en febrero 2027
  const dup = await call('POST', '/creditos', TESORERA, { ...nuevoSos, sociaId: A.id, primeraCuota: '2027-02', cuotasPagadas: 0 });
  assert.strictEqual(dup.status, 409);
});

await test('Manual: editar cambia solo las cuotas pendientes; con 2 restantes queda "Quedan 2 cuotas"', async () => {
  const bajo = await call('PUT', `/creditos/${manualId}`, TESORERA, { valorCuota: 20000, totalCuotas: 1 });
  assert.strictEqual(bajo.status, 400, 'no puede quedar con menos cuotas que las pagadas');
  const { status, body } = await call('PUT', `/creditos/${manualId}`, TESORERA, { valorCuota: 22000, totalCuotas: 4 });
  assert.strictEqual(status, 200, body.message);
  const cuotas = await cuotasDe(manualId);
  assert.deepStrictEqual(cuotas.map((q) => [q.monto, q.estado]), [
    [20000, 'descontada'], [20000, 'descontada'], [22000, 'pendiente'], [22000, 'pendiente']
  ]);
  const lista = await call('GET', '/creditos?estado=ULTIMAS_DOS&search=' + encodeURIComponent(D.rut), TESORERA);
  assert.ok(lista.body.data.some((c) => c.id === manualId && c.estado === 'ULTIMAS_DOS'));
  // Subir el total agrega cuotas al final, mes a mes
  await call('PUT', `/creditos/${manualId}`, TESORERA, { valorCuota: 22000, totalCuotas: 5 });
  const [ultima] = (await cuotasDe(manualId)).slice(-1);
  assert.deepStrictEqual([ultima.numero_cuota, ultima.mes_cobro, ultima.estado], [5, 10, 'pendiente']);
});

await test('Prepago: deja el crédito pagado y ya no se puede modificar', async () => {
  const futura = await call('POST', `/creditos/${manualId}/prepago`, TESORERA, { fecha: '2099-01-01' });
  assert.strictEqual(futura.status, 400);
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  const { status, body } = await call('POST', `/creditos/${manualId}/prepago`, TESORERA, { fecha: hoy });
  assert.strictEqual(status, 200, body.message);
  assert.deepStrictEqual([body.data.cuotas, body.data.monto], [3, 66000]);
  const [c] = await query('SELECT estado, cuotas_pagadas, total_cuotas FROM creditos WHERE id = ?', [manualId]);
  assert.deepStrictEqual([c.estado, c.cuotas_pagadas], ['finalizado', c.total_cuotas]);
  assert.ok((await cuotasDe(manualId)).slice(2).every((q) => q.estado === 'prepagada'));
  assert.strictEqual((await call('POST', `/creditos/${manualId}/prepago`, TESORERA, { fecha: hoy })).status, 409);
  assert.strictEqual((await call('PUT', `/creditos/${manualId}`, TESORERA, { valorCuota: 1000, totalCuotas: 5 })).status, 409);
});

await test('Anular: exige motivo, saca el crédito del historial y sus cuotas no se cobran', async () => {
  const pendientesDental = async () =>
    (await call('GET', '/creditos/periodo?mes=3&anio=2027', TESORERA)).body.data.find((e) => e.codigo === 'DENTAL').cuotasPendientes;
  const antes = await pendientesDental();
  const { body } = await call('POST', '/creditos', TESORERA, { ...nuevoSos, empresa: 'DENTAL', primeraCuota: '2027-03', cuotasPagadas: 0 });
  const id = body.data.id;
  assert.strictEqual(await pendientesDental(), antes + 1, 'la cuota de marzo del crédito nuevo queda pendiente');
  assert.strictEqual((await call('POST', `/creditos/${id}/anular`, TESORERA, { motivo: '' })).status, 400);
  const res = await call('POST', `/creditos/${id}/anular`, TESORERA, { motivo: 'Ingresado por error' });
  assert.strictEqual(res.status, 200, res.body.message);
  const ficha = await call('GET', `/creditos/${id}`, TESORERA);
  assert.deepStrictEqual([ficha.body.data.estado, ficha.body.data.motivoAnulacion], ['ANULADO', 'Ingresado por error']);
  const lista = await call('GET', '/creditos?convenio=DENTAL&search=' + encodeURIComponent(D.rut), TESORERA);
  assert.ok(!lista.body.data.some((c) => c.id === id));
  // La cuota de marzo del crédito anulado deja de contar como pendiente del mes
  assert.strictEqual(await pendientesDental(), antes);
});

console.log(`\n[RESULTADOS CRÉDITOS] ${passed} pasados, ${failed} fallidos`);
server.closeAllConnections?.();
server.close();
await dbPool?.end().catch(() => {});
fs.rmSync(uploadsDir, { recursive: true, force: true });
process.exitCode = failed > 0 ? 1 : 0;
