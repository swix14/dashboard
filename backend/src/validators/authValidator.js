import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(3, 'El RUT o correo electrónico es requerido'),
  password: z.string().min(6, 'La contraseña debe contener al menos 6 caracteres')
});

// La política de contenido (largo, letras y números, claves prohibidas) se valida en AuthService
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingrese su contraseña actual'),
  newPassword: z.string().min(1, 'Ingrese la nueva contraseña').max(100, 'La contraseña es demasiado larga')
});
