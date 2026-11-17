/**
 * Carga mensual de la planilla "Maestra Créditos" (día 18 de cada mes).
 *
 * Flujo en dos pasos con el MISMO archivo, igual que el padrón:
 *  1. previsualizar: lee la planilla y la compara con MySQL sin modificar nada.
 *  2. aplicar: repite la comparación dentro de una transacción, crea o actualiza créditos y cuotas,
 *     fija el monto A PAGAR de cada empresa para el mes y guarda el archivo en
 *     uploads/creditos/planillas/AAAA/MM/ (nunca se sobrescribe).
 *
 * Hojas reconocidas (por nombre, sin importar mayúsculas ni tildes):
 *  - SOS, Optica, Dental y Abogada: una columna por mes con el monto de la cuota.
 *  - ISIMUNDO: N° de crédito, fechas, monto prestado, valor cuota, total de cuotas,
 *    fecha de vencimiento y cuotas pagadas informadas por la empresa.
 *  - Hoja1 (resumen): descuento de cada empresa por socia; si existe, define el monto A PAGAR.
 *
 * Reglas:
 *  - El crédito se identifica por socia + empresa + clave (ISIMUNDO: N° de crédito;
 *    resto: mes de la primera cuota), así subir dos veces la planilla no duplica nada.
 *  - Crédito nuevo: las cuotas anteriores al mes cargado se consideran ya descontadas
 *    (en ISIMUNDO, las que la empresa informa como pagadas).
 *  - Las cuotas ya descontadas nunca se modifican; las pendientes se ajustan a la planilla.
 *  - Los créditos vigentes que no vienen en la planilla NO se cierran solos: se listan para revisión.
 *  - Un mes cuyo pago ya fue verificado no cambia su monto A PAGAR.
 */
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { revisarContenedorXlsx } from '../utils/xlsxGuard.js';
import { query, withTransaction } from '../config/db.js';
import { validateRut, formatRutWithDots } from '../utils/rutValidator.js';
import { cleanRut, normalizeText } from '../utils/sociaFormat.js';
import { hoyChile } from '../utils/fecha.js';
import { guardarArchivoHistorico } from '../utils/archivoHistorico.js';

// Topes de la planilla (auditoría H-016)
const MAX_FILAS = 5000;
const MAX_COLUMNAS = 80;
const MAX_CUOTAS = 120;

export const CONVENIO_CODIGOS = ['SOS', 'ISIMUNDO', 'OPTICA', 'DENTAL', 'ABOGADA'];
const HOJA_A_CODIGO = { sos: 'SOS', isimundo: 'ISIMUNDO', optica: 'OPTICA', dental: 'DENTAL', abogada: 'ABOGADA' };

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};
export const NOMBRE_MES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export class CreditoError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Utilidades de lectura
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const periodoKey = (anio, mes) => anio * 100 + mes;
export const claveMes = (anio, mes) => `${anio}-${pad(mes)}`;

export function sumarMeses(anio, mes, delta) {
  const total = anio * 12 + (mes - 1) + delta;
  return { anio: Math.floor(total / 12), mes: (total % 12) + 1 };
}

/** Encabezado normalizado: minúsculas, sin tildes ni símbolos ("Nº Crédito" -> "n credito") */
function limpiarEncabezado(text) {
  return normalizeText(text).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function cellValue(value) {
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if (Array.isArray(value.richText)) return value.richText.map((t) => t.text).join('');
    if (value.result !== undefined) return value.result;
    if (value.text !== undefined) return value.text;
  }
  return value;
}

