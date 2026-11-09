import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isDatabaseReady, query } from '../config/db.js';
import { env } from '../config/env.js';
import { INITIAL_USERS, INITIAL_ROLES, INITIAL_JARDINES } from './seedData.js';
import { AuditService } from './auditService.js';

// Almacén en memoria sincronizado con seed para pruebas locales de desarrollo
const memoryUsers = INITIAL_USERS.map((u) => ({ ...u }));

// Dominio oficial primero; los otros se mantienen por compatibilidad con accesos ya entregados
export const INSTITUTIONAL_DOMAINS = ['vtftemuco.cl', 'vtf.cl', 'asociacionvtf.cl'];

// Claves conocidas que nunca pueden quedar como definitivas
const FORBIDDEN_PASSWORDS = ['admin123!', '12345678', 'password', 'contraseña'];

export class PasswordChangeError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Política mínima de contraseñas de la directiva.
 * Devuelve el mensaje de error o null si la contraseña es aceptable.
 */
export function validatePasswordPolicy(password, rut) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'La nueva contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) {
    return 'La nueva contraseña debe combinar letras y números.';
  }
  if (FORBIDDEN_PASSWORDS.includes(password.toLowerCase())) {
    return 'Esa contraseña es la clave inicial o es demasiado común. Elija otra.';
  }
  const rutDigits = String(rut || '').replace(/[^0-9kK]/g, '');
  if (rutDigits && password.replace(/[^0-9kK]/g, '') === rutDigits) {
    return 'La contraseña no puede ser su RUT.';
  }
  return null;
}

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

    // Variantes de correo y alias: el dominio oficial es @vtftemuco.cl; se aceptan además
    // los dominios usados en versiones anteriores. Un dominio ajeno solo coincide exacto.
    const emailsToMatch = [cleanId];
    const [userPart, domainPart] = cleanId.split('@');
    if (domainPart && INSTITUTIONAL_DOMAINS.includes(domainPart)) {
      const domains = INSTITUTIONAL_DOMAINS;
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
        // a.* incluye primer_ingreso cuando la migración ya fue aplicada (si no, se asume 0)
        const rows = await query(
          `SELECT a.*, s.cargo, s.jardin
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
            email: row.correo || `${row.rut.toLowerCase()}@vtftemuco.cl`,
            firstName: row.nombres,
            lastName: row.apellidos,
            passwordHash: row.contrasena,
            isActive: Boolean(row.activo === 1 || row.activo === null),
            mustChangePassword: Number(row.primer_ingreso) === 1,
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
          uniqueEmails.includes(u.email.toLowerCase()) ||
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
        mustChangePassword: Boolean(user.mustChangePassword),
        role: user.role,
        socia: user.socia
      }
    };
  },

  /**
   * Cambio de contraseña de la directiva (obligatorio en el primer ingreso).
   * Exige la contraseña actual y deja registro en la bitácora.
   */
  async changePassword({ user, currentPassword, newPassword, ipAddress, userAgent }) {
    const policyError = validatePasswordPolicy(newPassword, user.rut);
    if (policyError) {
      throw new PasswordChangeError(policyError, 400);
    }
    if (currentPassword === newPassword) {
      throw new PasswordChangeError('La nueva contraseña debe ser distinta de la actual.', 400);
    }

    const isDbUser = String(user.id).startsWith('admin-');
    let currentHash = null;

    if (isDbUser) {
      const rows = await query('SELECT contrasena FROM administradores WHERE id = ?', [
        String(user.id).replace('admin-', '')
      ]);
      currentHash = rows[0]?.contrasena || null;
    } else {
      currentHash = memoryUsers.find((u) => u.id === user.id)?.passwordHash || null;
    }

    const matches = currentHash ? await bcrypt.compare(currentPassword, currentHash).catch(() => false) : false;
    if (!matches) {
      throw new PasswordChangeError('La contraseña actual no es correcta.', 401);
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    if (isDbUser) {
      const dbId = String(user.id).replace('admin-', '');
      try {
        await query('UPDATE administradores SET contrasena = ?, primer_ingreso = 0 WHERE id = ?', [newHash, dbId]);
      } catch (err) {
        // Base aún sin la columna primer_ingreso: se actualiza solo la contraseña
        if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
        await query('UPDATE administradores SET contrasena = ? WHERE id = ?', [newHash, dbId]);
      }
    } else {
      const memUser = memoryUsers.find((u) => u.id === user.id);
      memUser.passwordHash = newHash;
      memUser.mustChangePassword = false;
    }

    await AuditService.log({
      userId: user.id,
      rut: user.rut,
      action: 'PASSWORD_CHANGED',
      details: { role: user.role?.code },
      ipAddress,
      userAgent
    });

    return { success: true };
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
              primerIngreso: Boolean(row.primer_ingreso),
              mustChangePassword: Number(row.primer_ingreso) === 1
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
          `SELECT a.*, s.cargo, s.jardin
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
            email: row.correo || `${row.rut.toLowerCase()}@vtftemuco.cl`,
            firstName: row.nombres,
            lastName: row.apellidos,
            isActive: true,
            mustChangePassword: Number(row.primer_ingreso) === 1,
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
      mustChangePassword: Boolean(user.mustChangePassword),
      role: user.role,
      socia: user.socia
    };
  }
};
