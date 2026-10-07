import { prisma, isDatabaseReady } from '../config/prisma.js';

// Memoria volátil de auditoría si la conexión directa a DB está pendiente
const memoryAuditLogs = [];

export const AuditService = {
  /**
   * Registra una acción de auditoría
   */
  async log({ userId, action, details, ipAddress, userAgent }) {
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: userId || null,
      action,
      details: details || {},
      ipAddress: ipAddress || '127.0.0.1',
      userAgent: userAgent || 'Browser',
      createdAt: new Date()
    };

    if (isDatabaseReady()) {
      try {
        return await prisma.auditLog.create({
          data: {
            userId: entry.userId,
            action: entry.action,
            details: entry.details,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent
          }
        });
      } catch (err) {
        console.warn('Registro de auditoría almacenado en memoria local:', err.message);
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
        return await prisma.auditLog.findMany({
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true
              }
            }
          }
        });
      } catch {
        // Continuar con memoria
      }
    }

    return memoryAuditLogs.slice(0, limit);
  }
};
