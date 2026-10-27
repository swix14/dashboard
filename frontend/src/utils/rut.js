/**
 * Utilidades de RUT chileno (Módulo 11) — mismo algoritmo que backend/src/utils/rutValidator.js
 */
export function validateRut(rutString) {
  const clean = String(rutString || '').replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 8 || clean.length > 9) return false;

  const cuerpo = clean.slice(0, -1);
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const dvEsperado = 11 - (suma % 11);
  const dv = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : String(dvEsperado);
  return clean.slice(-1) === dv;
}

/**
 * Formatea mientras se escribe: 123456785 -> 12.345.678-5
 */
export function formatRut(rutString) {
  const clean = String(rutString || '').replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
  if (clean.length < 2) return clean;
  const cuerpo = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${clean.slice(-1)}`;
}
