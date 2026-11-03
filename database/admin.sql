USE `JARDINES_VTF`;

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
        'Admin123!',
        1
    ),
    (
        '13.918.472-6',
        'Alejandra Romanett',
        'Sias Novoa',
        'tesoreria@asociacionvtf.cl',
        'Tesorera',
        'Admin123!',
        1
    ),
    (
        '15.421.368-7',
        'Yerthie Johanna',
        'Sayago Gajardo',
        'presidencia@asociacionvtf.cl',
        'Presidenta',
        'Admin123!',
        1
    ),
    (
        '14.832.195-4',
        'Nelly Ester',
        'Mella Burgos',
        'secretaria@asociacionvtf.cl',
        'Secretaria',
        'Admin123!',
        1
    ),
    (
        '16.274.593-8',
        'Victoria Catalina',
        'Abarza Vega',
        'directora@asociacionvtf.cl',
        'Directora',
        'Admin123!',
        1
    ),

    -- DELEGADAS DE JARDIN
    (
        '17.890.123-1',
        'Claudia',
        'Navarro',
        'delegada@asociacionvtf.cl',
        'Delegada',
        'Admin123!',
        1
    )
ON DUPLICATE KEY UPDATE
    `nombres` = VALUES(`nombres`),
    `apellidos` = VALUES(`apellidos`),
    `correo` = VALUES(`correo`),
    `rol` = VALUES(`rol`),
    `contrasena` = VALUES(`contrasena`),
    `activo` = VALUES(`activo`);