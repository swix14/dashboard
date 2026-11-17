import { Router } from 'express';
import authRoutes from './authRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import treasuryRoutes from './treasuryRoutes.js';
import sociaRoutes from './sociaRoutes.js';
import sociaPortalRoutes from './sociaPortalRoutes.js';
import reporteRoutes from './reporteRoutes.js';
import creditRoutes from './creditRoutes.js';
import { requireDatabase } from '../middlewares/databaseMiddleware.js';
import { getDatabaseStatus, waitForDatabase } from '../config/db.js';

const router = Router();

// Healthcheck público: solo indica si la API está viva y conectada a MySQL
router.get('/health', async (req, res) => {
  await waitForDatabase();
  // Respuesta mínima (auditoría H-010): sin nombre del sistema ni códigos de error de MySQL.
  // El detalle del error queda solo en los logs del servidor.
  const { conectada } = getDatabaseStatus();
  res.status(200).json({ status: 'ok', database: { conectada } });
});

// Todas las rutas de negocio necesitan la base de datos (o el modo memoria en desarrollo)
router.use(requireDatabase);

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/tesoreria', treasuryRoutes);
router.use('/socias', sociaRoutes);
router.use('/socia', sociaPortalRoutes);
router.use('/reportes', reporteRoutes);
router.use('/creditos', creditRoutes);

export default router;
