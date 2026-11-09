import test from 'node:test';
import assert from 'node:assert';
import { createServer } from 'node:http';
import express from 'express';
import apiRouter from '../src/routes/index.js';
import { errorMiddleware } from '../src/middlewares/errorMiddleware.js';
import { isDatabaseReady, pool, query, waitForDatabase } from '../src/config/db.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiRouter);
app.use(errorMiddleware);

const server = createServer(app);

test('Suite de Pruebas: Portal Diferenciado de Socias y Buzón', async (t) => {
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  // Socia de prueba en estado de primer ingreso (antes y después: la suite es repetible)
  await waitForDatabase();
  const resetSociaDePrueba = async () => {
    if (isDatabaseReady()) {
      await query("UPDATE socias SET password = NULL, primer_ingreso = 1 WHERE rut = '20.081.109-7'");
    }
  };
  await resetSociaDePrueba();

  t.after(async () => {
    await resetSociaDePrueba();
    server.close();
    // Cerrar el pool en vez de process.exit: así no se ocultan fallos ni se corta libuv en Windows
    await pool?.end().catch(() => {});
  });

  let sociaToken = '';
  let sociaData = null;

  // 1. Obtener noticias públicas de socias
  await t.test('GET /api/socia/noticias retorna lista de avisos oficiales', async () => {
    const res = await fetch(`${baseUrl}/socia/noticias`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 3);
  });

  // 2. Login con contraseña inicial (primeros 6 dígitos de RUT)
  await t.test('POST /api/socia/login con RUT y clave inicial de 6 dígitos', async () => {
    const res = await fetch(`${baseUrl}/socia/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rut: '20.081.109-7',
        password: '200811' // Primeros 6 dígitos del cuerpo 20081109
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.token);
    assert.strictEqual(body.data.socia.rut, '20.081.109-7');
    sociaToken = body.data.token;
    sociaData = body.data.socia;
  });

  // 3. Login con contraseña incorrecta retorna error
  await t.test('POST /api/socia/login con contraseña incorrecta retorna 401', async () => {
    const res = await fetch(`${baseUrl}/socia/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rut: '20.081.109-7',
        password: 'clave_falsa_123'
      })
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  // 3b. Con la clave inicial, el servidor bloquea todo salvo el cambio de clave (solo verificable con MySQL)
  await t.test('POST /api/socia/buzon bloqueado con 403 hasta cambiar la clave inicial', async (st) => {
    if (!isDatabaseReady()) return st.skip('requiere MySQL');
    const res = await fetch(`${baseUrl}/socia/buzon/mis-mensajes`, {
      headers: { Authorization: `Bearer ${sociaToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.code, 'PASSWORD_CHANGE_REQUIRED');
  });

  // 4. Cambiar contraseña obligatoria
  await t.test('POST /api/socia/cambiar-clave actualiza contraseña con bcrypt', async () => {
    const res = await fetch(`${baseUrl}/socia/cambiar-clave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sociaToken}`
      },
      body: JSON.stringify({
        nuevaClave: 'MiNuevaClaveSegura2026'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.socia.primerIngreso, false);
  });

  // 4b. Tras cambiarla, la clave inicial ya no sirve y la personal sí
  await t.test('POST /api/socia/login rechaza la clave inicial después del cambio', async () => {
    const res = await fetch(`${baseUrl}/socia/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut: '20.081.109-7', password: '200811' })
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('POST /api/socia/login acepta la clave personal sin pedir nuevo cambio', async () => {
    const res = await fetch(`${baseUrl}/socia/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut: '20.081.109-7', password: 'MiNuevaClaveSegura2026' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.socia.primerIngreso, false);
  });

  // 5. Enviar mensaje al Buzón de Socias
  await t.test('POST /api/socia/buzon permite remitir consulta a la directiva', async () => {
    const formData = new FormData();
    formData.append('tipo', 'Consultas');
    formData.append('asunto', 'Consulta sobre bono de escolaridad y asamblea');
    formData.append('mensaje', 'Estimada directiva: Deseo consultar fecha de acreditación.');

    const res = await fetch(`${baseUrl}/socia/buzon`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sociaToken}`
      },
      body: formData
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.asunto, 'Consulta sobre bono de escolaridad y asamblea');
  });

  // 6. Consultar mis mensajes enviados
  await t.test('GET /api/socia/buzon/mis-mensajes devuelve el historial de la socia', async () => {
    const res = await fetch(`${baseUrl}/socia/buzon/mis-mensajes`, {
      headers: {
        Authorization: `Bearer ${sociaToken}`
      }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
  });
});
