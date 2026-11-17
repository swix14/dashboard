import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';

// Formatos aceptados como respaldo de movimientos (boletas, facturas, transferencias)
const ALLOWED_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

export const MAX_FILE_SIZE_MB = 5;

/**
 * Comprueba la firma real del archivo (primeros bytes), no solo el tipo que declara el navegador.
 * Así un ejecutable o un HTML renombrado a .pdf no queda guardado como comprobante.
 */
export function contenidoCoincide(header, mimeType) {
  const ascii = (start, end) => header.subarray(start, end).toString('latin1');
  switch (mimeType) {
    case 'application/pdf':
      return ascii(0, 5) === '%PDF-';
    case 'image/jpeg':
      return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    case 'image/png':
      return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
    case 'xlsx':
      // Un .xlsx es un ZIP
      return header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
    default:
      return false;
  }
}

async function leerCabecera(filePath) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await handle.read(buffer, 0, 16, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

fs.mkdirSync(env.UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.UPLOADS_DIR),
  // Nombre aleatorio en disco: nunca se usa el nombre enviado por el cliente
  filename: (req, file, cb) => {
    const ext = ALLOWED_TYPES[file.mimetype];
    cb(null, `comprobante-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});

const uploader = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      return cb(new Error('Formato de comprobante no permitido. Use PDF, JPG, PNG o WEBP.'));
    }
    cb(null, true);
  }
});

/**
 * Recibe un único archivo de comprobante en el campo indicado.
 * Las peticiones JSON (sin archivo) pasan sin cambios.
 */
export function uploadComprobante(fieldName = 'comprobante') {
  const handler = uploader.single(fieldName);

  return (req, res, next) => {
    handler(req, res, async (err) => {
      if (!err) {
        if (!req.file) return next();
        try {
          const header = await leerCabecera(req.file.path);
          if (contenidoCoincide(header, req.file.mimetype)) return next();
        } catch {
          // Si no se puede leer, se trata como archivo no válido
        }
        discardUploadedFile(req.file);
        return res.status(400).json({
          success: false,
          message: 'El contenido del archivo no corresponde a un PDF, JPG, PNG o WEBP válido.'
        });
      }

      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `El comprobante supera el tamaño máximo de ${MAX_FILE_SIZE_MB} MB.`
          : err.message;

      return res.status(400).json({ success: false, message });
    });
  };
}

// Planillas Excel: se leen en memoria (se guardan en disco solo al aplicar la carga)
const planillaUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    // Algunos navegadores envían application/octet-stream: se valida la extensión
    if (!/\.xlsx$/i.test(file.originalname || '')) {
      return cb(new Error('Formato no permitido. Suba la planilla en formato Excel .xlsx.'));
    }
    cb(null, true);
  }
});

export function uploadPlanilla(fieldName = 'planilla') {
  const handler = planillaUploader.single(fieldName);
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (!err) {
        if (req.file && !contenidoCoincide(req.file.buffer, 'xlsx')) {
          return res.status(400).json({
            success: false,
            message: 'El archivo no es una planilla Excel .xlsx válida.'
          });
        }
        return next();
      }
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? `La planilla supera el tamaño máximo de ${MAX_FILE_SIZE_MB} MB.` : err.message;
      return res.status(400).json({ success: false, message });
    });
  };
}

/**
 * Comprobantes de pago de varias empresas en un solo envío (un campo por empresa: comprobante_SOS, ...).
 * Se leen en memoria y se validan por su firma; el servicio los guarda en su carpeta histórica.
 * @param {string[]} codigos - códigos de empresa aceptados
 */
export function uploadComprobantesEmpresas(codigos) {
  const handler = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: codigos.length },
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_TYPES[file.mimetype]) {
        return cb(new Error('Formato de comprobante no permitido. Use PDF, JPG, PNG o WEBP.'));
      }
      cb(null, true);
    }
  }).fields(codigos.map((c) => ({ name: `comprobante_${c}`, maxCount: 1 })));

  return (req, res, next) => {
    handler(req, res, (err) => {
      if (err) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? `Cada comprobante puede pesar como máximo ${MAX_FILE_SIZE_MB} MB.`
            : err.code === 'LIMIT_UNEXPECTED_FILE'
              ? 'Comprobante de una empresa desconocida.'
              : err.message;
        return res.status(400).json({ success: false, message });
      }
      const porEmpresa = {};
      for (const [campo, files] of Object.entries(req.files || {})) {
        const file = files[0];
        if (!contenidoCoincide(file.buffer.subarray(0, 16), file.mimetype)) {
          return res.status(400).json({
            success: false,
            message: `El comprobante de ${campo.replace('comprobante_', '')} no es un PDF, JPG, PNG o WEBP válido.`
          });
        }
        porEmpresa[campo.replace('comprobante_', '')] = file;
      }
      req.comprobantes = porEmpresa;
      return next();
    });
  };
}

/**
 * Elimina un archivo subido cuando la operación asociada no se completa.
 */
export function discardUploadedFile(file) {
  if (file?.path) {
    fs.promises.unlink(file.path).catch(() => {});
  }
}

export function resolveUploadPath(storedName) {
  // basename evita que un nombre manipulado salga de la carpeta de subidas
  return path.join(env.UPLOADS_DIR, path.basename(storedName));
}
