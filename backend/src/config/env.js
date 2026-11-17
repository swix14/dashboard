import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_TEST = NODE_ENV === 'test';

/**
 * Clave JWT (auditoría H-003): ya no existe una clave por defecto en el código.
 * - Fuera de test la app NO arranca sin una clave propia de al menos 32 caracteres.
 * - En test, si no se entrega, se genera una aleatoria por proceso (nunca una conocida).
 */
const WEAK_SECRET_PATTERN = /vtf-gestion-super-secret-key|change-?me|default|admin123|^secret$/i;

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET || '';
  if (!secret && IS_TEST) return crypto.randomBytes(48).toString('hex');
  if (secret.length < 32 || WEAK_SECRET_PATTERN.test(secret)) {
    throw new Error(
      'JWT_SECRET no configurado o inseguro. Defina una cadena aleatoria de al menos 32 caracteres ' +
        '(en cPanel > Setup Node.js App > Environment variables, luego Restart). Puede generarla con: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
  return secret;
}

export const env = {
  PORT: process.env.PORT || 4000,
  NODE_ENV,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'jardines_vtf',
  JWT_SECRET: resolveJwtSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  // En producción sin valor por defecto: el mismo dominio ya se acepta y localhost no debe colarse (H-011)
  CORS_ORIGIN: process.env.CORS_ORIGIN || (NODE_ENV === 'production' ? '' : 'http://localhost:5173'),
  UPLOADS_DIR: process.env.UPLOADS_DIR || path.join(backendRoot, 'uploads'),
  // Respaldo de auditoría si MySQL falla (fuera de la carpeta pública)
  AUDIT_DIR: process.env.AUDIT_DIR || path.join(backendRoot, 'logs')
};

/**
 * Modo memoria con usuarios semilla (auditoría H-012): solo en pruebas automatizadas
 * o si se activa a mano con ALLOW_MEMORY_FALLBACK=true. Antes se activaba solo con
 * NODE_ENV distinto de production, y un servidor sin NODE_ENV podía aceptar 'Admin123!'.
 * Nunca se permite en producción, aunque la variable diga true.
 */
env.ALLOW_MEMORY_FALLBACK =
  NODE_ENV !== 'production' && (IS_TEST || process.env.ALLOW_MEMORY_FALLBACK === 'true');
