/**
 * Servicio del Padrón de Socias — Asociación VTF Temuco (V3, 100% MySQL)
 * Reglas de negocio:
 * - Estados: ACTIVA / SUSPENDIDA / RETIRADA. Solo las ACTIVAS pagan la cuota social de $4.000.
 * - RETIRADA es una baja lógica: deja de contar y de aparecer por defecto, pero conserva
 *   sus créditos e historial y puede reactivarse.
 * - Un traslado de jardín exige motivo y queda en historial_traslados (en la misma transacción).
 * - Columna CRÉDITO: SI cuando la socia mantiene al menos un crédito vigente.
 */
import { query, withTransaction } from '../config/db.js';
import { formatRutWithDots } from '../utils/rutValidator.js';
import { cleanRut, CUOTA_SOCIAL_MENSUAL } from '../utils/sociaFormat.js';
import { hoyChile } from '../utils/fecha.js';

export class SociaError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const MAX_EXPORT = 5000;

// RUT de la tabla sin puntos ni guion, para comparar con lo que escriba la usuaria
const RUT_LIMPIO_SQL = "UPPER(REPLACE(REPLACE(REPLACE(s.rut, '.', ''), '-', ''), ' ', ''))";

// Socias con al menos un crédito vigente
const CREDITO_VIGENTE_SQL = "EXISTS (SELECT 1 FROM creditos c WHERE c.socia_id = s.id AND c.estado = 'vigente')";

const SOCIA_COLUMNS = `
  s.id, s.rut, s.nombres, s.apellido_paterno, s.apellido_materno, s.cargo, s.celular, s.correo,
  s.estado, s.es_delegada, s.motivo_retiro,
  DATE_FORMAT(s.fecha_retiro, '%Y-%m-%d') AS fecha_retiro,
  DATE_FORMAT(s.fecha_ingreso, '%Y-%m-%d') AS fecha_ingreso,
  j.id AS jardin_id, j.codigo AS jardin_codigo, j.nombre AS jardin_nombre`;

function toListItem(row, creditosActivos = []) {
  const apellidos = [row.apellido_paterno, row.apellido_materno].filter(Boolean).join(' ');
  return {
    id: row.id,
    rut: row.rut,
    nombres: row.nombres,
    apellidoPaterno: row.apellido_paterno || '',
    apellidoMaterno: row.apellido_materno || '',
    // Compatibilidad con las vistas que muestran nombre + apellidos
    firstName: row.nombres,
    lastName: apellidos,
    cargo: row.cargo,
    estado: row.estado,
    celular: row.celular,
    correo: row.correo,
    fechaIngreso: row.fecha_ingreso,
    esDelegada: Boolean(row.es_delegada),
    jardin: row.jardin_id ? { id: row.jardin_id, code: row.jardin_codigo, name: row.jardin_nombre } : null,
    cuotaMensual: row.estado === 'ACTIVA' ? CUOTA_SOCIAL_MENSUAL : 0,
    tieneCredito: creditosActivos.length > 0,
    creditosActivos
  };
}

/** Créditos vigentes resumidos por socia (empresa y cuotas), para el listado */
async function creditosVigentesPorSocia(ids) {
  if (ids.length === 0) return new Map();
  const rows = await query(
    `SELECT c.socia_id, cv.nombre AS convenio, c.cuotas_pagadas, c.total_cuotas, c.monto_total
     FROM creditos c JOIN convenios cv ON cv.id = c.convenio_id
     WHERE c.estado = 'vigente' AND c.socia_id IN (${ids.map(() => '?').join(', ')})
     ORDER BY cv.nombre`,
    ids
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.socia_id)) map.set(r.socia_id, []);
    map.get(r.socia_id).push({
      tipo: r.convenio,
      cuotasPagadas: r.cuotas_pagadas,
      totalCuotas: r.total_cuotas,
      montoTotal: r.monto_total
    });
  }
  return map;
}

