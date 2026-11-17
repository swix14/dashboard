import { Router } from 'express';
import { SociaPortalController } from '../controllers/sociaPortalController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { createLoginLimiter } from '../middlewares/loginLimiter.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { uploadComprobante } from '../middlewares/uploadMiddleware.js';

const router = Router();

// Noticias y buzón los gestionan Admin, Presidenta, Secretaria y Directora (pedido de la directiva, 16-11-2026)
const canComunicar = requireRole('ADMIN', 'PRESIDENTA', 'SECRETARIA', 'DIRECTORA');

// 1. Acceso y autenticación de socias
router.post('/login', createLoginLimiter({ campo: 'rut' }), SociaPortalController.login);
router.post('/cambiar-clave', authMiddleware, SociaPortalController.cambiarClave);

// 2. Noticias y comunicados gremiales
router.get('/noticias', SociaPortalController.getNoticias);
router.post('/noticias', authMiddleware, canComunicar, SociaPortalController.createNoticia);
router.delete('/noticias/:id', authMiddleware, canComunicar, SociaPortalController.deleteNoticia);

// 3. Buzón de Socias (Sugerencias, Reclamos, Felicitaciones, Consultas)
router.post('/buzon', authMiddleware, uploadComprobante('adjunto'), SociaPortalController.enviarMensajeBuzon);
router.get('/buzon/mis-mensajes', authMiddleware, SociaPortalController.getMisMensajes);
router.get('/buzon/admin', authMiddleware, canComunicar, SociaPortalController.getBuzonAdmin);
router.patch('/buzon/:id/estado', authMiddleware, canComunicar, SociaPortalController.cambiarEstadoBuzon);
router.get('/buzon/:id/adjunto', authMiddleware, canComunicar, SociaPortalController.descargarAdjuntoBuzon);

export default router;
