/**
 * Créditos y Convenios (V4): tarjetas por empresa, historial de créditos, ficha de crédito
 * y verificación mensual de pagos con comprobante (días 1 al 5).
 *
 * Estado visible de un crédito (se calcula, no se guarda):
 *  - VIGENTE: le quedan 2 o más cuotas.
 *  - ULTIMA_CUOTA: le queda 1 cuota.
 *  - PAGADO: todas sus cuotas descontadas. Se muestra hasta un mes después de pagarse (decisión D4).
 */
import fs from 'node:fs';
import { query, withTransaction } from '../config/db.js';
import { hoyChile } from '../utils/fecha.js';
import { guardarArchivoHistorico, resolverArchivoHistorico } from '../utils/archivoHistorico.js';
import { CreditoError, recalcularCredito, NOMBRE_MES } from './creditImportService.js';

const pad = (n) => String(n).padStart(2, '0');

// Pagados visibles hasta un mes después de su fecha de pago (D4)
const VISIBLE_SQL = `(c.estado = 'vigente' OR (c.estado = 'finalizado' AND c.fecha_finalizacion >= DATE_SUB(?, INTERVAL 1 MONTH)))`;

// ULTIMAS_DOS: alerta naranja pedida por la directiva ("últimas 2 cuotas")
const ESTADO_SQL = `CASE
    WHEN c.estado = 'anulado' THEN 'ANULADO'
    WHEN c.estado = 'finalizado' THEN 'PAGADO'
    WHEN c.total_cuotas - c.cuotas_pagadas <= 1 THEN 'ULTIMA_CUOTA'
    WHEN c.total_cuotas - c.cuotas_pagadas = 2 THEN 'ULTIMAS_DOS'
    ELSE 'VIGENTE' END`;

const ESTADOS_FILTRO = { VIGENTE: 'VIGENTE', ULTIMAS_DOS: 'ULTIMAS_DOS', ULTIMA_CUOTA: 'ULTIMA_CUOTA', PAGADO: 'PAGADO' };

function nombreSocia(r) {
  return [r.nombres, r.apellido_paterno, r.apellido_materno].filter(Boolean).join(' ');
}

