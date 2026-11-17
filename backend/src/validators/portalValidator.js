import { z } from 'zod';

// Publicación de noticias para el portal de socias
export const noticiaSchema = z.object({
  titulo: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres').max(200, 'El título es demasiado largo'),
  contenido: z
    .string()
    .trim()
    .min(10, 'El contenido debe tener al menos 10 caracteres')
    .max(5000, 'El contenido es demasiado largo'),
  categoria: z.enum(['FEDERACION', 'CONVENIO', 'COMUNICADO', 'BENEFICIO']).default('COMUNICADO'),
  destacado: z.boolean().optional().default(false)
});

// Seguimiento de mensajes del buzón por parte de la directiva
export const estadoBuzonSchema = z.object({
  estado: z.enum(['PENDIENTE', 'LEIDO', 'RESPONDIDO'], { error: 'Estado de mensaje inválido' })
});

export const idParamSchema = z.coerce.number().int().positive();

// Ingreso de socias (la regla del RUT y la clave se revisa en SociaAuthService)
export const sociaLoginSchema = z.object({
  rut: z.string({ error: 'Debe ingresar RUT y contraseña.' }).trim().min(1, 'Debe ingresar RUT y contraseña.').max(100, 'RUT inválido'),
  password: z.string({ error: 'Debe ingresar RUT y contraseña.' }).min(1, 'Debe ingresar RUT y contraseña.').max(100, 'La contraseña es demasiado larga')
});

// La política de contenido de la nueva clave se valida en SociaAuthService
export const sociaCambiarClaveSchema = z.object({
  nuevaClave: z.string({ error: 'Ingrese la nueva contraseña.' }).min(1, 'Ingrese la nueva contraseña.').max(100, 'La contraseña es demasiado larga')
});

const TIPO_BUZON_ALIAS = {
  CONSULTAS: 'CONSULTA',
  SUGERENCIAS: 'SUGERENCIA',
  FELICITACIONES: 'FELICITACION',
  'FELICITACIÓN': 'FELICITACION',
  RECLAMOS: 'RECLAMO'
};

// Mensaje del buzón (llega como multipart: todos los campos son texto)
export const buzonMensajeSchema = z.object({
  // Acepta el código o la etiqueta que enviaban versiones anteriores del portal ("Consultas", "Reclamos"...):
  // antes cualquier valor desconocido se guardaba en silencio como CONSULTA
  tipo: z.preprocess(
    (v) => TIPO_BUZON_ALIAS[String(v ?? '').trim().toUpperCase()] ?? v,
    z.enum(['FELICITACION', 'RECLAMO', 'SUGERENCIA', 'CONSULTA', 'OTRO'], { error: 'Tipo de mensaje inválido' })
  ),
  asunto: z.string({ error: 'El asunto del mensaje es obligatorio.' }).trim().min(3, 'El asunto debe tener al menos 3 caracteres').max(200, 'El asunto es demasiado largo'),
  mensaje: z.string({ error: 'El cuerpo del mensaje no puede estar vacío.' }).trim().min(5, 'El mensaje debe tener al menos 5 caracteres').max(5000, 'El mensaje es demasiado largo')
});
