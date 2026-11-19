import { SuplenciaService } from '../services/suplenciaService.js';
import { audit, handle, invalid, responsable } from '../utils/controllerHelpers.js';
import { suplenciaSchema } from '../validators/treasuryValidator.js';

export const SuplenciaController = {
  /** GET /api/tesoreria/suplencia — solo Admin */
  getEstado: handle(async (req, res) => {
    res.json({ success: true, data: await SuplenciaService.getEstado() });
  }),

  /** PUT /api/tesoreria/suplencia — solo Admin; queda en la bitácora */
  setEstado: handle(async (req, res) => {
    const parsed = suplenciaSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    const data = await SuplenciaService.setEstado(parsed.data, responsable(req));
    await audit(req, data.activa ? 'SUPLENCIA_TESORERIA_ACTIVADA' : 'SUPLENCIA_TESORERIA_DESACTIVADA', {
      suplente: data.suplente
    });
    const message = data.activa
      ? `${data.suplente.nombre} queda como suplente de Tesorería.`
      : 'Suplencia de Tesorería desactivada.';
    res.json({ success: true, message, data });
  })
};
