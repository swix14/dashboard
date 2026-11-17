import { CreditService } from '../services/creditService.js';
import { CreditImportService } from '../services/creditImportService.js';
import { CreditManualService } from '../services/creditManualService.js';
import { AuditService } from '../services/auditService.js';
import { hoyChile } from '../utils/fecha.js';
import {
  periodoSchema,
  listCreditosSchema,
  crearCreditoSchema,
  editarCreditoSchema,
  anularCreditoSchema,
  prepagoSchema
} from '../validators/creditValidator.js';

const responsable = (req) => `${req.user.firstName} ${req.user.lastName || ''}`.trim();

function audit(req, action, details) {
  return AuditService.log({
    userId: req.user.id,
    rut: req.user.rut,
    action,
    details,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
}

function invalid(res, parsed) {
  return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Datos inválidos.' });
}

// Los errores de negocio (CreditoError) traen su código; el resto va al middleware central
function handle(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      next(err);
    }
  };
}

export const CreditController = {
  /** GET /api/creditos/resumen — tarjetas por empresa */
  getResumen: handle(async (req, res) => {
    res.json({ success: true, data: await CreditService.getResumen() });
  }),

  /** GET /api/creditos — historial con búsqueda, filtros y paginación */
  getCreditos: handle(async (req, res) => {
    const parsed = listCreditosSchema.safeParse(req.query);
    if (!parsed.success) return invalid(res, parsed);
    const { items, ...meta } = await CreditService.getCreditos(parsed.data);
    res.json({ success: true, data: items, ...meta });
  }),

  /** GET /api/creditos/grafico */
  getGrafico: handle(async (req, res) => {
    res.json({ success: true, data: await CreditService.getGrafico() });
  }),

  /** GET /api/creditos/:id — ficha del crédito */
  getCredito: handle(async (req, res) => {
    res.json({ success: true, data: await CreditService.getCredito(Number(req.params.id)) });
  }),

  /** GET /api/creditos/periodo?mes&anio — estado de la verificación del mes */
  getPeriodo: handle(async (req, res) => {
    const parsed = periodoSchema.safeParse(req.query);
    if (!parsed.success) return invalid(res, parsed);
    res.json({ success: true, data: await CreditService.getPeriodo(parsed.data) });
  }),

  /** POST /api/creditos/importar/previsualizar (multipart: planilla, mes, anio) */
  previsualizar: handle(async (req, res) => {
    const parsed = periodoSchema.safeParse(req.body || {});
    if (!parsed.success) return invalid(res, parsed);
    if (!req.file) return res.status(400).json({ success: false, message: 'Adjunte la planilla Maestra Créditos (.xlsx).' });
    const data = await CreditImportService.previsualizar(req.file.buffer, req.file.originalname, parsed.data);
    res.json({ success: true, data });
  }),

  /** POST /api/creditos/importar/aplicar (multipart: el mismo archivo de la vista previa) */
  aplicar: handle(async (req, res) => {
    const parsed = periodoSchema.safeParse(req.body || {});
    if (!parsed.success) return invalid(res, parsed);
    if (!req.file) return res.status(400).json({ success: false, message: 'Adjunte la planilla Maestra Créditos (.xlsx).' });
    const data = await CreditImportService.aplicar(req.file.buffer, req.file.originalname, parsed.data, responsable(req));
    await audit(req, 'CREDITOS_IMPORTED', { cargaId: data.cargaId, periodo: parsed.data, ...data.resumen });
    res.json({
      success: true,
      message: `Planilla aplicada: ${data.resumen.nuevos} créditos nuevos y ${data.resumen.actualizados} actualizados.`,
      data
    });
  }),

  /** GET /api/creditos/importar/historial */
  historialCargas: handle(async (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 12, 1), 100);
    res.json({ success: true, data: await CreditImportService.historial(limit) });
  }),

  /** POST /api/creditos/pagos/verificar (multipart: mes, anio y comprobante_<EMPRESA>) */
  verificarPagos: handle(async (req, res) => {
    const parsed = periodoSchema.safeParse(req.body || {});
    if (!parsed.success) return invalid(res, parsed);
    const data = await CreditService.verificarPagos(parsed.data, req.comprobantes || {}, responsable(req));
    await audit(req, 'CREDITOS_PAGOS_VERIFIED', { periodo: parsed.data, pagos: data });
    res.json({
      success: true,
      message: `Pagos verificados: ${data.map((d) => d.nombre).join(', ')}.`,
      data
    });
  }),

  /** POST /api/creditos — nuevo crédito ingresado a mano */
  crear: handle(async (req, res) => {
    const parsed = crearCreditoSchema.safeParse(req.body || {});
    if (!parsed.success) return invalid(res, parsed);
    const data = await CreditManualService.crear(parsed.data, hoyChile());
    await audit(req, 'CREDITO_CREATED', { creditoId: data.id, ...parsed.data });
    res.status(201).json({ success: true, message: 'Crédito ingresado.', data });
  }),

  /** PUT /api/creditos/:id — corrige un crédito vigente (solo sus cuotas pendientes) */
  editar: handle(async (req, res) => {
    const parsed = editarCreditoSchema.safeParse(req.body || {});
    if (!parsed.success) return invalid(res, parsed);
    const id = Number(req.params.id);
    const data = await CreditManualService.editar(id, parsed.data, hoyChile());
    await audit(req, 'CREDITO_UPDATED', { creditoId: id, ...parsed.data });
    res.json({ success: true, message: 'Crédito actualizado.', data });
  }),

  /** POST /api/creditos/:id/anular — { motivo } */
  anular: handle(async (req, res) => {
    const parsed = anularCreditoSchema.safeParse(req.body || {});
    if (!parsed.success) return invalid(res, parsed);
    const id = Number(req.params.id);
    const data = await CreditManualService.anular(id, parsed.data.motivo, hoyChile());
    await audit(req, 'CREDITO_ANULADO', { creditoId: id, motivo: parsed.data.motivo });
    res.json({ success: true, message: 'Crédito anulado.', data });
  }),

  /** POST /api/creditos/:id/prepago — { fecha }: la socia paga todo el saldo */
  prepagar: handle(async (req, res) => {
    const parsed = prepagoSchema.safeParse(req.body || {});
    if (!parsed.success) return invalid(res, parsed);
    if (parsed.data.fecha > hoyChile()) return res.status(400).json({ success: false, message: 'La fecha del pago no puede ser futura.' });
    const id = Number(req.params.id);
    const data = await CreditManualService.prepagar(id, parsed.data.fecha);
    await audit(req, 'CREDITO_PREPAGADO', { creditoId: id, ...data, fecha: parsed.data.fecha });
    res.json({ success: true, message: 'Prepago registrado: el crédito quedó pagado.', data });
  }),

  /** GET /api/creditos/pagos/:id/comprobante */
  descargarComprobante: handle(async (req, res) => {
    const { absolute, nombre } = await CreditService.getComprobante(Number(req.params.id));
    await audit(req, 'CREDITOS_COMPROBANTE_DOWNLOADED', { pagoId: Number(req.params.id) });
    res.download(absolute, nombre);
  })
};
