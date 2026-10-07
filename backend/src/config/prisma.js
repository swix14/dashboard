import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

let prisma = null;
let isDbConnected = false;

try {
  prisma = new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

  // Verificación rápida no bloqueante de conectividad
  prisma.$connect()
    .then(() => {
      isDbConnected = true;
      console.log('✓ Conexión establecida con base de datos PostgreSQL.');
    })
    .catch((err) => {
      isDbConnected = false;
      console.log('ℹ Base de datos PostgreSQL no detectada localmente (5432). Modo memoria activo para desarrollo.');
    });
} catch (error) {
  console.warn('Advertencia en inicialización de Prisma:', error.message);
}

export function isDatabaseReady() {
  return isDbConnected && prisma !== null;
}

export { prisma };
