import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { createLoginLimiter } from '../middlewares/loginLimiter.js';

const router = Router();

router.post('/login', createLoginLimiter({ campo: 'identifier' }), AuthController.login);
router.post('/logout', authMiddleware, AuthController.logout);
router.get('/me', authMiddleware, AuthController.getMe);
router.post('/cambiar-clave', authMiddleware, AuthController.changePassword);

export default router;
