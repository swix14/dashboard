import { z } from 'zod';

// Centros de costo oficiales según estatuto gremial
export const CENTROS_COSTO_VALIDOS = [
  'ASOCIACION',
  'CENA ANUAL',
  'FEDERACION',
  'ISI MUNDO COMISION'
];

/**
 * Validador estricto para movimientos de Tesorería.
 * Soporta JSON y multipart/form-data.
 */
// Máximo por movimiento: $100.000.000 CLP
export const MONTO_MAXIMO = 100_000_000;

export const movementSchema = z.object({
  // SALDO_APERTURA no se acepta por la API: los saldos de apertura se cargan solo con data.sql
  tipo: z.enum(['INGRESO', 'EGRESO'], {
    error: 'El tipo de movimiento debe ser INGRESO o EGRESO'
  }),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)')
    .refine((val) => {
      const [year, month, day] = val.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return (
        d.getFullYear() === year &&
        d.getMonth() === month - 1 &&
        d.getDate() === day &&
        year >= 2020 &&
        year <= 2100
      );
    }, 'La fecha indicada no corresponde a una fecha válida en el calendario'),
  descripcion: z.string().trim().min(3, 'La descripción debe tener al menos 3 caracteres'),
  centroCosto: z.enum(CENTROS_COSTO_VALIDOS, {
    error: 'Centro de costo no válido. Opciones: ASOCIACION, CENA ANUAL, FEDERACION, ISI MUNDO COMISION'
  }),
  categoria: z.string().trim().optional(),
  monto: z.coerce
    .number({ error: 'El monto debe ser un valor numérico' })
    .positive('El monto debe ser superior a 0')
    // Tope de negocio (auditoría H-026): ningún movimiento de la Asociación se acerca a esta cifra
    // y evita desbordar la columna INT de MySQL
    .max(MONTO_MAXIMO, `El monto no puede superar ${MONTO_MAXIMO.toLocaleString('es-CL')} CLP`)
    .int('El monto debe ser un número entero en pesos chilenos (CLP) sin decimales'),
  metodo: z.string().trim().min(2, 'El método de pago es requerido'),
  comprobante: z.string().nullable().optional()
});

// Corrección de un movimiento: los mismos datos del alta, salvo el tipo (no se cambia)
export const updateMovementSchema = movementSchema.omit({ tipo: true, comprobante: true });

export const annulMovementSchema = z.object({
  motivo: z.string({ error: 'Indique el motivo de la anulación' }).trim()
    .min(3, 'Indique el motivo de la anulación').max(255, 'El motivo es demasiado largo')
});

const fechaFiltro = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)')
  .optional()
  .or(z.literal('').transform(() => undefined));

// Filtros del listado de movimientos (auditoría H-019)
export const listMovementsSchema = z.object({
  tipo: z.enum(['TODOS', 'INGRESO', 'EGRESO', 'SALDO_APERTURA']).optional(),
  centroCosto: z.enum(['TODOS', ...CENTROS_COSTO_VALIDOS]).optional(),
  metodo: z.string().trim().max(50).optional(),
  fechaDesde: fechaFiltro,
  fechaHasta: fechaFiltro,
  fechaExacta: fechaFiltro
});

// Suplencia de Tesorería (solo Admin): activa o desactiva a la Directora que reemplaza a la Tesorera
export const suplenciaSchema = z.object({
  activa: z.boolean({ message: 'Indique si la suplencia queda activa o no.' }),
  suplenteId: z.coerce.number().int().positive().optional()
});
