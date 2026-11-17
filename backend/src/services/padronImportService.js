/**
 * Carga mensual de la planilla "Maestra Socias" (Excel .xlsx).
 *
 * Flujo en dos pasos con el MISMO archivo:
 *  1. previsualizar: lee la planilla y la compara con MySQL sin modificar nada.
 *  2. aplicar: repite la comparación dentro de una transacción y aplica altas y cambios.
 *     El archivo se guarda en uploads/padron/AAAA/MM/ y queda registrado en cargas_padron.
 *
 * Reglas:
 *  - La socia se identifica por RUT (con o sin puntos).
 *  - Una celda vacía en la planilla NO borra el dato existente (celular, correo, cargo, jardín).
 *  - Las socias que no vienen en la planilla NO se dan de baja: se listan para revisión manual.
 *  - Una socia RETIRADA que reaparece se lista para revisión; su estado no cambia solo.
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { revisarContenedorXlsx } from '../utils/xlsxGuard.js';
import { query, withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import { validateRut, formatRutWithDots } from '../utils/rutValidator.js';
import { cleanRut, normalizeCargo, normalizeCelular, normalizeName, normalizeText } from '../utils/sociaFormat.js';
import { SociaError } from './sociaService.js';
import { hoyChile } from '../utils/fecha.js';

// Topes de la planilla mensual (auditoría H-016)
const PLANILLA_MAX_FILAS = 5000;
const PLANILLA_MAX_COLUMNAS = 60;

const MOTIVO_TRASLADO = 'Actualización por planilla Maestra Socias';

// Encabezados aceptados (sin tildes, minúsculas) -> campo interno
const HEADER_MAP = {
  rut: 'rut',
  'apellido paterno': 'apellidoPaterno',
  'apellido materno': 'apellidoMaterno',
  nombres: 'nombres',
  nombre: 'nombres',
  cargo: 'cargo',
  celular: 'celular',
  telefono: 'celular',
  correo: 'correo',
  'correo electronico': 'correo',
  email: 'correo',
  jardin: 'jardin',
  'jardin infantil': 'jardin',
  establecimiento: 'jardin'
};

const CAMPOS_LEGIBLES = {
  nombres: 'Nombres',
  apellidoPaterno: 'Apellido paterno',
  apellidoMaterno: 'Apellido materno',
  cargo: 'Cargo',
  celular: 'Celular',
  correo: 'Correo',
  jardin: 'Jardín'
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valor de celda de exceljs a texto plano (texto enriquecido, hipervínculos, fórmulas) */
function cellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((t) => t.text).join('');
    if (value.text !== undefined) return String(value.text);
    if (value.result !== undefined) return String(value.result);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value);
}

const jardinKey = (name) => normalizeText(name).replace(/^(jardin infantil|jardin|sala cuna)\s+/, '');

/**
 * Lee la primera hoja y devuelve las filas con encabezados reconocidos.
 */
async function leerPlanilla(buffer) {
  // Antes de abrirla: el índice del ZIP no debe declarar contenido gigante (bomba ZIP, H-016)
  const motivo = revisarContenedorXlsx(buffer);
  if (motivo) throw new SociaError(motivo);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new SociaError('No se pudo leer el archivo. Debe ser una planilla Excel .xlsx.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new SociaError('La planilla no tiene hojas.');
  // El padrón tiene unas 280 socias: estos topes dejan margen y evitan procesar hojas desmedidas
  if (sheet.rowCount > PLANILLA_MAX_FILAS) {
    throw new SociaError(`La planilla tiene ${sheet.rowCount} filas; el máximo permitido es ${PLANILLA_MAX_FILAS}.`);
  }
  if (sheet.columnCount > PLANILLA_MAX_COLUMNAS) {
    throw new SociaError(`La planilla tiene ${sheet.columnCount} columnas; el máximo permitido es ${PLANILLA_MAX_COLUMNAS}.`);
  }

  // El encabezado es la primera fila (de las 15 primeras) que contiene la columna RUT
  let headerRow = null;
  let columns = null;
  for (let r = 1; r <= Math.min(15, sheet.rowCount); r++) {
    const map = {};
    sheet.getRow(r).eachCell((cell, col) => {
      const campo = HEADER_MAP[normalizeText(cellText(cell.value))];
      if (campo && !Object.values(map).includes(campo)) map[col] = campo;
    });
    if (Object.values(map).includes('rut')) {
      headerRow = r;
      columns = map;
      break;
    }
  }
  if (!headerRow) {
    throw new SociaError('No se encontró la fila de encabezados: la planilla debe tener una columna "RUT".');
  }
  const faltantes = ['rut', 'nombres', 'apellidoPaterno'].filter((c) => !Object.values(columns).includes(c));
  if (faltantes.length) {
    throw new SociaError(`Faltan columnas obligatorias: ${faltantes.map((c) => CAMPOS_LEGIBLES[c] || 'RUT').join(', ')}.`);
  }

  const filas = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const data = { fila: r };
    let vacia = true;
    for (const [col, campo] of Object.entries(columns)) {
      const text = cellText(row.getCell(Number(col)).value).trim();
      if (text) vacia = false;
      data[campo] = text;
    }
    if (!vacia) filas.push(data);
  }
  return filas;
}

