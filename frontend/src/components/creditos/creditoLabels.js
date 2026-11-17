export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const mesTexto = (mes, anio) => `${MESES[mes - 1]} ${anio}`;

// Estado visible del crédito (lo calcula el backend). Colores pedidos por la directiva en tonos suaves:
// naranjo = quedan 2 cuotas, rojo suave = última cuota, verde = pagado
export const ESTADO_CREDITO = {
  VIGENTE: { label: 'Vigente', variant: 'primary' },
  ULTIMAS_DOS: { label: 'Quedan 2 cuotas', variant: 'warning' },
  ULTIMA_CUOTA: { label: 'Última cuota', variant: 'error' },
  PAGADO: { label: 'Pagado', variant: 'success' }
};

// ANULADO no se ofrece como filtro (los anulados no salen en el historial), pero sí se muestra en la ficha
export const ESTADO_CREDITO_FICHA = { ...ESTADO_CREDITO, ANULADO: { label: 'Anulado', variant: 'neutral' } };

export const ESTADO_CUOTA = {
  pendiente: { label: 'Pendiente', variant: 'neutral' },
  descontada: { label: 'Descontada', variant: 'success' },
  condonada: { label: 'Condonada', variant: 'info' },
  prepagada: { label: 'Prepagada', variant: 'success' }
};

/** Mes actual como AAAA-MM (valor de un <input type="month">) */
export function mesActualInput() {
  const { anio, mes } = periodoActual();
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

/** Fecha de hoy en Chile como AAAA-MM-DD (valor de un <input type="date">) */
export function hoyInput() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}

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
