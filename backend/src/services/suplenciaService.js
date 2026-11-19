/**
 * Suplencia de Tesorería: cuando la Tesorera no está, el Admin activa a una Directora para que
 * opere Tesorería y Créditos con los mismos permisos de la Tesorera (sin perder los suyos).
 *
 * Se guarda en `configuracion` (clave suplente_tesoreria) con el id de la Directora o vacío.
 * El permiso se revisa en cada petición, así que activar o desactivar rige de inmediato.
 */
import { isDatabaseReady, query } from '../config/db.js';

const CLAVE = 'suplente_tesoreria';

export class SuplenciaError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Directoras activas que pueden reemplazar a la Tesorera */
async function candidatas() {
  const rows = await query(
    `SELECT id, nombres, apellidos FROM administradores
     WHERE UPPER(TRIM(rol)) = 'DIRECTORA' AND (activo = 1 OR activo IS NULL)
     ORDER BY id`
  );
  return rows.map((r) => ({ id: r.id, nombre: `${r.nombres || ''} ${r.apellidos || ''}`.trim() }));
}

async function leerClave() {
  const [row] = await query('SELECT valor, actualizado_por, updated_at FROM configuracion WHERE clave = ?', [CLAVE]);
  return row || null;
}

export const SuplenciaService = {
  /** Estado para el panel del Admin: si está activa, quién reemplaza y las Directoras disponibles */
  async getEstado() {
    const [lista, row] = await Promise.all([candidatas(), leerClave()]);
    const suplente = lista.find((c) => String(c.id) === String(row?.valor || '')) || null;
    return {
      activa: Boolean(suplente),
      suplente,
      candidatas: lista,
      actualizadoPor: row?.actualizado_por || null,
      actualizadoAt: row?.updated_at || null
    };
  },

  /** true si el usuario de la directiva ("admin-5") es la Directora suplente vigente */
  async esSuplente(userId) {
    if (!isDatabaseReady()) return false;
    const match = /^admin-(\d+)$/.exec(String(userId || ''));
    if (!match) return false;
    const row = await leerClave();
    if (!row || String(row.valor) !== match[1]) return false;
    // Si dejó de ser Directora o fue desactivada, la suplencia ya no le da permisos
    return (await candidatas()).some((c) => c.id === Number(match[1]));
  },

  /**
   * Activa o desactiva la suplencia. Sin suplenteId se elige la única Directora activa;
   * si hay varias, el Admin debe indicar cuál.
   */
  async setEstado({ activa, suplenteId }, actualizadoPor) {
    let valor = '';
    if (activa) {
      const lista = await candidatas();
      if (lista.length === 0) throw new SuplenciaError('No hay una Directora activa que pueda reemplazar a la Tesorera.');
      let elegida = suplenteId ? lista.find((c) => c.id === Number(suplenteId)) : null;
      if (!suplenteId && lista.length === 1) elegida = lista[0];
      if (!elegida) {
        throw new SuplenciaError(
          suplenteId ? 'La persona elegida no es una Directora activa.' : 'Hay más de una Directora: indique cuál reemplaza a la Tesorera.'
        );
      }
      valor = String(elegida.id);
    }
    await query(
      `INSERT INTO configuracion (clave, valor, actualizado_por) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor), actualizado_por = VALUES(actualizado_por)`,
      [CLAVE, valor, actualizadoPor]
    );
    return this.getEstado();
  }
};