async function findSociaRow(id, tx = query) {
  const rows = await tx(
    `SELECT ${SOCIA_COLUMNS}
     FROM socias s LEFT JOIN jardines j ON j.id = s.jardin_id
     WHERE s.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function assertJardinExists(jardinId, tx = query) {
  const rows = await tx('SELECT id, nombre FROM jardines WHERE id = ? AND activo = 1', [jardinId]);
  if (rows.length === 0) throw new SociaError('El jardín seleccionado no existe.');
  return rows[0];
}

function parseId(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new SociaError('Socia no encontrada en el padrón.', 404);
  return n;
}

export const SociaService = {
  /**
   * Resumen del padrón para los recuadros KPI (las RETIRADAS no cuentan)
   */
  async getSummary() {
    const [conteo] = await query(
      `SELECT
         SUM(estado <> 'RETIRADA') AS total,
         SUM(estado = 'ACTIVA') AS activas,
         SUM(estado = 'SUSPENDIDA') AS suspendidas,
         SUM(estado = 'RETIRADA') AS retiradas,
         SUM(estado <> 'RETIRADA' AND jardin_id IS NULL) AS sin_jardin,
         SUM(estado <> 'RETIRADA' AND cargo = 'SIN DATO') AS sin_cargo
       FROM socias`
    );

    const [credito] = await query(
      `SELECT COUNT(DISTINCT c.socia_id) AS socias_con_credito,
              COUNT(*) AS creditos_vigentes,
              COALESCE(SUM(GREATEST(c.total_cuotas - c.cuotas_pagadas, 0) * c.monto_cuota), 0) AS saldo_pendiente
       FROM creditos c JOIN socias s ON s.id = c.socia_id
       WHERE c.estado = 'vigente' AND s.estado <> 'RETIRADA'`
    );

    const porTipo = await query(
      `SELECT cv.nombre AS convenio, COUNT(*) AS total
       FROM creditos c JOIN convenios cv ON cv.id = c.convenio_id JOIN socias s ON s.id = c.socia_id
       WHERE c.estado = 'vigente' AND s.estado <> 'RETIRADA'
       GROUP BY cv.nombre`
    );

    const porCargo = await query(
      `SELECT cargo, COUNT(*) AS total FROM socias WHERE estado <> 'RETIRADA' GROUP BY cargo`
    );

    const [jardines] = await query('SELECT COUNT(*) AS total FROM jardines WHERE activo = 1');

    const activas = Number(conteo.activas || 0);
    return {
      totalSocias: Number(conteo.total || 0),
      sociasActivas: activas,
      sociasSuspendidas: Number(conteo.suspendidas || 0),
      sociasRetiradas: Number(conteo.retiradas || 0),
      sociasSinJardin: Number(conteo.sin_jardin || 0),
      sociasSinCargo: Number(conteo.sin_cargo || 0),
      sociasConCredito: Number(credito.socias_con_credito || 0),
      creditosVigentes: Number(credito.creditos_vigentes || 0),
      saldoCreditosPendiente: Number(credito.saldo_pendiente || 0),
      porTipoCredito: Object.fromEntries(porTipo.map((r) => [r.convenio, Number(r.total)])),
      porCargo: Object.fromEntries(porCargo.map((r) => [r.cargo, Number(r.total)])),
      totalJardines: Number(jardines.total || 0),
      valorCuotaMensual: CUOTA_SOCIAL_MENSUAL,
      recaudacionMensualEsperada: activas * CUOTA_SOCIAL_MENSUAL
    };
  },

  /**
   * Lista paginada del padrón con filtros combinables.
   * Por defecto excluye las RETIRADAS; se ven filtrando estado=RETIRADA.
   */
  async getSocias({ search, jardinId, estado = 'TODOS', cargo, credito = 'TODOS', page = 1, limit = 20 } = {}) {
    const where = [];
    const params = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      const rutTerm = cleanRut(search);
      const conditions = [
        "CONCAT_WS(' ', s.nombres, s.apellido_paterno, s.apellido_materno) LIKE ?",
        "CONCAT_WS(' ', s.apellido_paterno, s.apellido_materno, s.nombres) LIKE ?",
        'j.nombre LIKE ?',
        's.correo LIKE ?'
      ];
      params.push(term, term, term, term);
      if (rutTerm.length >= 3) {
        conditions.push(`${RUT_LIMPIO_SQL} LIKE ?`);
        params.push(`%${rutTerm}%`);
      }
      where.push(`(${conditions.join(' OR ')})`);
    }

    if (jardinId && jardinId !== 'TODOS') {
      if (jardinId === 'SIN_JARDIN') {
        where.push('s.jardin_id IS NULL');
      } else {
        where.push('s.jardin_id = ?');
        params.push(Number(jardinId));
      }
    }

    if (estado && estado !== 'TODOS') {
      where.push('s.estado = ?');
      params.push(estado);
    } else {
      where.push("s.estado <> 'RETIRADA'");
    }

    if (cargo && cargo !== 'TODOS') {
      where.push('s.cargo = ?');
      params.push(cargo.toUpperCase());
    }

    if (credito === 'SI') where.push(CREDITO_VIGENTE_SQL);
    if (credito === 'NO') where.push(`NOT ${CREDITO_VIGENTE_SQL}`);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const from = 'FROM socias s LEFT JOIN jardines j ON j.id = s.jardin_id';

    const [{ total }] = await query(`SELECT COUNT(*) AS total ${from} ${whereSql}`, params);

    // LIMIT/OFFSET como enteros ya validados (mysql2 no admite placeholders en LIMIT con execute)
    const pageSize = limit === 0 ? MAX_EXPORT : Math.min(Number(limit), MAX_EXPORT);
    const offset = limit === 0 ? 0 : (Math.max(1, Number(page)) - 1) * pageSize;

    const rows = await query(
      `SELECT ${SOCIA_COLUMNS} ${from} ${whereSql}
       ORDER BY s.apellido_paterno, s.apellido_materno, s.nombres
       LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    const creditos = await creditosVigentesPorSocia(rows.map((r) => r.id));

    return {
      items: rows.map((r) => toListItem(r, creditos.get(r.id) || [])),
      total: Number(total),
      page: limit === 0 ? 1 : Number(page),
      limit: limit === 0 ? Number(total) : pageSize
    };
  },

  /**
   * Ficha completa de una socia con todos sus créditos e historial de traslados
   */
  async getSociaById(id) {
    const sociaId = parseId(id);
    const row = await findSociaRow(sociaId);
    if (!row) throw new SociaError('Socia no encontrada en el padrón.', 404);

    const creditos = await query(
      `SELECT c.id, cv.nombre AS convenio, c.monto_total, c.monto_cuota, c.total_cuotas, c.cuotas_pagadas,
              DATE_FORMAT(c.fecha_otorgamiento, '%Y-%m-%d') AS fecha_inicio,
              DATE_FORMAT(c.fecha_termino, '%Y-%m-%d') AS fecha_termino, c.estado
       FROM creditos c JOIN convenios cv ON cv.id = c.convenio_id
       WHERE c.socia_id = ?
       ORDER BY c.estado = 'vigente' DESC, c.fecha_otorgamiento DESC`,
      [sociaId]
    );

    const historial = await query(
      `SELECT h.id, h.motivo, h.realizado_por, h.created_at,
              ja.nombre AS jardin_anterior, jn.nombre AS jardin_nuevo
       FROM historial_traslados h
       LEFT JOIN jardines ja ON ja.id = h.jardin_anterior_id
       LEFT JOIN jardines jn ON jn.id = h.jardin_nuevo_id
       WHERE h.socia_id = ?
       ORDER BY h.created_at DESC, h.id DESC`,
      [sociaId]
    );

    const vigentes = creditos.filter((c) => c.estado === 'vigente');
    const base = toListItem(
      row,
      vigentes.map((c) => ({ tipo: c.convenio, cuotasPagadas: c.cuotas_pagadas, totalCuotas: c.total_cuotas, montoTotal: c.monto_total }))
    );

    return {
      ...base,
      fechaRetiro: row.fecha_retiro,
      motivoRetiro: row.motivo_retiro,
      creditos: creditos.map((c) => ({
        id: c.id,
        tipo: c.convenio,
        tipoNombre: c.convenio,
        estado: c.estado.toUpperCase(),
        montoSolicitado: c.monto_total,
        valorCuota: c.monto_cuota,
        totalCuotas: c.total_cuotas,
        cuotasPagadas: c.cuotas_pagadas,
        saldoPendiente: Math.max(c.total_cuotas - c.cuotas_pagadas, 0) * c.monto_cuota,
        fechaInicio: c.fecha_inicio,
        fechaTermino: c.fecha_termino
      })),
      descuentoMensualCreditos: vigentes.reduce((sum, c) => sum + c.monto_cuota, 0),
      historialJardin: historial.map((h) => ({
        id: h.id,
        fecha: h.created_at,
        jardinAnterior: h.jardin_anterior || 'Sin jardín',
        jardinNuevo: h.jardin_nuevo || 'Sin jardín',
        motivo: h.motivo,
        changedBy: h.realizado_por
      }))
    };
  },

  /**
   * Incorpora una nueva socia (estado ACTIVA por defecto)
   */
  async createSocia(data) {
    const rut = formatRutWithDots(data.rut);
    const existing = await query(`SELECT id, estado FROM socias s WHERE ${RUT_LIMPIO_SQL} = ?`, [cleanRut(rut)]);
    if (existing.length > 0) {
      const hint = existing[0].estado === 'RETIRADA' ? ' Está retirada: edítela para reactivarla.' : '';
      throw new SociaError(`Ya existe una socia registrada con ese RUT.${hint}`, 409);
    }

    await assertJardinExists(data.jardinId);

    const result = await query(
      `INSERT INTO socias (rut, nombres, apellido_paterno, apellido_materno, cargo, estado, jardin_id, celular, correo, fecha_ingreso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rut,
        data.nombres,
        data.apellidoPaterno,
        data.apellidoMaterno || null,
        data.cargo,
        data.estado || 'ACTIVA',
        data.jardinId,
        data.celular ?? null,
        data.correo ?? null,
        data.fechaIngreso ?? hoyChile()
      ]
    );

    return this.getSociaById(result.insertId);
  },

  /**
   * Actualiza datos, estado o jardín. Todo ocurre en una transacción: si el traslado
   * no tiene motivo o el jardín no existe, la socia queda exactamente igual.
   * Devuelve la ficha actualizada y los campos modificados (para la bitácora).
   */
  async updateSocia(id, changes, changedBy) {
    const sociaId = parseId(id);

    const cambios = await withTransaction(async (tx) => {
      const rows = await tx(
        `SELECT id, nombres, apellido_paterno, apellido_materno, cargo, estado, celular, correo,
                jardin_id, es_delegada, DATE_FORMAT(fecha_ingreso, '%Y-%m-%d') AS fecha_ingreso
         FROM socias WHERE id = ? FOR UPDATE`,
        [sociaId]
      );
      const actual = rows[0];
      if (!actual) throw new SociaError('Socia no encontrada en el padrón.', 404);

      const fields = {
        nombres: 'nombres',
        apellidoPaterno: 'apellido_paterno',
        apellidoMaterno: 'apellido_materno',
        cargo: 'cargo',
        estado: 'estado',
        celular: 'celular',
        correo: 'correo',
        fechaIngreso: 'fecha_ingreso'
      };

      const diff = {};
      const sets = [];
      const params = [];

      const currentValue = (col) => actual[col] ?? null;

      for (const [key, col] of Object.entries(fields)) {
        if (changes[key] === undefined) continue;
        const nuevo = changes[key] === '' ? null : changes[key];
        if (nuevo !== currentValue(col)) {
          diff[key] = { anterior: currentValue(col), nuevo };
          sets.push(`${col} = ?`);
          params.push(nuevo);
        }
      }

      // Reactivar a una socia retirada limpia los datos del retiro
      if (diff.estado && actual.estado === 'RETIRADA') {
        sets.push('fecha_retiro = NULL', 'motivo_retiro = NULL');
      }

      if (changes.esDelegada !== undefined && Boolean(actual.es_delegada) !== changes.esDelegada) {
        diff.esDelegada = { anterior: Boolean(actual.es_delegada), nuevo: changes.esDelegada };
        sets.push('es_delegada = ?');
        params.push(changes.esDelegada ? 1 : 0);
      }

      if (changes.jardinId !== undefined && changes.jardinId !== actual.jardin_id) {
        await assertJardinExists(changes.jardinId, tx);
        const motivo = (changes.motivoTraslado || '').trim();
        // Asignar jardín a quien no tenía no es un traslado: no exige motivo
        if (actual.jardin_id !== null && motivo.length < 3) {
          throw new SociaError('Debe indicar el motivo del traslado de jardín.');
        }

        await tx(
          `INSERT INTO historial_traslados (socia_id, jardin_anterior_id, jardin_nuevo_id, motivo, realizado_por)
           VALUES (?, ?, ?, ?, ?)`,
          [sociaId, actual.jardin_id, changes.jardinId, motivo || 'Asignación de jardín', changedBy]
        );

        diff.jardinId = { anterior: actual.jardin_id, nuevo: changes.jardinId };
        sets.push('jardin_id = ?');
        params.push(changes.jardinId);

        // La delegada trasladada deja de representar a su jardín anterior
        if (actual.es_delegada && changes.esDelegada !== true) {
          diff.esDelegada = { anterior: true, nuevo: false };
          sets.push('es_delegada = 0');
        }
      }

      if (sets.length > 0) {
        await tx(`UPDATE socias SET ${sets.join(', ')} WHERE id = ?`, [...params, sociaId]);
      }
      return diff;
    });

    return { socia: await this.getSociaById(sociaId), cambios };
  },

  /**
   * Baja lógica: la socia queda RETIRADA (sin cuota ni conteo) conservando créditos e historial.
   */
  async retirarSocia(id, motivo) {
    const sociaId = parseId(id);
    const row = await findSociaRow(sociaId);
    if (!row) throw new SociaError('Socia no encontrada en el padrón.', 404);
    if (row.estado === 'RETIRADA') throw new SociaError('La socia ya se encuentra retirada.', 409);

    await query(
      `UPDATE socias SET estado = 'RETIRADA', es_delegada = 0, fecha_retiro = ?, motivo_retiro = ? WHERE id = ?`,
      [hoyChile(), motivo, sociaId]
    );
    return { socia: await this.getSociaById(sociaId), estadoAnterior: row.estado };
  },

  /**
   * Recuperación de clave desde la directiva: la socia vuelve a la clave inicial
   * (6 primeros dígitos del RUT) y debe crear una nueva en su próximo ingreso.
   */
  async restablecerClave(id) {
    const sociaId = parseId(id);
    const row = await findSociaRow(sociaId);
    if (!row) throw new SociaError('Socia no encontrada en el padrón.', 404);
    if (row.estado === 'RETIRADA') throw new SociaError('La socia está retirada: reactívela antes de restablecer su clave.', 409);

    await query('UPDATE socias SET password = NULL, primer_ingreso = 1 WHERE id = ?', [sociaId]);
    return { id: sociaId, rut: row.rut };
  },

  /**
   * Catálogo de jardines con conteo de socias y delegada asignada
   */
  async getJardines() {
    const rows = await query(
      `SELECT j.id, j.codigo, j.nombre,
              SUM(s.estado IN ('ACTIVA', 'SUSPENDIDA')) AS total,
              SUM(s.estado = 'ACTIVA') AS activas
       FROM jardines j LEFT JOIN socias s ON s.jardin_id = j.id
       WHERE j.activo = 1
       GROUP BY j.id, j.codigo, j.nombre
       ORDER BY j.codigo`
    );
    const delegadas = await query(
      `SELECT id, jardin_id, nombres, apellido_paterno FROM socias
       WHERE es_delegada = 1 AND estado <> 'RETIRADA' AND jardin_id IS NOT NULL`
    );
    const delegadaPorJardin = new Map(delegadas.map((d) => [d.jardin_id, d]));

    return rows.map((j) => {
      const d = delegadaPorJardin.get(j.id);
      return {
        id: j.id,
        code: j.codigo,
        name: j.nombre,
        totalSocias: Number(j.total || 0),
        sociasActivas: Number(j.activas || 0),
        delegada: d ? { id: d.id, nombre: `${d.nombres} ${d.apellido_paterno || ''}`.trim() } : null
      };
    });
  }
};
