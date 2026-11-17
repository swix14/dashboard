import fs from 'node:fs';
import { TreasuryService } from '../services/treasuryService.js';
import { discardUploadedFile, resolveUploadPath } from '../middlewares/uploadMiddleware.js';
import { audit, handle, responsable } from '../utils/controllerHelpers.js';
import { movementSchema, listMovementsSchema, updateMovementSchema, annulMovementSchema } from '../validators/treasuryValidator.js';

// Busboy entrega el nombre original en latin1; se normaliza a UTF-8 para conservar tildes y ñ
function decodeFileName(name) {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

/** Datos del comprobante subido por multer (null si no se adjuntó archivo) */
function comprobanteDe(file) {
  if (!file) return null;
  return {
    storedName: file.filename,
    originalName: decodeFileName(file.originalname),
    mimeType: file.mimetype,
    size: file.size
  };
}

/** Ejecuta la operación y, si falla, elimina el archivo recién subido para que no quede huérfano */
async function conArchivo(req, operacion) {
  try {
    return await operacion();
  } catch (error) {
    discardUploadedFile(req.file);
    throw error;
  }
}

export const TreasuryController = {
  /** GET /api/tesoreria/resumen */
  getSummary: handle(async (req, res) => {
    res.json({ success: true, data: await TreasuryService.getSummary() });
  }),

  /** GET /api/tesoreria/movimientos */
  getMovements: handle(async (req, res) => {
    const parsed = listMovementsSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Filtros inválidos' });
    }
    const movements = await TreasuryService.getMovements(parsed.data);
    res.json({ success: true, total: movements.length, data: movements });
  }),

  /**
   * POST /api/tesoreria/movimientos (Tesorera y Admin).
   * Reglas de negocio → 400 con su mensaje; fallas internas (MySQL, disco) → middleware central,
   * que en producción responde 500 sin exponer detalles técnicos.
   */
  createMovement: handle(async (req, res) => {
    const parsed = movementSchema.safeParse(req.body);
    if (!parsed.success) {
      discardUploadedFile(req.file);
      return res.status(400).json({ success: false, message: 'Datos de movimiento inválidos', errors: parsed.error.format() });
    }

    // Regla estricta: un egreso solo se registra con el archivo de respaldo adjunto
    if (parsed.data.tipo === 'EGRESO' && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'No es posible registrar un egreso sin adjuntar el archivo del comprobante (PDF o imagen).'
      });
    }

    const comprobanteArchivo = comprobanteDe(req.file);
    const created = await conArchivo(req, () =>
      TreasuryService.createMovement({
        ...parsed.data,
        comprobante: comprobanteArchivo ? comprobanteArchivo.originalName : parsed.data.comprobante,
        comprobanteArchivo,
        responsable: responsable(req)
      })
    );

    await audit(req, 'TREASURY_MOVEMENT_CREATED', {
      correlativo: created.correlativo,
      tipo: created.tipo,
      monto: created.monto,
      centroCosto: created.centroCosto,
      comprobante: created.comprobante
    });

    res.status(201).json({ success: true, message: 'Movimiento de tesorería registrado exitosamente', data: created });
  }),

  /** PUT /api/tesoreria/movimientos/:id (multipart; el archivo "comprobante" es opcional y reemplaza al anterior) */
  updateMovement: handle(async (req, res) => {
    const parsed = updateMovementSchema.safeParse(req.body || {});
    if (!parsed.success) {
      discardUploadedFile(req.file);
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Datos de movimiento inválidos' });
    }
    const id = Number(req.params.id);
    const result = await conArchivo(req, () =>
      TreasuryService.updateMovement(id, parsed.data, comprobanteDe(req.file), responsable(req))
    );

    // La auditoría guarda el antes y el después para la comisión revisadora
    await audit(req, 'TREASURY_MOVEMENT_UPDATED', result);

    res.json({ success: true, message: `Movimiento ${result.correlativo} actualizado.`, data: await TreasuryService.getMovementById(id) });
  }),

  /** POST /api/tesoreria/movimientos/:id/anular — { motivo } */
  annulMovement: handle(async (req, res) => {
    const parsed = annulMovementSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Indique el motivo de la anulación' });
    }
    const result = await TreasuryService.annulMovement(Number(req.params.id), parsed.data.motivo, responsable(req));
    await audit(req, 'TREASURY_MOVEMENT_ANULADO', { ...result, motivo: parsed.data.motivo });
    res.json({ success: true, message: `Movimiento ${result.correlativo} anulado.`, data: result });
  }),

  /** GET /api/tesoreria/movimientos/:id/comprobante — descarga el archivo de respaldo del movimiento */
  downloadComprobante: handle(async (req, res) => {
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
      return res.status(404).json({ success: false, message: 'El archivo del comprobante ya no se encuentra en el servidor.' });
    }

    await audit(req, 'TREASURY_RECEIPT_DOWNLOADED', { correlativo: movement.correlativo, comprobante: movement.comprobante });
    res.download(filePath, movement.comprobanteArchivo.originalName);
  })
};
