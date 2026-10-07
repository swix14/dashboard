import { z } from 'zod';
import { validateRut } from '../utils/rutValidator.js';

export const loginSchema = z.object({
  identifier: z.string().min(3, 'El RUT o correo electrónico es requerido'),
  password: z.string().min(6, 'La contraseña debe contener al menos 6 caracteres')
});

export const registerUserSchema = z.object({
  rut: z.string().refine((val) => validateRut(val), {
    message: 'El RUT proporcionado no es válido'
  }),
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener mínimo 6 caracteres'),
  firstName: z.string().min(2, 'El nombre es obligatorio'),
  lastName: z.string().min(2, 'El apellido es obligatorio'),
  roleCode: z.enum([
    'PRESIDENTA',
    'TESORERA',
    'SECRETARIA',
    'PRIMERA_DIRECTORA',
    'SEGUNDA_DIRECTORA',
    'DELEGADA',
    'SOCIA'
  ])
});
