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
  estado: z.enum(['TODOS', 'VIGENTE', 'ULTIMAS_DOS', 'ULTIMA_CUOTA', 'PAGADO']).default('TODOS'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const entero = (label, min, max) =>
  z.coerce.number({ error: `${label}: ingrese un número.` }).int(`${label}: debe ser un número entero.`)
    .min(min, `${label}: mínimo ${min.toLocaleString('es-CL')}.`).max(max, `${label}: máximo ${max.toLocaleString('es-CL')}.`);
const numeroCredito = z.string().trim().max(40, 'N° de crédito demasiado largo').optional().nullable()
  .transform((v) => (v ? v : null));
// En zod v4 una unión con z.undefined() no vuelve opcional la clave: se usa .optional()
const montoOtorgado = z.union([z.literal(''), z.null(), entero('Monto otorgado', 0, 100000000)]).optional()
  .transform((v) => (v === '' || v == null ? null : v));

const datosCredito = {
  numeroCredito,
  montoOtorgado,
  valorCuota: entero('Valor cuota', 1, 10000000),
  totalCuotas: entero('Total de cuotas', 1, 120)
};

// Nuevo crédito ingresado a mano (sin planilla)
export const crearCreditoSchema = z
  .object({
    sociaId: z.coerce.number({ error: 'Seleccione la socia.' }).int().positive('Seleccione la socia.'),
    empresa: z.enum(CODIGOS, { error: 'Seleccione la empresa.' }),
    ...datosCredito,
    primeraCuota: z.string({ error: 'Indique el mes de la primera cuota.' }).regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes de la primera cuota inválido.')
      .transform((v) => ({ anio: Number(v.slice(0, 4)), mes: Number(v.slice(5, 7)) }))
      .refine((p) => p.anio >= 2015 && p.anio <= 2100, 'Mes de la primera cuota inválido.'),
    cuotasPagadas: entero('Cuotas ya pagadas', 0, 120).default(0),
    fechaOtorgamiento: z.union([z.literal(''), z.null(), z.string().regex(FECHA, 'Fecha de otorgamiento inválida.')]).optional()
      .transform((v) => v || null)
  })
  .superRefine((d, ctx) => {
    if (d.empresa === 'ISIMUNDO' && !d.numeroCredito) ctx.addIssue({ code: 'custom', message: 'ISIMUNDO requiere el N° de crédito.', path: ['numeroCredito'] });
    if (d.cuotasPagadas >= d.totalCuotas) ctx.addIssue({ code: 'custom', message: 'Las cuotas ya pagadas deben ser menos que el total.', path: ['cuotasPagadas'] });
  });

export const editarCreditoSchema = z.object(datosCredito);

export const anularCreditoSchema = z.object({
  motivo: z.string({ error: 'Indique el motivo de la anulación.' }).trim().min(3, 'Indique el motivo de la anulación.').max(255, 'Motivo demasiado largo.')
});

// % de comisión de Isi Mundo: entre 0 y 20, hasta 2 decimales (ej. 2 o 2,5)
export const comisionPctSchema = z.object({
  pct: z.coerce.number({ error: 'Indique el porcentaje.' }).min(0, 'El porcentaje no puede ser negativo.')
    .max(20, 'El porcentaje no puede superar el 20 %.')
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-9, 'Use como máximo 2 decimales.')
});

// Registro de la comisión en Tesorería: monto (ajustable) y fecha en que llegó
export const registrarComisionSchema = z.object({
  monto: entero('Monto de la comisión', 1, 100000000),
  fecha: z.string({ error: 'Indique la fecha.' }).regex(FECHA, 'Fecha inválida.')
});

// Monto A PAGAR de una empresa en un mes, ingresado a mano (mes sin planilla o corrección)
export const aPagarSchema = periodoSchema.extend({
  empresa: z.enum(CODIGOS, { error: 'Seleccione la empresa.' }),
  monto: entero('Monto a pagar', 1, 1000000000)
});

export const prepagoSchema = z.object({
  fecha: z.string({ error: 'Indique la fecha del pago.' }).regex(FECHA, 'Fecha del pago inválida.')
});

export { CODIGOS as CODIGOS_EMPRESA };
