-- SCRIPT DE APROVISIONAMIENTO DE ADMINISTRADORES Y DIRECTIVA (SIGAV)
-- Clave inicial 'Admin123!' cifrada con bcrypt (costo 10).
-- primer_ingreso = 1 obliga a cada persona a crear su propia contraseña al entrar:
-- el sistema no permite usar ninguna sección hasta cambiarla.
--
-- RUTs tomados del padrón oficial (tabla socias, data.sql); correos oficiales @vtftemuco.cl.
-- Para una base YA INSTALADA no vuelva a importar este archivo: use
-- database/migraciones/2026-11-09_directiva_y_primer_ingreso.sql

INSERT INTO
    `administradores` (
        `rut`,
        `nombres`,
        `apellidos`,
        `correo`,
        `rol`,
        `contrasena`,
        `activo`,
        `primer_ingreso`
    )
VALUES
    -- ADMINISTRACION PRINCIPAL
    (
        '17.260.651-2',
        'Jhonny Marcelo',
        'Ferrada Pasten',
        'admin@vtftemuco.cl',
        'Super_Admin',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1,
        1
    ),
    (
        '16.947.343-9',
        'Alejandra Romanett',
        'Sias Novoa',
        'tesorera@vtftemuco.cl',
        'Tesorera',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1,
        1
    ),
    (
        '13.963.291-5',
        'Yerthie Johanna',
        'Sayago Gajardo',
        'presidenta@vtftemuco.cl',
        'Presidenta',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1,
        1
    ),
    (
        '11.354.669-7',
        'Nelly Ester',
        'Mella Burgos',
        'secretaria@vtftemuco.cl',
        'Secretaria',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1,
        1
    ),
    (
        -- Correo por confirmar: la directora no tiene casilla oficial informada
        '20.081.109-7',
        'Victoria Catalina',
        'Abarza Vega',
        'directora@vtftemuco.cl',
        'Directora',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1,
        1
    ),

    -- DELEGADAS DE JARDIN
    -- Cuenta de DEMOSTRACIÓN (RUT ficticio). Reemplazar por las delegadas reales cuando se confirmen.
    (
        '17.890.123-1',
        'Claudia',
        'Navarro',
        'delegada@vtftemuco.cl',
        'Delegada',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1,
        1
    )
-- Reimportar no pisa contraseñas ya personalizadas ni el estado de primer ingreso
ON DUPLICATE KEY UPDATE
    `nombres` = VALUES(`nombres`),
    `apellidos` = VALUES(`apellidos`),
    `correo` = VALUES(`correo`),
    `rol` = VALUES(`rol`),
    `activo` = VALUES(`activo`);
