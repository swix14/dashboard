/**
 * Cifras por jardín (V7, decisión D2): solo totales del establecimiento, nunca nombres, RUT
 * ni montos de deudas individuales. Lo usan la directiva (los 23 jardines, en Reportes) y la
 * delegada (solo su jardín, en la pestaña "Mi jardín" del portal de socias).
 */
import { query } from '../config/db.js';
import { CUOTA_SOCIAL_MENSUAL } from '../utils/sociaFormat.js';

export class JardinStatsError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const n = (v) => Number(v || 0);
const porJardin = (rows) => new Map(rows.map((r) => [r.jardin_id, r]));

/**
 * @param {number} anio - año de las cifras "del año" (incorporaciones, retiros, traslados y S.O.S)
 * @param {number|null} jardinId - null = todos los jardines activos
 */
async function calcular(anio, jardinId = null) {
  const filtro = jardinId ? 'AND j.id = ?' : '';
  const params = jardinId ? [jardinId] : [];

  const [jardines, socias, traslados, creditos, sos, convenios] = await Promise.all([
    query(`SELECT j.id, j.codigo, j.nombre FROM jardines j WHERE j.activo = 1 ${filtro} ORDER BY j.codigo`, params),
    query(
      `SELECT jardin_id,
              SUM(estado = 'ACTIVA') AS activas,
              SUM(estado = 'SUSPENDIDA') AS suspendidas,
              SUM(estado <> 'RETIRADA' AND YEAR(fecha_ingreso) = ?) AS ingresos,
              SUM(estado = 'RETIRADA' AND YEAR(fecha_retiro) = ?) AS retiros,
              SUM(es_delegada = 1 AND estado <> 'RETIRADA') AS delegadas
       FROM socias WHERE jardin_id IS NOT NULL GROUP BY jardin_id`,
      [anio, anio]
    ),
    query(
      `SELECT j.id AS jardin_id,
              (SELECT COUNT(*) FROM historial_traslados t WHERE t.jardin_nuevo_id = j.id AND YEAR(t.created_at) = ?) AS entradas,
              (SELECT COUNT(*) FROM historial_traslados t WHERE t.jardin_anterior_id = j.id AND YEAR(t.created_at) = ?) AS salidas
       FROM jardines j`,
      [anio, anio]
    ),
    // Socias distintas con al menos un crédito vigente, por empresa (sin montos)
    query(
      `SELECT s.jardin_id, cv.codigo, COUNT(DISTINCT c.socia_id) AS socias
       FROM creditos c
       JOIN socias s ON s.id = c.socia_id
       JOIN convenios cv ON cv.id = c.convenio_id
       WHERE c.estado = 'vigente' AND s.estado <> 'RETIRADA' AND s.jardin_id IS NOT NULL
       GROUP BY s.jardin_id, cv.codigo WITH ROLLUP`
    ),
    query(
      `SELECT s.jardin_id,
              SUM(x.estado = 'PENDIENTE') AS pendientes,
              SUM(x.estado = 'APROBADA') AS aprobadas,
              SUM(x.estado = 'RECHAZADA') AS rechazadas
       FROM solicitudes_sos x JOIN socias s ON s.id = x.socia_id
       WHERE YEAR(x.created_at) = ? AND s.jardin_id IS NOT NULL
       GROUP BY s.jardin_id`,
      [anio]
    ),
    query('SELECT codigo, nombre FROM convenios WHERE activo = 1 AND codigo IS NOT NULL ORDER BY orden, id')
  ]);

  const sociasMap = porJardin(socias);
  const trasladosMap = porJardin(traslados);
  const sosMap = porJardin(sos);
  // ROLLUP: fila con codigo NULL = socias con algún crédito vigente en el jardín (sin contar doble)
  const creditosMap = new Map();
  for (const r of creditos) {
    if (r.jardin_id === null) continue;
    const c = creditosMap.get(r.jardin_id) || { total: 0, empresas: {} };
    if (r.codigo === null) c.total = n(r.socias);
    else c.empresas[r.codigo] = n(r.socias);
    creditosMap.set(r.jardin_id, c);
  }

  return {
    empresas: convenios.map((c) => ({ codigo: c.codigo, nombre: c.nombre })),
    jardines: jardines.map((j) => {
      const s = sociasMap.get(j.id) || {};
      const t = trasladosMap.get(j.id) || {};
      const c = creditosMap.get(j.id) || { total: 0, empresas: {} };
      const x = sosMap.get(j.id) || {};
      const activas = n(s.activas);
      return {
        id: j.id,
        codigo: j.codigo,
        nombre: j.nombre,
        tieneDelegada: n(s.delegadas) > 0,
        socias: {
          activas,
          suspendidas: n(s.suspendidas),
          ingresosAnio: n(s.ingresos),
          retirosAnio: n(s.retiros),
          trasladosEntrada: n(t.entradas),
          trasladosSalida: n(t.salidas)
        },
        creditos: {
          sociasConCredito: c.total,
          porEmpresa: convenios.map((cv) => ({ codigo: cv.codigo, nombre: cv.nombre, socias: c.empresas[cv.codigo] || 0 }))
        },
        sos: { pendientes: n(x.pendientes), aprobadas: n(x.aprobadas), rechazadas: n(x.rechazadas) },
        aporteMensual: activas * CUOTA_SOCIAL_MENSUAL
      };
    })
  };
}

export const JardinStatsService = {
  /** Los jardines activos con sus cifras y una fila de totales (directiva) */
  async todos(anio) {
    const { empresas, jardines } = await calcular(anio);
    const sumar = (fn) => jardines.reduce((acc, j) => acc + fn(j), 0);
    const totales = {
      activas: sumar((j) => j.socias.activas),
      suspendidas: sumar((j) => j.socias.suspendidas),
      ingresosAnio: sumar((j) => j.socias.ingresosAnio),
      retirosAnio: sumar((j) => j.socias.retirosAnio),
      sociasConCredito: sumar((j) => j.creditos.sociasConCredito),
      sosAnio: sumar((j) => j.sos.pendientes + j.sos.aprobadas + j.sos.rechazadas),
      aporteMensual: sumar((j) => j.aporteMensual),
      sinDelegada: jardines.filter((j) => !j.tieneDelegada).length
    };
    return { anio, cuotaSocial: CUOTA_SOCIAL_MENSUAL, empresas, jardines, totales };
  },

  /**
   * Cifras del jardín de una delegada. Se verifica en cada consulta que siga marcada como
   * delegada y activa en el padrón: si la directiva le quita la marca, pierde el acceso de inmediato.
   */
  async deDelegada(sociaId, anio) {
    const [socia] = await query('SELECT jardin_id, es_delegada, estado FROM socias WHERE id = ?', [sociaId]);
    if (!socia || !socia.es_delegada || socia.estado !== 'ACTIVA' || !socia.jardin_id) {
      throw new JardinStatsError('Esta sección es solo para las delegadas de jardín.', 403);
    }
    const { empresas, jardines } = await calcular(anio, socia.jardin_id);
    if (!jardines[0]) throw new JardinStatsError('Su jardín no está activo en el padrón.', 404);
    return { anio, cuotaSocial: CUOTA_SOCIAL_MENSUAL, empresas, jardin: jardines[0] };
  },

  /** true si la socia está marcada como delegada y activa (para el informe mensual y el balance) */
  async esDelegadaActiva(sociaId) {
    const [socia] = await query('SELECT es_delegada, estado FROM socias WHERE id = ?', [sociaId]);
    return Boolean(socia && socia.es_delegada && socia.estado === 'ACTIVA');
  }
};
