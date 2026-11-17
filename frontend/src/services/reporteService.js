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

function guardarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombre;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ReporteApiService = {
  /** Cifras de los jardines (directiva) */
  async cifrasJardines() {
    const res = await api.get('/reportes/jardines');
    return res.data.data;
  },

  /** Cifras del jardín de la delegada (portal de socias) */
  async miJardin() {
    const res = await api.get('/socia/mi-jardin');
    return res.data.data;
  },

  /** Descarga el informe mensual en Excel (informe-mensual-AAAA-MM.xlsx) */
  async descargarInformeMensual(anio, mes) {
    try {
      const res = await api.get('/reportes/mensual/excel', { params: { anio, mes }, responseType: 'blob' });
      guardarBlob(res.data, `informe-mensual-${anio}-${String(mes).padStart(2, '0')}.xlsx`);
    } catch (err) {
      throw new Error(await mensajeDeBlob(err, 'No fue posible exportar el informe.'));
    }
  },

  /** Descarga el Balance Anual en PDF (balance-anual-AAAA.pdf) */
  async descargarBalanceAnual(anio) {
    try {
      const res = await api.get('/reportes/anual/pdf', { params: { anio }, responseType: 'blob' });
      guardarBlob(res.data, `balance-anual-${anio}.pdf`);
    } catch (err) {
      throw new Error(await mensajeDeBlob(err, 'No fue posible generar el balance.'));
    }
  }
};
