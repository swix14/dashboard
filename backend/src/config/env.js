import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const env = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'jardines_vtf',
  JWT_SECRET: process.env.JWT_SECRET || 'vtf-gestion-super-secret-key-2026-production-ready',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  UPLOADS_DIR: process.env.UPLOADS_DIR || path.join(backendRoot, 'uploads')
};

// Datos de memoria (semillas de prueba) cuando MySQL no responde.
// Solo para desarrollo y tests: en producción mostraría datos falsos y no guardaría nada.
env.ALLOW_MEMORY_FALLBACK = process.env.ALLOW_MEMORY_FALLBACK
  ? process.env.ALLOW_MEMORY_FALLBACK === 'true'
  : env.NODE_ENV !== 'production';

// Salvaguarda de seguridad en producción
// La clave por defecto está publicada en el repositorio: con ella cualquiera podría fabricar
// una sesión de Tesorera. En producción la app no arranca sin una clave propia.
if (env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32 || secret.includes('vtf-gestion-super-secret-key')) {
    throw new Error(
      'JWT_SECRET no configurado o inseguro. En cPanel > Setup Node.js App agregue la variable JWT_SECRET ' +
        'con una cadena aleatoria de al menos 32 caracteres y pulse Restart.'
    );
  }
}
