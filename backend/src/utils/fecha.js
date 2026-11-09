/**
 * Fechas en la hora de Chile, sin depender de la zona horaria del servidor.
 * toISOString() usa UTC: después de las 21:00 en Chile ya devuelve el día siguiente,
 * y el hosting puede estar configurado en otra zona (por ejemplo, Estados Unidos).
 */
const ZONA_CHILE = 'America/Santiago';

// en-CA formatea como AAAA-MM-DD
const formatoFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_CHILE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** Fecha de hoy en Chile, formato AAAA-MM-DD */
export function hoyChile(date = new Date()) {
  return formatoFecha.format(date);
}