export const CreditService = {
  /** Tarjetas por empresa: monto A PAGAR del último mes cargado y último pago verificado */
  async getResumen() {
    const hoy = hoyChile();
    const convenios = await query('SELECT id, codigo, nombre FROM convenios WHERE codigo IS NOT NULL AND activo = 1 ORDER BY orden, id');
    const conteos = await query(
      `SELECT c.convenio_id, ${ESTADO_SQL} AS estado_visible, COUNT(*) AS n
       FROM creditos c WHERE ${VISIBLE_SQL} GROUP BY c.convenio_id, estado_visible`,
      [hoy]
    );
    const pagos = await query(
      `SELECT id, convenio_id, mes, anio, monto_a_pagar, monto_pagado, verificado_at
       FROM pagos_convenio ORDER BY anio DESC, mes DESC`
    );

    return convenios.map((cv) => {
      const propios = pagos.filter((p) => p.convenio_id === cv.id);
      const ultimoCargado = propios[0] || null;
      const ultimoPago = propios.find((p) => p.verificado_at) || null;
      const cuenta = (estado) => Number(conteos.find((x) => x.convenio_id === cv.id && x.estado_visible === estado)?.n || 0);
      return {
        codigo: cv.codigo,
        nombre: cv.nombre,
        aPagar: ultimoCargado
          ? { monto: ultimoCargado.monto_a_pagar, mes: ultimoCargado.mes, anio: ultimoCargado.anio, verificado: Boolean(ultimoCargado.verificado_at) }
          : null,
        ultimoPago: ultimoPago ? { id: ultimoPago.id, monto: ultimoPago.monto_pagado, mes: ultimoPago.mes, anio: ultimoPago.anio } : null,
        vigentes: cuenta('VIGENTE') + cuenta('ULTIMAS_DOS') + cuenta('ULTIMA_CUOTA'),
        ultimaCuota: cuenta('ULTIMA_CUOTA'),
        pagados: cuenta('PAGADO')
      };
    });
  },

  /** Historial: una fila por crédito (una socia con SOS e ISIMUNDO aparece dos veces) */
  async getCreditos({ search, convenio = 'TODOS', estado = 'TODOS', page = 1, limit = 20 } = {}) {
    const where = [VISIBLE_SQL];
    const params = [hoyChile()];
    if (convenio !== 'TODOS') {
      where.push('cv.codigo = ?');
      params.push(convenio);
    }
    if (estado !== 'TODOS' && ESTADOS_FILTRO[estado]) {
      where.push(`${ESTADO_SQL} = ?`);
      params.push(ESTADOS_FILTRO[estado]);
    }
    if (search) {
      const texto = `%${search}%`;
      const rut = `%${String(search).replace(/[^0-9kK]/g, '')}%`;
      where.push(`(CONCAT_WS(' ', s.nombres, s.apellido_paterno, s.apellido_materno) LIKE ?
                   OR REPLACE(REPLACE(s.rut, '.', ''), '-', '') LIKE ?)`);
      params.push(texto, rut.length > 2 ? rut : texto);
    }
    const base = `FROM creditos c
                  JOIN socias s ON s.id = c.socia_id
                  JOIN convenios cv ON cv.id = c.convenio_id
                  WHERE ${where.join(' AND ')}`;
    const [{ total }] = await query(`SELECT COUNT(*) AS total ${base}`, params);
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const pag = Math.max(Number(page) || 1, 1);
    const rows = await query(
      `SELECT c.id, c.monto_cuota, c.total_cuotas, c.cuotas_pagadas, c.numero_credito, ${ESTADO_SQL} AS estado_visible,
              s.rut, s.nombres, s.apellido_paterno, s.apellido_materno, cv.codigo, cv.nombre AS convenio
       ${base}
       ORDER BY cv.orden, s.apellido_paterno, s.nombres, c.id
       LIMIT ${lim} OFFSET ${(pag - 1) * lim}`,
      params
    );
    return {
      total: Number(total),
      page: pag,
      limit: lim,
      items: rows.map((r) => ({
        id: r.id,
        socia: nombreSocia(r),
        rut: r.rut,
        empresa: r.codigo,
        empresaNombre: r.convenio,
        numeroCredito: r.numero_credito,
        estado: r.estado_visible,
        montoCuota: r.monto_cuota,
        cuotasPagadas: r.cuotas_pagadas,
        totalCuotas: r.total_cuotas
      }))
    };
  },

  /** Ficha del crédito con su calendario de cuotas */
  async getCredito(id) {
    const [r] = await query(
      `SELECT c.*, ${ESTADO_SQL} AS estado_visible, s.rut, s.nombres, s.apellido_paterno, s.apellido_materno,
              cv.codigo, cv.nombre AS convenio
       FROM creditos c JOIN socias s ON s.id = c.socia_id JOIN convenios cv ON cv.id = c.convenio_id
       WHERE c.id = ?`,
      [id]
    );
    if (!r) throw new CreditoError('El crédito no existe.', 404);
    const cuotas = await query(
      `SELECT numero_cuota, monto, mes_cobro, anio_cobro, estado, fecha_pago
       FROM cuotas_credito WHERE credito_id = ? ORDER BY numero_cuota`,
      [id]
    );
    const pendiente = cuotas.filter((q) => q.estado === 'pendiente').reduce((s, q) => s + q.monto, 0);
    return {
      id: r.id,
      socia: nombreSocia(r),
      rut: r.rut,
      empresa: r.codigo,
      empresaNombre: r.convenio,
      numeroCredito: r.numero_credito,
      estado: r.estado_visible,
      fechaInicio: r.fecha_otorgamiento,
      fechaTermino: r.fecha_termino,
      fechaPagado: r.fecha_finalizacion,
      origen: r.origen,
      motivoAnulacion: r.motivo_anulacion,
      fechaAnulacion: r.fecha_anulacion,
      montoOtorgado: r.monto_total,
      montoCuota: r.monto_cuota,
      totalCuotas: r.total_cuotas,
      cuotasPagadas: r.cuotas_pagadas,
      montoPendiente: pendiente,
      cuotas: cuotas.map((q) => ({
        numero: q.numero_cuota,
        monto: q.monto,
        mes: q.mes_cobro,
        anio: q.anio_cobro,
        estado: q.estado,
        fechaPago: q.fecha_pago
      }))
    };
  },

  /** Gráfico: créditos vigentes y en última cuota por empresa */
  async getGrafico() {
    const resumen = await this.getResumen();
    return resumen.map((r) => ({ empresa: r.codigo, nombre: r.nombre, vigentes: r.vigentes, ultimaCuota: r.ultimaCuota }));
  },

  /** Estado de la verificación de un mes: monto a pagar, cuotas pendientes y si ya se verificó */
  async getPeriodo({ mes, anio }) {
    const convenios = await query('SELECT id, codigo, nombre FROM convenios WHERE codigo IS NOT NULL AND activo = 1 ORDER BY orden, id');
    const pagos = await query('SELECT * FROM pagos_convenio WHERE mes = ? AND anio = ?', [mes, anio]);
    const pendientes = await query(
      `SELECT c.convenio_id, COUNT(*) AS n, COALESCE(SUM(q.monto), 0) AS monto
       FROM cuotas_credito q JOIN creditos c ON c.id = q.credito_id
       WHERE q.mes_cobro = ? AND q.anio_cobro = ? AND q.estado = 'pendiente' AND c.estado = 'vigente'
       GROUP BY c.convenio_id`,
      [mes, anio]
    );
    return convenios.map((cv) => {
      const p = pagos.find((x) => x.convenio_id === cv.id);
      const q = pendientes.find((x) => x.convenio_id === cv.id);
      return {
        codigo: cv.codigo,
        nombre: cv.nombre,
        cargado: Boolean(p),
        aPagar: p ? p.monto_a_pagar : null,
        cuotasPendientes: Number(q?.n || 0),
        montoCuotasPendientes: Number(q?.monto || 0),
        verificado: Boolean(p?.verificado_at),
        pago: p?.verificado_at
          ? {
              id: p.id,
              montoPagado: p.monto_pagado,
              cuotasDescontadas: p.cuotas_descontadas,
              comprobante: p.comprobante_original,
              verificadoPor: p.verificado_por,
              verificadoAt: p.verificado_at
            }
          : null
      };
    });
  },

  /**
   * Verifica el pago del mes de una o más empresas, cada una con su comprobante.
   * Por empresa, en una sola transacción: marca descontadas sus cuotas del mes, recalcula los
   * créditos (cuotas pagadas, última cuota, pagado) y registra el pago con su comprobante.
   * @param {{mes:number, anio:number}} periodo
   * @param {Record<string, {buffer: Buffer, originalname: string, mimetype: string}>} archivos - por código de empresa
   */
  async verificarPagos(periodo, archivos, realizadoPor) {
    const codigos = Object.keys(archivos);
    if (codigos.length === 0) throw new CreditoError('Adjunte al menos un comprobante de pago.');
    const convenios = await query(
      `SELECT id, codigo, nombre FROM convenios WHERE codigo IN (${codigos.map(() => '?').join(',')})`,
      codigos
    );
    const pagos = await query('SELECT convenio_id, verificado_at FROM pagos_convenio WHERE mes = ? AND anio = ?', [periodo.mes, periodo.anio]);
    for (const codigo of codigos) {
      const cv = convenios.find((c) => c.codigo === codigo);
      if (!cv) throw new CreditoError(`Empresa desconocida: ${codigo}.`);
      const p = pagos.find((x) => x.convenio_id === cv.id);
      const mesTexto = `${NOMBRE_MES[periodo.mes]} ${periodo.anio}`;
      if (!p) throw new CreditoError(`${cv.nombre}: primero cargue la planilla Maestra Créditos de ${mesTexto}.`);
      if (p.verificado_at) throw new CreditoError(`${cv.nombre}: el pago de ${mesTexto} ya fue verificado.`, 409);
    }

    // Comprobantes en carpetas separadas por mes y empresa; nunca se sobrescriben
    const guardados = [];
    try {
      for (const codigo of codigos) {
        const f = archivos[codigo];
        guardados.push({
          codigo,
          mime: f.mimetype,
          original: String(f.originalname || 'comprobante').slice(0, 255),
          ...guardarArchivoHistorico(f.buffer, ['creditos', 'comprobantes', String(periodo.anio), pad(periodo.mes), codigo], f.originalname)
        });
      }

      const hoy = hoyChile();
      return await withTransaction(async (tx) => {
        const resultado = [];
        for (const g of guardados) {
          const cv = convenios.find((c) => c.codigo === g.codigo);
          // Bloquea la fila del pago: dos verificaciones simultáneas no pueden descontar dos veces
          const [pago] = await tx(
            'SELECT id, monto_a_pagar, verificado_at FROM pagos_convenio WHERE convenio_id = ? AND mes = ? AND anio = ? FOR UPDATE',
            [cv.id, periodo.mes, periodo.anio]
          );
          if (!pago || pago.verificado_at) throw new CreditoError(`${cv.nombre}: el pago ya fue verificado.`, 409);

          const cuotas = await tx(
            `SELECT q.id, q.credito_id, q.monto FROM cuotas_credito q JOIN creditos c ON c.id = q.credito_id
             WHERE c.convenio_id = ? AND c.estado = 'vigente' AND q.mes_cobro = ? AND q.anio_cobro = ? AND q.estado = 'pendiente'
             FOR UPDATE`,
            [cv.id, periodo.mes, periodo.anio]
          );
          for (const q of cuotas) {
            await tx(`UPDATE cuotas_credito SET estado = 'descontada', fecha_pago = ? WHERE id = ?`, [hoy, q.id]);
          }
          for (const creditoId of new Set(cuotas.map((q) => q.credito_id))) {
            await recalcularCredito(tx, creditoId, hoy);
          }
          // El comprobante respalda la transferencia del monto A PAGAR del mes (planilla del día 18)
          const monto = pago.monto_a_pagar;
          await tx(
            `UPDATE pagos_convenio SET monto_pagado = ?, cuotas_descontadas = ?, comprobante_original = ?, comprobante_guardado = ?,
                                       comprobante_mime = ?, verificado_por = ?, verificado_at = NOW() WHERE id = ?`,
            [monto, cuotas.length, g.original, g.relative, g.mime, realizadoPor, pago.id]
          );
          resultado.push({ empresa: g.codigo, nombre: cv.nombre, pagoId: pago.id, montoPagado: monto, cuotasDescontadas: cuotas.length });
        }
        return resultado;
      });
    } catch (err) {
      // Si algo falla, no quedan comprobantes sueltos de una verificación que no se aplicó
      for (const g of guardados) fs.promises.unlink(g.absolute).catch(() => {});
      throw err;
    }
  },

  /** Ruta del comprobante de un pago verificado (para descargarlo) */
  async getComprobante(pagoId) {
    const [p] = await query(
      `SELECT p.comprobante_guardado, p.comprobante_original, p.mes, p.anio, cv.codigo
       FROM pagos_convenio p JOIN convenios cv ON cv.id = p.convenio_id WHERE p.id = ?`,
      [pagoId]
    );
    if (!p || !p.comprobante_guardado) throw new CreditoError('El pago no tiene comprobante.', 404);
    const absolute = resolverArchivoHistorico(p.comprobante_guardado);
    if (!absolute || !fs.existsSync(absolute)) throw new CreditoError('El comprobante ya no se encuentra en el servidor.', 404);
    const ext = (p.comprobante_guardado.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase();
    return { absolute, nombre: `comprobante-${p.codigo}-${p.anio}-${pad(p.mes)}${ext}` };
  }
};
