import mysql from 'mysql2/promise';
import { env } from './env.js';

// Errores que indican que el servidor MySQL no está disponible (no un error de SQL)
const CONNECTION_ERROR_CODES = [
  'ECONNREFUSED',
  'PROTOCOL_CONNECTION_LOST',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ER_ACCESS_DENIED_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR'
];

// Reintento periódico cuando la conexión inicial falla (MySQL reiniciado, credenciales corregidas, etc.)
const RECONNECT_INTERVAL_MS = 15000;

let pool = null;
let isConnected = false;
let lastError = null;
let reconnectTimer = null;
let initialAttempt = Promise.resolve(false);

function describeError(err) {
  return { code: err.code || 'ERROR', message: err.message || String(err) };
}

async function tryConnect() {
  if (!pool) return false;
  try {
    const connection = await pool.getConnection();
    connection.release();
    if (!isConnected) {
      console.log(`✓ Conexión exitosa a MySQL: ${env.DB_NAME}@${env.DB_HOST}:${env.DB_PORT}`);
    }
    isConnected = true;
    lastError = null;
    return true;
  } catch (err) {
    isConnected = false;
    lastError = describeError(err);
    console.warn(
      `ℹ MySQL no disponible [${lastError.code}] ${lastError.message} ` +
        `(DB_NAME=${env.DB_NAME}). ` +
        (env.ALLOW_MEMORY_FALLBACK ? 'Modo contingencia en memoria activo.' : 'La API responderá 503 hasta que se conecte.')
    );
    scheduleReconnect();
    return false;
  }
}

function scheduleReconnect() {
  if (reconnectTimer || env.NODE_ENV === 'test') return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await tryConnect();
  }, RECONNECT_INTERVAL_MS);
  reconnectTimer.unref?.();
}

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
    connectTimeout: 5000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  initialAttempt = tryConnect();
} catch (error) {
  isConnected = false;
  lastError = describeError(error);
  console.warn('Advertencia en inicialización del pool MySQL:', error.message);
}

export function isDatabaseReady() {
  return isConnected && pool !== null;
}

/**
 * Espera a que termine el primer intento de conexión.
 * Evita que las primeras peticiones (arranque en frío de Passenger) se atiendan
 * con datos de memoria mientras MySQL todavía está conectando.
 */
export function waitForDatabase() {
  return initialAttempt;
}

/**
 * Estado de la conexión para diagnóstico (sin credenciales).
 */
export function getDatabaseStatus() {
  return {
    conectada: isDatabaseReady(),
    error: lastError ? lastError.code : null
  };
}

/**
 * Ejecutar consultas SQL seguras preparadas
 */
export async function query(sql, params = []) {
  if (!pool) {
    throw new Error('Pool de base de datos no inicializado');
  }
  try {
    const [rows] = await pool.execute(sql, params);
    isConnected = true;
    return rows;
  } catch (err) {
    if (CONNECTION_ERROR_CODES.includes(err.code)) {
      isConnected = false;
      lastError = describeError(err);
      scheduleReconnect();
    }
    throw err;
  }
}

/**
 * Ejecuta varias operaciones como una sola transacción: o se aplican todas o ninguna.
 * `fn` recibe `tx(sql, params)` que corre sobre la misma conexión.
 */
export async function withTransaction(fn) {
  if (!pool) throw new Error('Pool de base de datos no inicializado');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tx = async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    };
    const result = await fn(tx);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback().catch(() => {});
    throw err;
  } finally {
    connection.release();
  }
}

export { pool };
export default { pool, isDatabaseReady, waitForDatabase, getDatabaseStatus, query, withTransaction };
