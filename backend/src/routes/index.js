import { Router } from 'express';
import authRoutes from './authRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';

const router = Router();

// Healthcheck endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    system: 'Sistema Web de Gestión — Asociación de Jardines VTF',
    timestamp: new Date().toISOString()
  });
});

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
