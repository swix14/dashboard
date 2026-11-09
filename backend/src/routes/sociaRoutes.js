import { Router } from 'express';
import { SociaController } from '../controllers/sociaController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { uploadPlanilla } from '../middlewares/uploadMiddleware.js';

const router = Router();

// Todas las rutas del padrón requieren sesión activa
router.use(authMiddleware);

// Consulta del padrón: Directiva completa (Directora incluida por gestión de convenios/créditos)
const canView = requireRole('ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA');

// Alta, modificación, retiro y carga de planilla: Admin, Presidenta, Tesorera y Secretaria
const canModify = requireRole('ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA');

router.get('/resumen', canView, SociaController.getSummary);
router.get('/jardines', canView, SociaController.getJardines);

// Carga mensual de la planilla Maestra Socias (antes de /:id para no confundirse con un id)
router.get('/importar/historial', canModify, SociaController.historialCargas);
router.post('/importar/previsualizar', canModify, uploadPlanilla('planilla'), SociaController.previsualizarPlanilla);
router.post('/importar/aplicar', canModify, uploadPlanilla('planilla'), SociaController.aplicarPlanilla);

router.get('/', canView, SociaController.getSocias);
router.get('/:id', canView, SociaController.getSociaById);

router.post('/', canModify, SociaController.createSocia);
router.put('/:id', canModify, SociaController.updateSocia);
router.delete('/:id', canModify, SociaController.retirarSocia);

export default router;
