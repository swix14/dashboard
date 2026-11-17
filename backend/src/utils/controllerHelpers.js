import { AuditService } from '../services/auditService.js';

/**
 * Utilidades comunes de los controladores (antes cada controlador tenía su propia copia).
 */

/** Nombre de quien hace la operación, para los campos "responsable" y "revisado por" */
export const responsable = (req) => `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

/** Id numérico de la socia del token del portal ("socia-12" o 12) */
export const sociaIdDe = (req) => Number(String(req.user?.sociaId ?? '').replace('socia-', ''));

/** Registra la acción en la bitácora con el usuario, su IP y su navegador */
export function audit(req, action, details) {
  return AuditService.log({
    userId: req.user.id,
    rut: req.user.rut,
    action,
    details,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
}

/** 400 con el primer error de validación de zod */
export function invalid(res, parsed, fallback = 'Datos inválidos.') {
  return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || fallback });
}

/**
 * Envuelve un controlador async: los errores de negocio (con statusCode) se responden con su
 * mensaje; el resto va al middleware central, que en producción no muestra el detalle técnico.
 */
export function handle(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
      next(err);
    }
  };
}