function cellText(value) {
  const v = cellValue(value);
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** Entero desde número o texto ("$25.000", "'5"); null si la celda está vacía o no es un número */
function parseEntero(value) {
  const v = cellValue(value);
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const digits = String(v).replace(/[^\d-]/g, '');
  if (!digits || digits === '-') return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

/** Fecha AAAA-MM-DD desde Date, número de serie de Excel o texto (AAAA-MM-DD / DD-MM-AAAA) */
function parseFecha(value) {
  const v = cellValue(value);
  if (v === null || v === undefined || v === '') return null;
  let d = null;
  if (v instanceof Date) d = v;
  else if (typeof v === 'number' && v > 20000 && v < 80000) d = new Date(Math.round((v - 25569) * 86400000));
  else {
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    return null;
  }
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Año de una columna que solo dice el mes ("Septiembre"): se asume dentro de la ventana
 * de 9 meses antes a 3 meses después del mes cargado.
 */
function anioDeMes(mes, periodo) {
  const diff = mes - periodo.mes;
  if (diff > 3) return periodo.anio - 1;
  if (diff < -8) return periodo.anio + 1;
  return periodo.anio;
}

/** Clasifica un encabezado: campo conocido, columna de mes o null */
function clasificarEncabezado(rawValue, periodo) {
  const v = cellValue(rawValue);
  if (v instanceof Date) return { mes: { anio: v.getUTCFullYear(), mes: v.getUTCMonth() + 1 } };
  const text = cellText(v);
  const fechaTexto = text.match(/^(\d{4})-(\d{1,2})(-\d{1,2})?$/);
  if (fechaTexto) return { mes: { anio: Number(fechaTexto[1]), mes: Number(fechaTexto[2]) } };
  const h = limpiarEncabezado(text);
  if (!h) return null;
  if (MESES[h]) return { mes: { anio: anioDeMes(MESES[h], periodo), mes: MESES[h] } };
  const mesAnio = h.match(/^([a-z]+) (\d{4})$/);
  if (mesAnio && MESES[mesAnio[1]]) return { mes: { anio: Number(mesAnio[2]), mes: MESES[mesAnio[1]] } };

  if (h === 'rut') return { campo: 'rut' };
  if (h === 'apellido paterno' || h === 'primer apellido') return { campo: 'apellidoPaterno' };
  if (h === 'apellido materno' || h === 'segundo apellido') return { campo: 'apellidoMaterno' };
  if (h === 'nombres' || h === 'nombre') return { campo: 'nombres' };
  if (/^(n|no|nro|num|numero) credito/.test(h)) return { campo: 'numero' };
  if (h.startsWith('fecha otorgamiento')) return { campo: 'fechaOtorgamiento' };
  if (h.startsWith('fecha termino')) return { campo: 'fechaTermino' };
  if (h.startsWith('fecha vencimiento')) return { campo: 'fechaVencimiento' };
  if (h.startsWith('monto prestado') || h === 'monto otorgado') return { campo: 'montoPrestado' };
  if (h.startsWith('valor cuota')) return { campo: 'valorCuota' };
  if (h.startsWith('valor adicional')) return { campo: 'valorAdicional' };
  if (h.startsWith('cuotas pagadas')) return { campo: 'cuotasPagadas' };
  if (h === 'cuotas' || h.startsWith('numero total') || h === 'total cuotas') return { campo: 'totalCuotas' };
  // Hoja resumen
  if (h.startsWith('cuota asociacion')) return { campo: 'cuotaAsociacion' };
  const desc = h.match(/^descuento (sos|isimundo|isi mundo|optica|dental|abogad[ao]?)/);
  if (desc) {
    const key = desc[1].replace(' ', '').replace(/^abogad.*/, 'abogada');
    return { campo: `descuento_${HOJA_A_CODIGO[key]}` };
  }
  return null;
}

/** Lee una hoja: fila de encabezados (la primera con "RUT") y filas con datos */
function leerHoja(sheet, periodo) {
  if (sheet.rowCount > MAX_FILAS) {
    throw new CreditoError(`La hoja "${sheet.name}" tiene ${sheet.rowCount} filas; el máximo es ${MAX_FILAS}.`);
  }
  if (sheet.columnCount > MAX_COLUMNAS) {
    throw new CreditoError(`La hoja "${sheet.name}" tiene ${sheet.columnCount} columnas; el máximo es ${MAX_COLUMNAS}.`);
  }
  let headerRow = null;
  let columnas = null;
  for (let r = 1; r <= Math.min(15, sheet.rowCount); r++) {
    const map = {};
    sheet.getRow(r).eachCell((cell, col) => {
      const c = clasificarEncabezado(cell.value, periodo);
      if (c) map[col] = c;
    });
    if (Object.values(map).some((c) => c.campo === 'rut')) {
      headerRow = r;
      columnas = map;
      break;
    }
  }
  if (!headerRow) return null;

  const filas = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const fila = { fila: r, meses: [] };
    let vacia = true;
    for (const [col, c] of Object.entries(columnas)) {
      const raw = row.getCell(Number(col)).value;
      if (cellText(raw) !== '') vacia = false;
      if (c.mes) {
        const monto = parseEntero(raw);
        if (monto && monto > 0) fila.meses.push({ ...c.mes, monto });
      } else {
        fila[c.campo] = raw;
      }
    }
    if (!vacia && cellText(fila.rut) !== '') filas.push(fila);
  }
  return { filas, tieneMeses: Object.values(columnas).some((c) => c.mes) };
}

function nombreDeFila(fila) {
  return [cellText(fila.nombres), cellText(fila.apellidoPaterno), cellText(fila.apellidoMaterno)].filter(Boolean).join(' ');
}

/**
 * Convierte una fila de una hoja de empresa en un crédito con su calendario de cuotas.
 * @returns {{ credito?: object, error?: string }}
 */
function creditoDesdeFila(codigo, fila, periodo) {
  if (codigo === 'ISIMUNDO') {
    const numero = cellText(fila.numero);
    const valorCuota = parseEntero(fila.valorCuota);
    const total = parseEntero(fila.totalCuotas);
    if (!numero) return { error: 'Falta el N° de crédito.' };
    if (!valorCuota || valorCuota <= 0) return { error: 'Valor de cuota inválido.' };
    if (!total || total <= 0 || total > MAX_CUOTAS) return { error: 'Número total de cuotas inválido.' };
    const pagadas = Math.min(Math.max(parseEntero(fila.cuotasPagadas) ?? 0, 0), total);
    // La fecha de vencimiento corresponde a la próxima cuota (pagadas + 1)
    const venc = parseFecha(fila.fechaVencimiento);
    const base = venc ? { anio: Number(venc.slice(0, 4)), mes: Number(venc.slice(5, 7)) } : periodo;
    const cuotas = [];
    for (let k = 1; k <= total; k++) {
      cuotas.push({ numero: k, ...sumarMeses(base.anio, base.mes, k - (pagadas + 1)), monto: valorCuota });
    }
    const primera = cuotas[0];
    const ultima = cuotas[cuotas.length - 1];
    return {
      credito: {
        clave: numero.slice(0, 40),
        numeroCredito: numero.slice(0, 50),
        montoTotal: parseEntero(fila.montoPrestado) || valorCuota * total,
        montoCuota: valorCuota,
        totalCuotas: total,
        fechaInicio: parseFecha(fila.fechaOtorgamiento) || `${claveMes(primera.anio, primera.mes)}-01`,
        fechaTermino: parseFecha(fila.fechaTermino) || `${claveMes(ultima.anio, ultima.mes)}-01`,
        pagadasInformadas: pagadas,
        cuotas
      }
    };
  }

  // SOS, Óptica, Dental y Abogada: calendario por columnas de mes
  const meses = [...fila.meses].sort((a, b) => periodoKey(a.anio, a.mes) - periodoKey(b.anio, b.mes));
  if (meses.length === 0) return { error: 'No tiene cuotas con monto en ningún mes.' };
  // Valor de cuota: el de la planilla o, si no viene, el de la primera cuota
  const valorCuota = parseEntero(fila.valorCuota) || meses[0].monto;
  let total = parseEntero(fila.totalCuotas) || meses.length;
  if (total < meses.length) total = meses.length;
  if (total > MAX_CUOTAS) return { error: 'Número total de cuotas inválido.' };
  const cuotas = meses.map((m, i) => ({ numero: i + 1, anio: m.anio, mes: m.mes, monto: m.monto }));
  // Si la planilla no alcanza a mostrar todas las cuotas, las que faltan siguen mes a mes
  while (cuotas.length < total) {
    const ultima = cuotas[cuotas.length - 1];
    cuotas.push({ numero: cuotas.length + 1, ...sumarMeses(ultima.anio, ultima.mes, 1), monto: valorCuota });
  }
  const primera = cuotas[0];
  const ultima = cuotas[cuotas.length - 1];
  return {
    credito: {
      clave: claveMes(primera.anio, primera.mes),
      numeroCredito: null,
      montoTotal: cuotas.reduce((s, c) => s + c.monto, 0),
      montoCuota: valorCuota,
      totalCuotas: total,
      fechaInicio: `${claveMes(primera.anio, primera.mes)}-01`,
      fechaTermino: `${claveMes(ultima.anio, ultima.mes)}-01`,
      pagadasInformadas: null,
      cuotas
    }
  };
}

/** Lee el libro completo: créditos por empresa y, si existe, el resumen de descuentos por socia */
async function leerPlanilla(buffer, periodo) {
  const motivo = revisarContenedorXlsx(buffer);
  if (motivo) throw new CreditoError(motivo);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new CreditoError('No se pudo leer el archivo. Debe ser una planilla Excel .xlsx.');
  }

  const hojas = {};
  let resumen = null;
  for (const sheet of workbook.worksheets) {
    const key = normalizeText(sheet.name).replace(/[^a-z]/g, '');
    const codigo = HOJA_A_CODIGO[key];
    const datos = leerHoja(sheet, periodo);
    if (!datos) continue;
    if (codigo) hojas[codigo] = datos.filas;
    else if (!resumen && datos.filas.some((f) => CONVENIO_CODIGOS.some((c) => f[`descuento_${c}`] !== undefined))) {
      resumen = datos.filas;
    }
  }
  if (Object.keys(hojas).length === 0) {
    throw new CreditoError('La planilla no tiene hojas de empresa reconocibles (SOS, ISIMUNDO, Optica, Dental o Abogada).');
  }
  return { hojas, resumen };
}

// ---------------------------------------------------------------------------
// Comparación con MySQL
// ---------------------------------------------------------------------------
function firmaCuotas(cuotas) {
  return cuotas
    .map((c) => `${claveMes(c.anio, c.mes)}:${c.monto}`)
    .sort()
    .join('|');
}

async function comparar({ hojas, resumen }, periodo, tx = query) {
  const convenios = await tx('SELECT id, codigo, nombre FROM convenios WHERE codigo IS NOT NULL');
  const convenioPorCodigo = new Map(convenios.map((c) => [c.codigo, c]));
  const socias = await tx('SELECT id, rut, estado FROM socias');
  const sociaPorRut = new Map(socias.map((s) => [cleanRut(s.rut), s]));
  // Respaldo: la planilla de la empresa a veces trae mal el dígito verificador
  const sociaPorCuerpo = new Map(socias.map((s) => [cleanRut(s.rut).slice(0, -1), s]));

  const codigos = Object.keys(hojas).filter((c) => convenioPorCodigo.has(c));
  const ids = codigos.map((c) => convenioPorCodigo.get(c).id);
  const existentes = ids.length
    ? await tx(
        `SELECT id, socia_id, convenio_id, clave_carga, monto_total, monto_cuota, total_cuotas, cuotas_pagadas, estado
         FROM creditos WHERE convenio_id IN (${ids.map(() => '?').join(',')})`,
        ids
      )
    : [];
  const cuotasRows = existentes.length
    ? await tx(
        `SELECT q.credito_id, q.numero_cuota, q.monto, q.mes_cobro, q.anio_cobro, q.estado
         FROM cuotas_credito q JOIN creditos c ON c.id = q.credito_id
         WHERE c.convenio_id IN (${ids.map(() => '?').join(',')})`,
        ids
      )
    : [];
  const cuotasPorCredito = new Map();
  for (const q of cuotasRows) {
    if (!cuotasPorCredito.has(q.credito_id)) cuotasPorCredito.set(q.credito_id, []);
    cuotasPorCredito.get(q.credito_id).push({
      numero: q.numero_cuota,
      anio: q.anio_cobro,
      mes: q.mes_cobro,
      monto: q.monto,
      estado: q.estado
    });
  }
  const existentePorClave = new Map(existentes.map((e) => [`${e.socia_id}|${e.convenio_id}|${e.clave_carga}`, e]));
  const pagos = await tx('SELECT convenio_id, verificado_at FROM pagos_convenio WHERE anio = ? AND mes = ?', [periodo.anio, periodo.mes]);
  const verificados = new Set(pagos.filter((p) => p.verificado_at).map((p) => p.convenio_id));

  const resultado = { nuevos: [], actualizados: [], sinCambios: [], errores: [], noIncluidos: [], empresas: [], advertencias: [] };
  const vistos = new Set();

  for (const codigo of Object.keys(hojas)) {
    const convenio = convenioPorCodigo.get(codigo);
    if (!convenio) {
      resultado.advertencias.push(`La empresa ${codigo} no existe en el sistema: se omitió su hoja.`);
      continue;
    }
    let cuotasDelMes = 0;
    let creditosHoja = 0;
    for (const fila of hojas[codigo]) {
      const rutTexto = cellText(fila.rut);
      const base = { empresa: codigo, fila: fila.fila, rut: rutTexto, nombre: nombreDeFila(fila) };
      const rutLimpio = cleanRut(rutTexto);
      let socia = sociaPorRut.get(rutLimpio);
      if (!socia && rutLimpio.length >= 8) {
        socia = sociaPorCuerpo.get(rutLimpio.slice(0, -1));
        if (socia) {
          resultado.advertencias.push(
            `${convenio.nombre}, fila ${fila.fila}: el RUT ${rutTexto} tiene otro dígito verificador; se asignó a la socia ${socia.rut} del padrón.`
          );
        }
      }
      if (!socia) {
        resultado.errores.push({
          ...base,
          motivo: validateRut(rutTexto) ? 'La socia no está en el padrón.' : 'RUT inválido y no está en el padrón.'
        });
        continue;
      }
      const { credito, error } = creditoDesdeFila(codigo, fila, periodo);
      if (error) {
        resultado.errores.push({ ...base, motivo: error });
        continue;
      }
      const key = `${socia.id}|${convenio.id}|${credito.clave}`;
      if (vistos.has(key)) {
        resultado.errores.push({ ...base, motivo: 'Crédito repetido en la misma hoja.' });
        continue;
      }
      vistos.add(key);
      creditosHoja++;
      cuotasDelMes += credito.cuotas
        .filter((c) => c.anio === periodo.anio && c.mes === periodo.mes)
        .reduce((s, c) => s + c.monto, 0);

      const item = { ...base, rut: formatRutWithDots(socia.rut), sociaId: socia.id, convenioId: convenio.id, credito };
      const actual = existentePorClave.get(key);
      if (!actual) {
        resultado.nuevos.push(item);
        continue;
      }
      const cuotasActuales = cuotasPorCredito.get(actual.id) || [];
      const cambios = [];
      if (Number(actual.monto_total) !== credito.montoTotal) cambios.push('monto total');
      if (Number(actual.monto_cuota) !== credito.montoCuota) cambios.push('valor cuota');
      if (Number(actual.total_cuotas) !== credito.totalCuotas) cambios.push('total de cuotas');
      if (firmaCuotas(cuotasActuales) !== firmaCuotas(credito.cuotas)) cambios.push('calendario de cuotas');
      if (cambios.length && actual.estado !== 'anulado') {
        resultado.actualizados.push({ ...item, creditoId: actual.id, cambios, cuotasActuales });
      } else {
        resultado.sinCambios.push({ ...item, creditoId: actual.id });
      }
    }

    // Créditos vigentes de esta empresa que la planilla ya no trae: revisión manual
    for (const e of existentes) {
      if (e.convenio_id !== convenio.id || e.estado !== 'vigente') continue;
      if (!vistos.has(`${e.socia_id}|${e.convenio_id}|${e.clave_carga}`)) {
        const socia = socias.find((s) => s.id === e.socia_id);
        resultado.noIncluidos.push({ empresa: codigo, creditoId: e.id, rut: socia?.rut || '', clave: e.clave_carga });
      }
    }

    // Monto A PAGAR del mes: la hoja resumen manda; si no viene, la suma de las cuotas del mes
    let aPagar = cuotasDelMes;
    let fuente = 'cuotas';
    if (resumen) {
      aPagar = resumen.reduce((s, f) => s + (parseEntero(f[`descuento_${codigo}`]) || 0), 0);
      fuente = 'resumen';
      if (aPagar !== cuotasDelMes) {
        resultado.advertencias.push(
          `${convenio.nombre}: el resumen indica $${aPagar.toLocaleString('es-CL')} y las cuotas del mes suman $${cuotasDelMes.toLocaleString('es-CL')}.`
        );
      }
    }
    const yaVerificado = verificados.has(convenio.id);
    if (yaVerificado) {
      resultado.advertencias.push(`${convenio.nombre}: el pago de ${NOMBRE_MES[periodo.mes]} ya fue verificado; su monto a pagar no cambia.`);
    }
    resultado.empresas.push({ codigo, convenioId: convenio.id, nombre: convenio.nombre, creditos: creditosHoja, aPagar, cuotasDelMes, fuente, yaVerificado });
  }
  return resultado;
}

function toPreview(resultado, originalName, periodo) {
  const resumir = (x) => ({ empresa: x.empresa, fila: x.fila, rut: x.rut, nombre: x.nombre, cuotas: x.credito.totalCuotas, montoCuota: x.credito.montoCuota });
  return {
    archivo: originalName,
    periodo,
    resumen: {
      nuevos: resultado.nuevos.length,
      actualizados: resultado.actualizados.length,
      sinCambios: resultado.sinCambios.length,
      noIncluidos: resultado.noIncluidos.length,
      errores: resultado.errores.length
    },
    empresas: resultado.empresas.map(({ convenioId, ...e }) => e),
    nuevos: resultado.nuevos.slice(0, 200).map(resumir),
    actualizados: resultado.actualizados.slice(0, 200).map((x) => ({ ...resumir(x), cambios: x.cambios })),
    noIncluidos: resultado.noIncluidos.slice(0, 200),
    errores: resultado.errores.slice(0, 200),
    advertencias: resultado.advertencias
  };
}

// ---------------------------------------------------------------------------
// Aplicación
// ---------------------------------------------------------------------------
const esAnterior = (c, periodo) => periodoKey(c.anio, c.mes) < periodoKey(periodo.anio, periodo.mes);

/** Estado inicial de una cuota que aún no existe en el sistema */
// La cuota del mes cargado siempre queda pendiente: se descuenta al verificar el pago (días 1 al 5).
// En ISIMUNDO, además, solo cuentan como descontadas las que la empresa informa como pagadas.
function estadoInicial(cuota, credito, periodo) {
  if (!esAnterior(cuota, periodo)) return 'pendiente';
  if (credito.pagadasInformadas !== null) return cuota.numero <= credito.pagadasInformadas ? 'descontada' : 'pendiente';
  return 'descontada';
}

/** Recalcula cuotas pagadas y estado del crédito a partir de sus cuotas */
export async function recalcularCredito(tx, creditoId, hoy) {
  const [r] = await tx(
    `SELECT c.total_cuotas, c.estado, c.fecha_finalizacion,
            (SELECT COUNT(*) FROM cuotas_credito q WHERE q.credito_id = c.id AND q.estado IN ('descontada', 'condonada', 'prepagada')) AS pagadas
     FROM creditos c WHERE c.id = ?`,
    [creditoId]
  );
  if (!r || r.estado === 'anulado') return;
  const pagadas = Number(r.pagadas);
  const finalizado = pagadas >= Number(r.total_cuotas);
  await tx(
    `UPDATE creditos SET cuotas_pagadas = ?, estado = ?, fecha_finalizacion = ? WHERE id = ?`,
    [pagadas, finalizado ? 'finalizado' : 'vigente', finalizado ? r.fecha_finalizacion || hoy : null, creditoId]
  );
}

export const CreditImportService = {
  async previsualizar(buffer, originalName, periodo) {
    const libro = await leerPlanilla(buffer, periodo);
    const resultado = await comparar(libro, periodo);
    return toPreview(resultado, originalName, periodo);
  },

  async aplicar(buffer, originalName, periodo, realizadoPor) {
    const libro = await leerPlanilla(buffer, periodo);
    const archivo = guardarArchivoHistorico(buffer, ['creditos', 'planillas', String(periodo.anio), pad(periodo.mes)], originalName || 'maestra-creditos.xlsx');
    const hoy = hoyChile();

    try {
      return await withTransaction(async (tx) => {
        const resultado = await comparar(libro, periodo, tx);

        for (const n of resultado.nuevos) {
          const c = n.credito;
          const insert = await tx(
            `INSERT INTO creditos (socia_id, convenio_id, numero_credito, monto_total, monto_cuota, total_cuotas,
                                   cuotas_pagadas, fecha_otorgamiento, fecha_termino, estado, clave_carga)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'vigente', ?)`,
            [n.sociaId, n.convenioId, c.numeroCredito, c.montoTotal, c.montoCuota, c.totalCuotas, c.fechaInicio, c.fechaTermino, c.clave]
          );
          for (const q of c.cuotas) {
            const estado = estadoInicial(q, c, periodo);
            await tx(
              `INSERT INTO cuotas_credito (credito_id, numero_cuota, monto, mes_cobro, anio_cobro, estado) VALUES (?, ?, ?, ?, ?, ?)`,
              [insert.insertId, q.numero, q.monto, q.mes, q.anio, estado]
            );
          }
          await recalcularCredito(tx, insert.insertId, hoy);
        }

        for (const u of resultado.actualizados) {
          const c = u.credito;
          await tx(
            `UPDATE creditos SET numero_credito = COALESCE(?, numero_credito), monto_total = ?, monto_cuota = ?, total_cuotas = ?,
                                 fecha_otorgamiento = ?, fecha_termino = ? WHERE id = ?`,
            [c.numeroCredito, c.montoTotal, c.montoCuota, c.totalCuotas, c.fechaInicio, c.fechaTermino, u.creditoId]
          );
          // Las cuotas se emparejan por número: las descontadas nunca se tocan, las pendientes
          // toman el mes y monto de la planilla y las que sobran (pendientes) se eliminan
          const porNumero = new Map(u.cuotasActuales.map((q) => [q.numero, q]));
          for (const q of u.cuotasActuales) {
            if (q.estado === 'pendiente' && q.numero > c.totalCuotas) {
              await tx(`DELETE FROM cuotas_credito WHERE credito_id = ? AND numero_cuota = ? AND estado = 'pendiente'`, [u.creditoId, q.numero]);
            }
          }
          for (const q of c.cuotas) {
            const actual = porNumero.get(q.numero);
            if (!actual) {
              await tx(
                `INSERT INTO cuotas_credito (credito_id, numero_cuota, monto, mes_cobro, anio_cobro, estado) VALUES (?, ?, ?, ?, ?, ?)`,
                [u.creditoId, q.numero, q.monto, q.mes, q.anio, estadoInicial(q, c, periodo)]
              );
            } else if (actual.estado === 'pendiente') {
              await tx(
                `UPDATE cuotas_credito SET monto = ?, mes_cobro = ?, anio_cobro = ? WHERE credito_id = ? AND numero_cuota = ? AND estado = 'pendiente'`,
                [q.monto, q.mes, q.anio, u.creditoId, q.numero]
              );
            }
          }
          await recalcularCredito(tx, u.creditoId, hoy);
        }

        const preview = toPreview(resultado, originalName, periodo);
        const insert = await tx(
          `INSERT INTO cargas_creditos (mes, anio, archivo_original, archivo_guardado, subido_por,
                                        creditos_nuevos, creditos_actualizados, sin_cambios, con_error, detalle)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            periodo.mes,
            periodo.anio,
            String(originalName || 'maestra-creditos.xlsx').slice(0, 255),
            archivo.relative,
            realizadoPor,
            preview.resumen.nuevos,
            preview.resumen.actualizados,
            preview.resumen.sinCambios,
            preview.resumen.errores,
            JSON.stringify(preview)
          ]
        );

        // Monto A PAGAR de cada empresa para el mes (no cambia si el pago ya fue verificado)
        for (const e of resultado.empresas) {
          await tx(
            `INSERT INTO pagos_convenio (convenio_id, mes, anio, monto_a_pagar, carga_id) VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               monto_a_pagar = IF(verificado_at IS NULL, VALUES(monto_a_pagar), monto_a_pagar),
               carga_id = IF(verificado_at IS NULL, VALUES(carga_id), carga_id)`,
            [e.convenioId, periodo.mes, periodo.anio, e.aPagar, insert.insertId]
          );
        }

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
      `SELECT id, mes, anio, archivo_original, subido_por, creditos_nuevos, creditos_actualizados, sin_cambios, con_error, created_at
       FROM cargas_creditos ORDER BY created_at DESC, id DESC LIMIT ${n}`
    );
    return rows.map((r) => ({
      id: r.id,
      mes: r.mes,
      anio: r.anio,
      archivo: r.archivo_original,
      subidoPor: r.subido_por,
      nuevos: r.creditos_nuevos,
      actualizados: r.creditos_actualizados,
      sinCambios: r.sin_cambios,
      conError: r.con_error,
      fecha: r.created_at
    }));
  }
};
