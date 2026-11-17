import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isDatabaseReady, query } from '../config/db.js';
import { env } from '../config/env.js';
import { INITIAL_USERS, INITIAL_ROLES, INITIAL_JARDINES } from './seedData.js';
import { AuditService } from './auditService.js';

// Almacén en memoria sincronizado con seed para pruebas locales de desarrollo
const memoryUsers = INITIAL_USERS.map((u) => ({ ...u }));

// Dominio de los correos institucionales (el login es solo por RUT)
export const INSTITUTIONAL_DOMAIN = 'vtftemuco.cl';

// Mensaje único para RUT inexistente o clave incorrecta: no revela si la cuenta existe
const CREDENCIALES_INVALIDAS = 'Credenciales inválidas. Compruebe su RUT y contraseña.';

// Hash de una clave aleatoria para igualar tiempos cuando el RUT no tiene cuenta
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), 10);

// Claves conocidas que nunca pueden quedar como definitivas
const FORBIDDEN_PASSWORDS = ['admin123!', '12345678', 'password', 'contraseña'];

// Rechazo de inicio de sesión (credenciales, dominio o cuenta inactiva): 401
export class LoginError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

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

    // Acceso de la directiva solo por RUT (decisión de la directiva, 16-11-2026): el correo ya no sirve
    const cleanRut = cleanId.replace(/[^0-9k]/g, '');
    if (cleanId.includes('@') || !/^[0-9.\-\sk]+$/.test(cleanId) || cleanRut.length < 7) {
      throw new LoginError(CREDENCIALES_INVALIDAS);
    }
    let user = null;

    // 1. Búsqueda en MySQL (administradores) si está disponible
    if (isDatabaseReady()) {
      try {
        // a.* incluye primer_ingreso cuando la migración ya fue aplicada (si no, se asume 0)
        const rows = await query(
          `SELECT a.*, s.cargo, j.nombre AS jardin
           FROM administradores a
           LEFT JOIN socias s ON a.rut = s.rut
           LEFT JOIN jardines j ON j.id = s.jardin_id
           WHERE LOWER(REPLACE(REPLACE(a.rut, '.', ''), '-', '')) = ?`,
          [cleanRut]
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
        // Con la base conectada, una falla de consulta es un error del servidor (500),
        // no "credenciales inválidas": así no se confunde ni cuenta como intento fallido
        console.error('Error consultando administradores en MySQL:', err.message);
        throw err;
      }
    }

    // 2. Fallback a memoria si la base de datos no está disponible o en tests locales
    if (!user && !isDatabaseReady()) {
      const found = memoryUsers.find((u) => u.rut.replace(/[^0-9kK]/g, '').toLowerCase() === cleanRut);

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

    // 3. Verificar contraseña (bcrypt). Si la cuenta no existe se compara contra un hash aleatorio
    // para que el tiempo de respuesta no delate qué RUT tiene cuenta (auditoría H-015).
    const passwordMatch = await bcrypt
      .compare(password, user ? user.passwordHash : DUMMY_HASH)
      .catch(() => false);

    if (!user) {
      throw new LoginError(CREDENCIALES_INVALIDAS);
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
      throw new LoginError(CREDENCIALES_INVALIDAS);
    }

    // Solo quien acreditó su clave sabe si su cuenta está desactivada
    if (!user.isActive) {
      throw new LoginError('Su usuario se encuentra inactivo o suspendido. Contacte a la directiva.');
    }

    // 4. Generar JWT firmado
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      rut: user.rut,
      role: user.role?.code || user.roleCode,
      name: `${user.firstName} ${user.lastName}`
    };

    // jwtid único por sesión: permite revocarla al cerrar sesión (auditoría H-005)
    const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
      jwtid: randomUUID(),
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
      let membershipError = null;
      if (isDatabaseReady()) {
        try {
          const rows = await query(
            `SELECT s.id, s.rut, s.nombres, s.apellido_paterno, s.apellido_materno, s.cargo,
                    j.nombre AS jardin, s.primer_ingreso, s.estado, s.es_delegada
             FROM socias s LEFT JOIN jardines j ON j.id = s.jardin_id
             WHERE s.id = ?`,
            [rawId]
          );
          if (rows.length > 0) {
            const row = rows[0];
            if (row.estado !== 'ACTIVA') {
              // Se lanza fuera del try: antes el catch lo tragaba y la socia suspendida seguía con acceso
              membershipError = new Error('Su membresía de socia se encuentra inactiva o suspendida.');
              throw membershipError;
            }
            return {
              id: `socia-${row.id}`,
              sociaId: row.id,
              rut: row.rut,
              firstName: row.nombres,
              lastName: `${row.apellido_paterno || ''} ${row.apellido_materno || ''}`.trim(),
              // Mismos datos que entrega el login del portal: al recargar la página (/auth/me) la
              // socia conserva sus apellidos por separado (S.O.S) y la pestaña "Mi jardín" si es delegada
              nombres: row.nombres,
              apellidoPaterno: row.apellido_paterno || '',
              apellidoMaterno: row.apellido_materno || '',
              esDelegada: Boolean(row.es_delegada),
              isActive: true,
              role: { id: 'role-socia', code: 'SOCIA', name: 'Socia' },
              cargo: row.cargo,
              jardin: row.jardin,
              primerIngreso: Boolean(row.primer_ingreso),
              mustChangePassword: Number(row.primer_ingreso) === 1
            };
          }
        } catch (err) {
          if (err === membershipError) throw err;
          console.warn('Error en getProfile socia MySQL:', err.message);
        }
        // Con base de datos, una socia que no existe (o una consulta fallida) no obtiene perfil
        throw new Error('Usuario no encontrado');
      }

      // Perfil genérico solo en modo memoria de desarrollo (sin MySQL)
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
          `SELECT a.*, s.cargo, j.nombre AS jardin
           FROM administradores a
           LEFT JOIN socias s ON a.rut = s.rut
               LEFT JOIN jardines j ON j.id = s.jardin_id
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
