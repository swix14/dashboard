import { JardinStatsService } from '../services/jardinStatsService.js';
import { sociaIdDe } from '../utils/controllerHelpers.js';
import { tieneRol } from './roleMiddleware.js';

/**
 * Permite los roles indicados y, además, a las socias marcadas como delegadas en el padrón
 * (entran con su cuenta del portal). La marca se revisa en cada consulta.
 */
export function requireRoleODelegada(...roles) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado.' });
      const rol = req.user.role?.code;
      if (tieneRol(req.user, roles)) return next();
      if (rol === 'SOCIA' && (await JardinStatsService.esDelegadaActiva(sociaIdDe(req)))) return next();
      return res.status(403).json({ success: false, message: 'Acceso denegado: esta sección es para la directiva y las delegadas de jardín.' });
    } catch (err) {
      return next(err);
    }
  };
}
