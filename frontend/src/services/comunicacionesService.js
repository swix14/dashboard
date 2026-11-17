import { api } from './api.js';

/**
 * Noticias para el portal de socias y lectura del buzón (panel de la directiva)
 */
export const ComunicacionesApiService = {
  async getNoticias() {
    const res = await api.get('/socia/noticias');
    return res.data.data || [];
  },

  async publicarNoticia({ titulo, contenido, categoria, destacado }) {
    const res = await api.post('/socia/noticias', { titulo, contenido, categoria, destacado });
    return res.data.data;
  },

  async eliminarNoticia(id) {
    await api.delete(`/socia/noticias/${id}`);
  },

  async getMensajes() {
    const res = await api.get('/socia/buzon/admin');
    return res.data.data || [];
  },

  async cambiarEstadoMensaje(id, estado) {
    const res = await api.patch(`/socia/buzon/${id}/estado`, { estado });
    return res.data.data;
  },

  /** Descarga el adjunto como Blob (la ruta exige el token, por eso no sirve un enlace directo) */
  async descargarAdjunto(id) {
    const res = await api.get(`/socia/buzon/${id}/adjunto`, { responseType: 'blob' });
    const disposition = res.headers['content-disposition'] || '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    return { blob: res.data, fileName: match ? decodeURIComponent(match[1]) : `adjunto-buzon-${id}` };
  }
};
