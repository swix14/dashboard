/**
 * Pruebas de la carga mensual de la planilla "Maestra Socias".
 * Genera planillas .xlsx con el mismo formato que la real (encabezado en la fila 2, desde la columna B).
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

// Comprobantes y planillas de esta suite en una carpeta temporal
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtf-padron-'));
process.env.UPLOADS_DIR = uploadsDir;

const { default: app } = await import('../src/server.js');
const { pool: dbPool, query, waitForDatabase, isDatabaseReady } = await import('../src/config/db.js');

await waitForDatabase();
if (!isDatabaseReady()) {
  console.error('padronImportTest requiere MySQL: ejecútelo con "npm test".');
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

const loginRes = await fetch(`${baseUrl}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'secretaria@vtftemuco.cl', password: 'Admin123!' })
});
const token = (await loginRes.json()).data.token;
const directoraRes = await fetch(`${baseUrl}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'directora@vtftemuco.cl', password: 'Admin123!' })
});
const directoraToken = (await directoraRes.json()).data.token;

/** Planilla con el formato de la Maestra Socias a partir de filas [rut, paterno, materno, nombres, cargo, celular, correo, jardin] */
async function crearPlanilla(filas) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hoja1');
  ws.getRow(2).values = [, 'RUT', 'APELLIDO PATERNO', 'APELLIDO MATERNO', 'NOMBRES', 'CARGO', 'CELULAR', 'CORREO', 'JARDÍN'];
  filas.forEach((f, i) => {
    ws.getRow(3 + i).values = [, ...f];
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function enviar(endpoint, buffer, nombre = 'Maestra Socias.xlsx', auth = token) {
  const form = new FormData();
  form.append('planilla', new Blob([buffer]), nombre);
  const res = await fetch(`${baseUrl}/socias/importar/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth}` },
    body: form
  });
  return { status: res.status, body: await res.json() };
}

// Planilla base = padrón actual de la base de prueba
const padron = await query(
  `SELECT s.rut, s.apellido_paterno, s.apellido_materno, s.nombres, s.cargo, s.celular, s.correo, j.nombre AS jardin
   FROM socias s LEFT JOIN jardines j ON j.id = s.jardin_id
   WHERE s.estado <> 'RETIRADA' ORDER BY s.id`
);
const filasBase = padron.map((s) => [
  s.rut,
  s.apellido_paterno,
  s.apellido_materno,
  s.nombres,
  s.cargo === 'SIN DATO' ? '' : s.cargo,
  s.celular || '',
  s.correo || '',
  s.jardin || ''
]);

// Cambios del "mes": 2 socias ya no vienen, 1 se traslada, 1 cambia celular, 1 nueva y 3 filas con error
const [sinCambio1, sinCambio2, trasladada, nuevoCelular, ...resto] = filasBase;
const filasMes = [
  [...trasladada.slice(0, 7), 'Boyeco'],
  [...nuevoCelular.slice(0, 5), '+569-11223344', ...nuevoCelular.slice(6)],
  ...resto,
  ['11.111.113-8', 'NUEVA', 'SOCIA', 'CAMILA ANDREA', 'Educadora ', '911112222', 'camila@correo.cl', 'Los Físicos'],
  ['12.345.678-0', 'RUT', 'MALO', 'PRUEBA', 'TECNICO', '', '', 'Boyeco'],
  ['13.963.291-5', 'DUPLICADA', 'EN', 'PLANILLA', 'TECNICO', '', '', 'Boyeco'],
  ['22.222.222-2', 'JARDIN', 'DESCONOCIDO', 'PRUEBA', 'TECNICO', '', '', 'Jardín Inexistente']
];
const planillaMes = await crearPlanilla(filasMes);

await test('Previsualizar no modifica la base y resume altas, cambios, ausentes y errores', async () => {
  const [{ total: antes }] = await query('SELECT COUNT(*) AS total FROM socias');
  const { status, body } = await enviar('previsualizar', planillaMes);
  assert.strictEqual(status, 200, body.message);
  const r = body.data.resumen;
  assert.strictEqual(r.nuevas, 1);
  assert.strictEqual(r.actualizadas, 2);
  assert.strictEqual(r.noIncluidas, 2);
  assert.strictEqual(r.errores, 3);
  assert.strictEqual(body.data.noIncluidas.map((s) => s.rut).sort().join(), [sinCambio1[0], sinCambio2[0]].sort().join());
  const motivos = body.data.errores.map((e) => e.motivo).join(' | ');
  assert.match(motivos, /RUT inválido/);
  assert.match(motivos, /repetido/);
  assert.match(motivos, /Jardín no reconocido/);
  const [{ total: despues }] = await query('SELECT COUNT(*) AS total FROM socias');
  assert.strictEqual(Number(despues), Number(antes));
});

