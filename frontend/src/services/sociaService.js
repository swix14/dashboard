import { api } from './api.js';

export const SociaApiService = {
  /** Resumen del padrón (recuadros KPI) */
  async getSummary() {
    const res = await api.get('/socias/resumen');
    return res.data.data;
  },

  /**
   * Página del padrón con filtros (search, jardinId, estado, cargo, credito, page, limit).
   * limit = 0 devuelve todas las coincidencias (exportación).
   * Respuesta: { items, total, page, limit }
   */
  async getSocias(filters = {}) {
    const res = await api.get('/socias', { params: filters });
    const { data, total, page, limit } = res.data;
    return { items: data, total, page, limit };
  },

  /** Ficha completa de una socia con créditos e historial de traslados */
  async getSocia(id) {
    const res = await api.get(`/socias/${id}`);
    return res.data.data;
  },

  /** Catálogo de jardines con conteo de socias y delegada */
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
  },

  /** Baja lógica: la socia queda RETIRADA, conservando créditos e historial */
  async retirarSocia(id, motivo) {
    const res = await api.delete(`/socias/${id}`, { data: { motivo } });
    return res.data.data;
  },

  /** Recuperación de clave: vuelve a los 6 primeros dígitos del RUT con cambio obligatorio */
  async restablecerClave(id) {
    const res = await api.post(`/socias/${id}/restablecer-clave`);
    return res.data;
  },

  /** Descarga el resumen de créditos de la socia en PDF (solo Admin, Presidenta y Tesorera) */
  async descargarCreditosPdf(id, rut) {
    const res = await api.get(`/socias/${id}/creditos/pdf`, { responseType: 'blob' });
    // En desarrollo (otro puerto) el navegador no expone Content-Disposition: se arma el nombre con el RUT
    const disposition = res.headers['content-disposition'] || '';
    const nombre = disposition.match(/filename="?([^";]+)"?/)?.[1] || `creditos-${String(rut || id).replace(/[^0-9kK-]/g, '')}.pdf`;
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombre;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /** Carga de la planilla Maestra Socias: vista previa (no modifica nada) */
  async previsualizarPlanilla(file) {
    const form = new FormData();
    form.append('planilla', file);
    const res = await api.post('/socias/importar/previsualizar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    });
    return res.data.data;
  },

  /** Carga de la planilla Maestra Socias: aplica los cambios del mismo archivo */
  async aplicarPlanilla(file) {
    const form = new FormData();
    form.append('planilla', file);
    const res = await api.post('/socias/importar/aplicar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    });
    return res.data;
  },

  async historialCargas() {
    const res = await api.get('/socias/importar/historial');
    return res.data.data;
  }
};
