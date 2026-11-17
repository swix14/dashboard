/**
 * Liquidación mensual para el empleador: lo que se descuenta por planilla a cada socia en un mes.
 *
 * Por socia: cuota social ($4.000 si está ACTIVA) + la cuota del mes de cada convenio
 * (S.O.S, ISIMUNDO, Óptica, Dental y Abogada). Mismo formato que la hoja resumen (Hoja1)
 * de la planilla Maestra Créditos, pero armado con los datos del sistema.
 *
 * Reglas:
 *  - Cuentan las cuotas pendientes o descontadas del mes; las prepagadas o condonadas no se
 *    descuentan por planilla y los créditos anulados no cuentan.
 *  - La socia suspendida no paga cuota social, pero sus convenios sí aparecen.
 *  - Solo se listan socias con algo que descontar.
 */
import ExcelJS from 'exceljs';
import { query } from '../config/db.js';
import { CUOTA_SOCIAL_MENSUAL } from '../utils/sociaFormat.js';
import { NOMBRE_MES } from './creditImportService.js';

// Reparto de la cuota social (reunión con la directiva)
const REPARTO_CUOTA = [
  ['Federación', 1000],
  ['Asociación', 1000],
  ['Fondo Cena Anual', 2000]
];

const CLP = '"$"#,##0';
const MORADO = 'FF725682';
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const LiquidacionService = {
  /** Datos de la liquidación del mes: filas por socia y totales por empresa */
  async generar({ mes, anio }) {
    const convenios = await query('SELECT id, codigo, nombre FROM convenios WHERE codigo IS NOT NULL ORDER BY orden, id');
    const cuotas = await query(
      `SELECT c.socia_id, cv.codigo, SUM(q.monto) AS monto
       FROM cuotas_credito q
       JOIN creditos c ON c.id = q.credito_id
       JOIN convenios cv ON cv.id = c.convenio_id
       WHERE q.mes_cobro = ? AND q.anio_cobro = ? AND q.estado IN ('pendiente', 'descontada') AND c.estado <> 'anulado'
       GROUP BY c.socia_id, cv.codigo`,
      [mes, anio]
    );
    const conConvenio = [...new Set(cuotas.map((c) => c.socia_id))];
    const socias = await query(
      `SELECT s.id, s.rut, s.nombres, s.apellido_paterno, s.apellido_materno, s.estado, COALESCE(j.nombre, 'Sin jardín') AS jardin
       FROM socias s LEFT JOIN jardines j ON j.id = s.jardin_id
       WHERE s.estado = 'ACTIVA' ${conConvenio.length ? `OR s.id IN (${conConvenio.map(() => '?').join(',')})` : ''}
       ORDER BY jardin, s.apellido_paterno, s.apellido_materno, s.nombres`,
      conConvenio
    );

    const porSocia = new Map();
    for (const c of cuotas) {
      if (!porSocia.has(c.socia_id)) porSocia.set(c.socia_id, {});
      porSocia.get(c.socia_id)[c.codigo] = Number(c.monto);
    }

    const filas = socias.map((s) => {
      const descuentos = Object.fromEntries(convenios.map((cv) => [cv.codigo, porSocia.get(s.id)?.[cv.codigo] || 0]));
      const cuotaSocial = s.estado === 'ACTIVA' ? CUOTA_SOCIAL_MENSUAL : 0;
      const total = cuotaSocial + Object.values(descuentos).reduce((a, b) => a + b, 0);
      return {
        rut: s.rut,
        apellidoPaterno: s.apellido_paterno,
        apellidoMaterno: s.apellido_materno || '',
        nombres: s.nombres,
        jardin: s.jardin,
        estado: s.estado,
        cuotaSocial,
        descuentos,
        total
      };
    }).filter((f) => f.total > 0);

    const totalEmpresa = Object.fromEntries(convenios.map((cv) => [cv.codigo, filas.reduce((s, f) => s + f.descuentos[cv.codigo], 0)]));
    const sociasEmpresa = Object.fromEntries(convenios.map((cv) => [cv.codigo, filas.filter((f) => f.descuentos[cv.codigo] > 0).length]));
    const totalCuotaSocial = filas.reduce((s, f) => s + f.cuotaSocial, 0);
    return {
      periodo: { mes, anio, nombreMes: capital(NOMBRE_MES[mes]) },
      empresas: convenios.map((cv) => ({ codigo: cv.codigo, nombre: cv.nombre, total: totalEmpresa[cv.codigo], socias: sociasEmpresa[cv.codigo] })),
      cuotaSocial: { total: totalCuotaSocial, socias: filas.filter((f) => f.cuotaSocial > 0).length },
      totalSocias: filas.length,
      totalGeneral: filas.reduce((s, f) => s + f.total, 0),
      filas
    };
  },

  /** Excel con la hoja de liquidación por socia y una hoja de resumen */
  async generarExcel(liq, generadoPor) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SIGAV — Asociación de Jardines VTF Temuco';
    wb.created = new Date();
    const { periodo, empresas } = liq;
    const titulo = `Liquidación de descuentos por planilla — ${periodo.nombreMes} ${periodo.anio}`;

    // Hoja 1: una fila por socia
    const ws = wb.addWorksheet('Liquidación', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToHeight: 0 },
      views: [{ state: 'frozen', ySplit: 4 }]
    });
    const columnas = [
      ['N°', 5], ['RUT', 14], ['Apellido paterno', 18], ['Apellido materno', 18], ['Nombres', 24], ['Jardín', 26],
      ['Cuota social', 13], ...empresas.map((e) => [e.nombre, 13]), ['Total', 14]
    ];
    ws.columns = columnas.map(([, width]) => ({ width }));
    const ultimaCol = columnas.length;
    ws.mergeCells(1, 1, 1, ultimaCol);
    ws.getCell(1, 1).value = 'Asociación de Jardines VTF Temuco';
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF4F3A5A' } };
    ws.mergeCells(2, 1, 2, ultimaCol);
    ws.getCell(2, 1).value = titulo;
    ws.getCell(2, 1).font = { bold: true, size: 12 };

    const header = ws.getRow(4);
    header.values = columnas.map(([t]) => t);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MORADO } }; });

    liq.filas.forEach((f, i) => {
      const row = ws.getRow(5 + i);
      row.values = [
        i + 1, f.rut, f.apellidoPaterno, f.apellidoMaterno, f.nombres, f.jardin,
        f.cuotaSocial, ...empresas.map((e) => f.descuentos[e.codigo]), f.total
      ];
      for (let c = 7; c <= ultimaCol; c++) row.getCell(c).numFmt = CLP;
      row.getCell(ultimaCol).font = { bold: true };
    });
    const filaTotal = ws.getRow(5 + liq.filas.length);
    filaTotal.values = [
      '', '', '', '', 'TOTAL', `${liq.totalSocias} socias`,
      liq.cuotaSocial.total, ...empresas.map((e) => e.total), liq.totalGeneral
    ];
    filaTotal.font = { bold: true };
    filaTotal.eachCell((c, n) => {
      c.border = { top: { style: 'thin', color: { argb: MORADO } } };
      if (n >= 7) c.numFmt = CLP;
    });

    // Hoja 2: resumen por empresa y reparto de la cuota social
    const rs = wb.addWorksheet('Resumen', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true } });
    rs.columns = [{ width: 34 }, { width: 12 }, { width: 18 }];
    rs.mergeCells('A1:C1');
    rs.getCell('A1').value = titulo;
    rs.getCell('A1').font = { bold: true, size: 12 };
    const cab = rs.getRow(3);
    cab.values = ['Concepto', 'Socias', 'Monto'];
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cab.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MORADO } }; });
    const filas = [
      ['Cuota social', liq.cuotaSocial.socias, liq.cuotaSocial.total],
      ...REPARTO_CUOTA.map(([n, v]) => [`   ${n} ($${v.toLocaleString('es-CL')} por socia)`, '', v * liq.cuotaSocial.socias]),
      ...empresas.map((e) => [e.nombre, e.socias, e.total]),
      ['TOTAL A DESCONTAR', liq.totalSocias, liq.totalGeneral]
    ];
    filas.forEach((valores, i) => {
      const row = rs.getRow(4 + i);
      row.values = valores;
      row.getCell(3).numFmt = CLP;
      if (!String(valores[0]).startsWith(' ')) row.getCell(1).font = { bold: true };
      if (i === filas.length - 1) row.font = { bold: true };
      row.eachCell((c) => { c.border = { bottom: { style: 'hair', color: { argb: 'FFD9D2DD' } } }; });
    });
    const pie = rs.getRow(4 + filas.length + 2);
    pie.getCell(1).value = `Generado el ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })} por ${generadoPor}`;
    pie.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF6B6B6B' } };

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
};
