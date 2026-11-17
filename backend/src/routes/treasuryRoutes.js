import { Router } from 'express';
import { TreasuryController } from '../controllers/treasuryController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { validateIdParam } from '../middlewares/validateIdParam.js';
import { uploadComprobante } from '../middlewares/uploadMiddleware.js';

const router = Router();

// Todas las rutas de tesorería requieren sesión activa
router.use(authMiddleware);

// Consulta de resumen y movimientos: Admin, Presidenta y Tesorera.
// Secretaria y Directora sin acceso a Tesorería (pedido de la directiva, 16-11-2026)
router.get(
  '/resumen',
  requireRole('ADMIN', 'PRESIDENTA', 'TESORERA'),
  TreasuryController.getSummary
);

router.get(
  '/movimientos',
  requireRole('ADMIN', 'PRESIDENTA', 'TESORERA'),
  TreasuryController.getMovements
);

router.get(
  '/movimientos/:id/comprobante',
  requireRole('ADMIN', 'PRESIDENTA', 'TESORERA'),
  validateIdParam,
  TreasuryController.downloadComprobante
);

// Creación de movimientos: EXCLUSIVO para Tesorera y Admin (Presidenta: SOLO VER)
// Acepta multipart/form-data con el archivo del comprobante en el campo "comprobante"
router.post(
  '/movimientos',
  requireRole('ADMIN', 'TESORERA'),
  uploadComprobante('comprobante'),
  TreasuryController.createMovement
);

export default router;
