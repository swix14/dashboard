import { SociaService } from '../services/sociaService.js';
import { AuditService } from '../services/auditService.js';
import { createSociaSchema, updateSociaSchema } from '../validators/sociaValidator.js';

function validationError(res, parsed) {
  const firstIssue = parsed.error.issues[0];
  return res.status(400).json({
    success: false,
    message: firstIssue?.message || 'Datos de socia inválidos',
    errors: parsed.error.format()
  });
}

export const SociaController = {
  /**
   * GET /api/socias/resumen
   */
  async getSummary(req, res, next) {
    try {
      const summary = await SociaService.getSummary();
      return res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/socias
   */
  async getSocias(req, res, next) {
    try {
      const { search, jardinId, estado, cargo, credito } = req.query;
      const list = await SociaService.getSocias({ search, jardinId, estado, cargo, credito });
      return res.status(200).json({ success: true, total: list.length, data: list });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/socias/jardines
   */
  async getJardines(req, res, next) {
    try {
      const jardines = await SociaService.getJardines();
      return res.status(200).json({ success: true, data: jardines });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/socias/:id
   */
  async getSociaById(req, res, next) {
    try {
      const socia = await SociaService.getSociaById(req.params.id);
      return res.status(200).json({ success: true, data: socia });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/socias
   */
  async createSocia(req, res, next) {
    try {
      const parsed = createSociaSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed);

      const created = await SociaService.createSocia(parsed.data);

      await AuditService.log({
        userId: req.user.id,
        action: 'SOCIA_CREATED',
        details: { sociaId: created.id, rut: created.rut, jardin: created.jardin?.name },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(201).json({
        success: true,
        message: 'Socia incorporada al padrón exitosamente',
        data: created
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/socias/:id
   */
  async updateSocia(req, res, next) {
    try {
      const parsed = updateSociaSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed);

      const { socia, cambios } = await SociaService.updateSocia(
        req.params.id,
        parsed.data,
        `${req.user.firstName} ${req.user.lastName}`
      );

      if (Object.keys(cambios).length > 0) {
        await AuditService.log({
          userId: req.user.id,
          action: cambios.jardinId ? 'SOCIA_TRANSFERRED' : 'SOCIA_UPDATED',
          details: { sociaId: socia.id, rut: socia.rut, cambios },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      return res.status(200).json({
        success: true,
        message: Object.keys(cambios).length > 0 ? 'Ficha de socia actualizada' : 'Sin cambios que guardar',
        data: socia
      });
    } catch (error) {
      next(error);
    }
  }
};
