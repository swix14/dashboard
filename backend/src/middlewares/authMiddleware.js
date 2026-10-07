import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthService } from '../services/authService.js';

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

    // Cargar perfil completo con rol
    const userProfile = await AuthService.getProfile(decoded.sub);
    req.user = userProfile;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al verificar autenticación: ' + error.message
    });
  }
}
