import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Mail, ShieldAlert, ArrowRight, CheckCircle2, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Input } from '../components/common/Input.jsx';
import { Button } from '../components/common/Button.jsx';
import { ThemeToggle } from '../components/common/ThemeToggle.jsx';

const loginFormSchema = z.object({
  identifier: z.string().min(3, 'Ingrese su correo institucional o RUT'),
  password: z.string().min(6, 'La contraseña debe contener al menos 6 caracteres')
});

const DEMO_ACCOUNTS = [
  { role: 'Tesorera', email: 'tesorera@vtf.cl', desc: 'Control financiero total, cuotas, créditos y pagos' },
  { role: 'Presidenta', email: 'presidenta@vtf.cl', desc: 'Supervisión general, rendición e informes' },
  { role: 'Secretaria', email: 'secretaria@vtf.cl', desc: 'Gestión de 280 socias y 23 jardines' },
  { role: 'Delegada', email: 'delegada.bambi@vtf.cl', desc: 'Transparencia de jardín y fondo común' },
  { role: 'Socia', email: 'socia.educadora@vtf.cl', desc: 'Consulta institucional individual' }
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      identifier: 'tesorera@vtf.cl',
      password: 'Admin123!'
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

  const handleSelectDemo = (email) => {
    setValue('identifier', email);
    setValue('password', 'Admin123!');
    setAuthError(null);
  };

  return (
    <div
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
        style={{
          width: '100%',
          maxWidth: '1000px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
          alignItems: 'stretch'
        }}
      >
        {/* Columna Izquierda: Información Institucional y Selector Rápido */}
        <div
          style={{
            backgroundColor: 'var(--login-hero-bg)',
            color: 'var(--login-hero-text)',
            borderRadius: 'var(--radius-xl)',
            padding: '2.5rem 2rem',
            border: '1px solid var(--login-hero-border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-lg)',
            transition: 'background-color var(--transition-normal), border-color var(--transition-normal)'
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--login-hero-card-bg)',
                border: '1px solid var(--login-hero-card-border)',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.03em',
                marginBottom: '1.25rem'
              }}
            >
              <span>Vía Transferencia de Fondos (VTF)</span>
            </div>

            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: 'var(--login-hero-text)',
                lineHeight: 1.25,
                marginBottom: '1rem'
              }}
            >
              Asociación de Jardines VTF
            </h1>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--login-hero-text-muted)',
                lineHeight: 1.6,
                marginBottom: '2rem'
              }}
            >
              Plataforma centralizada de gestión administrativa, financiera y de transparencia
              para 280 socias distribuidas en 23 jardines infantiles.
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--sand-300)',
                  letterSpacing: '0.05em',
                  marginBottom: '0.75rem'
                }}
              >
                Cuentas de Demostración por Rol (V1)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleSelectDemo(acc.email)}
                    style={{
                      background: 'var(--login-hero-card-bg)',
                      border: '1px solid var(--login-hero-card-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.625rem 0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: 'var(--login-hero-text)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--login-hero-card-hover)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--login-hero-card-bg)';
                      e.currentTarget.style.borderColor = 'var(--login-hero-card-border)';
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        {acc.role} ({acc.email})
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--login-hero-text-muted)' }}>
                        {acc.desc}
                      </div>
                    </div>
                    <UserCheck size={16} style={{ opacity: 0.8 }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--login-hero-text-muted)',
              borderTop: '1px solid var(--login-hero-card-border)',
              paddingTop: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>Clave demo unificada: <strong>Admin123!</strong></span>
            <span>Versión 1.0</span>
          </div>
        </div>

        {/* Columna Derecha: Formulario de Login */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-xl)',
            padding: '2.5rem 2rem',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1.75rem'
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Acceso Institucional
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Ingrese su correo registrado o RUT junto con su contraseña.
              </p>
            </div>
            <ThemeToggle size="sm" />
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
    </div>
  );
}
