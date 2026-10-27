import { Router } from 'express';
import { SociaController } from '../controllers/sociaController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

const router = Router();

// Todas las rutas del padrón requieren sesión activa
router.use(authMiddleware);

// Consulta del padrón: Directiva completa (Directora incluida por gestión de convenios/créditos)
const canView = requireRole('ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA');

// Alta y modificación de socias: Admin, Presidenta, Tesorera y Secretaria
const canModify = requireRole('ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA');

router.get('/resumen', canView, SociaController.getSummary);
router.get('/jardines', canView, SociaController.getJardines);
router.get('/', canView, SociaController.getSocias);
router.get('/:id', canView, SociaController.getSociaById);

router.post('/', canModify, SociaController.createSocia);
router.put('/:id', canModify, SociaController.updateSocia);

export default router;
