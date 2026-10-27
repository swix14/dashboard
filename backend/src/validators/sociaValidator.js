import { z } from 'zod';
import { validateRut } from '../utils/rutValidator.js';

const cargoEnum = z.enum(['DIRECTORA', 'EDUCADORA', 'TECNICO'], {
  errorMap: () => ({ message: 'El cargo debe ser DIRECTORA, EDUCADORA o TECNICO' })
});

const estadoEnum = z.enum(['ACTIVA', 'SUSPENDIDA'], {
  errorMap: () => ({ message: 'El estado debe ser ACTIVA o SUSPENDIDA' })
});

export const createSociaSchema = z.object({
  rut: z.string().refine((val) => validateRut(val), {
    message: 'El RUT proporcionado no es válido'
  }),
  firstName: z.string().trim().min(2, 'El nombre es obligatorio'),
  lastName: z.string().trim().min(2, 'Los apellidos son obligatorios'),
  cargo: cargoEnum,
  estado: estadoEnum.optional(),
  jardinId: z.string().min(1, 'Debe seleccionar un jardín')
});

// El RUT no se modifica: identifica a la socia de forma permanente
export const updateSociaSchema = z
  .object({
    firstName: z.string().trim().min(2, 'El nombre es obligatorio').optional(),
    lastName: z.string().trim().min(2, 'Los apellidos son obligatorios').optional(),
    cargo: cargoEnum.optional(),
    estado: estadoEnum.optional(),
    jardinId: z.string().min(1).optional(),
    motivoTraslado: z.string().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo a modificar'
  });
