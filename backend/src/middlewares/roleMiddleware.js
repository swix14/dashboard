/**
 * true si el usuario tiene alguno de los roles. La Directora suplente de Tesorería (activada por
 * el Admin) cuenta además como Tesorera mientras dure la suplencia.
 */
export function tieneRol(user, roles) {
  const code = user?.role?.code;
  if (roles.includes(code)) return true;
  return roles.includes('TESORERA') && user?.suplenteTesoreria === true;
}

/**
 * Middleware para autorización estricta basada en roles
 * @param {string[]} allowedRoles - Lista de códigos de roles permitidos
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado.'
      });
    }

    const userRoleCode = req.user.role?.code;

    if (!tieneRol(req.user, allowedRoles)) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado: Su rol (${userRoleCode || 'Sin Rol'}) no cuenta con privilegios para esta operación.`
      });
    }

    next();
  };
}
