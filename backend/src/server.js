import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { errorMiddleware } from './middlewares/errorMiddleware.js';

const app = express();

// cPanel (Passenger/LiteSpeed) atiende las peticiones detrás de un proxy
app.set('trust proxy', 1);

// Configuración segura de orígenes permitidos (CORS)
// En producción solo el dominio propio y CORS_ORIGIN (allowlist exacta, auditoría H-011);
// los orígenes localhost se aceptan únicamente en desarrollo y pruebas.
const IS_PRODUCTION = env.NODE_ENV === 'production';
const allowedOrigins = [
  env.CORS_ORIGIN,
  ...(IS_PRODUCTION ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'])
].filter(Boolean);

// Middlewares de seguridad y observabilidad
app.use(helmet());
app.use(
  // Variante con acceso a la petición para aceptar el mismo dominio que sirve la página
  // (en despliegue, frontend y API viven juntos en la misma app Node).
  cors((req, callback) => {
    const origin = req.headers.origin;
    const allow = (ok) =>
      callback(ok ? null : new Error(`Acceso bloqueado por política CORS: origen ${origin} no autorizado.`), {
        origin: ok,
        credentials: true
      });

    // Peticiones sin origen (Postman/curl o tareas de servidor)
    if (!origin) return allow(true);
    // Mismo dominio que sirve la aplicación
    try {
      if (new URL(origin).host === req.headers.host) return allow(true);
    } catch {
      return allow(false);
    }
    // Orígenes de desarrollo local (nunca en producción)
    if (!IS_PRODUCTION && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      return allow(true);
    }
    // Lista blanca configurada en entorno
    return allow(allowedOrigins.includes(origin));
  })
);
// Límite chico para JSON: los archivos viajan por multer, no en el cuerpo JSON (auditoría H-019/zod DoS)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Montaje de rutas API
app.use('/api', apiRouter);

// Rutas de API no encontradas
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Frontend compilado (carpeta public/ junto al backend en el paquete de despliegue)
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const indexHtml = path.join(publicDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
  // Cualquier otra ruta (/login, /socias, /socia/portal...) la resuelve React Router
  app.get('*', (req, res) => res.sendFile(indexHtml));
}

// Manejador para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Middleware global de errores
app.use(errorMiddleware);

// Iniciar servidor solo si es el proceso principal o lo arranca Passenger vía app.cjs
// (no cuando es importado en tests)
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const startedByLauncher = process.env.SIGAV_START === '1' || typeof globalThis.PhusionPassenger !== 'undefined';

if ((isMainModule || startedByLauncher) && process.env.NODE_ENV !== 'test') {
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
