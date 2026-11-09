import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isDatabaseReady, query } from '../config/db.js';
import { env } from '../config/env.js';

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

    // El portal de socias trabaja solo con el padrón real de MySQL (V3: sin padrón de memoria)
    if (!isDatabaseReady()) {
      throw new Error('El portal de socias no está disponible en este momento. Intente más tarde.');
    }

    const rows = await query(
      `SELECT s.id, s.rut, s.apellido_paterno, s.apellido_materno, s.nombres, s.cargo, s.estado,
              j.nombre AS jardin, s.password, s.primer_ingreso
       FROM socias s LEFT JOIN jardines j ON j.id = s.jardin_id
       WHERE UPPER(REPLACE(REPLACE(REPLACE(s.rut, '.', ''), '-', ''), ' ', '')) = ?
       LIMIT 1`,
      [cleanedInputRut]
    );
    const socia = rows[0];

    if (!socia || socia.estado === 'RETIRADA') {
      throw new Error('El RUT ingresado no figura en el padrón activo de socias de la Asociación.');
    }
    if (socia.estado !== 'ACTIVA') {
      throw new Error('Su membresía se encuentra suspendida. Comuníquese con la directiva.');
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
      // Una vez cambiada, la clave inicial (6 dígitos del RUT) deja de servir:
      // cualquiera que conozca el RUT podría entrar con ella.
    }

    if (!passwordValid) {
      if (isFirstTime) {
        // Ejemplo genérico: antes se mostraba la clave inicial real del RUT ingresado
        throw new Error(
          'Contraseña incorrecta. Para su primer ingreso, la contraseña son los primeros 6 dígitos de su RUT ' +
            '(ej. si su RUT es 12.345.678-5, la clave es 123456).'
        );
      }
      throw new Error('Contraseña incorrecta. Si olvidó su clave personal, pida a la directiva que la restablezca.');
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
  async cambiarClave(sociaId, nuevaClave, rut) {
    if (!nuevaClave || nuevaClave.trim().length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
    }
    if (rut && nuevaClave.trim() === getInitialPasswordFromRut(rut)) {
      throw new Error('La nueva contraseña no puede ser la clave inicial (6 primeros dígitos del RUT).');
    }

    const hash = await bcrypt.hash(nuevaClave.trim(), 10);
    const cleanId = String(sociaId).replace('socia-', '');

    const result = await query(`UPDATE socias SET password = ?, primer_ingreso = 0 WHERE id = ? AND estado = 'ACTIVA'`, [
      hash,
      cleanId
    ]);
    if (result.affectedRows === 0) {
      throw new Error('No fue posible actualizar la contraseña: socia no encontrada o no activa.');
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
