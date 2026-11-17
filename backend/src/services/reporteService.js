import ExcelJS from 'exceljs';
import { TreasuryService, resumirMovimientos } from './treasuryService.js';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const pad = (n) => String(n).padStart(2, '0');

function ultimoDiaDelMes(anio, mes) {
  // Día 0 del mes siguiente = último día del mes pedido
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Informe mensual de cuentas (no es la rendición anual).
 * Pedido de la directiva (16-11-2026): pago a Federación, total de egresos,
 * total disponible y cantidad de movimientos del mes.
 */
export const ReporteService = {
  async getInformeMensual(anio, mes) {
    const desde = `${anio}-${pad(mes)}-01`;
    const hasta = `${anio}-${pad(mes)}-${pad(ultimoDiaDelMes(anio, mes))}`;

    const hastaCierre = await TreasuryService.listarHasta(hasta);
    const delMes = hastaCierre.filter((m) => m.fecha >= desde && m.tipo !== 'SALDO_APERTURA');
    const mesResumen = resumirMovimientos(delMes);
    // El disponible es el saldo acumulado al último día del mes (incluye saldos de apertura)
    const alCierre = resumirMovimientos(hastaCierre);

    return {
      periodo: { anio, mes, nombreMes: MESES[mes - 1], desde, hasta },
      pagoFederacion: mesResumen.totalPagadoFederacion,
      totalIngresos: mesResumen.totalIngresos,
      totalEgresos: mesResumen.totalEgresos,
      totalDisponible: alCierre.saldoTotal,
      disponiblePorFondo: {
        asociacion: alCierre.saldoAsociacion,
        cenaAnual: alCierre.saldoCenaAnual
      },
      cantidadMovimientos: delMes.length,
      cantidadIngresos: delMes.filter((m) => m.tipo === 'INGRESO').length,
      cantidadEgresos: delMes.filter((m) => m.tipo === 'EGRESO').length
    };
  },

  /**
   * Planilla Excel del informe mensual
   * @returns {Promise<Buffer>}
   */
  async generarExcelMensual(informe, generadoPor) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIGAV — Asociación de Jardines VTF Temuco';
    wb.created = new Date();

    const ws = wb.addWorksheet('Informe mensual', {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true }
    });
    ws.columns = [{ width: 38 }, { width: 22 }];

    const { periodo } = informe;
    ws.mergeCells('A1:B1');
    ws.getCell('A1').value = 'Asociación de Jardines VTF Temuco';
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF4F3A5A' } };
    ws.mergeCells('A2:B2');
    ws.getCell('A2').value = `Informe mensual de cuentas — ${periodo.nombreMes} ${periodo.anio}`;
    ws.getCell('A2').font = { bold: true, size: 12 };
    ws.mergeCells('A3:B3');
    ws.getCell('A3').value = `Período: ${periodo.desde} al ${periodo.hasta}`;
    ws.getCell('A3').font = { color: { argb: 'FF6B6B6B' } };

    const header = ws.getRow(5);
    header.values = ['Concepto', 'Valor'];
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF725682' } };
    });

    const CLP = '"$"#,##0';
    const filas = [
      ['Pago a Federación', informe.pagoFederacion, CLP],
      ['Total de ingresos del mes', informe.totalIngresos, CLP],
      ['Total de egresos del mes', informe.totalEgresos, CLP],
      ['Total disponible al cierre', informe.totalDisponible, CLP],
      ['   Fondo Asociación', informe.disponiblePorFondo.asociacion, CLP],
      ['   Fondo Cena Anual', informe.disponiblePorFondo.cenaAnual, CLP],
      ['Total de movimientos (cantidad)', informe.cantidadMovimientos, '0'],
      ['   Ingresos', informe.cantidadIngresos, '0'],
      ['   Egresos', informe.cantidadEgresos, '0']
    ];
    filas.forEach(([concepto, valor, formato], i) => {
      const row = ws.getRow(6 + i);
      row.values = [concepto, valor];
      row.getCell(2).numFmt = formato;
      row.getCell(2).alignment = { horizontal: 'right' };
      if (!concepto.startsWith(' ')) row.getCell(1).font = { bold: true };
      row.eachCell((c) => {
        c.border = { bottom: { style: 'hair', color: { argb: 'FFD9D2DD' } } };
      });
    });

    const pie = ws.getRow(6 + filas.length + 2);
    pie.getCell(1).value = `Generado el ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })} por ${generadoPor}`;
    pie.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF6B6B6B' } };

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
};
