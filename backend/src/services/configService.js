/**
 * Parámetros del sistema ajustables por la directiva (tabla `configuracion`).
 * Hoy: porcentaje de comisión que Isi Mundo devuelve a la Asociación.
 */
import { query } from '../config/db.js';

const CLAVE_COMISION = 'comision_isimundo_pct';
export const COMISION_PCT_POR_DEFECTO = 2;

export const ConfigService = {
  /** % de comisión vigente de Isi Mundo (2 si nunca se ajustó) */
  async getComisionIsimundo(tx = query) {
    const [row] = await tx('SELECT valor, actualizado_por, updated_at FROM configuracion WHERE clave = ?', [CLAVE_COMISION]);
    const pct = row ? Number(row.valor) : COMISION_PCT_POR_DEFECTO;
    return {
      pct: Number.isFinite(pct) ? pct : COMISION_PCT_POR_DEFECTO,
      actualizadoPor: row?.actualizado_por || null,
      actualizadoAt: row?.updated_at || null
    };
  },

  async setComisionIsimundo(pct, actualizadoPor) {
    await query(
      `INSERT INTO configuracion (clave, valor, actualizado_por) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor), actualizado_por = VALUES(actualizado_por)`,
      [CLAVE_COMISION, String(pct), actualizadoPor]
    );
    return this.getComisionIsimundo();
  }
};

/** Comisión en pesos para un monto pagado (redondeada al peso) */
export const calcularComision = (monto, pct) => Math.round((Number(monto) || 0) * pct / 100);
