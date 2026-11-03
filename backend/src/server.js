import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { errorMiddleware } from './middlewares/errorMiddleware.js';

const app = express();

// Configuración segura de orígenes permitidos (CORS)
const allowedOrigins = [
  env.CORS_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000'
].filter(Boolean);

// Middlewares de seguridad y observabilidad
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (como Postman/curl o tareas de servidor)
      if (!origin) {
        return callback(null, true);
      }
      // Permitir orígenes de desarrollo local
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
      // Validar contra la lista blanca configurada en entorno
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Acceso bloqueado por política CORS: origen ${origin} no autorizado.`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Montaje de rutas API
app.use('/api', apiRouter);

// Manejador para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Middleware global de errores
app.use(errorMiddleware);

import { fileURLToPath } from 'node:url';

// Iniciar servidor solo si es ejecutado directamente como proceso principal (no cuando es importado en tests)
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule && process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    console.log(`====================================================`);
    console.log(` ASOCIACIÓN DE JARDINES VTF — BACKEND API INICIADO `);
    console.log(`====================================================`);
    console.log(` Entorno: ${env.NODE_ENV}`);
    console.log(` Puerto:  ${env.PORT}`);
    console.log(` URL:     http://localhost:${env.PORT}/api/health`);
    console.log(`====================================================`);
  });
}

export default app;
