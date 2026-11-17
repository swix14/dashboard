import { Router } from 'express';
import { SociaController } from '../controllers/sociaController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { validateIdParam } from '../middlewares/validateIdParam.js';
import { uploadPlanilla } from '../middlewares/uploadMiddleware.js';

const router = Router();

// Todas las rutas del padrón requieren sesión activa
router.use(authMiddleware);

// Consulta del padrón: Directiva completa (Directora incluida por gestión de convenios/créditos)
const canView = requireRole('ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA');

// Alta, modificación, retiro y carga de planilla: Admin, Presidenta, Tesorera, Secretaria
// y Directora (tiene los mismos permisos que la Secretaria desde el 16-11-2026)
const canModify = requireRole('ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA');

router.get('/resumen', canView, SociaController.getSummary);
router.get('/jardines', canView, SociaController.getJardines);

// Carga mensual de la planilla Maestra Socias (antes de /:id para no confundirse con un id)
router.get('/importar/historial', canModify, SociaController.historialCargas);
router.post('/importar/previsualizar', canModify, uploadPlanilla('planilla'), SociaController.previsualizarPlanilla);
router.post('/importar/aplicar', canModify, uploadPlanilla('planilla'), SociaController.aplicarPlanilla);

router.get('/', canView, SociaController.getSocias);
router.get('/:id', canView, validateIdParam, SociaController.getSociaById);

router.post('/', canModify, SociaController.createSocia);
router.put('/:id', canModify, validateIdParam, SociaController.updateSocia);
router.delete('/:id', canModify, validateIdParam, SociaController.retirarSocia);
router.post('/:id/restablecer-clave', canModify, validateIdParam, SociaController.restablecerClave);

export default router;
