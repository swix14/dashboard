/** Etiquetas y opciones compartidas por las vistas del padrón de socias */

export const CARGOS = [
  { value: 'DIRECTORA', label: 'Directora' },
  { value: 'EDUCADORA', label: 'Educadora' },
  { value: 'TECNICO', label: 'Técnico' },
  { value: 'ASISTENTE', label: 'Asistente' },
  { value: 'AUXILIAR', label: 'Auxiliar' },
  { value: 'SIN DATO', label: 'Sin dato' }
];

export const CARGO_LABELS = Object.fromEntries(CARGOS.map((c) => [c.value, c.label]));

export const ESTADO_BADGE = {
  ACTIVA: { variant: 'success', label: 'Activa' },
  SUSPENDIDA: { variant: 'warning', label: 'Suspendida' },
  RETIRADA: { variant: 'neutral', label: 'Retirada' }
};

export const CREDITO_ESTADO_BADGE = {
  VIGENTE: { variant: 'warning', label: 'Vigente' },
  FINALIZADO: { variant: 'success', label: 'Pagado' },
  ANULADO: { variant: 'neutral', label: 'Anulado' }
};

export const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  marginBottom: '0.375rem'
};

export function nombreCompleto(s) {
  return [s?.nombres, s?.apellidoPaterno, s?.apellidoMaterno].filter(Boolean).join(' ');
}
