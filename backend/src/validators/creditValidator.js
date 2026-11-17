import { z } from 'zod';

const CODIGOS = ['SOS', 'ISIMUNDO', 'OPTICA', 'DENTAL', 'ABOGADA'];

// Mes y año del período (vienen como texto en multipart y query string)
export const periodoSchema = z.object({
  mes: z.coerce.number({ error: 'Indique el mes.' }).int().min(1, 'Mes inválido').max(12, 'Mes inválido'),
  anio: z.coerce.number({ error: 'Indique el año.' }).int().min(2020, 'Año inválido').max(2100, 'Año inválido')
});

export const listCreditosSchema = z.object({
  search: z.string().trim().max(100, 'Búsqueda demasiado larga').optional(),
  convenio: z.enum(['TODOS', ...CODIGOS]).default('TODOS'),
  estado: z.enum(['TODOS', 'VIGENTE', 'ULTIMA_CUOTA', 'PAGADO']).default('TODOS'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export { CODIGOS as CODIGOS_EMPRESA };
