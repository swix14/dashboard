import { Router } from 'express';
import { CreditController } from '../controllers/creditController.js';
import { SosController } from '../controllers/sosController.js';
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
// Monto a pagar a mano (mes sin planilla o corrección), antes de verificar el pago
router.put('/periodo/a-pagar', canManage, CreditController.definirAPagar);
router.get('/importar/historial', canView, CreditController.historialCargas);
// Liquidación mensual para el empleador (cuota social + convenios por socia)
router.get('/liquidacion', canView, CreditController.getLiquidacion);
router.get('/liquidacion/excel', canView, CreditController.exportarLiquidacion);
router.post('/importar/previsualizar', canManage, uploadPlanilla('planilla'), CreditController.previsualizar);
router.post('/importar/aplicar', canManage, uploadPlanilla('planilla'), CreditController.aplicar);
router.post('/pagos/verificar', canManage, uploadComprobantesEmpresas(CODIGOS_EMPRESA), CreditController.verificarPagos);
router.get('/pagos/:id/comprobante', canView, validateIdParam, CreditController.descargarComprobante);
// Comisión de Isi Mundo: % ajustable y registro como ingreso en Tesorería
router.get('/comision', canView, CreditController.getComision);
router.put('/comision', canManage, CreditController.setComision);
router.post('/pagos/:id/comision', canManage, validateIdParam, CreditController.registrarComision);

// Solicitudes S.O.S que envían las socias desde su portal: aprobar crea el crédito S.O.S
router.get('/sos', canView, SosController.listar);
router.post('/sos/:id/aprobar', canManage, validateIdParam, SosController.aprobar);
router.post('/sos/:id/rechazar', canManage, validateIdParam, SosController.rechazar);

router.get('/', canView, CreditController.getCreditos);
router.get('/:id', canView, validateIdParam, CreditController.getCredito);

// Créditos a mano (sin planilla): nuevo, editar, anular y prepago. Admin y Tesorera
router.post('/', canManage, CreditController.crear);
router.put('/:id', canManage, validateIdParam, CreditController.editar);
router.post('/:id/anular', canManage, validateIdParam, CreditController.anular);
router.post('/:id/prepago', canManage, validateIdParam, CreditController.prepagar);

export default router;
