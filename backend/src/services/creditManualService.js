/**
 * Créditos ingresados y corregidos a mano (sin planilla Excel): nuevo crédito, edición,
 * anulación y prepago del saldo. Solo Admin y Tesorera.
 *
 * Reglas:
 *  - Un crédito manual usa la misma clave que la planilla (ISIMUNDO: N° de crédito; resto: mes de
 *    la primera cuota), así la planilla del día 18 lo reconoce y no lo duplica.
 *  - Las cuotas ya descontadas, condonadas o prepagadas nunca se modifican.
 *  - Solo se editan, anulan o prepagan créditos vigentes.
 */
import { withTransaction } from '../config/db.js';
import { CreditoError, recalcularCredito, claveMes, sumarMeses } from './creditImportService.js';

const primerDia = ({ anio, mes }) => `${claveMes(anio, mes)}-01`;

async function convenioPorCodigo(tx, codigo) {
  const [cv] = await tx('SELECT id, codigo, nombre FROM convenios WHERE codigo = ? AND activo = 1', [codigo]);
  if (!cv) throw new CreditoError('La empresa no existe o no está activa.');
  return cv;
}

/** Bloquea el crédito para editarlo; solo los vigentes se pueden modificar */
async function creditoVigente(tx, id) {
  const [c] = await tx(
    `SELECT c.*, cv.codigo FROM creditos c JOIN convenios cv ON cv.id = c.convenio_id WHERE c.id = ? FOR UPDATE`,
    [id]
  );
  if (!c) throw new CreditoError('El crédito no existe.', 404);
  if (c.estado === 'finalizado') throw new CreditoError('El crédito ya está pagado: no se puede modificar.', 409);
  if (c.estado === 'anulado') throw new CreditoError('El crédito está anulado: no se puede modificar.', 409);
  return c;
}

async function claveLibre(tx, { sociaId, convenioId, clave, excluirId = 0 }) {
  const [dup] = await tx(
    'SELECT id FROM creditos WHERE socia_id = ? AND convenio_id = ? AND clave_carga = ? AND id <> ?',
    [sociaId, convenioId, clave, excluirId]
  );
  return !dup;
}

