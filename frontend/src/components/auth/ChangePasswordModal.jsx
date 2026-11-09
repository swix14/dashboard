import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Lock, LogOut } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Button } from '../common/Button.jsx';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

// Misma política que valida el servidor (AuthService.validatePasswordPolicy)
const schema = z
  .object({
    currentPassword: z.string().min(1, 'Ingrese su contraseña actual'),
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, 'Debe incluir al menos una letra')
      .regex(/\d/, 'Debe incluir al menos un número'),
    confirmPassword: z.string()
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword']
  });

/**
 * Cambio de contraseña de la directiva.
 * En el primer ingreso es bloqueante: no se puede cerrar hasta cambiar la clave.
 */
export function ChangePasswordModal({ mandatory = false, onDone, onClose }) {
  const { token, setAuthenticatedSession, logout } = useAuth();
  const [serverError, setServerError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
  });

  const onSubmit = async (data) => {
    try {
      setIsSaving(true);
      setServerError(null);
      const res = await api.post('/auth/cambiar-clave', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      setAuthenticatedSession(token, res.data.data.user);
      onDone?.();
    } catch (err) {
      setServerError(err.response?.data?.message || 'No fue posible cambiar la contraseña.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      title={mandatory ? 'Cree su contraseña personal' : 'Cambiar contraseña'}
      subtitle={
        mandatory
          ? 'Por seguridad, la clave inicial debe cambiarse antes de usar el sistema.'
          : 'Actualice su contraseña de acceso.'
      }
      onClose={onClose || (() => {})}
      dismissible={!mandatory}
      maxWidth="460px"
    >
      <form onSubmit={handleSubmit(onSubmit)} style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
        {serverError && (
          <div role="alert" className="vtf-alert-error" style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            color: 'var(--error-text)',
            fontSize: '0.8125rem'
          }}>
            {serverError}
          </div>
        )}

        <Input
          label="Contraseña actual"
          type="password"
          icon={Lock}
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <Input
          label="Nueva contraseña"
          type="password"
          icon={KeyRound}
          autoComplete="new-password"
          helperText="Mínimo 8 caracteres, con letras y números."
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label="Repita la nueva contraseña"
          type="password"
          icon={KeyRound}
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {mandatory && (
            <Button type="button" variant="outline" icon={LogOut} onClick={logout}>
              Cerrar sesión
            </Button>
          )}
          <Button type="submit" variant="primary" isLoading={isSaving}>
            Guardar contraseña
          </Button>
        </div>
      </form>
    </Modal>
  );
}
