-- MIGRACIÓN V3 — Padrón de socias 100% en MySQL
-- Para bases YA INSTALADAS (importadas antes de V3). Aplicar JUNTO con el código de V3:
-- el código anterior lee la columna socias.jardin, que esta migración reemplaza por jardin_id.
-- phpMyAdmin > seleccionar la base > pestaña SQL > pegar y ejecutar UNA sola vez.
-- Recomendado: exportar un respaldo de la base antes (phpMyAdmin > Exportar).

SET NAMES utf8mb4;

-- 1. Catálogo de jardines
CREATE TABLE IF NOT EXISTS `jardines` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `codigo` VARCHAR(10) NOT NULL UNIQUE,
    `nombre` VARCHAR(150) NOT NULL UNIQUE,
    `activo` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

INSERT IGNORE INTO `jardines` (`id`, `codigo`, `nombre`) VALUES
(1, 'J-01', 'Aillan Marillan'),
(2, 'J-02', 'Boyeco'),
(3, 'J-03', 'Cerro Ñielol'),
(4, 'J-04', 'Gabriela Mistral'),
(5, 'J-05', 'Javiera Carrera'),
(6, 'J-06', 'Lomas De Labranza'),
(7, 'J-07', 'Los Castaños'),
(8, 'J-08', 'Los Físicos'),
(9, 'J-09', 'Los Folkloristas'),
(10, 'J-10', 'Los Jardines de Labranza'),
(11, 'J-11', 'Los Músicos'),
(12, 'J-12', 'Los Organilleros'),
(13, 'J-13', 'Los Sembradores'),
(14, 'J-14', 'Los Sopranos'),
(15, 'J-15', 'Mañío Chico'),
(16, 'J-16', 'Parque Costanera'),
(17, 'J-17', 'Piamonte'),
(18, 'J-18', 'Pichicautin'),
(19, 'J-19', 'Quinto Centenario'),
(20, 'J-20', 'Sergio Gajardo'),
(21, 'J-21', 'Villa Los Ríos'),
(22, 'J-22', 'Vista Verde'),
(23, 'J-23', 'Volcán Lascar');

-- 2. Columnas nuevas de la socia
ALTER TABLE `socias`
    ADD COLUMN `jardin_id` INT NULL,
    ADD COLUMN `fecha_ingreso` DATE NULL,
    ADD COLUMN `es_delegada` TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN `fecha_retiro` DATE NULL,
    ADD COLUMN `motivo_retiro` VARCHAR(255) NULL,
    ADD COLUMN `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 3. Jardín: de texto libre a referencia al catálogo
UPDATE `socias` s
    JOIN `jardines` j ON j.`nombre` = TRIM(s.`jardin`)
    SET s.`jardin_id` = j.`id`;

-- 4. Estado: se agrega RETIRADA (baja lógica)
ALTER TABLE `socias`
    MODIFY `estado` ENUM('ACTIVA', 'SUSPENDIDA', 'RETIRADA') NOT NULL DEFAULT 'ACTIVA';

-- 5. Cargos: 5 cargos oficiales; vacíos o desconocidos quedan como 'SIN DATO' para completar
UPDATE `socias` SET `cargo` = UPPER(TRIM(`cargo`)) WHERE `cargo` IS NOT NULL;
UPDATE `socias` SET `cargo` = 'TECNICO' WHERE `cargo` = 'TÉCNICO';
UPDATE `socias` SET `cargo` = 'SIN DATO'
    WHERE `cargo` IS NULL OR `cargo` NOT IN ('DIRECTORA', 'EDUCADORA', 'TECNICO', 'ASISTENTE', 'AUXILIAR');
ALTER TABLE `socias`
    MODIFY `cargo` ENUM('DIRECTORA', 'EDUCADORA', 'TECNICO', 'ASISTENTE', 'AUXILIAR', 'SIN DATO') NOT NULL DEFAULT 'SIN DATO';

-- 6. Celular en formato único +569XXXXXXXX (antes +569-XXXXXXXX o sin el +) y correos en minúscula
UPDATE `socias` SET `celular` = REPLACE(REPLACE(`celular`, '-', ''), ' ', '') WHERE `celular` IS NOT NULL;
UPDATE `socias` SET `celular` = CONCAT('+', `celular`) WHERE `celular` REGEXP '^569[0-9]{8}$';
UPDATE `socias` SET `celular` = CONCAT('+56', `celular`) WHERE `celular` REGEXP '^9[0-9]{8}$';
UPDATE `socias` SET `celular` = CONCAT('+569', `celular`) WHERE `celular` REGEXP '^[0-9]{8}$';
UPDATE `socias` SET `correo` = LOWER(TRIM(`correo`)) WHERE `correo` IS NOT NULL;

-- 7. Índices, llave foránea y retiro de la columna de texto
ALTER TABLE `socias`
    ADD INDEX `idx_socias_estado` (`estado`),
    ADD CONSTRAINT `fk_socias_jardin` FOREIGN KEY (`jardin_id`) REFERENCES `jardines` (`id`) ON DELETE SET NULL;

ALTER TABLE `socias` DROP COLUMN `jardin`;

-- 8. Historial de traslados y cargas de planilla
CREATE TABLE IF NOT EXISTS `historial_traslados` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `socia_id` INT NOT NULL,
    `jardin_anterior_id` INT NULL,
    `jardin_nuevo_id` INT NULL,
    `motivo` VARCHAR(255) NOT NULL,
    `realizado_por` VARCHAR(150) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_traslados_socia` (`socia_id`),
    CONSTRAINT `fk_traslados_socia` FOREIGN KEY (`socia_id`) REFERENCES `socias` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_traslados_jardin_ant` FOREIGN KEY (`jardin_anterior_id`) REFERENCES `jardines` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_traslados_jardin_nuevo` FOREIGN KEY (`jardin_nuevo_id`) REFERENCES `jardines` (`id`) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS `cargas_padron` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `archivo_original` VARCHAR(255) NOT NULL,
    `archivo_guardado` VARCHAR(255) NOT NULL,
    `subido_por` VARCHAR(150) NOT NULL,
    `total_filas` INT NOT NULL DEFAULT 0,
    `nuevas` INT NOT NULL DEFAULT 0,
    `actualizadas` INT NOT NULL DEFAULT 0,
    `sin_cambios` INT NOT NULL DEFAULT 0,
    `no_incluidas` INT NOT NULL DEFAULT 0,
    `con_error` INT NOT NULL DEFAULT 0,
    `detalle` LONGTEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 9. Créditos protegidos: una socia con créditos ya no se puede borrar en cascada
ALTER TABLE `creditos` DROP FOREIGN KEY `fk_creditos_socias`;
ALTER TABLE `creditos`
    ADD CONSTRAINT `fk_creditos_socias` FOREIGN KEY (`socia_id`) REFERENCES `socias` (`id`) ON DELETE RESTRICT;

-- Comprobación: socias por jardín (las sin jardín aparecen como NULL para completarlas)
SELECT j.`nombre` AS jardin, COUNT(*) AS socias
FROM `socias` s LEFT JOIN `jardines` j ON j.`id` = s.`jardin_id`
GROUP BY j.`nombre` ORDER BY socias DESC;
