import { api } from './api.js';

export const TreasuryApiService = {
  /**
   * Obtiene el resumen consolidado de la Tesorería (7 recuadros)
   */
  async getSummary() {
    const res = await api.get('/tesoreria/resumen');
    return res.data.data;
  },

  /**
   * Obtiene la lista de movimientos con filtros
   */
  async getMovements(filters = {}) {
    const res = await api.get('/tesoreria/movimientos', { params: filters });
    return res.data.data;
  },

  /**
   * Registra un nuevo movimiento en la Tesorería
   */
  async createMovement(movementData) {
    const res = await api.post('/tesoreria/movimientos', movementData);
    return res.data.data;
  }
};
