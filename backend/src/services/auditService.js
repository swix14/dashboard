import { isDatabaseReady, query } from '../config/db.js';

// Memoria de auditoría en caso de que MySQL no esté disponible
const memoryAuditLogs = [];

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
        await query(
          `INSERT INTO auditoria (usuario_id, usuario_rut, accion, detalles, ip_address, user_agent, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [entry.userId, entry.rut, entry.action, entry.details, entry.ipAddress, entry.userAgent]
        );
        return entry;
      } catch (err) {
        console.warn('Registro de auditoría guardado en memoria local:', err.message);
      }
    }

    memoryAuditLogs.unshift(entry);
    return entry;
  },

  /**
   * Obtiene los logs recientes de auditoría
   */
  async getRecentLogs(limit = 20) {
    if (isDatabaseReady()) {
      try {
        const rows = await query(
          `SELECT a.id, a.usuario_id, a.usuario_rut, a.accion, a.detalles, a.ip_address, a.user_agent, a.created_at,
                  adm.nombres, adm.apellidos, adm.correo, adm.rol
           FROM auditoria a
           LEFT JOIN administradores adm ON a.usuario_id = adm.id
           ORDER BY a.created_at DESC
           LIMIT ?`,
          [Number(limit)]
        );
        return rows.map((r) => ({
          ...r,
          details: typeof r.detalles === 'string' ? JSON.parse(r.detalles || '{}') : r.detalles,
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

    return memoryAuditLogs.slice(0, limit);
  }
};
