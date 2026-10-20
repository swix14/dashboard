import { z } from 'zod';

export const movementSchema = z.object({
  tipo: z.enum(['INGRESO', 'EGRESO'], {
    required_error: 'El tipo de movimiento es obligatorio (INGRESO o EGRESO)'
  }),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)'),
  descripcion: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
  centroCosto: z.string().min(1, 'El centro de costo es requerido'),
  categoria: z.string().optional(),
  monto: z.number().positive('El monto debe ser superior a 0'),
  metodo: z.string().min(2, 'El método de pago es requerido'),
  comprobante: z.string().nullable().optional()
});
