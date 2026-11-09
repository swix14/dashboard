import { env } from '../config/env.js';
import { isDatabaseReady, waitForDatabase } from '../config/db.js';

/**
 * Garantiza que ninguna petición se atienda antes de terminar el primer intento de
 * conexión a MySQL y, en producción, que nunca se respondan datos de memoria.
 */
export async function requireDatabase(req, res, next) {
  await waitForDatabase();

  if (isDatabaseReady() || env.ALLOW_MEMORY_FALLBACK) {
    return next();
  }

  return res.status(503).json({
    success: false,
    code: 'DATABASE_UNAVAILABLE',
    message:
      'El sistema no tiene conexión con la base de datos. Intente nuevamente en unos minutos o avise al administrador.'
  });
}
