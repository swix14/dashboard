import fs from 'node:fs';
import { TreasuryService } from '../services/treasuryService.js';
import { discardUploadedFile, resolveUploadPath } from '../middlewares/uploadMiddleware.js';
import { AuditService } from '../services/auditService.js';
import { movementSchema, listMovementsSchema, updateMovementSchema, annulMovementSchema } from '../validators/treasuryValidator.js';

const responsableDe = (req) => `${req.user.firstName} ${req.user.lastName || ''}`.trim();

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
      const parsed = listMovementsSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Filtros inválidos' });
      }
      const movements = await TreasuryService.getMovements(parsed.data);

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
        discardUploadedFile(req.file);
        return res.status(400).json({
          success: false,
          message: 'Datos de movimiento inválidos',
          errors: parsed.error.format()
        });
      }

      // Regla estricta: un egreso solo se registra con el archivo de respaldo adjunto
      if (parsed.data.tipo === 'EGRESO' && !req.file) {
        return res.status(400).json({
          success: false,
          message: 'No es posible registrar un egreso sin adjuntar el archivo del comprobante (PDF o imagen).'
        });
      }

      const responsableName = `${req.user.firstName} ${req.user.lastName}`;

      const comprobanteArchivo = req.file
        ? {
            storedName: req.file.filename,
            originalName: decodeFileName(req.file.originalname),
            mimeType: req.file.mimetype,
            size: req.file.size
          }
        : null;

      let created;
      try {
        created = await TreasuryService.createMovement({
          ...parsed.data,
          comprobante: comprobanteArchivo ? comprobanteArchivo.originalName : parsed.data.comprobante,
          comprobanteArchivo,
          responsable: responsableName
        });
      } catch (error) {
        discardUploadedFile(req.file);
        throw error;
      }

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
      // Reglas de negocio → 400 con su mensaje; fallas internas (MySQL, disco) → middleware central,
      // que en producción responde 500 sin exponer detalles técnicos
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      next(error);
    }
  },

  /**
   * PUT /api/tesoreria/movimientos/:id (multipart; el archivo "comprobante" es opcional y reemplaza al anterior)
   */
  async updateMovement(req, res, next) {
    try {
      const parsed = updateMovementSchema.safeParse(req.body || {});
      if (!parsed.success) {
        discardUploadedFile(req.file);
        return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Datos de movimiento inválidos' });
      }
      const comprobanteArchivo = req.file
        ? {
            storedName: req.file.filename,
            originalName: decodeFileName(req.file.originalname),
            mimeType: req.file.mimetype,
            size: req.file.size
          }
        : null;

      let result;
      try {
        result = await TreasuryService.updateMovement(Number(req.params.id), parsed.data, comprobanteArchivo, responsableDe(req));
      } catch (error) {
        discardUploadedFile(req.file);
        throw error;
      }

      // La auditoría guarda el antes y el después para la comisión revisadora
      await AuditService.log({
        userId: req.user.id,
        action: 'TREASURY_MOVEMENT_UPDATED',
        details: result,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.json({
        success: true,
        message: `Movimiento ${result.correlativo} actualizado.`,
        data: await TreasuryService.getMovementById(Number(req.params.id))
      });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
      next(error);
    }
  },

  /**
   * POST /api/tesoreria/movimientos/:id/anular — { motivo }
   */
  async annulMovement(req, res, next) {
    try {
      const parsed = annulMovementSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Indique el motivo de la anulación' });
      }
      const result = await TreasuryService.annulMovement(Number(req.params.id), parsed.data.motivo, responsableDe(req));
      await AuditService.log({
        userId: req.user.id,
        action: 'TREASURY_MOVEMENT_ANULADO',
        details: { ...result, motivo: parsed.data.motivo },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      return res.json({ success: true, message: `Movimiento ${result.correlativo} anulado.`, data: result });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
      next(error);
    }
  },

  /**
   * GET /api/tesoreria/movimientos/:id/comprobante
   * Descarga el archivo de respaldo asociado a un movimiento.
   */
  async downloadComprobante(req, res, next) {
    try {
      const movement = await TreasuryService.getMovementById(req.params.id);
      if (!movement) {
        return res.status(404).json({ success: false, message: 'Movimiento no encontrado.' });
      }

      if (!movement.comprobanteArchivo) {
        return res.status(404).json({
          success: false,
          message: `El movimiento ${movement.correlativo} no tiene un archivo digital adjunto (registro histórico: ${movement.comprobante || 'sin respaldo'}).`
        });
      }

      const filePath = resolveUploadPath(movement.comprobanteArchivo.storedName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'El archivo del comprobante ya no se encuentra en el servidor.'
        });
      }

      await AuditService.log({
        userId: req.user.id,
        action: 'TREASURY_RECEIPT_DOWNLOADED',
        details: { correlativo: movement.correlativo, comprobante: movement.comprobante },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.download(filePath, movement.comprobanteArchivo.originalName);
    } catch (error) {
      next(error);
    }
  }
};

// Busboy entrega el nombre original en latin1; se normaliza a UTF-8 para conservar tildes y ñ
function decodeFileName(name) {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}
