import { api } from './api.js';

/** Solicitudes S.O.S en línea: la socia las envía desde su portal y la directiva las revisa en Créditos */
export const SosApiService = {
  // --- Portal de socias ---
  async solicitar({ monto, cuotas, motivo }) {
    const res = await api.post('/socia/sos', { monto, cuotas, motivo });
    return res.data;
  },

  async misSolicitudes() {
    const res = await api.get('/socia/sos');
    return res.data.data;
  },

  // --- Directiva ---
  async listar(estado = 'TODAS') {
    const res = await api.get('/creditos/sos', { params: { estado } });
    return { items: res.data.data, pendientes: res.data.pendientes };
  },

  async aprobar(id, { valorCuota, primeraCuota, respuesta }) {
    const res = await api.post(`/creditos/sos/${id}/aprobar`, { valorCuota, primeraCuota, respuesta: respuesta || undefined });
    return res.data;
  },

  async rechazar(id, motivo) {
    const res = await api.post(`/creditos/sos/${id}/rechazar`, { motivo });
    return res.data;
  }
};

export const SOS_MONTO_MAXIMO = 1000000;

export const ESTADO_SOS = {
  PENDIENTE: { label: 'En revisión', variant: 'warning' },
  APROBADA: { label: 'Aprobada', variant: 'success' },
  RECHAZADA: { label: 'Rechazada', variant: 'error' }
};
