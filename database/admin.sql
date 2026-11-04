-- SCRIPT DE APROVISIONAMIENTO DE ADMINISTRADORES Y DIRECTIVA (SIGAV)
-- Contraseñas seguras cifradas con algoritmo bcrypt (costo 10) para 'Admin123!'

INSERT INTO
    `administradores` (
        `rut`,
        `nombres`,
        `apellidos`,
        `correo`,
        `rol`,
        `contrasena`,
        `activo`
    )
VALUES
    -- ADMINISTRACION PRINCIPAL
    (
        '17.260.651-2',
        'Jhonny Marcelo',
        'Ferrada Pasten',
        'admin@asociacionvtf.cl',
        'Super_Admin',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1
    ),
    (
        '13.918.472-6',
        'Alejandra Romanett',
        'Sias Novoa',
        'tesoreria@asociacionvtf.cl',
        'Tesorera',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1
    ),
    (
        '15.421.368-7',
        'Yerthie Johanna',
        'Sayago Gajardo',
        'presidencia@asociacionvtf.cl',
        'Presidenta',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1
    ),
    (
        '14.832.195-4',
        'Nelly Ester',
        'Mella Burgos',
        'secretaria@asociacionvtf.cl',
        'Secretaria',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1
    ),
    (
        '16.274.593-8',
        'Victoria Catalina',
        'Abarza Vega',
        'directora@asociacionvtf.cl',
        'Directora',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1
    ),

    -- DELEGADAS DE JARDIN
    (
        '17.890.123-1',
        'Claudia',
        'Navarro',
        'delegada@asociacionvtf.cl',
        'Delegada',
        '$2b$10$crgtkhpm9nlcizsbRFp.6.Xc2zzMyBxkJu7eRpE5yn58ZByMWv8M6',
        1
    )
ON DUPLICATE KEY UPDATE
    `nombres` = VALUES(`nombres`),
    `apellidos` = VALUES(`apellidos`),
    `correo` = VALUES(`correo`),
    `rol` = VALUES(`rol`),
    `contrasena` = VALUES(`contrasena`),
    `activo` = VALUES(`activo`);
