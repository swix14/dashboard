import { idParamSchema } from '../validators/portalValidator.js';

/**
 * Rechaza con 400 un :id que no sea un entero positivo (auditoría H-019),
 * antes de llegar al servicio o a la base de datos.
 */
export function validateIdParam(req, res, next) {
  if (!idParamSchema.safeParse(req.params.id).success) {
    return res.status(400).json({ success: false, message: 'Identificador inválido.' });
  }
  next();
}
