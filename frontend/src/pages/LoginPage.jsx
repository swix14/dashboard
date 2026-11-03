import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Mail, ShieldAlert, ArrowRight, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Input } from '../components/common/Input.jsx';
import { Button } from '../components/common/Button.jsx';
import { ThemeToggle } from '../components/common/ThemeToggle.jsx';

const loginFormSchema = z.object({
  identifier: z.string().min(3, 'Ingrese su correo institucional o RUT'),
  password: z.string().min(6, 'La contraseña debe contener al menos 6 caracteres')
});

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      identifier: '',
      password: ''
    }
  });

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      setAuthError(null);
      await login(data.identifier, data.password);
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      setAuthError(
        err.response?.data?.message || err.message || 'Error al iniciar sesión'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="login-page"
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-page)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem'
      }}
    >
      <div
        className="login-form-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem 2rem',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Cabecera institucional con Logo y selector de tema */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginBottom: '1.75rem',
            position: 'relative'
          }}
        >
          <div style={{ position: 'absolute', right: 0, top: 0 }}>
            <ThemeToggle size="sm" />
          </div>

          <img
            src="/logo-vtf.png"
            alt="Logo Asociación VTF Temuco"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              objectFit: 'cover',
              backgroundColor: 'white',
              padding: '2px',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '0.875rem'
            }}
          />

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--sigav-soft, rgba(114, 86, 130, 0.1))',
              border: '1px solid var(--border-light)',
              padding: '0.2rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--primary-600)',
              marginBottom: '0.5rem'
            }}
          >
            <span>Vía Transferencia de Fondos</span>
          </div>

          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              lineHeight: 1.2
            }}
          >
            Asociación VTF Temuco
          </h1>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginTop: '0.35rem'
            }}
          >
            Plataforma oficial de gestión administrativa y tesorería
          </p>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Acceso Institucional
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Ingrese su correo registrado o RUT junto con su contraseña.
          </p>
        </div>

        {authError && (
          <div
            style={{
              backgroundColor: 'var(--error-bg)',
              color: 'var(--error-text)',
              border: '1px solid var(--error-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem'
            }}
          >
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Correo Electrónico o RUT"
            placeholder="ej. tesorera@vtf.cl o 14.567.890-2"
            icon={Mail}
            error={errors.identifier?.message}
            {...register('identifier')}
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            icon={Lock}
            error={errors.password?.message}
            {...register('password')}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              fontSize: '0.8125rem'
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <input type="checkbox" defaultChecked />
              <span>Recordar sesión</span>
            </label>

            <span
              style={{
                color: 'var(--primary-600)',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer'
              }}
            >
              ¿Olvidó su contraseña?
            </span>
          </div>

          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            icon={ArrowRight}
            style={{ width: '100%', padding: '0.75rem' }}
          >
            Ingresar al Sistema
          </Button>
        </form>

        {/* Acceso Diferenciado para Socias de la Asociación */}
        <div style={{ marginTop: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '1.25rem 0 1rem 0',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.04em'
            }}
          >
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
            <span style={{ padding: '0 0.75rem', textTransform: 'uppercase' }}>
              ¿Eres Socia de la Asociación?
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/socia/login')}
            icon={Users}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderColor: 'var(--primary-300)',
              color: 'var(--primary-700)',
              fontWeight: 600,
              backgroundColor: 'var(--sigav-soft, rgba(114, 86, 130, 0.06))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            Acceso Socias
          </Button>
        </div>

        <div
          style={{
            marginTop: '2rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.5
          }}
        >
          🔒 Conexión segura y cifrada con verificación de permisos en backend según rol institucional.
        </div>
      </div>
    </div>
  );
}
