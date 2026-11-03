import { isDatabaseReady, query } from '../config/db.js';

let inMemoryBuzon = [];

export const BuzonService = {
  /**
   * Guarda un nuevo mensaje enviado por una socia
   */
  async crearMensaje({ sociaId, sociaRut, sociaNombre, sociaJardin, tipo, asunto, mensaje, archivoAdjunto }) {
    if (!asunto || !asunto.trim()) {
      throw new Error('El asunto del mensaje es obligatorio.');
    }
    if (!mensaje || !mensaje.trim()) {
      throw new Error('El cuerpo del mensaje no puede estar vacío.');
    }

    const tipoValido = ['FELICITACION', 'RECLAMO', 'SUGERENCIA', 'CONSULTA', 'OTRO'].includes(tipo)
      ? tipo
      : 'CONSULTA';

    if (isDatabaseReady()) {
      const result = await query(
        `INSERT INTO buzon_mensajes (socia_id, socia_rut, socia_nombre, socia_jardin, tipo, asunto, mensaje, archivo_adjunto, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE')`,
        [sociaId || null, sociaRut, sociaNombre, sociaJardin, tipoValido, asunto.trim(), mensaje.trim(), archivoAdjunto || null]
      );
      return {
        id: result.insertId,
        sociaRut,
        sociaNombre,
        sociaJardin,
        tipo: tipoValido,
        asunto: asunto.trim(),
        mensaje: mensaje.trim(),
        archivoAdjunto,
        estado: 'PENDIENTE',
        createdAt: new Date().toISOString()
      };
    }

    const item = {
      id: Date.now(),
      sociaId,
      sociaRut,
      sociaNombre,
      sociaJardin,
      tipo: tipoValido,
      asunto: asunto.trim(),
      mensaje: mensaje.trim(),
      archivoAdjunto,
      estado: 'PENDIENTE',
      createdAt: new Date().toISOString()
    };
    inMemoryBuzon.unshift(item);
    return item;
  },

  /**
   * Obtiene los mensajes enviados por una socia específica
   */
  async getMensajesPorSocia(sociaRut) {
    if (isDatabaseReady()) {
      try {
        const rows = await query(
          `SELECT id, tipo, asunto, mensaje, archivo_adjunto as archivoAdjunto, estado, created_at as createdAt
           FROM buzon_mensajes
           WHERE REPLACE(REPLACE(socia_rut, '.', ''), '-', '') = REPLACE(REPLACE(?, '.', ''), '-', '')
           ORDER BY created_at DESC`,
          [sociaRut]
        );
        return rows;
      } catch (err) {
        console.warn('Error leyendo buzon desde MySQL:', err.message);
      }
    }
    return inMemoryBuzon.filter((m) => m.sociaRut === sociaRut);
  },

  /**
   * Vista administrativa para que la Directiva y Admin revisen los mensajes recibidos
   */
  async getTodosLosMensajes() {
    if (isDatabaseReady()) {
      try {
        const rows = await query(
          `SELECT id, socia_id, socia_rut as sociaRut, socia_nombre as sociaNombre, socia_jardin as sociaJardin,
                  tipo, asunto, mensaje, archivo_adjunto as archivoAdjunto, estado, created_at as createdAt
           FROM buzon_mensajes
           ORDER BY created_at DESC`
        );
        return rows;
      } catch (err) {
        console.warn('Error leyendo todos los mensajes de buzón desde MySQL:', err.message);
      }
    }
    return inMemoryBuzon;
  }
};

