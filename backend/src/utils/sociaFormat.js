/**
 * Normalización de datos de socias — compartida por el formulario y la carga de la planilla.
 */

export const CARGOS = ['DIRECTORA', 'EDUCADORA', 'TECNICO', 'ASISTENTE', 'AUXILIAR', 'SIN DATO'];
export const ESTADOS = ['ACTIVA', 'SUSPENDIDA', 'RETIRADA'];
export const CUOTA_SOCIAL_MENSUAL = 4000;

/** Quita tildes y pasa a minúsculas (búsquedas y comparación de encabezados) */
export function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** RUT solo con dígitos y K, en mayúscula: "12.345.678-k" -> "12345678K" */
export function cleanRut(rut) {
  return String(rut ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Celular chileno en formato único +569XXXXXXXX.
 * Devuelve null si viene vacío y undefined si no se puede interpretar.
 */
export function normalizeCelular(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 8) return `+569${digits}`;
  if (digits.length === 9 && digits.startsWith('9')) return `+56${digits}`;
  if (digits.length === 11 && digits.startsWith('569')) return `+${digits}`;
  return undefined;
}

/** Cargo en el catálogo oficial; lo desconocido o vacío queda como 'SIN DATO' */
export function normalizeCargo(raw) {
  const value = normalizeText(raw).toUpperCase();
  return CARGOS.includes(value) ? value : 'SIN DATO';
}

/** Texto de nombre/apellido en mayúsculas sin espacios repetidos */
export function normalizeName(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}
