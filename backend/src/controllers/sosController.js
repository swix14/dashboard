import { SosService } from '../services/sosService.js';
import { hoyChile } from '../utils/fecha.js';
import { audit, handle, invalid, responsable, sociaIdDe } from '../utils/controllerHelpers.js';
import { solicitudSosSchema, aprobarSosSchema, rechazarSosSchema, listarSosSchema } from '../validators/creditValidator.js';

export const SosController = {
  /** POST /api/socia/sos — { monto, cuotas, motivo } */
  solicitar: handle(async (req, res) => {
    const parsed = solicitudSosSchema.safeParse(req.body || {});
    if (!parsed.success) return invalid(res, parsed);
    const data = await SosService.solicitar(sociaIdDe(req), parsed.data);
    await audit(req, 'SOS_SOLICITADO', { solicitudId: data.id, monto: data.monto, cuotas: data.cuotas });
    res.status(201).json({ success: true, message: 'Solicitud S.O.S enviada. La directiva le responderá por este portal.', data });
  }),

  /** GET /api/socia/sos — solicitudes de la socia que inició sesión */
  misSolicitudes: handle(async (req, res) => {
    res.json({ success: true, data: await SosService.deSocia(sociaIdDe(req)) });
  }),

  /** GET /api/creditos/sos?estado — bandeja de la directiva */
  listar: handle(async (req, res) => {
    const parsed = listarSosSchema.safeParse(req.query);
    if (!parsed.success) return invalid(res, parsed);
    const { items, pendientes } = await SosService.listar(parsed.data);
    res.json({ success: true, data: items, pendientes });
  }),

  /** POST /api/creditos/sos/:id/aprobar — { valorCuota, primeraCuota, respuesta? }: crea el crédito S.O.S */
  aprobar: handle(async (req, res) => {
    const parsed = aprobarSosSchema.safeParse(req.body || {});
    if (!parsed.success) return invalid(res, parsed);
    const hoy = hoyChile();
    const { anio, mes } = parsed.data.primeraCuota;
    // La primera cuota no puede quedar en un mes ya pasado
    if (anio * 12 + mes < Number(hoy.slice(0, 4)) * 12 + Number(hoy.slice(5, 7))) {
      return res.status(400).json({ success: false, message: 'La primera cuota no puede ser de un mes pasado.' });
    }
    const data = await SosService.aprobar(Number(req.params.id), parsed.data, responsable(req), hoy);
    await audit(req, 'SOS_APROBADO', data);
    res.json({ success: true, message: `S.O.S de ${data.sociaNombre} aprobado: se creó su crédito.`, data });
  }),

  /** POST /api/creditos/sos/:id/rechazar — { motivo } */
  rechazar: handle(async (req, res) => {
    const parsed = rechazarSosSchema.safeParse(req.body || {});
    if (!parsed.success) return invalid(res, parsed);
    const data = await SosService.rechazar(Number(req.params.id), parsed.data.motivo, responsable(req));
    await audit(req, 'SOS_RECHAZADO', data);
    res.json({ success: true, message: `S.O.S de ${data.sociaNombre} rechazado.`, data });
  })
};
