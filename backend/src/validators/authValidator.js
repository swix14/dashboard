import { z } from 'zod';

// Topes de largo (auditoría H-019): un texto gigante no debe llegar a bcrypt ni a la base
export const loginSchema = z.object({
  identifier: z.string().min(3, 'Ingrese su RUT').max(100, 'RUT inválido'),
  password: z.string().min(6, 'La contraseña debe contener al menos 6 caracteres').max(100, 'La contraseña es demasiado larga')
});

// La política de contenido (largo, letras y números, claves prohibidas) se valida en AuthService
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingrese su contraseña actual').max(100, 'La contraseña es demasiado larga'),
  newPassword: z.string().min(1, 'Ingrese la nueva contraseña').max(100, 'La contraseña es demasiado larga')
});
