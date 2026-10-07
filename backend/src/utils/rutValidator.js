/**
 * Validador de RUT chileno (Algoritmo Módulo 11)
 * Regla de negocio: El RUT debe validarse estrictamente.
 */
export function validateRut(rutString) {
  if (!rutString || typeof rutString !== 'string') return false;

  // Limpiar puntos y guiones
  const cleanRut = rutString.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleanRut.length < 8 || cleanRut.length > 9) return false;

  const cuerpo = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1);

  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const resto = suma % 11;
  const dvEsperado = 11 - resto;

  let dvCalculado = '';
  if (dvEsperado === 11) dvCalculado = '0';
  else if (dvEsperado === 10) dvCalculado = 'K';
  else dvCalculado = dvEsperado.toString();

  return dv === dvCalculado;
}

export function formatRut(rutString) {
  if (!rutString) return '';
  const clean = rutString.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${cuerpo}-${dv}`;
}
