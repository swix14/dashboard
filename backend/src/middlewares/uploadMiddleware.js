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
    handler(req, res, (err) => {
      if (!err) return next();

      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `El comprobante supera el tamaño máximo de ${MAX_FILE_SIZE_MB} MB.`
          : err.message;

      return res.status(400).json({ success: false, message });
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
