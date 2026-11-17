/**
 * Manejo central de errores (auditoría H-009).
 * - El log guarda solo lo necesario para diagnosticar (ruta, tipo, código y mensaje), nunca el
 *   objeto completo, que puede traer SQL, parámetros o datos personales. El stack solo fuera de producción.
 * - En producción los 500 responden un mensaje genérico; el detalle queda en el log del servidor.
 */
export function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || (typeof err.status === 'number' ? err.status : 500);
  const isProduction = process.env.NODE_ENV === 'production';

  if (statusCode >= 500) {
    const resumen = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${statusCode} ${err.name || 'Error'}` +
      `${err.code ? ` (${err.code})` : ''}: ${err.message}`;
    console.error(isProduction ? resumen : `${resumen}\n${err.stack || ''}`);
  } else if (process.env.NODE_ENV !== 'test') {
    console.warn(`${req.method} ${req.originalUrl} → ${statusCode}: ${err.message}`);
  }

  const message =
    statusCode >= 500 && isProduction
      ? 'Ha ocurrido un error interno en el servidor. Por favor comuníquese con el administrador si el problema persiste.'
      : err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack })
  });
}
