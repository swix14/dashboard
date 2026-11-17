import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isDatabaseReady, query } from '../config/db.js';
import { env } from '../config/env.js';

// Rechazo de inicio de sesión de socia: 401 (o 503 si el portal no tiene base de datos)
export class LoginError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

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

// Mensaje único de credenciales inválidas (no indica si el RUT existe ni cómo es la clave inicial)
const CREDENCIALES_INVALIDAS =
  'RUT o contraseña incorrectos. Si es su primer ingreso o no recuerda su clave, pida ayuda a la directiva.';

// Hash bcrypt de una clave aleatoria: iguala el tiempo de respuesta cuando el RUT no existe
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), 10);

export const SociaAuthService = {
  /**
   * Inicia sesión para socias con RUT y contraseña (inicial 6 dígitos o personalizada)
   */
  async loginSocia({ rut, password }) {
    const cleanedInputRut = cleanRut(rut);
    // Solo números, K, puntos, guion y espacios: un RUT con otras letras se rechaza (antes se descartaban en silencio)
    if (!/^[0-9.\-\skK]+$/.test(String(rut || '').trim()) || !cleanedInputRut || cleanedInputRut.length < 7) {
      throw new LoginError(CREDENCIALES_INVALIDAS);
    }

    // El portal de socias trabaja solo con el padrón real de MySQL (V3: sin padrón de memoria)
    if (!isDatabaseReady()) {
      throw new LoginError('El portal de socias no está disponible en este momento. Intente más tarde.', 503);
    }

    const rows = await query(
      `SELECT s.id, s.rut, s.apellido_paterno, s.apellido_materno, s.nombres, s.cargo, s.estado,
              j.nombre AS jardin, s.password, s.primer_ingreso, s.es_delegada
       FROM socias s LEFT JOIN jardines j ON j.id = s.jardin_id
       WHERE UPPER(REPLACE(REPLACE(REPLACE(s.rut, '.', ''), '-', ''), ' ', '')) = ?
       LIMIT 1`,
      [cleanedInputRut]
    );
    const socia = rows[0];

    // Respuesta uniforme (auditoría H-015): RUT inexistente, retirada o clave incorrecta dan el
    // mismo mensaje, para no revelar quién está en el padrón. El motivo real queda en el log interno.
    const existe = Boolean(socia) && socia.estado !== 'RETIRADA';
    const isFirstTime = existe && (socia.primer_ingreso === 1 || !socia.password);

    let passwordValid = false;
    if (!existe) {
      // Mismo costo que una comparación real: el tiempo de respuesta tampoco delata si el RUT existe
      await bcrypt.compare(password, DUMMY_HASH).catch(() => false);
    } else if (isFirstTime) {
      // En primer ingreso, la contraseña son los 6 primeros dígitos de su RUT
      passwordValid = password === getInitialPasswordFromRut(socia.rut);
    } else {
      // Contraseña personalizada con hash bcrypt (la clave inicial deja de servir)
      passwordValid = await bcrypt.compare(password, socia.password).catch(() => false);
    }

    if (!passwordValid) {
      throw new LoginError(CREDENCIALES_INVALIDAS);
    }

    // Solo quien acreditó su clave conoce el estado de su membresía
    if (socia.estado !== 'ACTIVA') {
      throw new LoginError('Su membresía se encuentra suspendida. Comuníquese con la directiva.');
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

    // jwtid único por sesión: permite revocarla al cerrar sesión (auditoría H-005)
    const token = jwt.sign(payload, env.JWT_SECRET, {
      jwtid: randomUUID(),
      expiresIn: env.JWT_EXPIRES_IN || '8h'
    });

    return {
      token,
      socia: {
        id: socia.id,
        rut: socia.rut,
        nombreCompleto: `${socia.nombres} ${socia.apellido_paterno || ''}`.trim(),
        // Por separado para los formularios del portal (ej. solicitud S.O.S)
        nombres: socia.nombres,
        apellidoPaterno: socia.apellido_paterno || '',
        apellidoMaterno: socia.apellido_materno || '',
        cargo: socia.cargo,
        jardin: socia.jardin,
        // Muestra la pestaña "Mi jardín"; el backend vuelve a verificar la marca en cada consulta
        esDelegada: Boolean(socia.es_delegada),
        primerIngreso: Boolean(socia.primer_ingreso)
      }
    };
  },

  /**
   * Cambia la contraseña obligatoria en primer ingreso o actualización voluntaria
   */
  async cambiarClave(sociaId, nuevaClave, rut, claveActual) {
    if (!nuevaClave || nuevaClave.trim().length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
    }
    if (rut && nuevaClave.trim() === getInitialPasswordFromRut(rut)) {
      throw new Error('La nueva contraseña no puede ser la clave inicial (6 primeros dígitos del RUT).');
    }

    const cleanId = String(sociaId).replace('socia-', '');

    // Cambio voluntario (ya tiene clave propia): exige la clave actual, para que una sesión
    // abierta en otro equipo no baste para quitarle la cuenta. El primer ingreso no la pide.
    const [actual] = await query(`SELECT password, primer_ingreso FROM socias WHERE id = ? AND estado = 'ACTIVA'`, [cleanId]);
    if (!actual) {
      throw new Error('No fue posible actualizar la contraseña: socia no encontrada o no activa.');
    }
    if (actual.password && Number(actual.primer_ingreso) === 0) {
      if (!claveActual || !(await bcrypt.compare(claveActual, actual.password))) {
        throw new Error('La contraseña actual no es correcta.');
      }
      if (claveActual === nuevaClave.trim()) {
        throw new Error('La nueva contraseña debe ser distinta a la actual.');
      }
    }

    const hash = await bcrypt.hash(nuevaClave.trim(), 10);

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
