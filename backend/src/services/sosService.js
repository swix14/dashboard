/**
 * Solicitudes S.O.S en línea (V5): la socia pide el crédito de emergencia desde su portal y
 * Admin o Tesorera lo aprueban o rechazan.
 *
 * Reglas:
 *  - Solo socias ACTIVAS piden S.O.S, y cada una tiene a lo más una solicitud pendiente.
 *  - Al aprobar se crea, en la misma transacción, el crédito S.O.S con sus cuotas (entra a la
 *    liquidación y a la verificación de pagos como cualquier crédito manual).
 *  - El egreso en Tesorería lo registra la Tesorera aparte, porque exige el comprobante de la transferencia.
 */
import { query, withTransaction } from '../config/db.js';
import { CreditoError } from './creditImportService.js';
import { CreditManualService } from './creditManualService.js';
import { SOS_MONTO_MAXIMO } from '../validators/creditValidator.js';

const nombreCompleto = (s) => [s.nombres, s.apellido_paterno, s.apellido_materno].filter(Boolean).join(' ');

const COLUMNAS = `id, socia_id AS sociaId, socia_rut AS sociaRut, socia_nombre AS sociaNombre, socia_jardin AS sociaJardin,
  monto, cuotas, motivo, estado, respuesta, revisado_por AS revisadoPor, revisado_at AS revisadoAt,
  credito_id AS creditoId, created_at AS createdAt`;

export const SosService = {
  /** La socia envía su solicitud; sus datos se toman del padrón, no del formulario */
  async solicitar(sociaId, { monto, cuotas, motivo }) {
    return withTransaction(async (tx) => {
      // Bloquea a la socia: dos envíos seguidos no dejan dos solicitudes pendientes
      const [s] = await tx(
        `SELECT s.id, s.rut, s.nombres, s.apellido_paterno, s.apellido_materno, s.estado, j.nombre AS jardin
         FROM socias s LEFT JOIN jardines j ON j.id = s.jardin_id WHERE s.id = ? FOR UPDATE`,
        [sociaId]
      );
      if (!s) throw new CreditoError('Socia no encontrada.', 404);
      if (s.estado !== 'ACTIVA') throw new CreditoError('Solo las socias activas pueden pedir un S.O.S.', 403);
      const [pendiente] = await tx(`SELECT id FROM solicitudes_sos WHERE socia_id = ? AND estado = 'PENDIENTE'`, [s.id]);
      if (pendiente) throw new CreditoError('Ya tiene una solicitud S.O.S en revisión. Espere la respuesta de la directiva.', 409);

      const insert = await tx(
        `INSERT INTO solicitudes_sos (socia_id, socia_rut, socia_nombre, socia_jardin, monto, cuotas, motivo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.rut, nombreCompleto(s), s.jardin || null, monto, cuotas, motivo]
      );
      const [creada] = await tx(`SELECT ${COLUMNAS} FROM solicitudes_sos WHERE id = ?`, [insert.insertId]);
      return creada;
    });
  },

  /** Solicitudes de la socia (más recientes primero) */
  async deSocia(sociaId) {
    return query(`SELECT ${COLUMNAS} FROM solicitudes_sos WHERE socia_id = ? ORDER BY created_at DESC, id DESC`, [sociaId]);
  },

  /** Bandeja de la directiva: pendientes primero, luego las revisadas recientes */
  async listar({ estado = 'TODAS', limit = 50 } = {}) {
    const filtro = estado === 'TODAS' ? '' : 'WHERE estado = ?';
    const items = await query(
      `SELECT ${COLUMNAS} FROM solicitudes_sos ${filtro}
       ORDER BY estado = 'PENDIENTE' DESC, created_at DESC, id DESC LIMIT ${Number(limit)}`,
      estado === 'TODAS' ? [] : [estado]
    );
    const [{ n }] = await query(`SELECT COUNT(*) AS n FROM solicitudes_sos WHERE estado = 'PENDIENTE'`);
    return { items, pendientes: Number(n) };
  },

  /** Bloquea la solicitud; solo las pendientes se pueden revisar */
  async pendienteEnTx(tx, id) {
    const [sol] = await tx('SELECT * FROM solicitudes_sos WHERE id = ? FOR UPDATE', [id]);
    if (!sol) throw new CreditoError('La solicitud no existe.', 404);
    if (sol.estado !== 'PENDIENTE') throw new CreditoError('La solicitud ya fue revisada.', 409);
    return sol;
  },

  /** Aprueba y crea el crédito S.O.S con el valor de cuota y el mes de la primera cuota indicados */
  async aprobar(id, { valorCuota, primeraCuota, respuesta }, revisadoPor, hoy) {
    return withTransaction(async (tx) => {
      const sol = await this.pendienteEnTx(tx, id);
      // Las cuotas no pueden sumar más que el tope; se tolera solo el redondeo hacia arriba de la cuota
      const totalCuotas = valorCuota * sol.cuotas;
      if (totalCuotas > Math.ceil(SOS_MONTO_MAXIMO / sol.cuotas) * sol.cuotas) {
        throw new CreditoError(`Las cuotas suman $${totalCuotas.toLocaleString('es-CL')}; el S.O.S no puede pasar de $${SOS_MONTO_MAXIMO.toLocaleString('es-CL')}.`, 400);
      }
      const credito = await CreditManualService.crearEnTx(
        tx,
        {
          sociaId: sol.socia_id,
          empresa: 'SOS',
          numeroCredito: null,
          montoOtorgado: sol.monto,
          valorCuota,
          totalCuotas: sol.cuotas,
          primeraCuota,
          cuotasPagadas: 0,
          fechaOtorgamiento: hoy
        },
        hoy
      );
      await tx(
        `UPDATE solicitudes_sos SET estado = 'APROBADA', respuesta = ?, revisado_por = ?, revisado_at = NOW(), credito_id = ? WHERE id = ?`,
        [respuesta || null, revisadoPor, credito.id, id]
      );
      return { id, sociaId: sol.socia_id, sociaNombre: sol.socia_nombre, monto: sol.monto, cuotas: sol.cuotas, valorCuota, creditoId: credito.id };
    });
  },

  /** Rechaza con motivo (la socia lo ve en su portal) */
  async rechazar(id, motivo, revisadoPor) {
    return withTransaction(async (tx) => {
      const sol = await this.pendienteEnTx(tx, id);
      await tx(
        `UPDATE solicitudes_sos SET estado = 'RECHAZADA', respuesta = ?, revisado_por = ?, revisado_at = NOW() WHERE id = ?`,
        [motivo, revisadoPor, id]
      );
      return { id, sociaId: sol.socia_id, sociaNombre: sol.socia_nombre, monto: sol.monto, motivo };
    });
  }
};
