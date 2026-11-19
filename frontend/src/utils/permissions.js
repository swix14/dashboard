/**
 * Matriz de accesos por sección (frontend). Debe coincidir con los requireRole del backend,
 * que es quien realmente protege los datos; aquí solo se decide qué se muestra.
 *
 * Decisión de la directiva (16-11-2026):
 *  - Secretaria: Inicio (sin finanzas), Socias (solo ficha personal), Comunicaciones y Reportes.
 *  - Directora: los mismos permisos que la Secretaria.
 *  - Delegadas: solo vista de Reportes (informe mensual).
 *
 * V4 (18-11-2026): Créditos y Convenios lo ven Admin y Tesorera (desde el 19-11 la Presidenta ya no);
 * solo Admin y Tesorera cargan la planilla del día 18 y verifican los pagos.
 */
export const ROLES_ACCESO = {
  // 19-11-2026: cada cargo ve solo los menús donde puede hacer cambios. La Presidenta, que en
  // Tesorería y Créditos solo leía, ya no tiene esos menús (sigue viendo el resumen en el Inicio
  // y la ficha de crédito en el Padrón). Los menús en construcción y Reportes no cambian.
  TESORERIA: ['ADMIN', 'TESORERA'],
  TESORERIA_REGISTRAR: ['ADMIN', 'TESORERA'],
  SOCIAS: ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA'],
  SOCIAS_MODIFICAR: ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA'],
  FICHA_CREDITO: ['ADMIN', 'PRESIDENTA', 'TESORERA'],
  CREDITOS: ['ADMIN', 'TESORERA'],
  CREDITOS_GESTIONAR: ['ADMIN', 'TESORERA'],
  COMUNICACIONES: ['ADMIN', 'PRESIDENTA', 'SECRETARIA', 'DIRECTORA'],
  DOCUMENTOS: ['ADMIN', 'PRESIDENTA', 'TESORERA'],
  REPORTES: ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA', 'DELEGADA'],
  AUDITORIA: ['ADMIN', 'PRESIDENTA', 'TESORERA']
};

/**
 * true si el rol tiene la sección. La Directora suplente de Tesorería (la activa el Admin)
 * cuenta además como Tesorera mientras dure la suplencia; el backend lo vuelve a revisar.
 */
export function puedeAcceder(roleCode, seccion, suplenteTesoreria = false) {
  const roles = ROLES_ACCESO[seccion] || [];
  return roles.includes(roleCode) || (suplenteTesoreria === true && roles.includes('TESORERA'));
}
