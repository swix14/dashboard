import { AuthService } from '../services/authService.js';
import { AuditService } from '../services/auditService.js';
import { loginSchema } from '../validators/authValidator.js';

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
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * POST /api/auth/logout
   */
  async logout(req, res, next) {
    try {
      if (req.user) {
        await AuditService.log({
          userId: req.user.id,
          action: 'LOGOUT',
          details: { email: req.user.email },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Sesión cerrada correctamente'
      });
    } catch (error) {
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
