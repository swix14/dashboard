-- MIGRACIÓN — Créditos ingresados a mano, anulación y prepago
-- Para bases YA INSTALADAS con la migración V4 (2026-11-18). Aplicar JUNTO con el código.
-- phpMyAdmin > seleccionar la base > pestaña SQL > pegar y ejecutar UNA sola vez.
-- No borra ni modifica los créditos existentes: todos quedan con origen PLANILLA.

SET NAMES utf8mb4;

-- 1. Origen del crédito (planilla del día 18 o ingresado a mano) y datos de la anulación
ALTER TABLE `creditos`
    ADD COLUMN `origen` ENUM('PLANILLA', 'MANUAL') NOT NULL DEFAULT 'PLANILLA',
    ADD COLUMN `motivo_anulacion` VARCHAR(255) NULL,
    ADD COLUMN `fecha_anulacion` DATE NULL;

-- 2. Cuotas que la socia pagó por adelantado (prepago del saldo)
ALTER TABLE `cuotas_credito`
    MODIFY COLUMN `estado` ENUM('pendiente', 'descontada', 'condonada', 'prepagada') DEFAULT 'pendiente';

-- Comprobación: debe mostrar las columnas nuevas
SHOW COLUMNS FROM `creditos` LIKE 'origen';
