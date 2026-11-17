/**
 * Ejecutor de pruebas del backend.
 *
 * 1. Crea desde cero una base de prueba (por defecto `jardines_vtf_test`) con los scripts del
 *    repositorio: database.sql, data.sql y admin.sql. Nunca toca la base de desarrollo.
 * 2. Ejecuta cada suite en un proceso aparte apuntando a esa base.
 *
 * Uso:  npm test               (todas)
 *       node test/run.js socias (solo las suites cuyo nombre contiene "socias")
 *
 * Requiere MySQL/MariaDB local (XAMPP). Credenciales: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD del .env.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(testDir, '..');
const databaseDir = path.resolve(backendDir, '../database');
dotenv.config({ path: path.join(backendDir, '.env') });

const TEST_DB = process.env.DB_NAME_TEST || 'jardines_vtf_test';
if (!/^[\w]+_test$/.test(TEST_DB)) {
  console.error(`La base de pruebas debe terminar en "_test" (recibido: ${TEST_DB}). Se cancela por seguridad.`);
  process.exit(1);
}

const SUITES = [
  'authTest.js',
  'sociasTest.js',
  'padronImportTest.js',
  'creditosTest.js',
  'comprobantesTest.js',
  'treasuryPersistenceTest.js',
  'sociaPortalTest.js',
  'sosTest.js',
  'bloqueantesTest.js',
  'accesosTest.js'
];

async function prepararBase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    charset: 'utf8mb4'
  });
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await connection.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${TEST_DB}\``);
    for (const file of ['database.sql', 'data.sql', 'admin.sql']) {
      await connection.query(fs.readFileSync(path.join(databaseDir, file), 'utf8'));
    }
    // Las suites inician sesión con la clave inicial: se omite el cambio obligatorio de primer ingreso
    await connection.query('UPDATE administradores SET primer_ingreso = 0');
    // admin.sql deja desactivada la delegada de demostración; las suites la usan para probar permisos
    await connection.query("UPDATE administradores SET activo = 1 WHERE correo = 'delegada@vtftemuco.cl'");
  } finally {
    await connection.end();
  }
}

const filtro = process.argv[2];
const suites = SUITES.filter((s) => !filtro || s.toLowerCase().includes(filtro.toLowerCase()));

try {
  await prepararBase();
} catch (err) {
  console.error(`No se pudo preparar la base de pruebas "${TEST_DB}": ${err.message}`);
  console.error('¿Está encendido MySQL (XAMPP)?');
  process.exit(1);
}
console.log(`Base de pruebas lista: ${TEST_DB}\n`);

for (const suite of suites) {
  console.log(`▶ ${suite}`);
  const result = spawnSync(process.execPath, [path.join(testDir, suite)], {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, DB_NAME: TEST_DB, NODE_ENV: 'test' }
  });
  if (result.status !== 0) {
    console.error(`\n✗ La suite ${suite} falló (código ${result.status}).`);
    process.exit(result.status || 1);
  }
}
console.log(`\n✓ ${suites.length} suites aprobadas.`);
