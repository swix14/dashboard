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
  AlertCircle,
  Info,
  CheckCircle2,
  Sparkles,
  Mail,
  Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { Input } from '../components/common/Input.jsx';
import { RutInput } from '../components/common/RutInput.jsx';
import { readIdleLogoutMessage } from '../utils/idleSession.js';
import { validateRut } from '../utils/rut.js';
import { Button } from '../components/common/Button.jsx';
import { ThemeToggle } from '../components/common/ThemeToggle.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { DIRECTIVA_OFICIAL } from '../utils/directiva.js';

// Nombre y apellidos por separado (formulario S.O.S); firstName sigue siendo el nombre visible
const nombresSeparados = (socia) => ({
  nombres: socia.nombres || '',
  apellidoPaterno: socia.apellidoPaterno || '',
  apellidoMaterno: socia.apellidoMaterno || '',
  // Muestra la pestaña "Mi jardín" del portal (el backend verifica la marca en cada consulta)
  esDelegada: Boolean(socia.esDelegada)
});

const sociaLoginSchema = z.object({
  rut: z.string().refine(validateRut, 'Ingrese un RUT válido (ej. 12.345.678-5)'),
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

  // Si la sesión anterior se cerró por inactividad, se explica aquí
  const [authError, setAuthError] = useState(readIdleLogoutMessage);
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
        ...nombresSeparados(socia),
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

      const { token } = res.data.data;
      setModalSuccess(true);

      // La respuesta del cambio de clave solo trae id y primerIngreso: los datos de la socia
      // salen del login (antes el portal quedaba sin nombre, RUT ni jardín hasta recargar)
      const socia = provisionalSession.socia;
      const updatedUser = {
        id: `socia-${socia.id}`,
        sociaId: socia.id,
        rut: socia.rut,
        firstName: socia.nombreCompleto,
        lastName: '',
        ...nombresSeparados(socia),
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

  // Cancelar el primer ingreso descarta la sesión provisional: la socia vuelve al login
  const cerrarCambioClave = () => {
    setShowPasswordModal(false);
    setProvisionalSession(null);
    setModalError(null);
    resetPassForm();
  };

  // Obtener iniciales del nombre completo para el avatar de la directiva
  const getInitials = (name = '') =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');

  return (
    <div className="socia-login-page">
      <div className="socia-login-layout">
        {/* Directiva oficial: canales de contacto de la Asociación */}
        <aside
          className="socia-directiva-panel vtf-top-accent"
          aria-labelledby="directiva-titulo"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem 1.75rem 1.625rem',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <div>
            {/* Cabecera del panel de Directiva */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem' }}>
              <img
                src="/logo-vtf.png"
                alt="Logo Asociación VTF Temuco"
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  backgroundColor: 'white',
                  padding: '2px',
                  border: '2px solid var(--primary-200)',
                  boxShadow: 'var(--shadow-sm)',
                  flexShrink: 0
                }}
              />
              <div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    backgroundColor: 'var(--sigav-soft)',
                    color: 'var(--primary-700)',
                    border: '1px solid var(--primary-200)',
                    borderRadius: 'var(--radius-full)',
                    padding: '0.15rem 0.6rem',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                    marginBottom: '0.3rem'
                  }}
                >
                  Canales Oficiales
                </span>
                <h2
                  id="directiva-titulo"
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    margin: 0,
                    lineHeight: 1.2
                  }}
                >
                  Directiva Oficial
                </h2>
              </div>
            </div>

            <p
              style={{
                fontSize: '0.84rem',
                color: 'var(--text-muted)',
                margin: '0 0 1.25rem',
                lineHeight: 1.5
              }}
            >
              ¿Tienes dudas sobre tu ingreso, cuotas o convenios? Escríbenos directamente a nuestro correo institucional.
            </p>

            {/* Tarjetas de contacto de la directiva */}
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              {DIRECTIVA_OFICIAL.map((dir) => (
                <li key={dir.correo}>
                  <a
                    href={`mailto:${dir.correo}`}
                    className="directiva-member-card"
                    aria-label={`Enviar correo a ${dir.nombre}, ${dir.cargo}`}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: dir.bgVar,
                        color: dir.textVar,
                        border: `1px solid ${dir.borderVar}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        flexShrink: 0,
                        letterSpacing: '0.02em'
                      }}
                    >
                      {getInitials(dir.nombre)}
                    </div>

                    <div
                      style={{
                        minWidth: 0,
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '0.25rem'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.9375rem',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          lineHeight: 1.25
                        }}
                      >
                        {dir.nombre}
                      </span>
                      <span
                        style={{
                          fontSize: '0.675rem',
                          fontWeight: 700,
                          backgroundColor: dir.bgVar,
                          color: dir.textVar,
                          border: `1px solid ${dir.borderVar}`,
                          padding: '0.125rem 0.5rem',
                          borderRadius: 'var(--radius-full)',
                          letterSpacing: '0.02em'
                        }}
                      >
                        {dir.cargo}
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          marginTop: '0.1rem',
                          fontSize: '0.8rem',
                          color: 'var(--primary-600)',
                          fontWeight: 600,
                          overflowWrap: 'anywhere'
                        }}
                      >
                        <Mail size={13} style={{ flexShrink: 0 }} aria-hidden="true" />
                        <span>{dir.correo}</span>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Pie institucional informativo */}
          <div
            style={{
              marginTop: '1.375rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              lineHeight: 1.4
            }}
          >
            <Building2 size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} aria-hidden="true" />
            <span>
              Representación gremial de los <strong style={{ color: 'var(--text-main)' }}>23 jardines VTF</strong> de Temuco y Labranza
            </span>
          </div>
        </aside>

      <div
        className="socia-login-card vtf-top-accent"
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem 2rem',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-lg)',
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
            Tu contraseña inicial son los <strong style={{ color: 'var(--text-main)' }}>primeros 6 dígitos de tu RUT</strong> (sin puntos ni guion).
            <br />
            <em>Ejemplo: Si tu RUT es <strong style={{ color: 'var(--text-main)' }}>12.345.678-5</strong>, tu clave inicial es <strong style={{ color: 'var(--text-main)' }}>123456</strong>.</em>
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
          <RutInput
            label="RUT de la Socia"
            placeholder="ej. 12.345.678-5"
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
      </div>
      </div>

      {/* Modal Obligatorio de Cambio de Contraseña en Primer Ingreso */}
      {showPasswordModal && (
        <Modal
          title="Cambio Obligatorio de Contraseña"
          subtitle={`Bienvenida ${provisionalSession?.socia?.nombreCompleto || 'Socia'}. Por seguridad institucional, debes establecer una contraseña personal antes de ingresar a tu portal.`}
          onClose={cerrarCambioClave}
          dismissible={!isChangingPass && !modalSuccess}
          maxWidth="440px"
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
            <form onSubmit={handleSubmitPass(onSubmitCambioClave)} className="pwd-form" noValidate>
              <p className="pwd-aviso is-info">
                <KeyRound size={16} aria-hidden="true" />
                <span>Elige una clave de al menos 6 caracteres que recuerdes fácilmente. No puede ser la clave inicial.</span>
              </p>

              {modalError && (
                <p role="alert" className="pwd-aviso is-error">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{modalError}</span>
                </p>
              )}

              <Input
                label="Nueva contraseña"
                type="password"
                placeholder="Mínimo 6 caracteres"
                icon={Lock}
                autoComplete="new-password"
                error={passErrors.nuevaClave?.message}
                {...registerPass('nuevaClave')}
              />

              <Input
                label="Confirmar nueva contraseña"
                type="password"
                placeholder="Repite tu nueva contraseña"
                icon={ShieldCheck}
                autoComplete="new-password"
                error={passErrors.confirmarClave?.message}
                {...registerPass('confirmarClave')}
              />

              <div className="pwd-acciones">
                <Button type="button" variant="outline" onClick={cerrarCambioClave} disabled={isChangingPass}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={isChangingPass} icon={ShieldCheck}>
                  Guardar y entrar al portal
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

