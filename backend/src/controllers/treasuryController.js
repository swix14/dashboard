import { TreasuryService } from '../services/treasuryService.js';
import { AuditService } from '../services/auditService.js';
import { movementSchema } from '../validators/treasuryValidator.js';

export const TreasuryController = {
  /**
   * GET /api/tesoreria/resumen
   */
  async getSummary(req, res, next) {
    try {
      const summary = await TreasuryService.getSummary();
      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/tesoreria/movimientos
   */
  async getMovements(req, res, next) {
    try {
      const { tipo, centroCosto, metodo, fechaDesde, fechaHasta, fechaExacta } = req.query;
      const movements = await TreasuryService.getMovements({
        tipo,
        centroCosto,
        metodo,
        fechaDesde,
        fechaHasta,
        fechaExacta
      });

      return res.status(200).json({
        success: true,
        total: movements.length,
        data: movements
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/tesoreria/movimientos
   * Solo Tesorera y Admin tienen permiso de crear/modificar.
   */
  async createMovement(req, res, next) {
    try {
      const parsed = movementSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Datos de movimiento inválidos',
          errors: parsed.error.format()
        });
      }

      const responsableName = `${req.user.firstName} ${req.user.lastName}`;

      const created = await TreasuryService.createMovement({
        ...parsed.data,
        responsable: responsableName
      });

      // Registrar auditoría de la operación financiera
      await AuditService.log({
        userId: req.user.id,
        action: 'TREASURY_MOVEMENT_CREATED',
        details: {
          correlativo: created.correlativo,
          tipo: created.tipo,
          monto: created.monto,
          centroCosto: created.centroCosto,
          comprobante: created.comprobante
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(201).json({
        success: true,
        message: 'Movimiento de tesorería registrado exitosamente',
        data: created
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
};
