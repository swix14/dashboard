import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Lock,
  UserCheck,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Info,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { Input } from '../components/common/Input.jsx';
import { Button } from '../components/common/Button.jsx';
import { ThemeToggle } from '../components/common/ThemeToggle.jsx';
import { Modal } from '../components/common/Modal.jsx';

const sociaLoginSchema = z.object({
  rut: z.string().min(8, 'Ingrese un RUT válido (ej. 12.345.678-5)'),
  password: z.string().min(4, 'Ingrese su contraseña')
});

const cambiarClaveSchema = z
  .object({
    nuevaClave: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
    confirmarClave: z.string().min(6, 'Debe confirmar su nueva contraseña')
  })
  .refine((data) => data.nuevaClave === data.confirmarClave, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarClave']
  });

export function SociaLoginPage() {
  const navigate = useNavigate();
  const { setAuthenticatedSession } = useAuth();

  const [authError, setAuthError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Estado para el modal de cambio obligatorio de clave
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [provisionalSession, setProvisionalSession] = useState(null);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalSuccess, setModalSuccess] = useState(false);

  const {
    register: registerLogin,
    handleSubmit: handleSubmitLogin,
    formState: { errors: loginErrors }
  } = useForm({
    resolver: zodResolver(sociaLoginSchema),
    defaultValues: { rut: '', password: '' }
  });

  const {
    register: registerPass,
    handleSubmit: handleSubmitPass,
    reset: resetPassForm,
    formState: { errors: passErrors }
  } = useForm({
    resolver: zodResolver(cambiarClaveSchema),
    defaultValues: { nuevaClave: '', confirmarClave: '' }
  });

  const onSubmitLogin = async (data) => {
    try {
      setIsLoading(true);
      setAuthError(null);

      const response = await api.post('/socia/login', {
        rut: data.rut.trim(),
        password: data.password.trim()
      });

      const { token, socia } = response.data.data;

      // Si es primer ingreso, abrimos modal obligatorio de cambio de clave
      if (socia.primerIngreso) {
        setProvisionalSession({ token, socia });
        setShowPasswordModal(true);
        return;
      }

      // Si ya tiene contraseña personalizada previa, iniciamos sesión normalmente
      const userSession = {
        id: `socia-${socia.id}`,
        sociaId: socia.id,
        rut: socia.rut,
        firstName: socia.nombreCompleto,
        lastName: '',
        role: { id: 'role-socia', code: 'SOCIA', name: 'Socia' },
        cargo: socia.cargo,
        jardin: socia.jardin,
        primerIngreso: false
      };

      setAuthenticatedSession(token, userSession);
      navigate('/socia/portal', { replace: true });
    } catch (err) {
      setAuthError(
        err.response?.data?.message ||
          err.message ||
          'Error al validar credenciales de socia'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitCambioClave = async (data) => {
    if (!provisionalSession) return;
    try {
      setIsChangingPass(true);
      setModalError(null);

      const res = await api.post(
        '/socia/cambiar-clave',
        { nuevaClave: data.nuevaClave },
        { headers: { Authorization: `Bearer ${provisionalSession.token}` } }
      );

      const { socia, token } = res.data.data;
      setModalSuccess(true);

      const updatedUser = {
        id: `socia-${socia.id}`,
        sociaId: socia.id,
        rut: socia.rut,
        firstName: socia.nombreCompleto,
        lastName: '',
        role: { id: 'role-socia', code: 'SOCIA', name: 'Socia' },
        cargo: socia.cargo,
        jardin: socia.jardin,
        primerIngreso: false
      };

      // Breve pausa para que la socia vea la confirmación visual de éxito
      setTimeout(() => {
        setAuthenticatedSession(token || provisionalSession.token, updatedUser);
        setShowPasswordModal(false);
        navigate('/socia/portal', { replace: true });
      }, 1200);
    } catch (err) {
      setModalError(
        err.response?.data?.message ||
          err.message ||
          'Error al actualizar su contraseña'
      );
    } finally {
      setIsChangingPass(false);
    }
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
          maxWidth: '480px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem 2rem',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Cabecera institucional de Socias */}
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

          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              backgroundColor: 'var(--sigav-soft, rgba(114, 86, 130, 0.12))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-600)',
              marginBottom: '1rem',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--primary-200)'
            }}
          >
            <UserCheck size={34} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: 'var(--sigav-soft, rgba(114, 86, 130, 0.1))',
              border: '1px solid var(--border-light)',
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--primary-700)',
              marginBottom: '0.5rem'
            }}
          >
            <Sparkles size={13} />
            <span>Portal Exclusivo de Socias</span>
          </div>

          <h1
            style={{
              fontSize: '1.45rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              lineHeight: 1.2
            }}
          >
            Asociación de Jardines VTF
          </h1>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              marginTop: '0.35rem'
            }}
          >
            Ingreso individual para socias de jardines infantiles de Temuco
          </p>
        </div>

        {/* Tarjeta Explicativa de Primer Ingreso */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-light)',
            borderLeft: '4px solid var(--primary-500)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            marginBottom: '1.5rem',
            fontSize: '0.8125rem',
            color: 'var(--text-main)',
            lineHeight: 1.5
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 700,
              color: 'var(--primary-700)',
              marginBottom: '0.35rem'
            }}
          >
            <Info size={16} />
            <span>¿Es tu primera vez ingresando?</span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Tu contraseña inicial son los <strong>primeros 6 dígitos de tu RUT</strong> (sin puntos ni guion).
            <br />
            <em>Ejemplo: Si tu RUT es <strong>12.345.678-5</strong>, tu clave inicial es <strong>123456</strong>.</em>
            <br />
            Al entrar se te solicitará crear tu propia contraseña personal.
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
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmitLogin(onSubmitLogin)}>
          <Input
            label="RUT de la Socia"
            placeholder="ej. 12.345.678-5 o 12345678-5"
            icon={UserCheck}
            error={loginErrors.rut?.message}
            {...registerLogin('rut')}
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="Primeros 6 dígitos de tu RUT"
            icon={Lock}
            error={loginErrors.password?.message}
            {...registerLogin('password')}
          />

          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            icon={ArrowRight}
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
          >
            Ingresar a mi Portal
          </Button>
        </form>

        {/* Botón de retorno al Login Institucional de Directiva */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)'
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = 'var(--primary-600)')}
            onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <ArrowLeft size={14} />
            <span>Volver al acceso institucional (Directiva / Admin)</span>
          </button>
        </div>
      </div>

      {/* Modal Obligatorio de Cambio de Contraseña en Primer Ingreso */}
      {showPasswordModal && (
        <Modal
          title="Cambio Obligatorio de Contraseña"
          subtitle={`Bienvenida ${provisionalSession?.socia?.nombreCompleto || 'Socia'}. Por seguridad institucional, debes establecer una contraseña personal antes de ingresar a tu portal.`}
          onClose={() => {
            setShowPasswordModal(false);
            setProvisionalSession(null);
            resetPassForm();
          }}
          maxWidth="480px"
        >
          {modalSuccess ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--success-bg, rgba(46, 125, 50, 0.1))',
                  color: 'var(--success-text, #2e7d32)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                ¡Contraseña Establecida con Éxito!
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                Redirigiendo a tu portal de socia...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitPass(onSubmitCambioClave)}>
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-subtle)',
                  padding: '0.875rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.25rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <KeyRound size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                <span>
                  Elige una clave segura de al menos 6 caracteres que recuerdes fácilmente.
                </span>
              </div>

              {modalError && (
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
                    marginBottom: '1rem'
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{modalError}</span>
                </div>
              )}

              <Input
                label="Nueva Contraseña"
                type="password"
                placeholder="Mínimo 6 caracteres"
                icon={Lock}
                error={passErrors.nuevaClave?.message}
                {...registerPass('nuevaClave')}
              />

              <Input
                label="Confirmar Nueva Contraseña"
                type="password"
                placeholder="Repite tu nueva contraseña"
                icon={ShieldCheck}
                error={passErrors.confirmarClave?.message}
                {...registerPass('confirmarClave')}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-light)'
                }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setProvisionalSession(null);
                    resetPassForm();
                  }}
                  disabled={isChangingPass}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isChangingPass}
                  icon={ShieldCheck}
                >
                  Guardar y Entrar al Portal
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
