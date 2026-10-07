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

    if (!allowedRoles.includes(userRoleCode)) {
      return res.status(403).json({
        success: false,
        message: `Acceso denegado: Su rol (${userRoleCode || 'Sin Rol'}) no cuenta con privilegios para esta operación.`
      });
    }

    next();
  };
}
