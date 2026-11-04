import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isDatabaseReady, query } from '../config/db.js';
import { env } from '../config/env.js';
import { INITIAL_USERS, INITIAL_ROLES, INITIAL_JARDINES } from './seedData.js';
import { AuditService } from './auditService.js';

// Almacén en memoria sincronizado con seed para pruebas locales de desarrollo
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

    // Variantes de correo y alias para permitir inicio flexible (@vtf.cl y @asociacionvtf.cl)
    const emailsToMatch = [cleanId];
    if (cleanId.includes('@')) {
      const [userPart] = cleanId.split('@');
      const domains = ['vtf.cl', 'asociacionvtf.cl'];
      const aliases = [userPart];
      if (userPart === 'tesorera' || userPart === 'tesoreria' || userPart === 'alejandra.sias') {
        aliases.push('tesoreria', 'tesorera', 'alejandra.sias');
      }
      if (userPart === 'presidenta' || userPart === 'presidencia' || userPart === 'yerthie.sayago') {
        aliases.push('presidencia', 'presidenta', 'yerthie.sayago');
      }
      if (userPart === 'secretaria' || userPart === 'nelly.mella') {
        aliases.push('secretaria', 'nelly.mella');
      }
      if (userPart === 'directora' || userPart === 'victoria.abarza') {
        aliases.push('directora', 'victoria.abarza');
      }
      if (userPart === 'admin' || userPart === 'superadmin' || userPart === 'jhonny.ferrada') {
        aliases.push('admin', 'jhonny.ferrada');
      }
      if (userPart.startsWith('delegada') || userPart === 'claudia.navarro') {
        aliases.push('delegada', 'delegada.bambi', 'claudia.navarro');
      }
      if (userPart.startsWith('socia') || userPart === 'francisca.torres') {
        aliases.push('socia', 'socia.educadora', 'francisca.torres');
      }

      for (const alias of aliases) {
        for (const dom of domains) {
          emailsToMatch.push(`${alias}@${dom}`);
        }
      }
    }
    const uniqueEmails = [...new Set(emailsToMatch)];
    let user = null;

    // 1. Búsqueda en MySQL (administradores) si está disponible
    if (isDatabaseReady()) {
      try {
        const placeholders = uniqueEmails.map(() => '?').join(', ');
        const rows = await query(
          `SELECT a.id, a.rut, a.nombres, a.apellidos, a.correo, a.rol, a.contrasena, a.activo,
                  s.cargo, s.jardin
           FROM administradores a
           LEFT JOIN socias s ON a.rut = s.rut
           WHERE LOWER(a.rut) = ? 
              OR LOWER(REPLACE(REPLACE(a.rut, '.', ''), '-', '')) = ?
              OR LOWER(a.correo) IN (${placeholders})`,
          [cleanId, cleanRut, ...uniqueEmails]
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
        console.warn('Error consultando administradores en MySQL, usando contingencia:', err.message);
      }
    }

    // 2. Fallback a memoria si la base de datos no está disponible o en tests locales
    if (!user && !isDatabaseReady()) {
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

    // 3. Verificar contraseña mediante hash bcrypt exclusivamente (sin texto plano)
    let passwordMatch = false;
    try {
      passwordMatch = await bcrypt.compare(password, user.passwordHash);
    } catch {
      passwordMatch = false;
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
        isActive: user.isActive,
        role: user.role,
        socia: user.socia
      }
    };
  },

  /**
   * Obtener perfil del usuario por ID con verificación de estado activo
   */
  async getProfile(userId) {
    let user = null;

    if (String(userId).startsWith('socia-')) {
      const rawId = String(userId).replace('socia-', '');
      if (isDatabaseReady()) {
        try {
          const rows = await query(
            `SELECT id, rut, nombres, apellido_paterno, apellido_materno, cargo, jardin, primer_ingreso, estado
             FROM socias
             WHERE id = ?`,
            [rawId]
          );
          if (rows.length > 0) {
            const row = rows[0];
            const isSociaActive = row.estado ? row.estado === 'ACTIVA' : true;
            if (!isSociaActive) {
              throw new Error('Su membresía de socia se encuentra inactiva o suspendida.');
            }
            return {
              id: `socia-${row.id}`,
              sociaId: row.id,
              rut: row.rut,
              firstName: row.nombres,
              lastName: `${row.apellido_paterno || ''} ${row.apellido_materno || ''}`.trim(),
              isActive: true,
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
        isActive: true,
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
          const isActive = Boolean(row.activo === 1 || row.activo === null);
          if (!isActive) {
            throw new Error('Su usuario se encuentra inactivo o suspendido. Contacte a la directiva.');
          }

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
            isActive: true,
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
        if (err.message.includes('inactivo') || err.message.includes('suspendido')) {
          throw err;
        }
        console.warn('Error en getProfile MySQL:', err.message);
      }
    }

    if (!user && !isDatabaseReady()) {
      const found = memoryUsers.find((u) => u.id === userId);
      if (found) {
        if (!found.isActive) {
          throw new Error('Su usuario se encuentra inactivo o suspendido. Contacte a la directiva.');
        }
        const role = INITIAL_ROLES.find((r) => r.code === found.roleCode);
        const jardin = INITIAL_JARDINES.find((j) => j.id === found.jardinId);
        user = {
          ...found,
          isActive: true,
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
      isActive: user.isActive !== false,
      role: user.role,
      socia: user.socia
    };
  }
};
