import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isDatabaseReady, query } from '../config/db.js';
import { env } from '../config/env.js';
import { INITIAL_USERS, INITIAL_ROLES, INITIAL_JARDINES } from './seedData.js';
import { AuditService } from './auditService.js';

// Almacén en memoria sincronizado con seed para garantizar disponibilidad continua
const memoryUsers = [...INITIAL_USERS];

function normalizeRoleCode(rawRole) {
  if (!rawRole) return 'SOCIA';
  const r = rawRole.trim().toUpperCase().replace(/\s+/g, '_');
  if (r === 'SUPER_ADMIN') return 'ADMIN';
  return r;
}

export const AuthService = {
  /**
   * Autenticación con RUT o Correo y contraseña
   */
  async login({ identifier, password, ipAddress, userAgent }) {
    const cleanId = identifier.trim().toLowerCase();
    const cleanRut = cleanId.replace(/[^0-9kK]/g, '');
    const altEmail = cleanId.endsWith('@vtf.cl')
      ? cleanId.replace('@vtf.cl', '@asociacionvtf.cl')
      : cleanId.endsWith('@asociacionvtf.cl')
      ? cleanId.replace('@asociacionvtf.cl', '@vtf.cl')
      : cleanId;
    let user = null;

    // 1. Búsqueda en MySQL XAMPP (administradores) si está disponible
    if (isDatabaseReady()) {
      try {
        const rows = await query(
          `SELECT a.id, a.rut, a.nombres, a.apellidos, a.correo, a.rol, a.contrasena, a.activo,
                  s.cargo, s.jardin
           FROM administradores a
           LEFT JOIN socias s ON a.rut = s.rut
           WHERE LOWER(a.rut) = ? 
              OR LOWER(REPLACE(REPLACE(a.rut, '.', ''), '-', '')) = ?
              OR LOWER(a.correo) = ?
              OR LOWER(a.correo) = ?`,
          [cleanId, cleanRut, cleanId, altEmail]
        );

        if (rows.length > 0) {
          const row = rows[0];
          const roleCode = normalizeRoleCode(row.rol);
          const roleObj = INITIAL_ROLES.find((r) => r.code === roleCode) || {
            id: `role-${roleCode.toLowerCase()}`,
            code: roleCode,
            name: row.rol
          };

          user = {
            id: `admin-${row.id}`,
            dbId: row.id,
            rut: row.rut,
            email: row.correo || `${row.rut.toLowerCase()}@asociacionvtf.cl`,
            firstName: row.nombres,
            lastName: row.apellidos,
            passwordHash: row.contrasena,
            isActive: Boolean(row.activo === 1 || row.activo === null),
            role: roleObj,
            socia: {
              id: `socia-${row.id}`,
              rut: row.rut,
              firstName: row.nombres,
              lastName: row.apellidos,
              cargo: row.cargo || row.rol,
              estado: 'ACTIVA',
              jardin: row.jardin ? { name: row.jardin } : null
            }
          };
        }
      } catch (err) {
        console.warn('Error consultando administradores en MySQL, usando fallback:', err.message);
      }
    }

    // 2. Fallback a memoria si no se encontró en MySQL o está desconectado
    if (!user) {
      const found = memoryUsers.find(
        (u) =>
          u.email.toLowerCase() === cleanId ||
          u.rut.replace(/[^0-9kK]/g, '').toLowerCase() === cleanRut
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

    // 3. Verificar contraseña: texto plano (de prueba en admin.sql) o hash bcrypt
    let passwordMatch = false;
    if (user.passwordHash === password) {
      passwordMatch = true;
    } else {
      try {
        passwordMatch = await bcrypt.compare(password, user.passwordHash);
      } catch {
        passwordMatch = false;
      }
    }

    if (!passwordMatch) {
      await AuditService.log({
        userId: user.id,
        rut: user.rut,
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
      rut: user.rut,
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

    if (String(userId).startsWith('socia-')) {
      const rawId = String(userId).replace('socia-', '');
      if (isDatabaseReady()) {
        try {
          const rows = await query(
            `SELECT id, rut, nombres, apellido_paterno, apellido_materno, cargo, jardin, primer_ingreso
             FROM socias
             WHERE id = ?`,
            [rawId]
          );
          if (rows.length > 0) {
            const row = rows[0];
            return {
              id: `socia-${row.id}`,
              sociaId: row.id,
              rut: row.rut,
              firstName: row.nombres,
              lastName: `${row.apellido_paterno || ''} ${row.apellido_materno || ''}`.trim(),
              role: { id: 'role-socia', code: 'SOCIA', name: 'Socia' },
              cargo: row.cargo,
              jardin: row.jardin,
              primerIngreso: Boolean(row.primer_ingreso)
            };
          }
        } catch (err) {
          console.warn('Error en getProfile socia MySQL:', err.message);
        }
      }

      return {
        id: `socia-${rawId}`,
        sociaId: rawId,
        rut: 'RUT Socia',
        firstName: 'Socia',
        lastName: 'VTF',
        role: { id: 'role-socia', code: 'SOCIA', name: 'Socia' },
        cargo: 'Socia',
        jardin: 'Jardín VTF',
        primerIngreso: false
      };
    }

    if (isDatabaseReady() && String(userId).startsWith('admin-')) {
      const rawId = userId.replace('admin-', '');
      try {
        const rows = await query(
          `SELECT a.id, a.rut, a.nombres, a.apellidos, a.correo, a.rol, a.activo,
                  s.cargo, s.jardin
           FROM administradores a
           LEFT JOIN socias s ON a.rut = s.rut
           WHERE a.id = ?`,
          [rawId]
        );

        if (rows.length > 0) {
          const row = rows[0];
          const roleCode = normalizeRoleCode(row.rol);
          const roleObj = INITIAL_ROLES.find((r) => r.code === roleCode) || {
            id: `role-${roleCode.toLowerCase()}`,
            code: roleCode,
            name: row.rol
          };

          user = {
            id: `admin-${row.id}`,
            rut: row.rut,
            email: row.correo || `${row.rut.toLowerCase()}@asociacionvtf.cl`,
            firstName: row.nombres,
            lastName: row.apellidos,
            role: roleObj,
            socia: {
              id: `socia-${row.id}`,
              rut: row.rut,
              firstName: row.nombres,
              lastName: row.apellidos,
              cargo: row.cargo || row.rol,
              estado: 'ACTIVA',
              jardin: row.jardin ? { name: row.jardin } : null
            }
          };
        }
      } catch (err) {
        console.warn('Error en getProfile MySQL:', err.message);
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
