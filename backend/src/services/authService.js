import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, isDatabaseReady } from '../config/prisma.js';
import { env } from '../config/env.js';
import { INITIAL_USERS, INITIAL_ROLES, INITIAL_JARDINES } from './seedData.js';
import { AuditService } from './auditService.js';

// Almacén en memoria sincronizado con seed para garantizar disponibilidad continua
const memoryUsers = [...INITIAL_USERS];

export const AuthService = {
  /**
   * Autenticación con RUT o Correo y contraseña
   */
  async login({ identifier, password, ipAddress, userAgent }) {
    const cleanId = identifier.trim().toLowerCase();
    let user = null;

    // 1. Intento de búsqueda en Prisma DB solo si está conectada
    if (isDatabaseReady()) {
      try {
        user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: cleanId, mode: 'insensitive' } },
              { rut: cleanId }
            ]
          },
          include: {
            role: true,
            socia: {
              include: {
                jardin: true
              }
            }
          }
        });
      } catch {
        // Fallback
      }
    }

    // 2. Fallback a memoria
    if (!user) {
      const found = memoryUsers.find(
        (u) =>
          u.email.toLowerCase() === cleanId ||
          u.rut.replace(/[^0-9kK]/g, '').toLowerCase() === cleanId.replace(/[^0-9kK]/g, '').toLowerCase()
      );

      if (found) {
        const role = INITIAL_ROLES.find((r) => r.code === found.roleCode);
        const jardin = INITIAL_JARDINES.find((j) => j.id === found.jardinId);
        user = {
          ...found,
          role,
          socia: {
            id: `socia-${found.id}`,
            rut: found.rut,
            firstName: found.firstName,
            lastName: found.lastName,
            cargo: found.cargo,
            estado: 'ACTIVA',
            jardin
          }
        };
      }
    }

    if (!user) {
      throw new Error('Credenciales inválidas. Compruebe su correo/RUT y contraseña.');
    }

    if (!user.isActive) {
      throw new Error('Su usuario se encuentra inactivo o suspendido. Contacte a la directiva.');
    }

    // 3. Verificar contraseña con bcrypt
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      await AuditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        details: { reason: 'Contraseña incorrecta', identifier: cleanId },
        ipAddress,
        userAgent
      });
      throw new Error('Credenciales inválidas. Compruebe su correo/RUT y contraseña.');
    }

    // 4. Generar JWT firmado
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      rut: user.rut,
      role: user.role?.code || user.roleCode,
      name: `${user.firstName} ${user.lastName}`
    };

    const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN
    });

    // 5. Registrar auditoría de inicio de sesión
    await AuditService.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      details: { role: tokenPayload.role },
      ipAddress,
      userAgent
    });

    return {
      token,
      user: {
        id: user.id,
        rut: user.rut,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        socia: user.socia
      }
    };
  },

  /**
   * Obtener perfil del usuario por ID
   */
  async getProfile(userId) {
    let user = null;

    if (isDatabaseReady()) {
      try {
        user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            role: true,
            socia: {
              include: {
                jardin: true
              }
            }
          }
        });
      } catch {
        // Fallback
      }
    }

    if (!user) {
      const found = memoryUsers.find((u) => u.id === userId);
      if (found) {
        const role = INITIAL_ROLES.find((r) => r.code === found.roleCode);
        const jardin = INITIAL_JARDINES.find((j) => j.id === found.jardinId);
        user = {
          ...found,
          role,
          socia: {
            id: `socia-${found.id}`,
            rut: found.rut,
            firstName: found.firstName,
            lastName: found.lastName,
            cargo: found.cargo,
            estado: 'ACTIVA',
            jardin
          }
        };
      }
    }

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return {
      id: user.id,
      rut: user.rut,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      socia: user.socia
    };
  }
};
