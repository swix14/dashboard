import { Router } from 'express';
import { SociaPortalController } from '../controllers/sociaPortalController.js';
import { SosController } from '../controllers/sosController.js';
import { ReporteController } from '../controllers/reporteController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { createLoginLimiter } from '../middlewares/loginLimiter.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { uploadComprobante } from '../middlewares/uploadMiddleware.js';
import { validateIdParam } from '../middlewares/validateIdParam.js';

const router = Router();

// Noticias y buzón los gestionan Admin, Presidenta, Secretaria y Directora (pedido de la directiva, 16-11-2026)
const canComunicar = requireRole('ADMIN', 'PRESIDENTA', 'SECRETARIA', 'DIRECTORA');

// 1. Acceso y autenticación de socias
router.post('/login', createLoginLimiter({ campo: 'rut' }), SociaPortalController.login);
router.post('/cambiar-clave', authMiddleware, SociaPortalController.cambiarClave);

// 2. Noticias y comunicados gremiales
router.get('/noticias', SociaPortalController.getNoticias);
router.post('/noticias', authMiddleware, canComunicar, SociaPortalController.createNoticia);
router.delete('/noticias/:id', authMiddleware, canComunicar, validateIdParam, SociaPortalController.deleteNoticia);

const soloSocia = requireRole('SOCIA');

// 3. Buzón de Socias (Sugerencias, Reclamos, Felicitaciones, Consultas): solo las socias escriben
// (el rol se revisa antes de recibir el adjunto, para no guardar archivos de quien no puede enviar)
router.post('/buzon', authMiddleware, soloSocia, uploadComprobante('adjunto'), SociaPortalController.enviarMensajeBuzon);
router.get('/buzon/mis-mensajes', authMiddleware, SociaPortalController.getMisMensajes);
router.get('/buzon/admin', authMiddleware, canComunicar, SociaPortalController.getBuzonAdmin);
router.patch('/buzon/:id/estado', authMiddleware, canComunicar, validateIdParam, SociaPortalController.cambiarEstadoBuzon);
router.get('/buzon/:id/adjunto', authMiddleware, canComunicar, validateIdParam, SociaPortalController.descargarAdjuntoBuzon);

// 4. Solicitudes S.O.S en línea (solo la socia; la directiva las revisa en /api/creditos/sos)
router.post('/sos', authMiddleware, soloSocia, SosController.solicitar);
router.get('/sos', authMiddleware, soloSocia, SosController.misSolicitudes);

// 5. "Mi jardín": cifras de su establecimiento para la socia marcada como delegada en el padrón
router.get('/mi-jardin', authMiddleware, soloSocia, ReporteController.getMiJardin);

export default router;
