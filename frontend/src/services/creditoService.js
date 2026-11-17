import { api } from './api.js';

/** Créditos y Convenios (V4): tarjetas, historial, carga de planilla y verificación de pagos */
export const CreditoApiService = {
  async getResumen() {
    const res = await api.get('/creditos/resumen');
    return res.data.data;
  },

  /** Historial con filtros: { search, convenio, estado, page, limit } → { items, total, page, limit } */
  async getCreditos(filters = {}) {
    const res = await api.get('/creditos', { params: filters });
    const { data, total, page, limit } = res.data;
    return { items: data, total, page, limit };
  },

  async getCredito(id) {
    const res = await api.get(`/creditos/${id}`);
    return res.data.data;
  },

  /** % de comisión de Isi Mundo vigente */
  async getComision() {
    const res = await api.get('/creditos/comision');
    return res.data.data;
  },

  async setComision(pct) {
    const res = await api.put('/creditos/comision', { pct });
    return res.data;
  },

  /** Registra la comisión de un pago verificado de ISIMUNDO como ingreso en Tesorería */
  async registrarComision(pagoId, monto, fecha) {
    const res = await api.post(`/creditos/pagos/${pagoId}/comision`, { monto, fecha });
    return res.data;
  },

  /** Liquidación del mes para el empleador: totales por empresa */
  async getLiquidacion(mes, anio) {
    const res = await api.get('/creditos/liquidacion', { params: { mes, anio } });
    return res.data.data;
  },

  /** Descarga el Excel de la liquidación (una fila por socia) */
  async descargarLiquidacion(mes, anio) {
    const res = await api.get('/creditos/liquidacion/excel', { params: { mes, anio }, responseType: 'blob', timeout: 60000 });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `liquidacion-descuentos-${anio}-${String(mes).padStart(2, '0')}.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /** Créditos a mano (sin planilla) */
  async crearCredito(datos) {
    const res = await api.post('/creditos', datos);
    return res.data;
  },

  async editarCredito(id, datos) {
    const res = await api.put(`/creditos/${id}`, datos);
    return res.data;
  },

  async anularCredito(id, motivo) {
    const res = await api.post(`/creditos/${id}/anular`, { motivo });
    return res.data;
  },

  async prepagarCredito(id, fecha) {
    const res = await api.post(`/creditos/${id}/prepago`, { fecha });
    return res.data;
  },

  async getPeriodo(mes, anio) {
    const res = await api.get('/creditos/periodo', { params: { mes, anio } });
    return res.data.data;
  },

  async getHistorialCargas() {
    const res = await api.get('/creditos/importar/historial');
    return res.data.data;
  },

  async previsualizarPlanilla(file, mes, anio) {
    const res = await api.post('/creditos/importar/previsualizar', formPlanilla(file, mes, anio), {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    });
    return res.data.data;
  },

  async aplicarPlanilla(file, mes, anio) {
    const res = await api.post('/creditos/importar/aplicar', formPlanilla(file, mes, anio), {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000
    });
    return res.data;
  },

  /** comprobantes: { SOS: File, ISIMUNDO: File, ... } (solo las empresas que se verifican) */
  async verificarPagos(mes, anio, comprobantes) {
    const form = new FormData();
    form.append('mes', String(mes));
    form.append('anio', String(anio));
    for (const [codigo, file] of Object.entries(comprobantes)) form.append(`comprobante_${codigo}`, file);
    const res = await api.post('/creditos/pagos/verificar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000
    });
    return res.data;
  },

  /** Descarga el comprobante de un pago verificado */
  async descargarComprobante(pagoId, nombreSugerido) {
    const res = await api.get(`/creditos/pagos/${pagoId}/comprobante`, { responseType: 'blob' });
    // En desarrollo (otro puerto) el navegador no expone Content-Disposition: se usa el nombre sugerido
    const disposition = res.headers['content-disposition'] || '';
    const ext = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[res.data.type] || '';
    const nombre = disposition.match(/filename="?([^";]+)"?/)?.[1] || `${nombreSugerido || `comprobante-${pagoId}`}${ext}`;
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombre;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

function formPlanilla(file, mes, anio) {
  const form = new FormData();
  form.append('mes', String(mes));
  form.append('anio', String(anio));
  form.append('planilla', file);
  return form;
}
