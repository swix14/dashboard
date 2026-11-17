// Marca de "sesión cerrada por inactividad" (sessionStorage: vive solo en esta pestaña)
export const IDLE_LOGOUT_FLAG = 'vtf_idle_logout';

/**
 * Mensaje para la página de login si la sesión se cerró por inactividad.
 * Solo lee (seguro en StrictMode); la marca se borra al iniciar sesión (AuthContext).
 */
export function readIdleLogoutMessage() {
  try {
    if (sessionStorage.getItem(IDLE_LOGOUT_FLAG)) {
      return 'Tu sesión se cerró por 10 minutos de inactividad. Ingresa nuevamente.';
    }
  } catch {
    // Sin sessionStorage no hay mensaje
  }
  return null;
}

export function clearIdleLogoutFlag() {
  try {
    sessionStorage.removeItem(IDLE_LOGOUT_FLAG);
  } catch {
    // Nada que limpiar
  }
}
