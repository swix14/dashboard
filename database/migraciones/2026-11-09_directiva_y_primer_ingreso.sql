-- MIGRACIÓN 2026-11-09 — Directiva real y cambio de clave obligatorio
-- Para bases YA INSTALADAS en cPanel (importadas antes de esta fecha).
-- phpMyAdmin > seleccionar la base > pestaña SQL > pegar y ejecutar UNA sola vez.
-- Si el paso 1 responde "Duplicate column name 'primer_ingreso'", ya estaba aplicado:
-- ejecute solo los pasos 2 y 3.

-- 1. Marca de primer ingreso: obliga a crear una contraseña personal
ALTER TABLE `administradores`
    ADD COLUMN `primer_ingreso` TINYINT(1) NOT NULL DEFAULT 1;

-- 2. RUTs reales del padrón y correos oficiales @vtftemuco.cl
--    (antes había RUTs de ejemplo, por eso no se veía el jardín ni el cargo real)
UPDATE `administradores` SET `rut` = '17.260.651-2', `correo` = 'admin@vtftemuco.cl'      WHERE `rol` = 'Super_Admin';
UPDATE `administradores` SET `rut` = '16.947.343-9', `correo` = 'tesorera@vtftemuco.cl'   WHERE `rol` = 'Tesorera';
UPDATE `administradores` SET `rut` = '13.963.291-5', `correo` = 'presidenta@vtftemuco.cl' WHERE `rol` = 'Presidenta';
UPDATE `administradores` SET `rut` = '11.354.669-7', `correo` = 'secretaria@vtftemuco.cl' WHERE `rol` = 'Secretaria';
UPDATE `administradores` SET `rut` = '20.081.109-7', `correo` = 'directora@vtftemuco.cl'  WHERE `rol` = 'Directora';
UPDATE `administradores` SET `correo` = 'delegada@vtftemuco.cl'                            WHERE `rol` = 'Delegada' AND `rut` = '17.890.123-1';

-- 3. Quien siga con la clave inicial compartida deberá cambiarla en su próximo ingreso
UPDATE `administradores` SET `primer_ingreso` = 1;

-- Comprobación: deben verse 6 filas con primer_ingreso = 1 y los correos @vtftemuco.cl
SELECT `rut`, `nombres`, `correo`, `rol`, `activo`, `primer_ingreso` FROM `administradores`;
