import { z } from 'zod';
import { validateRut } from '../utils/rutValidator.js';
import { CARGOS, normalizeCelular, normalizeName } from '../utils/sociaFormat.js';

const cargoEnum = z.enum(CARGOS, {
  error: `El cargo debe ser uno de: ${CARGOS.join(', ')}`
});

// RETIRADA no se asigna desde el formulario: se usa la acción "Retirar socia" (con motivo)
const estadoEditable = z.enum(['ACTIVA', 'SUSPENDIDA'], {
  error: 'El estado debe ser ACTIVA o SUSPENDIDA'
});

const nombre = (label) => z.string().transform(normalizeName).pipe(z.string().min(2, `${label} es obligatorio`));

const celular = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    const normalized = normalizeCelular(v);
    if (normalized === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Celular inválido: use 9 dígitos, ej. +56912345678' });
      return z.NEVER;
    }
    return normalized;
  });

const correo = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v && v.trim() ? v.trim().toLowerCase() : null))
  .pipe(z.union([z.string().email('Correo electrónico inválido'), z.null(), z.undefined()]));

const fechaIngreso = z
  .union([z.string(), z.null()])
  .optional()
  .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), {
    message: 'Fecha de ingreso inválida (use AAAA-MM-DD)'
  })
  .transform((v) => (v === undefined ? undefined : v || null));

const jardinId = z.coerce.number({ error: 'Debe seleccionar un jardín' }).int().positive('Debe seleccionar un jardín');

export const createSociaSchema = z.object({
  rut: z.string().refine((val) => validateRut(val), { message: 'El RUT proporcionado no es válido' }),
  nombres: nombre('El nombre'),
  apellidoPaterno: nombre('El apellido paterno'),
  apellidoMaterno: z.string().optional().transform((v) => (v ? normalizeName(v) : '')),
  cargo: cargoEnum,
  estado: estadoEditable.optional().default('ACTIVA'),
  jardinId,
  celular,
  correo,
  fechaIngreso
});

// El RUT no se modifica: identifica a la socia de forma permanente
export const updateSociaSchema = z
  .object({
    nombres: nombre('El nombre').optional(),
    apellidoPaterno: nombre('El apellido paterno').optional(),
    apellidoMaterno: z.string().optional().transform((v) => (v === undefined ? undefined : normalizeName(v))),
    cargo: cargoEnum.optional(),
    estado: estadoEditable.optional(),
    jardinId: jardinId.optional(),
    motivoTraslado: z.string().optional(),
    celular,
    correo,
    fechaIngreso,
    esDelegada: z.boolean().optional()
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Debe enviar al menos un campo a modificar'
  });

export const retirarSociaSchema = z.object({
  motivo: z.string().trim().min(3, 'Indique el motivo del retiro')
});

export const listSociasSchema = z.object({
  // Filtros acotados (auditoría H-019): texto con tope y jardín como TODOS, SIN_JARDIN o un número
  search: z.string().max(100, 'Búsqueda demasiado larga').optional(),
  jardinId: z
    .string()
    .regex(/^(TODOS|SIN_JARDIN|\d{1,6})$/, 'Jardín inválido')
    .optional(),
  estado: z.enum(['TODOS', 'ACTIVA', 'SUSPENDIDA', 'RETIRADA']).optional().default('TODOS'),
  cargo: z.string().max(30, 'Cargo inválido').optional(),
  credito: z.enum(['TODOS', 'SI', 'NO']).optional().default('TODOS'),
  page: z.coerce.number().int().min(1).optional().default(1),
  // limit=0 devuelve todo (exportación), con tope de seguridad en el servicio
  limit: z.coerce.number().int().min(0).max(5000).optional().default(20)
});
