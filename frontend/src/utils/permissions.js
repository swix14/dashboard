/**
 * Matriz de accesos por sección (frontend). Debe coincidir con los requireRole del backend,
 * que es quien realmente protege los datos; aquí solo se decide qué se muestra.
 *
 * Decisión de la directiva (16-11-2026):
 *  - Secretaria: Inicio (sin finanzas), Socias (solo ficha personal), Comunicaciones y Reportes.
 *  - Directora: los mismos permisos que la Secretaria.
 *  - Delegadas: solo vista de Reportes (informe mensual).
 */
export const ROLES_ACCESO = {
  TESORERIA: ['ADMIN', 'PRESIDENTA', 'TESORERA'],
  TESORERIA_REGISTRAR: ['ADMIN', 'TESORERA'],
  SOCIAS: ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA'],
  SOCIAS_MODIFICAR: ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA'],
  FICHA_CREDITO: ['ADMIN', 'PRESIDENTA', 'TESORERA'],
  COMUNICACIONES: ['ADMIN', 'PRESIDENTA', 'SECRETARIA', 'DIRECTORA'],
  DOCUMENTOS: ['ADMIN', 'PRESIDENTA', 'TESORERA'],
  REPORTES: ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA', 'DELEGADA'],
  AUDITORIA: ['ADMIN', 'PRESIDENTA', 'TESORERA']
};

export function puedeAcceder(roleCode, seccion) {
  return (ROLES_ACCESO[seccion] || []).includes(roleCode);
}
