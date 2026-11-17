import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, KeyRound, Lock } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Button } from '../common/Button.jsx';
import { api } from '../../services/api.js';

// Misma política que valida el servidor (SociaAuthService.cambiarClave)
const schema = z
  .object({
    claveActual: z.string().min(1, 'Ingrese su contraseña actual'),
    nuevaClave: z.string().min(6, 'Mínimo 6 caracteres').max(100, 'La contraseña es demasiado larga'),
    confirmar: z.string()
  })
  .refine((d) => d.nuevaClave === d.confirmar, { message: 'Las contraseñas no coinciden', path: ['confirmar'] })
  .refine((d) => d.nuevaClave !== d.claveActual, { message: 'Debe ser distinta a la actual', path: ['nuevaClave'] });

/** Cambio voluntario de contraseña desde el portal de socias (pide la clave actual). */
export function SociaChangePasswordModal({ onClose }) {
  const [serverError, setServerError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({ resolver: zodResolver(schema), defaultValues: { claveActual: '', nuevaClave: '', confirmar: '' } });

  const onSubmit = async (data) => {
    try {
      setIsSaving(true);
      setServerError(null);
      await api.post('/socia/cambiar-clave', { claveActual: data.claveActual, nuevaClave: data.nuevaClave });
      setDone(true);
    } catch (err) {
      setServerError(err.response?.data?.message || 'No fue posible cambiar la contraseña.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Cambiar contraseña" subtitle="Actualice su clave de acceso al portal." onClose={onClose} maxWidth="440px">
      {done ? (
        <div className="pwd-form">
          <p role="status" className="pwd-aviso is-ok">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>Contraseña actualizada. Las sesiones abiertas en otros equipos se cerraron.</span>
          </p>
          <div className="pwd-acciones">
            <Button type="button" variant="primary" onClick={onClose}>
              Listo
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="pwd-form" noValidate>
          {serverError && (
            <p role="alert" className="pwd-aviso is-error">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{serverError}</span>
            </p>
          )}
          <Input
            label="Contraseña actual"
            type="password"
            icon={Lock}
            autoComplete="current-password"
            error={errors.claveActual?.message}
            {...register('claveActual')}
          />
          <Input
            label="Nueva contraseña"
            type="password"
            icon={KeyRound}
            autoComplete="new-password"
            helperText="Mínimo 6 caracteres. No puede ser la clave inicial (6 primeros dígitos del RUT)."
            error={errors.nuevaClave?.message}
            {...register('nuevaClave')}
          />
          <Input
            label="Repita la nueva contraseña"
            type="password"
            icon={KeyRound}
            autoComplete="new-password"
            error={errors.confirmar?.message}
            {...register('confirmar')}
          />
          <div className="pwd-acciones">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              Guardar contraseña
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default SociaChangePasswordModal;
