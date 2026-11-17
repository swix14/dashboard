-- MIGRACIÓN — Solicitudes S.O.S en línea desde el portal de socias
-- Para bases YA INSTALADAS. Aplicar ANTES de subir el código, después de 2026-11-21_comision_isimundo.sql.
-- phpMyAdmin > seleccionar la base > pestaña SQL > pegar y ejecutar UNA sola vez.

SET NAMES utf8mb4;

-- La socia pide el S.O.S desde su portal; Admin o Tesorera lo aprueban (crea el crédito S.O.S) o lo rechazan con motivo.
-- Nombre, RUT y jardín se guardan como estaban al pedirlo.
CREATE TABLE IF NOT EXISTS `solicitudes_sos` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `socia_id` INT NOT NULL,
    `socia_rut` VARCHAR(12) NOT NULL,
    `socia_nombre` VARCHAR(200) NOT NULL,
    `socia_jardin` VARCHAR(150) NULL,
    `monto` INT NOT NULL,
    `cuotas` TINYINT NOT NULL,
    `motivo` TEXT NOT NULL,
    `estado` ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
    `respuesta` VARCHAR(255) NULL,
    `revisado_por` VARCHAR(150) NULL,
    `revisado_at` DATETIME NULL,
    `credito_id` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sos_estado` (`estado`, `created_at`),
    INDEX `idx_sos_socia` (`socia_id`),
    CONSTRAINT `fk_sos_socia` FOREIGN KEY (`socia_id`) REFERENCES `socias` (`id`),
    CONSTRAINT `fk_sos_credito` FOREIGN KEY (`credito_id`) REFERENCES `creditos` (`id`) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Comprobación: debe mostrar la tabla vacía
SELECT COUNT(*) AS solicitudes FROM `solicitudes_sos`;
