import { SociaAuthService } from '../services/sociaAuthService.js';
import { NoticiasService } from '../services/noticiasService.js';
import { BuzonService } from '../services/buzonService.js';

export const SociaPortalController = {
  /**
   * Inicio de sesión exclusivo para socias
   */
  async login(req, res, next) {
    try {
      const { rut, password } = req.body;
      if (!rut || !password) {
        return res.status(400).json({
          success: false,
          message: 'Debe ingresar RUT y contraseña.'
        });
      }
      const data = await SociaAuthService.loginSocia({ rut, password });
      res.json({
        success: true,
        message: 'Acceso concedido al Portal de Socias.',
        data
      });
    } catch (err) {
      res.status(401).json({
        success: false,
        message: err.message
      });
    }
  },

  /**
   * Cambio de contraseña de la socia (obligatorio en primer ingreso o voluntario)
   */
  async cambiarClave(req, res, next) {
    try {
      const rawId = req.user?.sociaId || req.user?.id;
      const cleanId = String(rawId || '').replace('socia-', '');

      if (!cleanId) {
        return res.status(401).json({
          success: false,
          message: 'Sesión no válida o no identificada como socia.'
        });
      }

      const { nuevaClave } = req.body;
      const result = await SociaAuthService.cambiarClave(cleanId, nuevaClave);

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
      const { titulo, contenido, categoria, destacado } = req.body;
      const autor = req.user ? `${req.user.firstName} (${req.user.role})` : 'Directiva VTF';
      const noticia = await NoticiasService.createNoticia({
        titulo,
        contenido,
        categoria,
        destacado,
        autor
      });
      res.status(201).json({
        success: true,
        message: 'Noticia publicada exitosamente.',
        data: noticia
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err.message
      });
    }
  },

  /**
   * Enviar mensaje al buzón de socias
   */
  async enviarMensajeBuzon(req, res, next) {
    try {
      const user = req.user;
      const { tipo, asunto, mensaje } = req.body;
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
