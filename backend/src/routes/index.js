import { Router } from 'express';
import authRoutes from './authRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import treasuryRoutes from './treasuryRoutes.js';
import sociaRoutes from './sociaRoutes.js';
import sociaPortalRoutes from './sociaPortalRoutes.js';
import { requireDatabase } from '../middlewares/databaseMiddleware.js';
import { getDatabaseStatus, waitForDatabase } from '../config/db.js';

const router = Router();

// Healthcheck: indica además si la API está conectada a MySQL (diagnóstico de despliegue)
router.get('/health', async (req, res) => {
  await waitForDatabase();
  const database = getDatabaseStatus();
  res.status(200).json({
    status: 'ok',
    system: 'Sistema Web de Gestión — Asociación de Jardines VTF',
    database,
    timestamp: new Date().toISOString()
  });
});

// Todas las rutas de negocio necesitan la base de datos (o el modo memoria en desarrollo)
router.use(requireDatabase);

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/tesoreria', treasuryRoutes);
router.use('/socias', sociaRoutes);
router.use('/socia', sociaPortalRoutes);

export default router;
