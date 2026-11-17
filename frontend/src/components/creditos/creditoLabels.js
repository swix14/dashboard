export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const mesTexto = (mes, anio) => `${MESES[mes - 1]} ${anio}`;

// Estado visible del crédito (lo calcula el backend)
export const ESTADO_CREDITO = {
  VIGENTE: { label: 'Vigente', variant: 'primary' },
  ULTIMA_CUOTA: { label: 'Última cuota', variant: 'warning' },
  PAGADO: { label: 'Pagado', variant: 'success' }
};

export const ESTADO_CUOTA = {
  pendiente: { label: 'Pendiente', variant: 'neutral' },
  descontada: { label: 'Descontada', variant: 'success' },
  condonada: { label: 'Condonada', variant: 'info' }
};

export const EMPRESAS = [
  { codigo: 'SOS', nombre: 'S.O.S' },
  { codigo: 'ISIMUNDO', nombre: 'ISIMUNDO' },
  { codigo: 'OPTICA', nombre: 'Óptica' },
  { codigo: 'DENTAL', nombre: 'Dental' },
  { codigo: 'ABOGADA', nombre: 'Abogada' }
];

/** Mes y año actuales en hora de Chile */
export function periodoActual() {
  const [anio, mes] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' })
    .format(new Date())
    .split('-')
    .map(Number);
  return { anio, mes };
}

/** Años ofrecidos en los selectores: desde 2026 hasta el próximo */
export function aniosDisponibles() {
  const { anio } = periodoActual();
  return Array.from({ length: Math.max(anio + 1 - 2026 + 1, 1) }, (_, i) => anio + 1 - i);
}
