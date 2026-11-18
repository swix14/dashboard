import { api } from './api.js';
import { guardarBlob, mensajeDeBlob } from '../utils/descargas.js';

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
