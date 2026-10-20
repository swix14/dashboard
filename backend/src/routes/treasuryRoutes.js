import { Router } from 'express';
import { TreasuryController } from '../controllers/treasuryController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

const router = Router();

// Todas las rutas de tesorería requieren sesión activa
router.use(authMiddleware);

// Consulta de resumen y movimientos: permitida para Directiva (incluida Presidenta para supervisión)
router.get(
  '/resumen',
  requireRole('ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA'),
  TreasuryController.getSummary
);

router.get(
  '/movimientos',
  requireRole('ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA'),
  TreasuryController.getMovements
);

// Creación de movimientos: EXCLUSIVO para Tesorera y Admin (Presidenta: SOLO VER)
router.post(
  '/movimientos',
  requireRole('ADMIN', 'TESORERA'),
  TreasuryController.createMovement
);

export default router;
