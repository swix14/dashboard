import { api } from './api.js';

// Mensaje del backend cuando la respuesta esperada era un archivo (blob)
async function mensajeDeBlob(err, fallback) {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || fallback;
}

export const ReporteApiService = {
  /** Descarga el Balance Anual en PDF (balance-anual-AAAA.pdf) */
  async descargarBalanceAnual(anio) {
    try {
      const res = await api.get('/reportes/anual/pdf', { params: { anio }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `balance-anual-${anio}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      throw new Error(await mensajeDeBlob(err, 'No fue posible generar el balance.'));
    }
  }
};
