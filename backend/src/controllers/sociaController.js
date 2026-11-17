import { SociaService } from '../services/sociaService.js';
import { PadronImportService } from '../services/padronImportService.js';
import { AuditService } from '../services/auditService.js';
import { SessionService } from '../services/sessionService.js';
import {
  createSociaSchema,
  updateSociaSchema,
  retirarSociaSchema,
  listSociasSchema
} from '../validators/sociaValidator.js';

function validationError(res, parsed) {
  const firstIssue = parsed.error.issues[0];
  return res.status(400).json({
    success: false,
    message: firstIssue?.message || 'Datos de socia inválidos',
    errors: parsed.error.format()
  });
}

// Ficha de crédito: solo Admin, Presidenta y Tesorera. La Secretaria y la Directora ven
// únicamente la ficha personal de la socia (pedido de la directiva, 16-11-2026).
export const CREDITO_ROLES = ['ADMIN', 'PRESIDENTA', 'TESORERA'];
const puedeVerCreditos = (req) => CREDITO_ROLES.includes(req.user?.role?.code);

// Quita del padrón todo dato de créditos para los roles sin acceso a la ficha de crédito
function sinCreditosEnListado(item) {
  const { tieneCredito, creditosActivos, ...personal } = item;
  return personal;
}
function sinCreditosEnFicha(socia) {
  const { creditos, descuentoMensualCreditos, ...personal } = socia;
  return personal;
}
function sinCreditosEnResumen(summary) {
  const { sociasConCredito, creditosVigentes, saldoCreditosPendiente, porTipoCredito, ...resto } = summary;
  return resto;
}

const responsable = (req) => `${req.user.firstName} ${req.user.lastName}`.trim();

function audit(req, action, details) {
  return AuditService.log({
    userId: req.user.id,
    rut: req.user.rut,
    action,
    details,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
}

export const SociaController = {
  /** GET /api/socias/resumen */
  async getSummary(req, res, next) {
    try {
      const summary = await SociaService.getSummary();
      const data = puedeVerCreditos(req) ? summary : sinCreditosEnResumen(summary);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/socias?search&jardinId&estado&cargo&credito&page&limit */
  async getSocias(req, res, next) {
    try {
      const parsed = listSociasSchema.safeParse(req.query);
      if (!parsed.success) return validationError(res, parsed);
      // Sin acceso a créditos tampoco se puede filtrar por crédito (revelaría quién tiene uno)
      const filtros = puedeVerCreditos(req) ? parsed.data : { ...parsed.data, credito: undefined };
      const result = await SociaService.getSocias(filtros);
      const items = puedeVerCreditos(req) ? result.items : result.items.map(sinCreditosEnListado);
      return res.status(200).json({ success: true, ...result, items, data: items });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/socias/jardines */
  async getJardines(req, res, next) {
    try {
      const jardines = await SociaService.getJardines();
      return res.status(200).json({ success: true, data: jardines });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/socias/:id */
  async getSociaById(req, res, next) {
    try {
      const socia = await SociaService.getSociaById(req.params.id);
      const data = puedeVerCreditos(req) ? socia : sinCreditosEnFicha(socia);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/socias */
  async createSocia(req, res, next) {
    try {
      const parsed = createSociaSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed);

      const created = await SociaService.createSocia(parsed.data);
      await audit(req, 'SOCIA_CREATED', { sociaId: created.id, rut: created.rut, jardin: created.jardin?.name });

      return res.status(201).json({
        success: true,
        message: 'Socia incorporada al padrón exitosamente',
        data: created
      });
    } catch (error) {
      next(error);
    }
  },

  /** PUT /api/socias/:id */
  async updateSocia(req, res, next) {
    try {
      const parsed = updateSociaSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed);

      const { socia, cambios } = await SociaService.updateSocia(req.params.id, parsed.data, responsable(req));

      if (Object.keys(cambios).length > 0) {
        await audit(req, cambios.jardinId ? 'SOCIA_TRANSFERRED' : 'SOCIA_UPDATED', {
          sociaId: socia.id,
          rut: socia.rut,
          cambios
        });
      }

      return res.status(200).json({
        success: true,
        message: Object.keys(cambios).length > 0 ? 'Ficha de socia actualizada' : 'Sin cambios que guardar',
        data: socia
      });
    } catch (error) {
      next(error);
    }
  },

  /** DELETE /api/socias/:id — baja lógica (RETIRADA), conserva créditos e historial */
  async retirarSocia(req, res, next) {
    try {
      const parsed = retirarSociaSchema.safeParse(req.body || {});
      if (!parsed.success) return validationError(res, parsed);

      const { socia, estadoAnterior } = await SociaService.retirarSocia(req.params.id, parsed.data.motivo);
      await audit(req, 'SOCIA_RETIRED', {
        sociaId: socia.id,
        rut: socia.rut,
        estadoAnterior,
        motivo: parsed.data.motivo
      });

      return res.status(200).json({ success: true, message: 'Socia retirada del padrón', data: socia });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/socias/:id/restablecer-clave — recuperación de clave hecha por la directiva */
  async restablecerClave(req, res, next) {
    try {
      const { id, rut } = await SociaService.restablecerClave(req.params.id);
      // Las sesiones que la socia tuviera abiertas dejan de valer
      await SessionService.revokeOthers(`socia-${id}`, null);
      await audit(req, 'SOCIA_PASSWORD_RESET', { sociaId: id, rut });
      return res.json({
        success: true,
        message: 'Clave restablecida. La socia entra con los 6 primeros dígitos de su RUT y debe crear una nueva.'
      });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/socias/importar/previsualizar (multipart, campo "planilla") */
  async previsualizarPlanilla(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'Adjunte la planilla Excel (.xlsx).' });
      const preview = await PadronImportService.previsualizar(req.file.buffer, req.file.originalname);
      return res.status(200).json({ success: true, data: preview });
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/socias/importar/aplicar (multipart, mismo archivo de la vista previa) */
  async aplicarPlanilla(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'Adjunte la planilla Excel (.xlsx).' });
      const result = await PadronImportService.aplicar(req.file.buffer, req.file.originalname, responsable(req));
      await audit(req, 'PADRON_IMPORTED', {
        cargaId: result.cargaId,
        archivo: req.file.originalname,
        ...result.resumen
      });
      return res.status(200).json({
        success: true,
        message: `Planilla aplicada: ${result.resumen.nuevas} nuevas y ${result.resumen.actualizadas} actualizadas.`,
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/socias/importar/historial */
  async historialCargas(req, res, next) {
    try {
      // Límite acotado a un entero entre 1 y 100 (auditoría H-019)
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
      const data = await PadronImportService.historial(limit);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
};
