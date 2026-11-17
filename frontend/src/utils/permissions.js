/**
 * Matriz de accesos por sección (frontend). Debe coincidir con los requireRole del backend,
 * que es quien realmente protege los datos; aquí solo se decide qué se muestra.
 *
 * Decisión de la directiva (16-11-2026):
 *  - Secretaria: Inicio (sin finanzas), Socias (solo ficha personal), Comunicaciones y Reportes.
 *  - Directora: los mismos permisos que la Secretaria.
 *  - Delegadas: solo vista de Reportes (informe mensual).
 *
 * V4 (18-11-2026): Créditos y Convenios lo ven Admin, Presidenta (solo lectura) y Tesorera;
 * solo Admin y Tesorera cargan la planilla del día 18 y verifican los pagos.
 */
export const ROLES_ACCESO = {
  TESORERIA: ['ADMIN', 'PRESIDENTA', 'TESORERA'],
  TESORERIA_REGISTRAR: ['ADMIN', 'TESORERA'],
  SOCIAS: ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA'],
  SOCIAS_MODIFICAR: ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA'],
  FICHA_CREDITO: ['ADMIN', 'PRESIDENTA', 'TESORERA'],
  CREDITOS: ['ADMIN', 'PRESIDENTA', 'TESORERA'],
  CREDITOS_GESTIONAR: ['ADMIN', 'TESORERA'],
  COMUNICACIONES: ['ADMIN', 'PRESIDENTA', 'SECRETARIA', 'DIRECTORA'],
  DOCUMENTOS: ['ADMIN', 'PRESIDENTA', 'TESORERA'],
  REPORTES: ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA', 'DELEGADA'],
  AUDITORIA: ['ADMIN', 'PRESIDENTA', 'TESORERA']
};

export function puedeAcceder(roleCode, seccion) {
  return (ROLES_ACCESO[seccion] || []).includes(roleCode);
}
