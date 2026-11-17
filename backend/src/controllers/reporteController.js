import { z } from 'zod';
import { ReporteService } from '../services/reporteService.js';
import { AuditService } from '../services/auditService.js';
import { BalancePdfService } from '../services/balancePdfService.js';
import { hoyChile } from '../utils/fecha.js';

// Período del informe: por defecto el mes actual (hora de Chile)
function periodoSchema() {
  const [anioActual, mesActual] = hoyChile().split('-').map(Number);
  return z.object({
    anio: z.coerce.number().int().min(2020).max(anioActual).default(anioActual),
    mes: z.coerce.number().int().min(1).max(12).default(mesActual)
  });
}

function parsePeriodo(req, res) {
  const parsed = periodoSchema().safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Período inválido: indique un año y un mes válidos.' });
    return null;
  }
  return parsed.data;
}

function parseAnio(req, res) {
  const anioActual = Number(hoyChile().slice(0, 4));
  const parsed = z.object({ anio: z.coerce.number().int().min(2020).max(anioActual).default(anioActual) }).safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: `Año inválido: indique un año entre 2020 y ${anioActual}.` });
    return null;
  }
  return parsed.data.anio;
}

export const ReporteController = {
  /** GET /api/reportes/anual/pdf?anio — Balance Anual para la asamblea */
  async exportarBalanceAnualPdf(req, res, next) {
    try {
      const anio = parseAnio(req, res);
      if (anio === null) return undefined;
      const balance = await ReporteService.getBalanceAnual(anio, hoyChile());
      if (!balance.hayDatos) {
        return res.status(404).json({ success: false, message: `No hay movimientos de Tesorería registrados hasta ${anio}.` });
      }
      const emitidoPor = `${req.user.firstName} ${req.user.lastName || ''}`.trim();
      const { buffer, nombre } = await BalancePdfService.generar(balance, emitidoPor);

      await AuditService.log({
        userId: req.user.id,
        rut: req.user.rut,
        action: 'BALANCE_ANUAL_PDF',
        details: { anio, hasta: balance.hasta, movimientos: balance.cantidadMovimientos },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/reportes/mensual?anio&mes */
  async getInformeMensual(req, res, next) {
    try {
      const periodo = parsePeriodo(req, res);
      if (!periodo) return undefined;
      const informe = await ReporteService.getInformeMensual(periodo.anio, periodo.mes);
      return res.json({ success: true, data: informe });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/reportes/mensual/excel?anio&mes */
  async exportarInformeMensual(req, res, next) {
    try {
      const periodo = parsePeriodo(req, res);
      if (!periodo) return undefined;
      const informe = await ReporteService.getInformeMensual(periodo.anio, periodo.mes);
      const generadoPor = `${req.user.firstName} ${req.user.lastName || ''}`.trim();
      const buffer = await ReporteService.generarExcelMensual(informe, generadoPor);

      await AuditService.log({
        userId: req.user.id,
        rut: req.user.rut,
        action: 'REPORTE_MENSUAL_EXPORTED',
        details: { anio: periodo.anio, mes: periodo.mes },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      const fileName = `informe-mensual-${periodo.anio}-${String(periodo.mes).padStart(2, '0')}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
};
