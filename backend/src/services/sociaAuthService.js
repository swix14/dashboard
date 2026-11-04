import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isDatabaseReady, query } from '../config/db.js';
import { env } from '../config/env.js';
import { INITIAL_SOCIAS } from './sociasSeedData.js';

// Cache en memoria para actualización de contraseñas de socias cuando MySQL no está conectado
const memorySociaPasswords = new Map();

/**
 * Normaliza un RUT removiendo puntos, espacios y guion, dejando solo dígitos y K
 */
function cleanRut(rawRut) {
  return String(rawRut || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Obtiene los primeros 6 dígitos del cuerpo numérico del RUT
 * Ej: "20.081.109-7" -> cuerpo "20081109" -> primeros 6 dígitos: "200811"
 */
export function getInitialPasswordFromRut(rawRut) {
  const cleaned = cleanRut(rawRut);
  // El cuerpo es todo menos el dígito verificador
  const body = cleaned.length > 1 ? cleaned.slice(0, -1) : cleaned;
  return body.slice(0, 6);
}

export const SociaAuthService = {
  /**
   * Inicia sesión para socias con RUT y contraseña (inicial 6 dígitos o personalizada)
   */
  async loginSocia({ rut, password }) {
    const cleanedInputRut = cleanRut(rut);
    if (!cleanedInputRut || cleanedInputRut.length < 7) {
      throw new Error('Ingrese un RUT válido para acceder al portal.');
    }

    let socia = null;

    if (isDatabaseReady()) {
      try {
        const rows = await query(
          `SELECT id, rut, apellido_paterno, apellido_materno, nombres, cargo, celular, correo, jardin, password, primer_ingreso
           FROM socias
           WHERE REPLACE(REPLACE(REPLACE(rut, '.', ''), '-', ''), ' ', '') = ?
           LIMIT 1`,
          [cleanedInputRut]
        );
        if (rows.length > 0) {
          socia = rows[0];
        }
      } catch (dbErr) {
        console.warn('Error consultando tabla socias en MySQL:', dbErr.message);
      }
    }

    // Fallback en memoria si la BD no está disponible
    if (!socia) {
      const match = INITIAL_SOCIAS.find(
        (s) => cleanRut(s.rut) === cleanedInputRut && s.estado === 'ACTIVA'
      );
      if (match) {
        const memPass = memorySociaPasswords.get(match.id);
        socia = {
          id: match.id,
          rut: match.rut,
          nombres: match.firstName,
          apellido_paterno: match.lastName,
          apellido_materno: '',
          cargo: match.cargo,
          jardin: match.jardin?.name || 'Jardín VTF',
          password: memPass || null,
          primer_ingreso: memPass ? 0 : 1
        };
      } else if (cleanedInputRut === '200811097') {
        const memPass = memorySociaPasswords.get('1') || memorySociaPasswords.get('socia-1');
        socia = {
          id: 1,
          rut: '20.081.109-7',
          nombres: 'VICTORIA CATALINA',
          apellido_paterno: 'ABARZA',
          apellido_materno: 'VEGA',
          cargo: 'TECNICO',
          jardin: 'Los Folkloristas',
          password: memPass || null,
          primer_ingreso: memPass ? 0 : 1
        };
      }
    }

    if (!socia) {
      throw new Error('El RUT ingresado no figura en el padrón activo de socias de la Asociación.');
    }

    const defaultInitialPass = getInitialPasswordFromRut(socia.rut);
    const isFirstTime = socia.primer_ingreso === 1 || !socia.password;

    let passwordValid = false;

    if (isFirstTime) {
      // En primer ingreso, la contraseña son los 6 primeros dígitos de su RUT
      passwordValid = password === defaultInitialPass;
    } else {
      // Contraseña personalizada con hash bcrypt
      try {
        passwordValid = await bcrypt.compare(password, socia.password);
      } catch {
        passwordValid = false;
      }
      // Si por alguna razón ingresa con la inicial, también permitimos y pedimos cambiar
      if (!passwordValid && password === defaultInitialPass) {
        passwordValid = true;
        socia.primer_ingreso = 1;
      }
    }

    if (!passwordValid) {
      if (isFirstTime) {
        throw new Error(`Contraseña incorrecta. Recuerde que para su primer ingreso su contraseña son los primeros 6 dígitos de su RUT (ej. ${defaultInitialPass}).`);
      }
      throw new Error('Contraseña incorrecta.');
    }

    const payload = {
      sub: `socia-${socia.id}`,
      sociaId: socia.id,
      rut: socia.rut,
      firstName: socia.nombres,
      lastName: `${socia.apellido_paterno || ''} ${socia.apellido_materno || ''}`.trim(),
      cargo: socia.cargo,
      jardin: socia.jardin,
      role: 'SOCIA',
      primerIngreso: Boolean(socia.primer_ingreso)
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN || '8h'
    });

    return {
      token,
      socia: {
        id: socia.id,
        rut: socia.rut,
        nombreCompleto: `${socia.nombres} ${socia.apellido_paterno || ''}`.trim(),
        cargo: socia.cargo,
        jardin: socia.jardin,
        primerIngreso: Boolean(socia.primer_ingreso)
      }
    };
  },

  /**
   * Cambia la contraseña obligatoria en primer ingreso o actualización voluntaria
   */
  async cambiarClave(sociaId, nuevaClave) {
    if (!nuevaClave || nuevaClave.trim().length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
    }

    const hash = await bcrypt.hash(nuevaClave.trim(), 10);
    const cleanId = String(sociaId).replace('socia-', '');
    memorySociaPasswords.set(cleanId, hash);
    memorySociaPasswords.set(sociaId, hash);

    if (isDatabaseReady()) {
      await query(
        `UPDATE socias SET password = ?, primer_ingreso = 0 WHERE id = ?`,
        [hash, cleanId]
      );
    }

    return {
      success: true,
      message: 'Contraseña actualizada exitosamente.',
      data: {
        socia: {
          id: sociaId,
          primerIngreso: false
        }
      }
    };
  }
};
