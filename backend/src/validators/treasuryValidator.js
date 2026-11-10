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
export const movementSchema = z.object({
  // SALDO_APERTURA no se acepta por la API: los saldos de apertura se cargan solo con data.sql
  tipo: z.enum(['INGRESO', 'EGRESO'], {
    errorMap: () => ({ message: 'El tipo de movimiento debe ser INGRESO o EGRESO' })
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
    errorMap: () => ({ message: 'Centro de costo no válido. Opciones: ASOCIACION, CENA ANUAL, FEDERACION, ISI MUNDO COMISION' })
  }),
  categoria: z.string().trim().optional(),
  monto: z.coerce
    .number({ invalid_type_error: 'El monto debe ser un valor numérico' })
    .positive('El monto debe ser superior a 0')
    .int('El monto debe ser un número entero en pesos chilenos (CLP) sin decimales'),
  metodo: z.string().trim().min(2, 'El método de pago es requerido'),
  comprobante: z.string().nullable().optional()
});
