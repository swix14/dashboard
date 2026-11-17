import { AuthService, PasswordChangeError } from '../services/authService.js';
import { audit } from '../utils/controllerHelpers.js';
import { loginSchema, changePasswordSchema } from '../validators/authValidator.js';
import { SessionService } from '../services/sessionService.js';

export const AuthController = {
  /**
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Datos de inicio de sesión inválidos',
          errors: parsed.error.format()
        });
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login({
        identifier: parsed.data.identifier,
        password: parsed.data.password,
        ipAddress,
        userAgent
      });

      return res.status(200).json({
        success: true,
        message: 'Sesión iniciada correctamente',
        data: result
      });
    } catch (error) {
      // Rechazos de acceso (LoginError) → 401; fallas internas → middleware central (500)
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      next(error);
    }
  },

  /**
   * POST /api/auth/logout
   */
  async logout(req, res, next) {
    try {
      // Revoca este token en el servidor: copiarlo ya no sirve después de cerrar sesión (H-005)
      await SessionService.revoke(req.session?.jti, req.session?.exp);

      if (req.user) await audit(req, 'LOGOUT', { email: req.user.email });

      return res.status(200).json({
        success: true,
        message: 'Sesión cerrada correctamente'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/auth/cambiar-clave
   */
  async changePassword(req, res, next) {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message || 'Datos inválidos para el cambio de contraseña'
        });
      }

      await AuthService.changePassword({
        user: req.user,
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      // Con la clave nueva, las demás sesiones abiertas (otro equipo, una sesión robada) dejan de valer
      await SessionService.revokeOthers(req.user.id, req.session?.jti);

      return res.status(200).json({
        success: true,
        message: 'Contraseña actualizada correctamente.',
        data: { user: { ...req.user, mustChangePassword: false } }
      });
    } catch (error) {
      if (error instanceof PasswordChangeError) {
        // 401 reservado para sesión inválida en el frontend: la clave actual errónea responde 400
        return res.status(error.status === 401 ? 400 : error.status).json({ success: false, message: error.message });
      }
      next(error);
    }
  },

  /**
   * GET /api/auth/me
   */
  async getMe(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        data: {
          user: req.user
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
