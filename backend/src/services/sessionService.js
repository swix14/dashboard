import { isDatabaseReady, query } from '../config/db.js';

/**
 * Revocación de sesiones (auditoría H-005).
 * Cada token lleva un identificador único (jti). Al cerrar sesión se registra como revocado y
 * authMiddleware lo rechaza aunque su firma siga vigente. Cada registro se guarda solo hasta que
 * el token habría expirado de todos modos.
 */
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`sesiones_revocadas\` (
    \`jti\` CHAR(36) NOT NULL PRIMARY KEY,
    \`expira\` DATETIME NOT NULL,
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX \`idx_sesiones_expira\` (\`expira\`)
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4`;

// Corte por persona: al cambiar la contraseña se invalidan sus OTRAS sesiones abiertas
// (tokens emitidos antes de "desde", salvo el de quien hizo el cambio)
const CREATE_CORTE_SQL = `
  CREATE TABLE IF NOT EXISTS \`sesiones_corte\` (
    \`usuario\` VARCHAR(40) NOT NULL PRIMARY KEY,
    \`desde_ms\` BIGINT NOT NULL,
    \`excepto_jti\` CHAR(36) NULL
  ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4`;

// Modo memoria (pruebas): jti -> expiración en ms; usuario -> { desdeMs, exceptoJti }
const memoryRevoked = new Map();
const memoryCorte = new Map();
let tableReady = null;

// Las tablas se crean solas la primera vez (no exige correr la migración antes de desplegar)
function ensureTable() {
  if (!tableReady) {
    tableReady = Promise.all([query(CREATE_TABLE_SQL), query(CREATE_CORTE_SQL)]).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

// Un token emitido antes del corte (iat en segundos) deja de valer, salvo la sesión exceptuada
function cortado(corte, jti, iatSeconds) {
  if (!corte || !iatSeconds) return false;
  return iatSeconds * 1000 < corte.desdeMs && jti !== corte.exceptoJti;
}

const toMysqlDate = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

export const SessionService = {
  /**
   * Marca un token como cerrado.
   * @param {string} jti - identificador único del token
   * @param {number} expSeconds - claim exp del JWT (segundos desde epoch)
   */
  async revoke(jti, expSeconds) {
    if (!jti) return;
    const expiraMs = (expSeconds || 0) * 1000 || Date.now() + 24 * 60 * 60 * 1000;

    if (!isDatabaseReady()) {
      memoryRevoked.set(jti, expiraMs);
      return;
    }
    await ensureTable();
    await query('INSERT IGNORE INTO sesiones_revocadas (jti, expira) VALUES (?, ?)', [jti, toMysqlDate(expiraMs)]);
    // Limpieza: los tokens ya expirados no necesitan seguir en la lista
    await query('DELETE FROM sesiones_revocadas WHERE expira < ?', [toMysqlDate(Date.now())]).catch(() => {});
  },

  /**
   * Cierra todas las demás sesiones de una persona (cambio de contraseña).
   * @param {string} usuario - claim sub del token (admin-12 / socia-34)
   * @param {string} jtiActual - sesión que hizo el cambio y que sigue abierta
   */
  async revokeOthers(usuario, jtiActual) {
    if (!usuario) return;
    // iat viene en segundos: se redondea hacia abajo para no cortar un token emitido en este mismo segundo.
    // Se guarda como número (ms UTC) para no depender de la zona horaria de MySQL.
    const desdeMs = Math.floor(Date.now() / 1000) * 1000;
    if (!isDatabaseReady()) {
      memoryCorte.set(usuario, { desdeMs, exceptoJti: jtiActual || null });
      return;
    }
    await ensureTable();
    await query(
      `INSERT INTO sesiones_corte (usuario, desde_ms, excepto_jti) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE desde_ms = VALUES(desde_ms), excepto_jti = VALUES(excepto_jti)`,
      [usuario, desdeMs, jtiActual || null]
    );
  },

  /**
   * @param {string} jti
   * @param {string} usuario - claim sub
   * @param {number} iat - claim iat (segundos)
   * @returns {Promise<boolean>} true si el token fue cerrado (logout) o quedó cortado (cambio de clave)
   */
  async isRevoked(jti, usuario, iat) {
    if (!isDatabaseReady()) {
      const exp = jti ? memoryRevoked.get(jti) : null;
      if (exp && exp < Date.now()) memoryRevoked.delete(jti);
      if (exp && exp >= Date.now()) return true;
      return cortado(memoryCorte.get(usuario), jti, iat);
    }
    await ensureTable();
    if (jti) {
      const rows = await query('SELECT 1 FROM sesiones_revocadas WHERE jti = ? LIMIT 1', [jti]);
      if (rows.length > 0) return true;
    }
    if (!usuario) return false;
    const cortes = await query(
      'SELECT desde_ms, excepto_jti FROM sesiones_corte WHERE usuario = ? LIMIT 1',
      [usuario]
    );
    if (!cortes.length) return false;
    return cortado({ desdeMs: Number(cortes[0].desde_ms), exceptoJti: cortes[0].excepto_jti }, jti, iat);
  }
};
