import { Router } from 'express';
import { ReporteController } from '../controllers/reporteController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

const router = Router();

// Informe mensual de cuentas: toda la directiva y las delegadas (ellas solo ven y exportan, no modifican nada)
router.use(authMiddleware, requireRole('ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA', 'DELEGADA'));

router.get('/mensual', ReporteController.getInformeMensual);
router.get('/mensual/excel', ReporteController.exportarInformeMensual);
// Balance Anual en PDF: solo cifras consolidadas, sin socias ni deudas individuales
router.get('/anual/pdf', ReporteController.exportarBalanceAnualPdf);

export default router;