export const CreditManualService = {
  /**
   * Nuevo crédito con su calendario de cuotas. Las primeras `cuotasPagadas` quedan descontadas
   * (crédito que viene de antes y se ingresa a mitad de camino).
   */
  async crear(datos, hoy) {
    return withTransaction((tx) => this.crearEnTx(tx, datos, hoy));
  },

  /** Igual que crear, dentro de una transacción ya abierta (ej. al aprobar una solicitud S.O.S) */
  async crearEnTx(tx, datos, hoy) {
    const [socia] = await tx('SELECT id, estado FROM socias WHERE id = ?', [datos.sociaId]);
    if (!socia) throw new CreditoError('La socia no existe.', 404);
    if (socia.estado === 'RETIRADA') throw new CreditoError('La socia está retirada del padrón: no se le pueden ingresar créditos.');
    const cv = await convenioPorCodigo(tx, datos.empresa);

    const clave = cv.codigo === 'ISIMUNDO' ? datos.numeroCredito : claveMes(datos.primeraCuota.anio, datos.primeraCuota.mes);
    if (!(await claveLibre(tx, { sociaId: socia.id, convenioId: cv.id, clave }))) {
      throw new CreditoError(
        cv.codigo === 'ISIMUNDO'
          ? `La socia ya tiene el crédito ISIMUNDO N° ${clave}.`
          : `La socia ya tiene un crédito de ${cv.nombre} que parte en ${clave}. Edítelo desde su ficha.`,
        409
      );
    }

    const cuotas = Array.from({ length: datos.totalCuotas }, (_, i) => ({
      numero: i + 1,
      ...sumarMeses(datos.primeraCuota.anio, datos.primeraCuota.mes, i)
    }));
    const ultima = cuotas[cuotas.length - 1];
    const insert = await tx(
      `INSERT INTO creditos (socia_id, convenio_id, numero_credito, monto_total, monto_cuota, total_cuotas, cuotas_pagadas,
                             fecha_otorgamiento, fecha_termino, estado, clave_carga, origen)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'vigente', ?, 'MANUAL')`,
      [
        socia.id,
        cv.id,
        datos.numeroCredito || null,
        datos.montoOtorgado || datos.valorCuota * datos.totalCuotas,
        datos.valorCuota,
        datos.totalCuotas,
        datos.fechaOtorgamiento || primerDia(datos.primeraCuota),
        primerDia(ultima),
        clave
      ]
    );
    for (const q of cuotas) {
      await tx(
        `INSERT INTO cuotas_credito (credito_id, numero_cuota, monto, mes_cobro, anio_cobro, estado) VALUES (?, ?, ?, ?, ?, ?)`,
        [insert.insertId, q.numero, datos.valorCuota, q.mes, q.anio, q.numero <= datos.cuotasPagadas ? 'descontada' : 'pendiente']
      );
    }
    await recalcularCredito(tx, insert.insertId, hoy);
    return { id: insert.insertId, empresa: cv.codigo, clave };
  },

  /**
   * Corrige valor de cuota, total de cuotas, monto otorgado o N° de crédito.
   * Solo cambian las cuotas pendientes: si hay más cuotas se agregan al final mes a mes,
   * y si hay menos se quitan las últimas pendientes.
   */
  async editar(id, datos, hoy) {
    return withTransaction(async (tx) => {
      const c = await creditoVigente(tx, id);
      const cuotas = await tx(
        'SELECT id, numero_cuota, monto, mes_cobro, anio_cobro, estado FROM cuotas_credito WHERE credito_id = ? ORDER BY numero_cuota FOR UPDATE',
        [id]
      );
      const cerradas = cuotas.filter((q) => q.estado !== 'pendiente');
      const minimo = Math.max(1, ...cerradas.map((q) => q.numero_cuota));
      if (datos.totalCuotas < minimo) {
        throw new CreditoError(`El crédito ya tiene ${cerradas.length} cuotas pagadas: el total no puede ser menor que ${minimo}.`);
      }

      // ISIMUNDO se identifica por su N° de crédito: si cambia, cambia la clave con la que lo reconoce la planilla
      let clave = c.clave_carga;
      if (c.codigo === 'ISIMUNDO') {
        if (!datos.numeroCredito) throw new CreditoError('ISIMUNDO requiere el N° de crédito.');
        clave = datos.numeroCredito;
        if (!(await claveLibre(tx, { sociaId: c.socia_id, convenioId: c.convenio_id, clave, excluirId: id }))) {
          throw new CreditoError(`La socia ya tiene otro crédito ISIMUNDO N° ${clave}.`, 409);
        }
      }

      if (datos.valorCuota !== Number(c.monto_cuota)) {
        await tx(`UPDATE cuotas_credito SET monto = ? WHERE credito_id = ? AND estado = 'pendiente'`, [datos.valorCuota, id]);
      }
      await tx(`DELETE FROM cuotas_credito WHERE credito_id = ? AND estado = 'pendiente' AND numero_cuota > ?`, [id, datos.totalCuotas]);
      const ultima = cuotas[cuotas.length - 1];
      for (let n = (ultima?.numero_cuota || 0) + 1; n <= datos.totalCuotas; n++) {
        const base = ultima ? { anio: ultima.anio_cobro, mes: ultima.mes_cobro } : { anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) };
        const p = sumarMeses(base.anio, base.mes, n - (ultima?.numero_cuota || 0));
        await tx(
          `INSERT INTO cuotas_credito (credito_id, numero_cuota, monto, mes_cobro, anio_cobro, estado) VALUES (?, ?, ?, ?, ?, 'pendiente')`,
          [id, n, datos.valorCuota, p.mes, p.anio]
        );
      }
      const [fin] = await tx(
        'SELECT mes_cobro, anio_cobro FROM cuotas_credito WHERE credito_id = ? ORDER BY numero_cuota DESC LIMIT 1',
        [id]
      );
      await tx(
        `UPDATE creditos SET numero_credito = ?, monto_total = ?, monto_cuota = ?, total_cuotas = ?, clave_carga = ?, fecha_termino = ?
         WHERE id = ?`,
        [
          datos.numeroCredito || null,
          datos.montoOtorgado || datos.valorCuota * datos.totalCuotas,
          datos.valorCuota,
          datos.totalCuotas,
          clave,
          fin ? primerDia({ anio: fin.anio_cobro, mes: fin.mes_cobro }) : c.fecha_termino,
          id
        ]
      );
      await recalcularCredito(tx, id, hoy);
      return { id };
    });
  },

  /** Anula un crédito ingresado por error. Sus cuotas pendientes dejan de cobrarse. */
  async anular(id, motivo, hoy) {
    return withTransaction(async (tx) => {
      await creditoVigente(tx, id);
      await tx(`UPDATE creditos SET estado = 'anulado', motivo_anulacion = ?, fecha_anulacion = ? WHERE id = ?`, [motivo, hoy, id]);
      return { id };
    });
  },

  /** Prepago: la socia paga todo el saldo de una vez. Las cuotas pendientes quedan prepagadas y el crédito, pagado. */
  async prepagar(id, fecha) {
    return withTransaction(async (tx) => {
      await creditoVigente(tx, id);
      const pendientes = await tx(
        `SELECT id, monto FROM cuotas_credito WHERE credito_id = ? AND estado = 'pendiente' FOR UPDATE`,
        [id]
      );
      if (pendientes.length === 0) throw new CreditoError('El crédito no tiene cuotas pendientes.', 409);
      await tx(`UPDATE cuotas_credito SET estado = 'prepagada', fecha_pago = ? WHERE credito_id = ? AND estado = 'pendiente'`, [fecha, id]);
      await recalcularCredito(tx, id, fecha);
      return { id, cuotas: pendientes.length, monto: pendientes.reduce((s, q) => s + q.monto, 0) };
    });
  }
};
