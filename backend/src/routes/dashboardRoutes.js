import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

const router = Router();

// Todas las rutas del dashboard requieren sesión activa
router.use(authMiddleware);

// Métricas adaptadas al rol
router.get('/metrics', DashboardController.getMetrics);

// Auditoría reciente (restringida a Directiva: Presidenta, Tesorera, Secretaria)
router.get(
  '/audit-recent',
  requireRole('PRESIDENTA', 'TESORERA', 'SECRETARIA'),
  DashboardController.getRecentAudit
);

export default router;
