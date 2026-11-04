/**
 * Validador de RUT chileno (Algoritmo Módulo 11)
 * Regla de negocio: El RUT debe validarse estrictamente.
 */
export function validateRut(rutString) {
  if (!rutString || typeof rutString !== 'string') return false;

  // Limpiar puntos, espacios y guiones
  const cleanRut = rutString.replace(/[\.\-\s]/g, '').toUpperCase();
  if (cleanRut.length < 8 || cleanRut.length > 9) return false;

  const cuerpo = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1);

  // El cuerpo debe contener estrictamente dígitos numéricos
  if (!/^\d+$/.test(cuerpo)) return false;

  // El dígito verificador debe ser un número del 0 al 9 o K
  if (!/^[0-9K]$/.test(dv)) return false;

  return dv === computeRutDv(cuerpo);
}

/**
 * Calcula el dígito verificador (Módulo 11) para el cuerpo numérico de un RUT
 */
export function computeRutDv(cuerpo) {
  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const dvEsperado = 11 - (suma % 11);
  if (dvEsperado === 11) return '0';
  if (dvEsperado === 10) return 'K';
  return dvEsperado.toString();
}

/**
 * Formatea un RUT al estilo oficial con puntos y guion (Ej: 12.345.678-5)
 */
export function formatRutWithDots(rutString) {
  if (!rutString) return '';
  const clean = rutString.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  const cuerpo = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${clean.slice(-1)}`;
}

export function formatRut(rutString) {
  if (!rutString) return '';
  const clean = rutString.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${cuerpo}-${dv}`;
}
