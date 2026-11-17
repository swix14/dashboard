import bcrypt from 'bcryptjs';

// Usuarios FICTICIOS solo para pruebas automatizadas (modo memoria, NODE_ENV=test).
// Nunca se usan en producción: el modo memoria está deshabilitado fuera de test (H-007/H-012).
// Hash pre-generado para 'Admin123!' (costo 10)
export const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('Admin123!', 10);

export const INITIAL_ROLES = [
  {
    id: 'role-0-admin',
    code: 'ADMIN',
    name: 'Super Administrador',
    description: 'Acceso total y administración de todo el sistema y permisos.'
  },
  {
    id: 'role-1-presidenta',
    code: 'PRESIDENTA',
    name: 'Presidenta',
    description: 'Acceso a toda la app con modificación, excepto en Tesorería (solo lectura).'
  },
  {
    id: 'role-2-tesorera',
    code: 'TESORERA',
    name: 'Tesorera',
    description: 'Acceso operativo total a toda la app y gestión exclusiva de Tesorería.'
  },
  {
    id: 'role-3-secretaria',
    code: 'SECRETARIA',
    name: 'Secretaria',
    description: 'Acceso de solo lectura general, con permiso para agregar y modificar Socias.'
  },
  {
    id: 'role-4-directora',
    code: 'DIRECTORA',
    name: 'Directora',
    description: 'Acceso de solo lectura general, con excepción en gestión de Convenios/Créditos.'
  },
  {
    id: 'role-6-delegada',
    code: 'DELEGADA',
    name: 'Delegada de Jardín',
    description: 'Representante de jardín. Consulta exclusiva de módulo de Reportes.'
  },
  {
    id: 'role-7-socia',
    code: 'SOCIA',
    name: 'Socia',
    description: 'Consulta institucional pública y estado de cuota personal.'
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
    id: 'user-admin',
    email: 'admin@vtftemuco.cl',
    rut: '10.111.222-5',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Usuario',
    lastName: 'Prueba Admin',
    roleCode: 'ADMIN',
    roleId: 'role-0-admin',
    jardinId: null,
    cargo: 'ADMINISTRADOR',
    isActive: true
  },
  {
    id: 'user-presidenta',
    email: 'presidenta@vtftemuco.cl',
    rut: '15.421.368-7',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Usuaria',
    lastName: 'Prueba Presidenta',
    roleCode: 'PRESIDENTA',
    roleId: 'role-1-presidenta',
    jardinId: 'jar-1',
    cargo: 'PRESIDENTA',
    isActive: true
  },
  {
    id: 'user-tesorera',
    email: 'tesorera@vtftemuco.cl',
    rut: '13.918.472-6',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Usuaria',
    lastName: 'Prueba Tesorera',
    roleCode: 'TESORERA',
    roleId: 'role-2-tesorera',
    jardinId: 'jar-2',
    cargo: 'TESORERA',
    isActive: true
  },
  {
    id: 'user-secretaria',
    email: 'secretaria@vtftemuco.cl',
    rut: '14.832.195-4',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Usuaria',
    lastName: 'Prueba Secretaria',
    roleCode: 'SECRETARIA',
    roleId: 'role-3-secretaria',
    jardinId: 'jar-3',
    cargo: 'SECRETARIA',
    isActive: true
  },
  {
    id: 'user-directora',
    email: 'directora@vtftemuco.cl',
    rut: '16.274.593-8',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Usuaria',
    lastName: 'Prueba Directora',
    roleCode: 'DIRECTORA',
    roleId: 'role-4-directora',
    jardinId: 'jar-4',
    cargo: 'DIRECTORA',
    isActive: true
  },
  {
    id: 'user-delegada',
    email: 'delegada@vtftemuco.cl',
    rut: '17.890.123-1',
    passwordHash: DEFAULT_PASSWORD_HASH,
    firstName: 'Usuaria',
    lastName: 'Prueba Delegada',
    roleCode: 'DELEGADA',
    roleId: 'role-6-delegada',
    jardinId: 'jar-1',
    cargo: 'DELEGADA',
    isActive: true
  },
  {
    id: 'user-socia',
    email: 'socia@vtftemuco.cl',
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

// Movimientos históricos de ejemplo de la Tesorería (solo modo memoria, sin MySQL)
export const INITIAL_MOVEMENTS = [
  {
    id: 'mov-apertura-asoc',
    correlativo: 'MOV-2026-000A',
    fecha: '2026-01-01',
    tipo: 'SALDO_APERTURA',
    centroCosto: 'ASOCIACION',
    categoria: 'APERTURA',
    descripcion: 'Saldo de apertura ejercicio contable 2026 - Fondo Asociación',
    metodo: 'Traspaso Ejercicio Anterior',
    monto: 5103000,
    responsable: 'Tesorera General VTF',
    comprobante: 'acta_apertura_asociacion_2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-01-01T09:00:00Z'
  },
  {
    id: 'mov-apertura-cena',
    correlativo: 'MOV-2026-000B',
    fecha: '2026-01-01',
    tipo: 'SALDO_APERTURA',
    centroCosto: 'CENA ANUAL',
    categoria: 'APERTURA',
    descripcion: 'Saldo de apertura ejercicio contable 2026 - Fondo Cena Anual',
    metodo: 'Traspaso Ejercicio Anterior',
    monto: 8856000,
    responsable: 'Tesorera General VTF',
    comprobante: 'acta_apertura_cena_2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-01-01T09:00:00Z'
  },
  {
    id: 'mov-001',
    correlativo: 'MOV-2026-001',
    fecha: '2026-06-02',
    tipo: 'EGRESO',
    centroCosto: 'FEDERACION',
    categoria: 'PAGO FEDERACION',
    descripcion: 'Aporte gremial nacional mes de Junio 2026',
    metodo: 'Transferencia Bancaria',
    monto: 280000,
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_fed_jun_2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-06-02T10:30:00Z'
  },
  {
    id: 'mov-002',
    correlativo: 'MOV-2026-002',
    fecha: '2026-07-02',
    tipo: 'EGRESO',
    centroCosto: 'FEDERACION',
    categoria: 'PAGO FEDERACION',
    descripcion: 'Aporte gremial nacional mes de Julio 2026',
    metodo: 'Transferencia Bancaria',
    monto: 280000,
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_fed_jul_2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-07-02T11:15:00Z'
  },
  {
    id: 'mov-003',
    correlativo: 'MOV-2026-003',
    fecha: '2026-08-03',
    tipo: 'EGRESO',
    centroCosto: 'FEDERACION',
    categoria: 'PAGO FEDERACION',
    descripcion: 'Aporte gremial nacional mes de Agosto 2026',
    metodo: 'Transferencia Bancaria',
    monto: 280000,
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_fed_ago_2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-08-03T09:45:00Z'
  },
  {
    id: 'mov-004',
    correlativo: 'MOV-2026-004',
    fecha: '2026-09-02',
    tipo: 'EGRESO',
    centroCosto: 'FEDERACION',
    categoria: 'PAGO FEDERACION',
    descripcion: 'Aporte gremial nacional mes de Septiembre 2026',
    metodo: 'Transferencia Bancaria',
    monto: 280000,
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_fed_sep_2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-09-02T10:00:00Z'
  },
  {
    id: 'mov-005',
    correlativo: 'MOV-2026-005',
    fecha: '2026-10-02',
    tipo: 'EGRESO',
    centroCosto: 'FEDERACION',
    categoria: 'PAGO FEDERACION',
    descripcion: 'Aporte gremial nacional mes de Octubre 2026',
    metodo: 'Transferencia Bancaria',
    monto: 280000,
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_fed_oct_2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-10-02T12:00:00Z'
  },
  {
    id: 'mov-006',
    correlativo: 'MOV-2026-006',
    fecha: '2026-10-04',
    tipo: 'INGRESO',
    centroCosto: 'ISI MUNDO COMISION',
    categoria: 'ISI MUNDO COMISION',
    descripcion: 'Comisión 2% liquidación convenio compras Isi Mundo',
    metodo: 'Transferencia Bancaria',
    monto: 54200,
    responsable: 'Tesorera General VTF',
    comprobante: 'liquidacion_comision_isimundo_oct2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-10-04T15:20:00Z'
  },
  {
    id: 'mov-007',
    correlativo: 'MOV-2026-007',
    fecha: '2026-10-05',
    tipo: 'INGRESO',
    centroCosto: 'CENA ANUAL',
    categoria: 'CENA ANUAL',
    descripcion: 'Recaudación fondo cuota cena anual ($2.000 x 262 socias)',
    metodo: 'Descuento Planilla',
    monto: 524000,
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_recaudacion_cena_oct2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-10-05T09:00:00Z'
  },
  {
    id: 'mov-008',
    correlativo: 'MOV-2026-008',
    fecha: '2026-10-05',
    tipo: 'INGRESO',
    centroCosto: 'ASOCIACION',
    categoria: 'ASOCIACION',
    descripcion: 'Recaudación cuota gremial asociación ($1.000 x 262 socias)',
    metodo: 'Descuento Planilla',
    monto: 262000,
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_recaudacion_asoc_oct2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-10-05T09:05:00Z'
  },
  {
    id: 'mov-009',
    correlativo: 'MOV-2026-009',
    fecha: '2026-10-08',
    tipo: 'EGRESO',
    centroCosto: 'CENA ANUAL',
    categoria: 'S.O.S',
    descripcion: 'Crédito de emergencia S.O.S aprobado para socia de Jardín Campanita',
    metodo: 'Transferencia Bancaria',
    monto: 120000,
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_transferencia_sos_0810.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-10-08T16:40:00Z'
  },
  {
    id: 'mov-010',
    correlativo: 'MOV-2026-010',
    fecha: '2026-10-12',
    tipo: 'EGRESO',
    centroCosto: 'ASOCIACION',
    categoria: 'OTROS',
    descripcion: 'Adquisición de insumos de papelería e impresiones para asamblea general',
    metodo: 'Efectivo',
    monto: 45000,
    responsable: 'Tesorera General VTF',
    comprobante: 'boleta_papeleria_12102026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-10-12T11:30:00Z'
  }
];
