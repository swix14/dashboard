-- MIGRACIÓN — Comisión de Isi Mundo con porcentaje ajustable
-- Para bases YA INSTALADAS. Aplicar JUNTO con el código, después de 2026-11-20_tesoreria_correcciones.sql.
-- phpMyAdmin > seleccionar la base > pestaña SQL > pegar y ejecutar UNA sola vez.

SET NAMES utf8mb4;

-- 1. Parámetros del sistema que la directiva puede ajustar (por ahora, el % de comisión de Isi Mundo)
CREATE TABLE IF NOT EXISTS `configuracion` (
    `clave` VARCHAR(60) PRIMARY KEY,
    `valor` VARCHAR(255) NOT NULL,
    `actualizado_por` VARCHAR(150) NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

INSERT IGNORE INTO `configuracion` (`clave`, `valor`) VALUES ('comision_isimundo_pct', '2');

-- 2. Comisión calculada al verificar el pago de ISIMUNDO (con el % vigente ese día)
--    y el ingreso de Tesorería con que se registró
ALTER TABLE `pagos_convenio`
    ADD COLUMN `comision_pct` DECIMAL(5,2) NULL,
    ADD COLUMN `comision_monto` INT NULL,
    ADD COLUMN `comision_movimiento_id` INT NULL;

-- Los pagos de ISIMUNDO ya verificados quedan con el 2 % vigente hasta hoy
UPDATE `pagos_convenio` p JOIN `convenios` cv ON cv.id = p.convenio_id
SET p.comision_pct = 2, p.comision_monto = ROUND(p.monto_pagado * 2 / 100)
WHERE cv.codigo = 'ISIMUNDO' AND p.verificado_at IS NOT NULL AND p.comision_pct IS NULL;

-- Comprobación: debe mostrar el 2 %
SELECT * FROM `configuracion`;
