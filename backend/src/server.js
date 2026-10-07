import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { errorMiddleware } from './middlewares/errorMiddleware.js';

const app = express();

// Middlewares de seguridad y observabilidad
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (como Postman/curl o apps móviles) y orígenes de Vite
      if (!origin || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(null, true);
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

// Iniciar servidor solo si no es importado en tests
if (process.env.NODE_ENV !== 'test') {
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