/**
 * Compara la planilla con el padrón. `tx` permite ejecutar las lecturas dentro de la transacción.
 */
async function compararConPadron(filas, tx = query) {
  const jardines = await tx('SELECT id, nombre FROM jardines WHERE activo = 1');
  const jardinPorNombre = new Map(jardines.map((j) => [jardinKey(j.nombre), j]));
  const jardinPorId = new Map(jardines.map((j) => [j.id, j]));

  const socias = await tx(
    `SELECT id, rut, nombres, apellido_paterno, apellido_materno, cargo, celular, correo, jardin_id, estado, es_delegada
     FROM socias`
  );
  const sociaPorRut = new Map(socias.map((s) => [cleanRut(s.rut), s]));

  const resultado = {
    totalFilas: filas.length,
    nuevas: [],
    actualizadas: [],
    sinCambios: 0,
    noIncluidas: [],
    retiradasEnPlanilla: [],
    errores: [],
    advertencias: []
  };
  const rutsEnPlanilla = new Set();

  for (const f of filas) {
    const rutLimpio = cleanRut(f.rut);
    const nombre = `${normalizeName(f.nombres)} ${normalizeName(f.apellidoPaterno)}`.trim();

    if (!validateRut(f.rut || '')) {
      resultado.errores.push({ fila: f.fila, rut: f.rut, nombre, motivo: 'RUT inválido' });
      continue;
    }
    if (rutsEnPlanilla.has(rutLimpio)) {
      resultado.errores.push({ fila: f.fila, rut: f.rut, nombre, motivo: 'RUT repetido en la planilla' });
      continue;
    }
    rutsEnPlanilla.add(rutLimpio);

    if (normalizeName(f.nombres).length < 2 || normalizeName(f.apellidoPaterno).length < 2) {
      resultado.errores.push({ fila: f.fila, rut: f.rut, nombre, motivo: 'Faltan nombres o apellido paterno' });
      continue;
    }

    let jardin = null;
    if (f.jardin) {
      jardin = jardinPorNombre.get(jardinKey(f.jardin)) || null;
      if (!jardin) {
        resultado.errores.push({ fila: f.fila, rut: f.rut, nombre, motivo: `Jardín no reconocido: "${f.jardin}"` });
        continue;
      }
    }

    // Datos propuestos por la planilla; undefined = la celda vino vacía y no se toca el dato actual
    const propuesto = {
      nombres: normalizeName(f.nombres),
      apellidoPaterno: normalizeName(f.apellidoPaterno),
      apellidoMaterno: f.apellidoMaterno ? normalizeName(f.apellidoMaterno) : undefined,
      cargo: f.cargo ? normalizeCargo(f.cargo) : undefined,
      celular: undefined,
      correo: undefined,
      jardinId: jardin ? jardin.id : undefined
    };

    if (f.celular) {
      const cel = normalizeCelular(f.celular);
      if (cel) propuesto.celular = cel;
      else resultado.advertencias.push({ fila: f.fila, rut: f.rut, nombre, motivo: `Celular no válido, se ignora: "${f.celular}"` });
    }
    if (f.correo) {
      const correo = f.correo.trim().toLowerCase();
      if (EMAIL_RE.test(correo)) propuesto.correo = correo;
      else resultado.advertencias.push({ fila: f.fila, rut: f.rut, nombre, motivo: `Correo no válido, se ignora: "${f.correo}"` });
    }
    if (f.cargo && propuesto.cargo === 'SIN DATO') {
      resultado.advertencias.push({ fila: f.fila, rut: f.rut, nombre, motivo: `Cargo no reconocido: "${f.cargo}" (queda SIN DATO)` });
    }
    if (!f.jardin) {
      resultado.advertencias.push({ fila: f.fila, rut: f.rut, nombre, motivo: 'Sin jardín en la planilla' });
    }

    const actual = sociaPorRut.get(rutLimpio);
    if (!actual) {
      resultado.nuevas.push({
        fila: f.fila,
        rut: formatRutWithDots(f.rut),
        nombre,
        datos: { ...propuesto, cargo: propuesto.cargo || 'SIN DATO' },
        jardin: jardin?.nombre || null
      });
      continue;
    }

    const cambios = {};
    const comparar = (campo, anterior, nuevo, mostrarAnterior = anterior, mostrarNuevo = nuevo) => {
      if (nuevo === undefined) return;
      if ((anterior ?? null) !== (nuevo ?? null)) {
        cambios[campo] = { anterior: mostrarAnterior ?? null, nuevo: mostrarNuevo ?? null };
      }
    };
    comparar('nombres', actual.nombres, propuesto.nombres);
    comparar('apellidoPaterno', actual.apellido_paterno, propuesto.apellidoPaterno);
    comparar('apellidoMaterno', actual.apellido_materno, propuesto.apellidoMaterno);
    // Un cargo no reconocido en la planilla no pisa un cargo válido ya registrado
    if (!(propuesto.cargo === 'SIN DATO' && actual.cargo !== 'SIN DATO')) {
      comparar('cargo', actual.cargo, propuesto.cargo);
    }
    // Se compara contra el dato actual ya normalizado: un cambio solo de formato no es un cambio
    comparar('celular', normalizeCelular(actual.celular) || actual.celular, propuesto.celular, actual.celular);
    comparar('correo', actual.correo ? actual.correo.trim().toLowerCase() : actual.correo, propuesto.correo, actual.correo);
    comparar(
      'jardin',
      actual.jardin_id,
      propuesto.jardinId,
      jardinPorId.get(actual.jardin_id)?.nombre,
      jardinPorId.get(propuesto.jardinId)?.nombre
    );

    if (actual.estado === 'RETIRADA') {
      resultado.retiradasEnPlanilla.push({ id: actual.id, rut: actual.rut, nombre });
    }

    if (Object.keys(cambios).length > 0) {
      resultado.actualizadas.push({ id: actual.id, fila: f.fila, rut: actual.rut, nombre, cambios, propuesto, actual });
    } else {
      resultado.sinCambios++;
    }
  }

  for (const s of socias) {
    if (s.estado !== 'RETIRADA' && !rutsEnPlanilla.has(cleanRut(s.rut))) {
      resultado.noIncluidas.push({
        id: s.id,
        rut: s.rut,
        nombre: `${s.nombres} ${s.apellido_paterno || ''}`.trim(),
        estado: s.estado,
        jardin: jardinPorId.get(s.jardin_id)?.nombre || null
      });
    }
  }

  return resultado;
}

