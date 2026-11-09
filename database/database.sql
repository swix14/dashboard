-- Script para generar la base de datos
-- Aun está en revisión y progreso por lo que puede tener errores/problemas

-- Para dropear la base de datos (solo usenlo para pruebas y no para
-- la base de datos real porfa)
-- Configuración de codificación UTF-8
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- NOTA PARA DESPLIEGUE EN CPANEL O XAMPP:
-- En cPanel, selecciona primero la base de datos creada (ej: usuario_jardines_vtf) y luego importa este archivo.
-- Si ejecutas en un entorno local vacío de desarrollo, puedes descomentar las siguientes 2 líneas:
-- CREATE DATABASE IF NOT EXISTS `jardines_vtf` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE `jardines_vtf`;

CREATE TABLE IF NOT EXISTS `administradores` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `rut` VARCHAR(12) NOT NULL UNIQUE,
    `nombres` VARCHAR(100),
    `apellidos` VARCHAR(100),
    `correo` VARCHAR(100) UNIQUE NULL,
    `rol` VARCHAR(50),
    `contrasena` VARCHAR(100),
    `activo` TINYINT(1) DEFAULT 1,
    -- 1 = debe cambiar la clave inicial antes de usar el sistema
    `primer_ingreso` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 1. Tabla de Socias (con id numérico para FKs y RUT único)
CREATE TABLE IF NOT EXISTS `socias` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `rut` VARCHAR(12) NOT NULL UNIQUE,
    `apellido_paterno` VARCHAR(50),
    `apellido_materno` VARCHAR(50),
    `nombres` VARCHAR(100),
    `cargo` VARCHAR(50),
    `celular` VARCHAR(20),
    `correo` VARCHAR(100),
    `password` VARCHAR(255) NULL,
    `primer_ingreso` TINYINT(1) DEFAULT 1,
    `jardin` VARCHAR(150),
    `estado` ENUM('ACTIVA', 'SUSPENDIDA') DEFAULT 'ACTIVA'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 2. Tabla de Convenios / Proveedores
CREATE TABLE IF NOT EXISTS `convenios` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(100) NOT NULL UNIQUE, -- 'SOS', 'ISIMUNDO', 'Óptica', etc.
    `descripcion` TEXT NULL,
    `activo` TINYINT(1) DEFAULT 1
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 3. Tabla de Créditos / Préstamos otorgados
CREATE TABLE IF NOT EXISTS `creditos` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `socia_id` INT NOT NULL, -- Nombre normalizado a socia_id
    `convenio_id` INT NOT NULL,
    `numero_credito` VARCHAR(50) NULL,
    `monto_total` INT NOT NULL,
    `monto_cuota` INT NOT NULL,
    `total_cuotas` INT NOT NULL,
    `cuotas_pagadas` INT DEFAULT 0,
    `fecha_otorgamiento` DATE NULL,
    `fecha_termino` DATE NULL,
    `estado` ENUM(
        'vigente',
        'finalizado',
        'anulado'
    ) DEFAULT 'vigente',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_creditos_socias` FOREIGN KEY (`socia_id`) REFERENCES `socias` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_creditos_convenios` FOREIGN KEY (`convenio_id`) REFERENCES `convenios` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 4. Tabla de Cuotas Mensuales programadas
CREATE TABLE IF NOT EXISTS `cuotas_credito` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `credito_id` INT NOT NULL,
    `numero_cuota` INT NOT NULL,
    `monto` INT NOT NULL,
    `mes_cobro` INT NOT NULL,
    `anio_cobro` INT NOT NULL,
    `estado` ENUM(
        'pendiente',
        'descontada',
        'condonada'
    ) DEFAULT 'pendiente',
    `fecha_pago` DATE NULL,
    CONSTRAINT `fk_cuotas_credito` FOREIGN KEY (`credito_id`) REFERENCES `creditos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 5. Cabecera de Rendición / Descuento Mensual por Socia
CREATE TABLE IF NOT EXISTS `liquidaciones_mensuales` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `socia_id` INT NOT NULL,
    `mes` INT NOT NULL,
    `anio` INT NOT NULL,
    `cuota_asociacion` INT DEFAULT 4000,
    `total_descuentos` INT NOT NULL,
    `estado` ENUM('generada', 'pagada') DEFAULT 'generada',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_socia_periodo` (`socia_id`, `mes`, `anio`),
    CONSTRAINT `fk_liquidaciones_socias` FOREIGN KEY (`socia_id`) REFERENCES `socias` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE OR REPLACE VIEW `vista_liquidacion_socias` AS
