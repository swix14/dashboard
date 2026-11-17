-- MIGRACIÓN — Corrección de movimientos de Tesorería (editar y anular)
-- Para bases YA INSTALADAS. Aplicar JUNTO con el código, después de 2026-11-19_creditos_manual.sql.
-- phpMyAdmin > seleccionar la base > pestaña SQL > pegar y ejecutar UNA sola vez.
-- No borra ni modifica movimientos: todos quedan vigentes (anulado = 0).

SET NAMES utf8mb4;

-- Un movimiento anulado se conserva en el libro (transparencia ante la comisión revisadora)
-- pero deja de sumar en los saldos, el Inicio y el informe mensual.
ALTER TABLE `movimientos_tesoreria`
    ADD COLUMN `anulado` TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN `motivo_anulacion` VARCHAR(255) NULL,
    ADD COLUMN `anulado_por` VARCHAR(150) NULL,
    ADD COLUMN `anulado_at` DATETIME NULL,
    ADD COLUMN `editado_por` VARCHAR(150) NULL,
    ADD COLUMN `editado_at` DATETIME NULL;

-- Comprobación: debe mostrar la columna nueva
SHOW COLUMNS FROM `movimientos_tesoreria` LIKE 'anulado';
