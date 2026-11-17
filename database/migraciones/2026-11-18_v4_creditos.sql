-- MIGRACIÓN V4 — Créditos y Convenios
-- Para bases YA INSTALADAS. Aplicar JUNTO con el código de V4.
-- phpMyAdmin > seleccionar la base > pestaña SQL > pegar y ejecutar UNA sola vez.
-- Recomendado: exportar un respaldo de la base antes (phpMyAdmin > Exportar).
-- No borra ni modifica los créditos existentes: solo agrega columnas y tablas.

SET NAMES utf8mb4;

-- 1. Código fijo de cada empresa (coincide con el nombre de la hoja de la planilla Maestra Créditos)
ALTER TABLE `convenios`
    ADD COLUMN `codigo` VARCHAR(20) NULL AFTER `id`,
    ADD COLUMN `orden` INT NOT NULL DEFAULT 0;

UPDATE `convenios` SET `codigo` = 'SOS', `orden` = 1 WHERE `nombre` = 'SOS';
UPDATE `convenios` SET `codigo` = 'ISIMUNDO', `orden` = 2 WHERE `nombre` = 'ISIMUNDO';
UPDATE `convenios` SET `codigo` = 'OPTICA', `orden` = 3 WHERE `nombre` IN ('Óptica', 'Optica');
UPDATE `convenios` SET `codigo` = 'DENTAL', `orden` = 4 WHERE `nombre` = 'Dental';
UPDATE `convenios` SET `codigo` = 'ABOGADA', `orden` = 5 WHERE `nombre` = 'Abogada';

ALTER TABLE `convenios` ADD UNIQUE KEY `uk_convenios_codigo` (`codigo`);

-- 2. Identificador de cada crédito dentro de la planilla (evita duplicarlo al subirla de nuevo)
--    ISIMUNDO: número de crédito. Resto: mes de la primera cuota (AAAA-MM).
--    fecha_finalizacion: un crédito pagado deja de mostrarse un mes después (decisión D4).
ALTER TABLE `creditos`
    ADD COLUMN `clave_carga` VARCHAR(40) NULL,
    ADD COLUMN `fecha_finalizacion` DATE NULL;

UPDATE `creditos` SET `clave_carga` = COALESCE(`numero_credito`, DATE_FORMAT(`fecha_otorgamiento`, '%Y-%m'));
UPDATE `creditos` SET `fecha_finalizacion` = `fecha_termino` WHERE `estado` = 'finalizado';

ALTER TABLE `creditos` ADD UNIQUE KEY `uk_creditos_carga` (`socia_id`, `convenio_id`, `clave_carga`);

-- Índice para ubicar las cuotas de un mes al verificar el pago
ALTER TABLE `cuotas_credito` ADD INDEX `idx_cuotas_periodo` (`anio_cobro`, `mes_cobro`, `estado`);

-- 3. Cargas de la planilla Maestra Créditos (día 18). Cada archivo se conserva, nunca se sobrescribe.
CREATE TABLE IF NOT EXISTS `cargas_creditos` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `mes` INT NOT NULL,
    `anio` INT NOT NULL,
    `archivo_original` VARCHAR(255) NOT NULL,
    `archivo_guardado` VARCHAR(255) NOT NULL,
    `subido_por` VARCHAR(150) NOT NULL,
    `creditos_nuevos` INT NOT NULL DEFAULT 0,
    `creditos_actualizados` INT NOT NULL DEFAULT 0,
    `sin_cambios` INT NOT NULL DEFAULT 0,
    `con_error` INT NOT NULL DEFAULT 0,
    `detalle` LONGTEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_cargas_creditos_periodo` (`anio`, `mes`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 4. Pago mensual a cada empresa: monto a pagar (planilla del 18) y pago verificado con comprobante (días 1 al 5)
CREATE TABLE IF NOT EXISTS `pagos_convenio` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `convenio_id` INT NOT NULL,
    `mes` INT NOT NULL,
    `anio` INT NOT NULL,
    `monto_a_pagar` INT NOT NULL DEFAULT 0,
    `carga_id` INT NULL,
    `monto_pagado` INT NULL,
    `cuotas_descontadas` INT NULL,
    `comprobante_original` VARCHAR(255) NULL,
    `comprobante_guardado` VARCHAR(255) NULL,
    `comprobante_mime` VARCHAR(100) NULL,
    `verificado_por` VARCHAR(150) NULL,
    `verificado_at` DATETIME NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_pago_convenio_periodo` (`convenio_id`, `anio`, `mes`),
    CONSTRAINT `fk_pagos_convenio` FOREIGN KEY (`convenio_id`) REFERENCES `convenios` (`id`),
    CONSTRAINT `fk_pagos_carga` FOREIGN KEY (`carga_id`) REFERENCES `cargas_creditos` (`id`) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Comprobación: deben verse las 5 empresas con su código
SELECT `id`, `codigo`, `nombre`, `orden` FROM `convenios` ORDER BY `orden`;
