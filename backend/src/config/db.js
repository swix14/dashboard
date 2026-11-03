import mysql from 'mysql2/promise';
import { env } from './env.js';

let pool = null;
let isConnected = false;

try {
  pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  // Verificación no bloqueante de conectividad
  pool.getConnection()
    .then((connection) => {
      isConnected = true;
      connection.release();
      console.log(`✓ Conexión exitosa a MySQL XAMPP: ${env.DB_NAME}@${env.DB_HOST}:${env.DB_PORT}`);
    })
    .catch((err) => {
      isConnected = false;
      console.warn(`ℹ MySQL XAMPP no disponible (${err.message}). Modo contingencia activo.`);
    });
} catch (error) {
  isConnected = false;
  console.warn('Advertencia en inicialización del pool MySQL:', error.message);
}

export function isDatabaseReady() {
  return isConnected && pool !== null;
}

/**
 * Ejecutar consultas SQL seguras preparadas
 */
export async function query(sql, params = []) {
  if (!pool) {
    throw new Error('Pool de base de datos no inicializado');
  }
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export { pool };
export default { pool, isDatabaseReady, query };
