import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthService } from '../services/authService.js';

// Rutas permitidas mientras la persona no haya cambiado su clave inicial
const PASSWORD_CHANGE_ALLOWED = ['/api/auth/me', '/api/auth/logout', '/api/auth/cambiar-clave', '/api/socia/cambiar-clave'];

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acceso no autorizado: Token de autenticación no proporcionado.'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;

    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Sesión inválida o expirada. Por favor inicie sesión nuevamente.'
      });
    }

    // Cargar perfil completo con rol y validación de estado activo
    const userProfile = await AuthService.getProfile(decoded.sub);
    if (!userProfile) {
      return res.status(401).json({
        success: false,
        message: 'Acceso no autorizado: Usuario no encontrado en el sistema.'
      });
    }

    if (userProfile.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: Su usuario se encuentra inactivo o suspendido. Contacte a la directiva.'
      });
    }

    // Primer ingreso: bloquear todo salvo el cambio de clave (validado en servidor, no solo en pantalla)
    const path = req.originalUrl.split('?')[0];
    if (userProfile.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.includes(path)) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Debe cambiar su contraseña inicial antes de continuar.'
      });
    }

    req.user = userProfile;
    next();
  } catch (error) {
    const isSuspended = error.message.includes('inactivo') || error.message.includes('suspendido');
    return res.status(isSuspended ? 403 : 401).json({
      success: false,
      message: error.message
    });
  }
}
