/**
 * Padrón inicial de socias para el modo memoria (V3).
 * Se genera de forma determinística: siempre produce las mismas 280 socias
 * (276 activas + 4 suspendidas) distribuidas en los 23 jardines VTF.
 */
import { INITIAL_JARDINES, INITIAL_USERS } from './seedData.js';
import { computeRutDv, formatRutWithDots } from '../utils/rutValidator.js';

export const TOTAL_SOCIAS = 280;
export const CUOTA_SOCIAL_MENSUAL = 4000;

export const TIPOS_CREDITO = [
  { code: 'ISIMUNDO', name: 'Convenio Isi Mundo', commissionRate: 0.02 },
  { code: 'S.O.S', name: 'Crédito S.O.S Emergencia', commissionRate: 0 },
  { code: 'OPTICA', name: 'Convenio Salud Óptica', commissionRate: 0 },
  { code: 'DENTAL', name: 'Convenio Salud Dental', commissionRate: 0 }
];

const NOMBRES = [
  'María José', 'Camila', 'Valentina', 'Javiera', 'Constanza', 'Daniela', 'Fernanda', 'Carolina',
  'Paula', 'Catalina', 'Andrea', 'Karina', 'Marcela', 'Patricia', 'Gloria', 'Pamela',
  'Francisca', 'Bárbara', 'Natalia', 'Lorena', 'Ximena', 'Viviana', 'Soledad', 'Macarena',
  'Rocío', 'Jacqueline', 'Verónica', 'Alejandra', 'Ignacia', 'Paola'
];

const APELLIDOS = [
  'González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva',
  'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'Torres',
  'Araya', 'Flores', 'Espinoza', 'Valenzuela', 'Castillo', 'Tapia', 'Reyes', 'Gutiérrez',
  'Castro', 'Pizarro', 'Álvarez', 'Vásquez', 'Sánchez', 'Huenchullán'
];

// Índices del padrón generado que quedan suspendidas (4 en total)
const INDICES_SUSPENDIDAS = new Set([17, 88, 151, 230]);

const MONTOS_CREDITO = {
  ISIMUNDO: [180000, 320000, 450000, 600000],
  'S.O.S': [100000, 150000, 200000, 300000],
  OPTICA: [80000, 120000, 160000, 200000],
  DENTAL: [120000, 220000, 350000, 450000]
};

const PLAZOS_CUOTAS = [3, 6, 10, 12];

function addMonths(isoMonth, months) {
  const [year, month] = isoMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return date.toISOString().slice(0, 10);
}

function buildCredito(sociaId, k, estado) {
  const tipo = TIPOS_CREDITO[Math.floor(k / 7) % TIPOS_CREDITO.length];
  const monto = MONTOS_CREDITO[tipo.code][k % 4];
  const totalCuotas = PLAZOS_CUOTAS[(k + 1) % PLAZOS_CUOTAS.length];
  const cuotasPagadas = estado === 'FINALIZADO' ? totalCuotas : k % totalCuotas;
  const fechaInicio = addMonths('2026-10', estado === 'FINALIZADO' ? -18 : -cuotasPagadas);

  return {
    id: `cred-${sociaId}-${estado === 'FINALIZADO' ? 'f' : 'a'}`,
    tipo: tipo.code,
    tipoNombre: tipo.name,
    montoSolicitado: monto,
    totalCuotas,
    cuotasPagadas,
    valorCuota: Math.ceil(monto / totalCuotas / 100) * 100,
    comisionAsociacion: Math.round(monto * tipo.commissionRate),
    fechaInicio,
    fechaTermino: addMonths(fechaInicio.slice(0, 7), totalCuotas),
    estado
  };
}

function buildSociasIniciales() {
  const socias = [];
  const conteoPorJardin = new Map();

  // 1. Integrantes de la directiva y cuentas demo que además son socias
  for (const user of INITIAL_USERS) {
    if (!user.jardinId) continue; // El Super Admin no es socia
    socias.push({
      id: `socia-${user.id}`,
      rut: user.rut,
      firstName: user.firstName,
      lastName: user.lastName,
      cargo: ['DIRECTORA', 'EDUCADORA', 'TECNICO'].includes(user.cargo) ? user.cargo : 'EDUCADORA',
      estado: 'ACTIVA',
      jardinId: user.jardinId,
      cargoDirectiva: ['PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA'].includes(user.roleCode)
        ? user.roleCode
        : null,
      esDelegada: user.roleCode === 'DELEGADA',
      fechaIncorporacion: '2015-03-01',
      creditos: [],
      historialJardin: []
    });
    conteoPorJardin.set(user.jardinId, (conteoPorJardin.get(user.jardinId) || 0) + 1);
  }

  // 2. Resto del padrón distribuido entre los 23 jardines
  const restantes = TOTAL_SOCIAS - socias.length;
  for (let k = 0; k < restantes; k++) {
    const jardin = INITIAL_JARDINES[k % INITIAL_JARDINES.length];
    const posicion = conteoPorJardin.get(jardin.id) || 0;
    conteoPorJardin.set(jardin.id, posicion + 1);

    const cuerpo = String(9000000 + k * 37613);
    const id = `socia-${String(k + 1).padStart(3, '0')}`;
    // Nombre según k % 30 y primer apellido desplazado por bloque de 30: nunca se repite la combinación
    const bloque = Math.floor(k / NOMBRES.length);
    const nombre = NOMBRES[k % NOMBRES.length];
    const apellidos = `${APELLIDOS[(k + bloque * 7) % APELLIDOS.length]} ${APELLIDOS[(k * 13 + 5) % APELLIDOS.length]}`;

    const creditos = [];
    if (k % 7 === 3) creditos.push(buildCredito(id, k, 'ACTIVO'));
    if (k % 35 === 10) creditos.push(buildCredito(id, k, 'FINALIZADO'));

    socias.push({
      id,
      rut: formatRutWithDots(cuerpo + computeRutDv(cuerpo)),
      firstName: nombre,
      lastName: apellidos,
      cargo: posicion === 0 ? 'DIRECTORA' : posicion <= 3 ? 'EDUCADORA' : 'TECNICO',
      estado: INDICES_SUSPENDIDAS.has(k) ? 'SUSPENDIDA' : 'ACTIVA',
      jardinId: jardin.id,
      cargoDirectiva: null,
      esDelegada: false,
      fechaIncorporacion: `${2008 + (k % 17)}-${String((k % 12) + 1).padStart(2, '0')}-${String((k % 27) + 1).padStart(2, '0')}`,
      creditos,
      historialJardin: []
    });
  }

  // 3. Una delegada por jardín: la primera educadora activa si el jardín aún no tiene
  for (const jardin of INITIAL_JARDINES) {
    const sociasJardin = socias.filter((s) => s.jardinId === jardin.id);
    if (sociasJardin.some((s) => s.esDelegada)) continue;
    const candidata = sociasJardin.find(
      (s) => s.cargo === 'EDUCADORA' && s.estado === 'ACTIVA' && !s.cargoDirectiva
    );
    if (candidata) candidata.esDelegada = true;
  }

  return socias;
}

export const INITIAL_SOCIAS = buildSociasIniciales();
