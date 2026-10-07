import bcrypt from 'bcryptjs';

// Hash pre-generado para 'Admin123!' (costo 10)
export const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('Admin123!', 10);

export const INITIAL_ROLES = [
  {
    id: 'role-1-presidenta',
    code: 'PRESIDENTA',
    name: 'Presidenta',
    description: 'Supervisión general, consulta de informes y rendiciones institucionales.'
  },
  {
    id: 'role-2-tesorera',
    code: 'TESORERA',
    name: 'Tesorera',
    description: 'Acceso operativo financiero completo: cuotas, créditos, ingresos, egresos y pagos.'
  },
  {
    id: 'role-3-secretaria',
    code: 'SECRETARIA',
    name: 'Secretaria',
    description: 'Gestión administrativa de socias, jardines y estados administrativos.'
  },
  {
    id: 'role-4-directora1',
    code: 'PRIMERA_DIRECTORA',
    name: 'Primera Directora',
    description: 'Consulta general y apoyo administrativo autorizado.'
  },
  {
    id: 'role-5-directora2',
    code: 'SEGUNDA_DIRECTORA',
    name: 'Segunda Directora',
    description: 'Supervisión y visualización general de la asociación.'
  },
  {
    id: 'role-6-delegada',
    code: 'DELEGADA',
    name: 'Delegada de Jardín',
    description: 'Representante de jardín. Consulta exclusiva de datos generales y fondo común.'
  },
  {
    id: 'role-7-socia',
    code: 'SOCIA',
    name: 'Socia',
    description: 'Consulta institucional pública y estado general de la asociación.'
  }
];

export const INITIAL_JARDINES = [
  { id: 'jar-1', code: 'J-01', name: 'Jardín Infantil Bambi', address: 'Av. Las Flores 120' },
  { id: 'jar-2', code: 'J-02', name: 'Jardín Rayito de Sol', address: 'Calle Los Aromos 450' },
  { id: 'jar-3', code: 'J-03', name: 'Jardín Los Cerezos', address: 'Pasaje Primavera 89' },
  { id: 'jar-4', code: 'J-04', name: 'Jardín Campanita', address: 'Av. Salvador Allende 1024' },
  { id: 'jar-5', code: 'J-05', name: 'Jardín Dulces Sonrisas', address: 'Calle Las Vertientes 312' },
  { id: 'jar-6', code: 'J-06', name: 'Jardín Semillitas del Futuro', address: 'Pasaje El Roble 78' },
  { id: 'jar-7', code: 'J-07', name: 'Jardín Pequeños Pasos', address: 'Av. San Martín 650' },
  { id: 'jar-8', code: 'J-08', name: 'Jardín Bosque Encantado', address: 'Calle Los Boldos 220' },
  { id: 'jar-9', code: 'J-09', name: 'Jardín Gabriela Mistral', address: 'Av. El Parque 512' },
  { id: 'jar-10', code: 'J-10', name: 'Jardín Arcoíris', address: 'Pasaje La Estrella 90' },
  { id: 'jar-11', code: 'J-11', name: 'Jardín Valle Verde', address: 'Calle Los Maitenes 340' },
  { id: 'jar-12', code: 'J-12', name: 'Jardín Rincón Infantil', address: 'Av. Central 815' },
  { id: 'jar-13', code: 'J-13', name: 'Jardín Mariposas de Colores', address: 'Calle Los Pinos 104' },
  { id: 'jar-14', code: 'J-14', name: 'Jardín Gotitas de Rocío', address: 'Pasaje El Trébol 45' },
  { id: 'jar-15', code: 'J-15', name: 'Jardín Tierra de Niños', address: 'Av. Los Libertadores 770' },
  { id: 'jar-16', code: 'J-16', name: 'Jardín Sueños Mágicos', address: 'Calle Mirador 320' },
  { id: 'jar-17', code: 'J-17', name: 'Jardín Nuevo Amanecer', address: 'Pasaje Los Coigües 12' },
  { id: 'jar-18', code: 'J-18', name: 'Jardín Estrellitas', address: 'Av. Costanera 1450' },
  { id: 'jar-19', code: 'J-19', name: 'Jardín Colibrí', address: 'Calle Baquedano 99' },
  { id: 'jar-20', code: 'J-20', name: 'Jardín Espacio Feliz', address: 'Pasaje Las Nalcas 60' },
  { id: 'jar-21', code: 'J-21', name: 'Jardín Los Peques', address: 'Av. Independencia 405' },
  { id: 'jar-22', code: 'J-22', name: 'Jardín Creciendo Juntos', address: 'Calle Prat 230' },
  { id: 'jar-23', code: 'J-23', name: 'Jardín Mi Dulce Hogar', address: 'Av. Balmaceda 1120' }
];

export const INITIAL_USERS = [
  {
    id: 'user-presidenta',
    email: 'presidenta@vtf.cl',
    rut: '12.345.678-5',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Patricia',
    lastName: 'Gómez Alarcón',
    roleCode: 'PRESIDENTA',
    roleId: 'role-1-presidenta',
    jardinId: 'jar-1',
    cargo: 'DIRECTORA',
    isActive: true
  },
  {
    id: 'user-tesorera',
    email: 'tesorera@vtf.cl',
    rut: '14.567.890-2',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Rosa',
    lastName: 'Pérez Contreras',
    roleCode: 'TESORERA',
    roleId: 'role-2-tesorera',
    jardinId: 'jar-2',
    cargo: 'EDUCADORA',
    isActive: true
  },
  {
    id: 'user-secretaria',
    email: 'secretaria@vtf.cl',
    rut: '15.678.901-0',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Carmen',
    lastName: 'Fuentes Valenzuela',
    roleCode: 'SECRETARIA',
    roleId: 'role-3-secretaria',
    jardinId: 'jar-3',
    cargo: 'EDUCADORA',
    isActive: true
  },
  {
    id: 'user-directora1',
    email: 'directora1@vtf.cl',
    rut: '13.456.789-7',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Mónica',
    lastName: 'Silva Riquelme',
    roleCode: 'PRIMERA_DIRECTORA',
    roleId: 'role-4-directora1',
    jardinId: 'jar-4',
    cargo: 'DIRECTORA',
    isActive: true
  },
  {
    id: 'user-directora2',
    email: 'directora2@vtf.cl',
    rut: '16.789.012-3',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Loreto',
    lastName: 'Morales Soto',
    roleCode: 'SEGUNDA_DIRECTORA',
    roleId: 'role-5-directora2',
    jardinId: 'jar-5',
    cargo: 'TECNICO',
    isActive: true
  },
  {
    id: 'user-delegada',
    email: 'delegada.bambi@vtf.cl',
    rut: '17.890.123-1',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Claudia',
    lastName: 'Navarro Muñoz',
    roleCode: 'DELEGADA',
    roleId: 'role-6-delegada',
    jardinId: 'jar-1',
    cargo: 'EDUCADORA',
    isActive: true
  },
  {
    id: 'user-socia',
    email: 'socia.educadora@vtf.cl',
    rut: '18.901.234-9',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Francisca',
    lastName: 'Torres Vera',
    roleCode: 'SOCIA',
    roleId: 'role-7-socia',
    jardinId: 'jar-2',
    cargo: 'TECNICO',
    isActive: true
  }
];
