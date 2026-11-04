export function errorMiddleware(err, req, res, next) {
  console.error('Error capturado en middleware central:', err);

  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const isProduction = process.env.NODE_ENV === 'production';

  // En producción, los errores 500 no deben filtrar detalles internos de la base de datos o sistema de archivos
  const message =
    statusCode === 500 && isProduction
      ? 'Ha ocurrido un error interno en el servidor. Por favor comuníquese con el administrador si el problema persiste.'
      : err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
