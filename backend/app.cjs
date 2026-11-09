// Archivo de arranque para cPanel ("Application startup file": app.cjs).
// Passenger carga este archivo en formato CommonJS y desde aquí se inicia la app (ES Modules).
process.env.SIGAV_START = '1';
import('./src/server.js').catch((err) => {
  console.error('No se pudo iniciar SIGAV:', err);
  process.exit(1);
});
