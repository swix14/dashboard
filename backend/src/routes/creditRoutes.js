import { Router } from 'express';
import { CreditController } from '../controllers/creditController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { validateIdParam } from '../middlewares/validateIdParam.js';
import { uploadPlanilla, uploadComprobantesEmpresas } from '../middlewares/uploadMiddleware.js';
import { CODIGOS_EMPRESA } from '../validators/creditValidator.js';

const router = Router();
router.use(authMiddleware);

// Ver créditos: Admin, Presidenta (solo lectura) y Tesorera. La Directora queda fuera hasta que
// la directiva defina su acceso a los convenios.
const canView = requireRole('ADMIN', 'PRESIDENTA', 'TESORERA');
// Cargar la planilla del día 18 y verificar los pagos: Admin y Tesorera
const canManage = requireRole('ADMIN', 'TESORERA');

router.get('/resumen', canView, CreditController.getResumen);
router.get('/grafico', canView, CreditController.getGrafico);
router.get('/periodo', canView, CreditController.getPeriodo);
router.get('/importar/historial', canView, CreditController.historialCargas);
router.post('/importar/previsualizar', canManage, uploadPlanilla('planilla'), CreditController.previsualizar);
router.post('/importar/aplicar', canManage, uploadPlanilla('planilla'), CreditController.aplicar);
router.post('/pagos/verificar', canManage, uploadComprobantesEmpresas(CODIGOS_EMPRESA), CreditController.verificarPagos);
router.get('/pagos/:id/comprobante', canView, validateIdParam, CreditController.descargarComprobante);

router.get('/', canView, CreditController.getCreditos);
router.get('/:id', canView, validateIdParam, CreditController.getCredito);

export default router;