/** Vista previa sin datos internos (lo que ve la pantalla) */
function toPreview(resultado, archivo) {
  return {
    archivo,
    totalFilas: resultado.totalFilas,
    resumen: {
      nuevas: resultado.nuevas.length,
      actualizadas: resultado.actualizadas.length,
      sinCambios: resultado.sinCambios,
      noIncluidas: resultado.noIncluidas.length,
      retiradasEnPlanilla: resultado.retiradasEnPlanilla.length,
      errores: resultado.errores.length,
      advertencias: resultado.advertencias.length
    },
    nuevas: resultado.nuevas.map(({ fila, rut, nombre, jardin, datos }) => ({ fila, rut, nombre, jardin, cargo: datos.cargo })),
    actualizadas: resultado.actualizadas.map(({ fila, rut, nombre, cambios }) => ({
      fila,
      rut,
      nombre,
      cambios: Object.entries(cambios).map(([campo, v]) => ({ campo: CAMPOS_LEGIBLES[campo] || campo, ...v }))
    })),
    noIncluidas: resultado.noIncluidas,
    retiradasEnPlanilla: resultado.retiradasEnPlanilla,
    errores: resultado.errores,
    advertencias: resultado.advertencias
  };
}

function guardarArchivo(buffer, originalName) {
  const now = new Date();
  const [yyyy, mm, dd] = hoyChile(now).split('-');
  const hora = now.toLocaleTimeString('en-GB', { timeZone: 'America/Santiago', hour12: false }).replace(/:/g, '');
  const stamp = `${yyyy}-${mm}-${dd}_${hora}`;
  const base = path.basename(originalName || 'planilla.xlsx').replace(/[^\w.\-]+/g, '_').slice(-80);
  const dir = path.join(env.UPLOADS_DIR, 'padron', yyyy, mm);
  fs.mkdirSync(dir, { recursive: true });
  // 'wx' nunca sobrescribe: si ya hay una planilla con ese nombre en el mismo segundo, se numera
  for (let n = 1; n < 1000; n++) {
    const name = n === 1 ? `${stamp}_${base}` : `${stamp}_${n}_${base}`;
    const absolute = path.join(dir, name);
    try {
      fs.writeFileSync(absolute, buffer, { flag: 'wx' });
      return { relative: ['padron', yyyy, mm, name].join('/'), absolute };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  throw new Error('No se pudo guardar la planilla: demasiadas cargas en el mismo segundo.');
}

export const PadronImportService = {
  async previsualizar(buffer, originalName) {
    const filas = await leerPlanilla(buffer);
    const resultado = await compararConPadron(filas);
    return toPreview(resultado, originalName);
  },

  async aplicar(buffer, originalName, realizadoPor) {
    const filas = await leerPlanilla(buffer);
    const archivo = guardarArchivo(buffer, originalName);

    try {
      return await withTransaction(async (tx) => {
        const resultado = await compararConPadron(filas, tx);
        const hoy = hoyChile();

        for (const n of resultado.nuevas) {
          await tx(
            `INSERT INTO socias (rut, nombres, apellido_paterno, apellido_materno, cargo, estado, jardin_id, celular, correo, fecha_ingreso)
             VALUES (?, ?, ?, ?, ?, 'ACTIVA', ?, ?, ?, ?)`,
            [
              n.rut,
              n.datos.nombres,
              n.datos.apellidoPaterno,
              n.datos.apellidoMaterno ?? null,
              n.datos.cargo,
              n.datos.jardinId ?? null,
              n.datos.celular ?? null,
              n.datos.correo ?? null,
              hoy
            ]
          );
        }

        const columnas = {
          nombres: 'nombres',
          apellidoPaterno: 'apellido_paterno',
          apellidoMaterno: 'apellido_materno',
          cargo: 'cargo',
          celular: 'celular',
          correo: 'correo'
        };
        for (const u of resultado.actualizadas) {
          const sets = [];
          const params = [];
          for (const [campo, col] of Object.entries(columnas)) {
            if (u.cambios[campo]) {
              sets.push(`${col} = ?`);
              params.push(u.propuesto[campo]);
            }
          }
          if (u.cambios.jardin) {
            sets.push('jardin_id = ?');
            params.push(u.propuesto.jardinId);
            if (u.actual.es_delegada) sets.push('es_delegada = 0');
            await tx(
              `INSERT INTO historial_traslados (socia_id, jardin_anterior_id, jardin_nuevo_id, motivo, realizado_por)
               VALUES (?, ?, ?, ?, ?)`,
              [u.id, u.actual.jardin_id, u.propuesto.jardinId, MOTIVO_TRASLADO, realizadoPor]
            );
          }
          await tx(`UPDATE socias SET ${sets.join(', ')} WHERE id = ?`, [...params, u.id]);
        }

        const preview = toPreview(resultado, originalName);
        const insert = await tx(
          `INSERT INTO cargas_padron
             (archivo_original, archivo_guardado, subido_por, total_filas, nuevas, actualizadas, sin_cambios, no_incluidas, con_error, detalle)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            originalName,
            archivo.relative,
            realizadoPor,
            preview.totalFilas,
            preview.resumen.nuevas,
            preview.resumen.actualizadas,
            preview.resumen.sinCambios,
            preview.resumen.noIncluidas,
            preview.resumen.errores,
            JSON.stringify(preview)
          ]
        );

        return { cargaId: insert.insertId, archivoGuardado: archivo.relative, ...preview };
      });
    } catch (err) {
      // Si la transacción falla, la planilla no queda registrada como aplicada
      fs.promises.unlink(archivo.absolute).catch(() => {});
      throw err;
    }
  },

  async historial(limit = 12) {
    const n = Math.min(Math.max(Number(limit) || 12, 1), 100);
    const rows = await query(
      `SELECT id, archivo_original, subido_por, total_filas, nuevas, actualizadas, sin_cambios, no_incluidas, con_error, created_at
       FROM cargas_padron ORDER BY created_at DESC, id DESC LIMIT ${n}`
    );
    return rows.map((r) => ({
      id: r.id,
      archivo: r.archivo_original,
      subidoPor: r.subido_por,
      totalFilas: r.total_filas,
      nuevas: r.nuevas,
      actualizadas: r.actualizadas,
      sinCambios: r.sin_cambios,
      noIncluidas: r.no_incluidas,
      conError: r.con_error,
      fecha: r.created_at
    }));
  }
};
