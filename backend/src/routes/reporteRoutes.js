import { Router } from 'express';
import { ReporteController } from '../controllers/reporteController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { requireRoleODelegada } from '../middlewares/delegadaMiddleware.js';

const router = Router();

const DIRECTIVA = ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA'];

// Informe mensual y Balance Anual: la directiva y las delegadas (ellas solo ven y exportan, no modifican nada).
// Las delegadas entran con la cuenta DELEGADA de la consola o con su cuenta del portal si están marcadas en el padrón.
router.use(authMiddleware);
const directivaODelegada = requireRoleODelegada(...DIRECTIVA, 'DELEGADA');

router.get('/mensual', directivaODelegada, ReporteController.getInformeMensual);
router.get('/mensual/excel', directivaODelegada, ReporteController.exportarInformeMensual);
// Balance Anual en PDF: solo cifras consolidadas, sin socias ni deudas individuales
router.get('/anual/pdf', directivaODelegada, ReporteController.exportarBalanceAnualPdf);
// Cifras de los 23 jardines: solo la directiva (cada delegada ve su jardín en el portal)
router.get('/jardines', requireRole(...DIRECTIVA), ReporteController.getCifrasJardines);

export default router;
