import { api } from './api.js';

export const SociaApiService = {
  /**
   * Resumen del padrón (recuadros KPI)
   */
  async getSummary() {
    const res = await api.get('/socias/resumen');
    return res.data.data;
  },

  /**
   * Lista de socias con filtros (search, jardinId, estado, cargo, credito)
   */
  async getSocias(filters = {}) {
    const res = await api.get('/socias', { params: filters });
    return res.data.data;
  },

  /**
   * Ficha completa de una socia con créditos e historial de traslados
   */
  async getSocia(id) {
    const res = await api.get(`/socias/${id}`);
    return res.data.data;
  },

  /**
   * Catálogo de los 23 jardines con conteo de socias y delegada
   */
  async getJardines() {
    const res = await api.get('/socias/jardines');
    return res.data.data;
  },

  async createSocia(data) {
    const res = await api.post('/socias', data);
    return res.data.data;
  },

  async updateSocia(id, data) {
    const res = await api.put(`/socias/${id}`, data);
    return res.data.data;
  }
};
