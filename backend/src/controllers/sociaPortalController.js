import { SociaAuthService } from '../services/sociaAuthService.js';
import { NoticiasService } from '../services/noticiasService.js';
import { BuzonService } from '../services/buzonService.js';
import fs from 'node:fs';
import path from 'node:path';
import { AuditService } from '../services/auditService.js';
import { SessionService } from '../services/sessionService.js';
import { resolveUploadPath } from '../middlewares/uploadMiddleware.js';
import {
  noticiaSchema,
  estadoBuzonSchema,
  idParamSchema,
  sociaLoginSchema,
  sociaCambiarClaveSchema,
  buzonMensajeSchema
} from '../validators/portalValidator.js';

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

function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

export const SociaPortalController = {
  /**
   * Inicio de sesión exclusivo para socias
   */
  async login(req, res, next) {
    try {
      const parsed = sociaLoginSchema.safeParse(req.body || {});
      if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message || 'Debe ingresar RUT y contraseña.');
      const data = await SociaAuthService.loginSocia(parsed.data);
      res.json({
        success: true,
        message: 'Acceso concedido al Portal de Socias.',
        data
      });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      next(err);
    }
  },

  /**
   * Cambio de contraseña de la socia (obligatorio en primer ingreso o voluntario)
   */
  async cambiarClave(req, res, next) {
    try {
      const rawId = req.user?.sociaId || req.user?.id;
      const cleanId = String(rawId || '').replace('socia-', '');

      // La directiva cambia su clave en /api/auth/cambiar-clave, nunca sobre la tabla socias
      if (!cleanId || req.user?.role?.code !== 'SOCIA') {
        return res.status(401).json({
          success: false,
          message: 'Sesión no válida o no identificada como socia.'
        });
      }

      const parsed = sociaCambiarClaveSchema.safeParse(req.body || {});
      if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message || 'Ingrese la nueva contraseña.');
      const result = await SociaAuthService.cambiarClave(
        cleanId,
        parsed.data.nuevaClave,
        req.user?.rut,
        parsed.data.claveActual
      );
      // Las demás sesiones abiertas de la socia dejan de valer (H-005)
      await SessionService.revokeOthers(req.user.id, req.session?.jti);

      res.json({
        success: true,
        message: result.message,
        data: {
          socia: {
            id: cleanId,
            primerIngreso: false
          }
        }
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err.message
      });
    }
  },

  /**
   * Listado de comunicados y noticias gremiales
   */
  async getNoticias(req, res, next) {
    try {
      const noticias = await NoticiasService.getNoticias();
      res.json({
        success: true,
        data: noticias
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Publicar una noticia (para Admin / Directiva)
   */
  async createNoticia(req, res, next) {
    try {
      const parsed = noticiaSchema.safeParse(req.body);
      if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message || 'Datos de la noticia inválidos');

      // role es un objeto { code, name }
      const autor =
        `${req.user.firstName} ${req.user.lastName || ''}`.trim() +
        ` (${req.user.role?.name || req.user.role?.code || 'Directiva'})`;
      const noticia = await NoticiasService.createNoticia({ ...parsed.data, autor });
      await audit(req, 'NOTICIA_PUBLISHED', { noticiaId: noticia.id, titulo: noticia.titulo });
      return res.status(201).json({ success: true, message: 'Noticia publicada exitosamente.', data: noticia });
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /api/socia/noticias/:id */
  async deleteNoticia(req, res, next) {
    try {
      const id = idParamSchema.safeParse(req.params.id);
      if (!id.success) return badRequest(res, 'Noticia inválida.');
      const existia = await NoticiasService.deleteNoticia(id.data);
      if (!existia) return res.status(404).json({ success: false, message: 'La noticia no existe.' });
      await audit(req, 'NOTICIA_DELETED', { noticiaId: id.data });
      return res.json({ success: true, message: 'Noticia eliminada.' });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/socia/buzon/:id/estado */
  async cambiarEstadoBuzon(req, res, next) {
    try {
      const id = idParamSchema.safeParse(req.params.id);
      if (!id.success) return badRequest(res, 'Mensaje inválido.');
      const parsed = estadoBuzonSchema.safeParse(req.body);
      if (!parsed.success) return badRequest(res, parsed.error.issues[0]?.message || 'Estado inválido');
      const existia = await BuzonService.cambiarEstado(id.data, parsed.data.estado);
      if (!existia) return res.status(404).json({ success: false, message: 'El mensaje no existe.' });
      await audit(req, 'BUZON_ESTADO_CHANGED', { mensajeId: id.data, estado: parsed.data.estado });
      return res.json({
        success: true,
        message: 'Estado del mensaje actualizado.',
        data: { id: id.data, estado: parsed.data.estado }
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/socia/buzon/:id/adjunto: descarga privada del archivo que adjuntó la socia */
  async descargarAdjuntoBuzon(req, res, next) {
    try {
      const id = idParamSchema.safeParse(req.params.id);
      if (!id.success) return badRequest(res, 'Mensaje inválido.');
      const mensaje = await BuzonService.getMensajeById(id.data);
      if (!mensaje || !mensaje.archivoAdjunto) {
        return res.status(404).json({ success: false, message: 'El mensaje no tiene archivo adjunto.' });
      }
      const filePath = resolveUploadPath(mensaje.archivoAdjunto);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'El archivo adjunto ya no se encuentra en el servidor.' });
      }
      await audit(req, 'BUZON_ADJUNTO_DOWNLOADED', { mensajeId: id.data });
      return res.download(filePath, `adjunto-buzon-${id.data}${path.extname(mensaje.archivoAdjunto).toLowerCase()}`);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Enviar mensaje al buzón de socias
   */
  async enviarMensajeBuzon(req, res, next) {
    try {
      const user = req.user;
      const parsed = buzonMensajeSchema.safeParse(req.body || {});
      if (!parsed.success) {
        // El adjunto ya quedó en disco: si el mensaje no es válido no debe quedar huérfano
        if (req.file) fs.rmSync(resolveUploadPath(req.file.filename), { force: true });
        return badRequest(res, parsed.error.issues[0]?.message || 'Mensaje inválido');
      }
      const { tipo, asunto, mensaje } = parsed.data;
      const archivoAdjunto = req.file ? req.file.filename : null;

      const nuevoMensaje = await BuzonService.crearMensaje({
        sociaId: user?.sociaId,
        sociaRut: user?.rut || 'Socia Anónima',
        sociaNombre: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Socia',
        sociaJardin: user?.jardin || 'Sin Jardín Especificado',
        tipo,
        asunto,
        mensaje,
        archivoAdjunto
      });

      res.status(201).json({
        success: true,
        message: 'Su mensaje ha sido enviado exitosamente a la directiva.',
        data: nuevoMensaje
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err.message
      });
    }
  },

  /**
   * Mis mensajes enviados (para la socia)
   */
  async getMisMensajes(req, res, next) {
    try {
      const rut = req.user?.rut;
      const mensajes = await BuzonService.getMensajesPorSocia(rut);
      res.json({
        success: true,
        data: mensajes
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Todos los mensajes del buzón (para la Directiva y Admin)
   */
  async getBuzonAdmin(req, res, next) {
    try {
      const mensajes = await BuzonService.getTodosLosMensajes();
      res.json({
        success: true,
        data: mensajes
      });
    } catch (err) {
      next(err);
    }
  }
};
