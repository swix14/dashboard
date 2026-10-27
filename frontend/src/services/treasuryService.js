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
   * Registra un nuevo movimiento en la Tesorería.
   * Se envía como multipart/form-data para incluir el archivo del comprobante.
   */
  async createMovement({ archivoComprobante, ...movementData }) {
    const form = new FormData();
    Object.entries(movementData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, value);
    });
    if (archivoComprobante) form.append('comprobante', archivoComprobante);

    const res = await api.post('/tesoreria/movimientos', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000
    });
    return res.data.data;
  },

  /**
   * Descarga el archivo del comprobante de un movimiento como Blob
   */
  async getComprobante(movementId) {
    const res = await api.get(`/tesoreria/movimientos/${movementId}/comprobante`, {
      responseType: 'blob',
      timeout: 30000
    });
    return res.data;
  }
};