await test('Previsualizar rechaza archivos que no son .xlsx y planillas sin columna RUT', async () => {
  const noXlsx = await enviar('previsualizar', Buffer.from('rut;nombre'), 'padron.csv');
  assert.strictEqual(noXlsx.status, 400);
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Hoja1').getRow(1).values = ['NOMBRE', 'JARDIN'];
  const sinRut = await enviar('previsualizar', Buffer.from(await wb.xlsx.writeBuffer()));
  assert.strictEqual(sinRut.status, 400);
  assert.match(sinRut.body.message, /RUT/);
});

await test('Directora (solo lectura) no puede cargar planillas', async () => {
  const { status } = await enviar('previsualizar', planillaMes, 'x.xlsx', directoraToken);
  assert.strictEqual(status, 403);
});

await test('Aplicar inserta la nueva, actualiza cambios con historial y no da de baja ausentes', async () => {
  const { status, body } = await enviar('aplicar', planillaMes);
  assert.strictEqual(status, 200, body.message);

  const [nueva] = await query(
    `SELECT s.nombres, s.cargo, s.celular, s.estado, j.nombre AS jardin FROM socias s
     LEFT JOIN jardines j ON j.id = s.jardin_id WHERE s.rut = '11.111.113-8'`
  );
  assert.deepStrictEqual(
    { ...nueva },
    { nombres: 'CAMILA ANDREA', cargo: 'EDUCADORA', celular: '+56911112222', estado: 'ACTIVA', jardin: 'Los Físicos' }
  );

  const [tras] = await query(
    `SELECT j.nombre AS jardin, (SELECT COUNT(*) FROM historial_traslados h WHERE h.socia_id = s.id) AS traslados
     FROM socias s JOIN jardines j ON j.id = s.jardin_id WHERE s.rut = ?`,
    [trasladada[0]]
  );
  assert.strictEqual(tras.jardin, 'Boyeco');
  assert.strictEqual(Number(tras.traslados), 1);

  const [cel] = await query('SELECT celular FROM socias WHERE rut = ?', [nuevoCelular[0]]);
  assert.strictEqual(cel.celular, '+56911223344');

  const ausentes = await query('SELECT estado FROM socias WHERE rut IN (?, ?)', [sinCambio1[0], sinCambio2[0]]);
  assert.ok(ausentes.every((s) => s.estado === 'ACTIVA'));
});

await test('La planilla queda guardada por año/mes y registrada en cargas_padron', async () => {
  const [carga] = await query('SELECT * FROM cargas_padron ORDER BY id DESC LIMIT 1');
  assert.strictEqual(carga.nuevas, 1);
  assert.strictEqual(carga.subido_por.length > 0, true);
  const now = new Date();
  assert.match(carga.archivo_guardado, new RegExp(`^padron/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/`));
  assert.ok(fs.existsSync(path.join(uploadsDir, carga.archivo_guardado)));

  const hist = await fetch(`${baseUrl}/socias/importar/historial`, { headers: { Authorization: `Bearer ${token}` } });
  const { data } = await hist.json();
  assert.strictEqual(data[0].id, carga.id);
});

await test('Aplicar dos veces la misma planilla no duplica ni cambia nada', async () => {
  const { body } = await enviar('previsualizar', planillaMes);
  assert.strictEqual(body.data.resumen.nuevas, 0);
  assert.strictEqual(body.data.resumen.actualizadas, 0);
  const [{ total }] = await query("SELECT COUNT(*) AS total FROM socias WHERE rut = '11.111.113-8'");
  assert.strictEqual(Number(total), 1);
});

await test('Celdas vacías no borran datos existentes', async () => {
  const [antes] = await query('SELECT celular, cargo, jardin_id FROM socias WHERE rut = ?', [nuevoCelular[0]]);
  const vacia = await crearPlanilla([[nuevoCelular[0], nuevoCelular[1], nuevoCelular[2], nuevoCelular[3], '', '', '', '']]);
  await enviar('aplicar', vacia);
  const [despues] = await query('SELECT celular, cargo, jardin_id FROM socias WHERE rut = ?', [nuevoCelular[0]]);
  assert.deepStrictEqual({ ...despues }, { ...antes });
});

console.log(`\n[RESULTADOS IMPORTACIÓN] ${passed} pasados, ${failed} fallidos`);
server.closeAllConnections?.();
server.close();
await dbPool?.end().catch(() => {});
fs.rmSync(uploadsDir, { recursive: true, force: true });
process.exitCode = failed > 0 ? 1 : 0;
