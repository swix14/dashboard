-- Revocación de sesiones al cerrar sesión (auditoría de seguridad, hallazgo H-005)
-- La aplicación crea esta tabla sola la primera vez que la necesita; este script queda como
-- registro y para crearla a mano si el usuario MySQL de cPanel no tuviera permiso CREATE.

CREATE TABLE IF NOT EXISTS `sesiones_revocadas` (
    `jti` CHAR(36) NOT NULL PRIMARY KEY,
    `expira` DATETIME NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sesiones_expira` (`expira`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Corte por persona: al cambiar la contraseña se cierran sus demás sesiones abiertas
CREATE TABLE IF NOT EXISTS `sesiones_corte` (
    `usuario` VARCHAR(40) NOT NULL PRIMARY KEY,
    `desde_ms` BIGINT NOT NULL,
    `excepto_jti` CHAR(36) NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