SELECT
    l.id AS liquidacion_id,
    s.rut,
    s.nombres,
    s.apellido_paterno,
    s.apellido_materno,
    l.mes,
    l.anio,
    l.cuota_asociacion,
    l.total_descuentos,
    l.estado
FROM
    `liquidaciones_mensuales` l
    INNER JOIN `socias` s ON l.socia_id = s.id;

-- 6. Tabla de Movimientos de Tesorería (Ingresos, Egresos, Saldos Iniciales y Comprobantes)
CREATE TABLE IF NOT EXISTS `movimientos_tesoreria` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `correlativo` VARCHAR(50) NOT NULL UNIQUE,
    `fecha` DATE NOT NULL,
    `tipo` ENUM('INGRESO', 'EGRESO', 'SALDO_APERTURA') NOT NULL,
    `centro_costo` ENUM('ASOCIACION', 'CENA ANUAL', 'FEDERACION', 'ISI MUNDO COMISION') NOT NULL,
    `categoria` VARCHAR(100) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `metodo` VARCHAR(50) NOT NULL,
    `monto` INT NOT NULL,
    `responsable` VARCHAR(150) NOT NULL,
    `comprobante` VARCHAR(255) NULL,
    `comprobante_stored` VARCHAR(255) NULL,
    `comprobante_mime` VARCHAR(100) NULL,
    `comprobante_size` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_mov_fecha` (`fecha`),
    INDEX `idx_mov_centro` (`centro_costo`),
    INDEX `idx_mov_tipo` (`tipo`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 7. Tabla de Auditoría / Bitácora de Acciones
CREATE TABLE IF NOT EXISTS `auditoria` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `usuario_id` INT NULL,
    `usuario_rut` VARCHAR(12) NULL,
    `accion` VARCHAR(100) NOT NULL,
    `detalles` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_auditoria_usuario` (`usuario_id`),
    INDEX `idx_auditoria_accion` (`accion`),
    INDEX `idx_auditoria_fecha` (`created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 8. Tabla de Noticias y Comunicados Gremiales
CREATE TABLE IF NOT EXISTS `noticias` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `titulo` VARCHAR(200) NOT NULL,
    `contenido` TEXT NOT NULL,
    `categoria` ENUM('FEDERACION', 'CONVENIO', 'COMUNICADO', 'BENEFICIO') DEFAULT 'COMUNICADO',
    `fecha_publicacion` DATE NOT NULL,
    `destacado` TINYINT(1) DEFAULT 0,
    `autor` VARCHAR(100) DEFAULT 'Directiva VTF',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 9. Tabla de Buzón de Socias (Sugerencias, Reclamos, Felicitaciones, Consultas)
CREATE TABLE IF NOT EXISTS `buzon_mensajes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `socia_id` INT NULL,
    `socia_rut` VARCHAR(15) NOT NULL,
    `socia_nombre` VARCHAR(150) NOT NULL,
    `socia_jardin` VARCHAR(150) NOT NULL,
    `tipo` ENUM('FELICITACION', 'RECLAMO', 'SUGERENCIA', 'CONSULTA', 'OTRO') NOT NULL,
    `asunto` VARCHAR(200) NOT NULL,
    `mensaje` TEXT NOT NULL,
    `archivo_adjunto` VARCHAR(255) NULL,
    `estado` ENUM('PENDIENTE', 'LEIDO', 'RESPONDIDO') DEFAULT 'PENDIENTE',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_buzon_rut` (`socia_rut`),
    INDEX `idx_buzon_tipo` (`tipo`),
    INDEX `idx_buzon_fecha` (`created_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;