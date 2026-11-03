USE `JARDINES_VTF`;

-- 1. Asegurar columnas en administradores
ALTER TABLE `administradores` 
    ADD COLUMN IF NOT EXISTS `correo` VARCHAR(100) UNIQUE NULL AFTER `apellidos`,
    ADD COLUMN IF NOT EXISTS `activo` TINYINT(1) DEFAULT 1 AFTER `contrasena`;

-- Actualizar correos y contraseñas de administradores
UPDATE `administradores` SET `correo` = 'admin@asociacionvtf.cl', `activo` = 1 WHERE `rut` = '17.260.651-2';
UPDATE `administradores` SET `correo` = 'tesoreria@asociacionvtf.cl', `activo` = 1 WHERE `rut` = '13.918.472-6';
UPDATE `administradores` SET `correo` = 'presidencia@asociacionvtf.cl', `activo` = 1 WHERE `rut` = '15.421.368-7';
UPDATE `administradores` SET `correo` = 'secretaria@asociacionvtf.cl', `activo` = 1 WHERE `rut` = '14.832.195-4';
UPDATE `administradores` SET `correo` = 'directora@asociacionvtf.cl', `activo` = 1 WHERE `rut` = '16.274.593-8';
UPDATE `administradores` SET `correo` = 'delegada@asociacionvtf.cl', `activo` = 1 WHERE `rut` = '17.890.123-1';

-- 2. Crear tabla de Movimientos de Tesorería
CREATE TABLE IF NOT EXISTS `movimientos_tesoreria` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `correlativo` VARCHAR(50) NOT NULL UNIQUE,
    `fecha` DATE NOT NULL,
    `tipo` ENUM('INGRESO', 'EGRESO') NOT NULL,
    `centro_costo` ENUM('ASOCIACION', 'CENA ANUAL', 'FEDERACION', 'ISI MUNDO COMISION') NOT NULL,
    `categoria` VARCHAR(100) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `metodo` VARCHAR(50) NOT NULL,
    `monto` INT NOT NULL,
    `responsable` VARCHAR(150) NOT NULL,
    `comprobante` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_mov_fecha` (`fecha`),
    INDEX `idx_mov_centro` (`centro_costo`),
    INDEX `idx_mov_tipo` (`tipo`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 3. Crear tabla de Auditoría
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

-- 4. Cargar movimientos históricos iniciales de tesorería (si no existen)
INSERT IGNORE INTO `movimientos_tesoreria` 
(`id`, `correlativo`, `fecha`, `tipo`, `centro_costo`, `categoria`, `descripcion`, `metodo`, `monto`, `responsable`, `comprobante`, `created_at`)
VALUES
(1, 'MOV-2026-001', '2026-06-02', 'EGRESO', 'FEDERACION', 'PAGO FEDERACION', 'Aporte gremial nacional mes de Junio 2026', 'Transferencia Bancaria', 280000, 'Alejandra Romanett Sias Novoa', 'comprobante_fed_jun_2026.pdf', '2026-06-02 10:30:00'),
(2, 'MOV-2026-002', '2026-07-02', 'EGRESO', 'FEDERACION', 'PAGO FEDERACION', 'Aporte gremial nacional mes de Julio 2026', 'Transferencia Bancaria', 280000, 'Alejandra Romanett Sias Novoa', 'comprobante_fed_jul_2026.pdf', '2026-07-02 11:15:00'),
(3, 'MOV-2026-003', '2026-08-03', 'EGRESO', 'FEDERACION', 'PAGO FEDERACION', 'Aporte gremial nacional mes de Agosto 2026', 'Transferencia Bancaria', 280000, 'Alejandra Romanett Sias Novoa', 'comprobante_fed_ago_2026.pdf', '2026-08-03 09:45:00'),
(4, 'MOV-2026-004', '2026-09-02', 'EGRESO', 'FEDERACION', 'PAGO FEDERACION', 'Aporte gremial nacional mes de Septiembre 2026', 'Transferencia Bancaria', 280000, 'Alejandra Romanett Sias Novoa', 'comprobante_fed_sep_2026.pdf', '2026-09-02 10:00:00'),
(5, 'MOV-2026-005', '2026-10-02', 'EGRESO', 'FEDERACION', 'PAGO FEDERACION', 'Aporte gremial nacional mes de Octubre 2026', 'Transferencia Bancaria', 280000, 'Alejandra Romanett Sias Novoa', 'comprobante_fed_oct_2026.pdf', '2026-10-02 12:00:00'),
(6, 'MOV-2026-006', '2026-10-04', 'INGRESO', 'ISI MUNDO COMISION', 'ISI MUNDO COMISION', 'Comisión 2% liquidación convenio compras Isi Mundo', 'Transferencia Bancaria', 54200, 'Alejandra Romanett Sias Novoa', 'liquidacion_comision_isimundo_oct2026.pdf', '2026-10-04 15:20:00'),
(7, 'MOV-2026-007', '2026-10-05', 'INGRESO', 'CENA ANUAL', 'CENA ANUAL', 'Recaudación fondo cuota cena anual ($2.000 x 262 socias)', 'Descuento Planilla', 524000, 'Alejandra Romanett Sias Novoa', 'comprobante_recaudacion_cena_oct2026.pdf', '2026-10-05 09:00:00'),
(8, 'MOV-2026-008', '2026-10-05', 'INGRESO', 'ASOCIACION', 'ASOCIACION', 'Recaudación cuota gremial asociación ($1.000 x 262 socias)', 'Descuento Planilla', 262000, 'Alejandra Romanett Sias Novoa', 'comprobante_recaudacion_asoc_oct2026.pdf', '2026-10-05 09:05:00'),
(9, 'MOV-2026-009', '2026-10-08', 'EGRESO', 'CENA ANUAL', 'S.O.S', 'Crédito de emergencia S.O.S aprobado para socia de Jardín Campanita', 'Transferencia Bancaria', 120000, 'Alejandra Romanett Sias Novoa', 'comprobante_transferencia_sos_0810.pdf', '2026-10-08 16:40:00'),
(10, 'MOV-2026-010', '2026-10-12', 'EGRESO', 'ASOCIACION', 'OTROS', 'Adquisición de insumos de papelería e impresiones para asamblea general', 'Efectivo', 45000, 'Alejandra Romanett Sias Novoa', 'boleta_papeleria_12102026.pdf', '2026-10-12 11:30:00');
