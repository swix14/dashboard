import fs from 'node:fs';
import path from 'node:path';
import { isDatabaseReady, query } from '../config/db.js';
import { env } from '../config/env.js';

// Memoria de auditoría: solo para el modo memoria de las pruebas automatizadas
const memoryAuditLogs = [];

/**
 * Respaldo durable (auditoría H-014): si MySQL no responde, el evento se agrega a un archivo
 * JSONL fuera de la carpeta pública (sobrevive a reinicios) y se traspasa a la tabla
 * `auditoria` en cuanto vuelve la conexión. Antes quedaba en memoria y se perdía al reiniciar.
 */
const PENDING_FILE = path.join(env.AUDIT_DIR, 'auditoria-pendiente.jsonl');
const FLUSH_INTERVAL_MS = 60 * 1000;
let lastFlushAttempt = 0;
let flushing = false;

function appendPending(entry) {
  try {
    fs.mkdirSync(env.AUDIT_DIR, { recursive: true });
    fs.appendFileSync(PENDING_FILE, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
  } catch (err) {
    // Último recurso: que al menos quede en el log del servidor
    console.error(`AUDITORÍA NO PERSISTIDA (${entry.action}):`, err.message);
  }
}

function dbUserIdOf(userId) {
  // usuario_id es INT y apunta a administradores: "admin-12" -> 12; socias y memoria -> NULL (queda el RUT)
  const match = /^admin-(\d+)$/.exec(String(userId || ''));
  return match ? Number(match[1]) : null;
}

const toMysqlDate = (value) => new Date(value).toISOString().slice(0, 19).replace('T', ' ');

async function insertEntry(entry) {
  await query(
    `INSERT INTO auditoria (usuario_id, usuario_rut, accion, detalles, ip_address, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [dbUserIdOf(entry.userId), entry.rut, entry.action, entry.details, entry.ipAddress, entry.userAgent, toMysqlDate(entry.createdAt)]
  );
}

/**
 * Traspasa a MySQL los eventos pendientes del archivo de respaldo (como máximo una vez por minuto).
 * Lo que no alcance a insertarse vuelve al archivo para el siguiente intento.
 */
async function flushPending() {
  if (flushing || Date.now() - lastFlushAttempt < FLUSH_INTERVAL_MS || !fs.existsSync(PENDING_FILE)) return;
  flushing = true;
  lastFlushAttempt = Date.now();
  const processing = `${PENDING_FILE}.${process.pid}.procesando`;
  try {
    fs.renameSync(PENDING_FILE, processing);
    const lines = fs.readFileSync(processing, 'utf8').split('\n').filter(Boolean);
    const restantes = [];
    for (const line of lines) {
      try {
        await insertEntry(JSON.parse(line));
      } catch {
        restantes.push(line);
      }
    }
    if (restantes.length) {
      fs.appendFileSync(PENDING_FILE, `${restantes.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
    }
    fs.rmSync(processing, { force: true });
  } catch (err) {
    console.warn('No se pudo traspasar la auditoría pendiente:', err.message);
  } finally {
    flushing = false;
  }
}

// Un registro con texto que no es JSON no debe impedir leer toda la bitácora
function parseDetails(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return { texto: raw };
  }
}

export const AuditService = {
  /**
   * Registra una acción de auditoría
   */
  async log({ userId, rut, action, details, ipAddress, userAgent }) {
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: userId || null,
      rut: rut || null,
      action,
      details: typeof details === 'string' ? details : JSON.stringify(details || {}),
      ipAddress: ipAddress || '127.0.0.1',
      userAgent: userAgent || 'Browser',
      createdAt: new Date()
    };

    if (isDatabaseReady()) {
      try {
        await insertEntry(entry);
        // Con la base de vuelta, se recuperan los eventos que quedaron en el archivo de respaldo
        flushPending().catch(() => {});
        return entry;
      } catch (err) {
        console.warn(`Auditoría a respaldo en archivo (${entry.action}):`, err.message);
      }
    }

    if (env.ALLOW_MEMORY_FALLBACK) {
      memoryAuditLogs.unshift(entry);
    } else {
      appendPending(entry);
    }
    return entry;
  },

  /**
   * Obtiene los logs recientes de auditoría
   */
  async getRecentLogs(limit = 20) {
    // LIMIT como entero validado: mysql2 (execute) con "LIMIT ?" falla en MySQL 8 y la
    // bitácora caía en silencio a la memoria vacía.
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 200);
    if (isDatabaseReady()) {
      try {
        const rows = await query(
          `SELECT a.id, a.usuario_id, a.usuario_rut, a.accion, a.detalles, a.ip_address, a.user_agent, a.created_at,
                  adm.nombres, adm.apellidos, adm.correo, adm.rol
           FROM auditoria a
           LEFT JOIN administradores adm ON a.usuario_id = adm.id
           ORDER BY a.created_at DESC
           LIMIT ${safeLimit}`
        );
        return rows.map((r) => ({
          ...r,
          details: parseDetails(r.detalles),
          user: r.usuario_id ? {
            id: r.usuario_id,
            firstName: r.nombres,
            lastName: r.apellidos,
            email: r.correo,
            role: { code: r.rol?.toUpperCase() }
          } : null
        }));
      } catch (err) {
        console.warn('Error leyendo auditoría desde MySQL:', err.message);
      }
    }

    return memoryAuditLogs.slice(0, safeLimit);
  }
};
