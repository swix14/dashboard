import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Newspaper,
  Mailbox,
  LogOut,
  Send,
  Paperclip,
  CheckCircle2,
  Clock,
  Building2,
  User,
  Mail,
  Calendar,
  Sparkles,
  AlertCircle,
  FileText,
  ChevronRight,
  Bell,
  HeartHandshake,
  ThumbsUp,
  MessageSquare,
  HelpCircle,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { Card } from '../components/common/Card.jsx';
import { Button } from '../components/common/Button.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { ThemeToggle } from '../components/common/ThemeToggle.jsx';

// Directiva Oficial de la Asociación (Visualización estrictamente restringida a las 3 directivas con correo institucional)
const DIRECTIVA_OFICIAL = [
  {
    nombre: 'YERTIE',
    cargo: 'PRESIDENTA',
    correo: 'presidenta@vtftemuco.cl',
    color: '#725682'
  },
  {
    nombre: 'ALEJANDRA',
    cargo: 'TESORERA',
    correo: 'tesorera@vtftemuco.cl',
    color: '#2e7d32'
  },
  {
    nombre: 'NELLY',
    cargo: 'SECRETARIA',
    correo: 'secretaria@vtftemuco.cl',
    color: '#1976d2'
  }
];

export function SociaPortalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Sección activa: 'noticias' o 'buzon'
  const [activeTab, setActiveTab] = useState('noticias');

  // Estado de noticias
  const [noticias, setNoticias] = useState([]);
  const [loadingNoticias, setLoadingNoticias] = useState(true);
  const [noticiasError, setNoticiasError] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');

  // Estado de buzón
  const [buzonSubTab, setBuzonSubTab] = useState('nuevo'); // 'nuevo' | 'historial'
  const [tipoMensaje, setTipoMensaje] = useState('Consultas');
  const [asunto, setAsunto] = useState('');
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [archivoAdjunto, setArchivoAdjunto] = useState(null);
  const [enviandoBuzon, setEnviandoBuzon] = useState(false);
  const [buzonFeedback, setBuzonFeedback] = useState(null);

  // Historial de mensajes de la socia
  const [misMensajes, setMisMensajes] = useState([]);
  const [loadingMensajes, setLoadingMensajes] = useState(false);

  // Cargar noticias al montar
  useEffect(() => {
    fetchNoticias();
  }, []);

  // Cargar historial de mensajes cuando cambie a la pestaña de historial
  useEffect(() => {
    if (activeTab === 'buzon' && buzonSubTab === 'historial') {
      fetchMisMensajes();
    }
  }, [activeTab, buzonSubTab]);

  const fetchNoticias = async () => {
    try {
      setLoadingNoticias(true);
      setNoticiasError(null);
      const res = await api.get('/socia/noticias');
      if (res.data?.data) {
        setNoticias(res.data.data);
      }
    } catch (err) {
      setNoticiasError('No fue posible cargar las noticias institucionales.');
    } finally {
      setLoadingNoticias(false);
    }
  };

  const fetchMisMensajes = async () => {
    try {
      setLoadingMensajes(true);
      const res = await api.get('/socia/buzon/mis-mensajes');
      if (res.data?.data) {
        setMisMensajes(res.data.data);
      }
    } catch (err) {
      console.warn('Error al obtener mensajes de buzón:', err.message);
    } finally {
      setLoadingMensajes(false);
    }
  };

  const handleEnviarBuzon = async (e) => {
    e.preventDefault();
    if (!asunto.trim() || !mensajeTexto.trim()) {
      setBuzonFeedback({
        type: 'error',
        message: 'Por favor complete el asunto y el mensaje antes de enviar.'
      });
      return;
    }

    try {
      setEnviandoBuzon(true);
      setBuzonFeedback(null);

      const formData = new FormData();
      formData.append('tipo', tipoMensaje);
      formData.append('asunto', asunto.trim());
      formData.append('mensaje', mensajeTexto.trim());
      if (archivoAdjunto) {
        formData.append('adjunto', archivoAdjunto);
      }

      await api.post('/socia/buzon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setBuzonFeedback({
        type: 'success',
        message: '¡Tu mensaje ha sido enviado exitosamente a la directiva de la Asociación!'
      });

      // Limpiar formulario
      setAsunto('');
      setMensajeTexto('');
      setArchivoAdjunto(null);
      const fileInput = document.getElementById('socia-archivo-input');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setBuzonFeedback({
        type: 'error',
        message:
          err.response?.data?.message ||
          'Ocurrió un error al enviar el mensaje. Inténtelo nuevamente.'
      });
    } finally {
      setEnviandoBuzon(false);
    }
  };

  const handleCerrarSesion = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getCategoriaBadge = (cat) => {
    switch (cat?.toUpperCase()) {
      case 'FEDERACION':
        return <Badge variant="success">Federación Nacional</Badge>;
      case 'CONVENIO':
        return <Badge variant="warning">Convenio Comercial</Badge>;
      case 'COMUNICADO':
      default:
        return <Badge variant="primary">Comunicado Oficial</Badge>;
    }
  };

  const filteredNoticias = noticias.filter((noticia) => {
    if (filtroCategoria === 'TODAS') return true;
    return noticia.categoria?.toUpperCase() === filtroCategoria;
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-page)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* 1. Barra Superior Institucional */}
      <header
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-light)',
          padding: '0.875rem 1.5rem',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          {/* Logo y título */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <img
              src="/logo-vtf.png"
              alt="Logo VTF"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                objectFit: 'cover',
                backgroundColor: 'white',
                padding: '2px',
                border: '1px solid var(--border-light)'
              }}
            />
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <h1
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    margin: 0
                  }}
                >
                  Asociación VTF Temuco
                </h1>
                <span
                  style={{
                    backgroundColor: 'var(--sigav-soft, rgba(114, 86, 130, 0.12))',
                    color: 'var(--primary-700)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  PORTAL DE SOCIAS
                </span>
              </div>
              <p
                style={{
                  fontSize: '0.775rem',
                  color: 'var(--text-muted)',
                  margin: 0
                }}
              >
                Plataforma de comunicación, avisos gremiales y buzón directo
              </p>
            </div>
          </div>

          {/* Acciones de cabecera */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ThemeToggle size="sm" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={LogOut}
              onClick={handleCerrarSesion}
              style={{
                borderColor: 'var(--border-light)',
                color: 'var(--text-muted)'
              }}
            >
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Contenido Principal con Contenedor Centrado */}
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          padding: '1.5rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}
      >
        {/* 2. Banner de Directiva Oficial (Estricto: Yertie, Alejandra, Nelly con @vtftemuco.cl) */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.25rem 1.5rem',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} style={{ color: 'var(--primary-600)' }} />
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Directiva Oficial de la Asociación
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Canales oficiales de representación institucional
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem'
            }}
          >
            {DIRECTIVA_OFICIAL.map((dir, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem',
                  border: '1px solid var(--border-light)',
                  borderLeft: `4px solid ${dir.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.875rem'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: `${dir.color}15`,
                    color: dir.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1rem'
                  }}
                >
                  {dir.nombre.charAt(0)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: 'var(--text-main)'
                      }}
                    >
                      {dir.nombre}
                    </span>
                    <span
                      style={{
                        fontSize: '0.675rem',
                        fontWeight: 700,
                        backgroundColor: 'var(--border-subtle)',
                        color: 'var(--text-main)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {dir.cargo}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      marginTop: '0.25rem',
                      color: 'var(--text-muted)',
                      fontSize: '0.775rem'
                    }}
                  >
                    <Mail size={13} style={{ flexShrink: 0 }} />
                    <a
                      href={`mailto:${dir.correo}`}
                      style={{
                        color: 'var(--primary-600)',
                        textDecoration: 'none',
                        wordBreak: 'break-all'
                      }}
                    >
                      {dir.correo}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Tarjeta de Identificación de la Socia Activa */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.25rem 1.5rem',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: 'var(--sigav-soft, rgba(114, 86, 130, 0.15))',
                color: 'var(--primary-700)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.25rem',
                border: '1px solid var(--primary-200)'
              }}
            >
              {user?.firstName?.charAt(0) || 'S'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    margin: 0
                  }}
                >
                  {user?.firstName || user?.name || 'Socia Activa'}{' '}
                  {user?.lastName || ''}
                </h2>
                <Badge variant="success">Socia Activa</Badge>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginTop: '0.35rem',
                  flexWrap: 'wrap',
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)'
                }}
              >
                <span>
                  <strong>RUT:</strong> {user?.rut || 'Sin registrar'}
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Building2 size={14} style={{ color: 'var(--primary-600)' }} />
                  <strong>Jardín:</strong> {user?.jardin || 'Jardín VTF Temuco'}
                </span>
                {user?.cargo && (
                  <>
                    <span>•</span>
                    <span>
                      <strong>Cargo:</strong> {user.cargo}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Layout con Sidebar Estricto (3 Secciones: Noticias, Buzón, Cerrar Sesión) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 260px) 1fr',
            gap: '1.5rem',
            alignItems: 'start'
          }}
          className="socia-layout-grid"
        >
          {/* Sidebar */}
          <aside
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-xl)',
              padding: '1rem',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <div
              style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                padding: '0.5rem 0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Menú de Navegación
            </div>

            {/* 1. Noticias */}
            <button
              type="button"
              onClick={() => setActiveTab('noticias')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                backgroundColor:
                  activeTab === 'noticias'
                    ? 'var(--sigav-soft, rgba(114, 86, 130, 0.12))'
                    : 'transparent',
                color:
                  activeTab === 'noticias'
                    ? 'var(--primary-700)'
                    : 'var(--text-main)',
                fontWeight: activeTab === 'noticias' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <Newspaper size={18} />
              <span style={{ flex: 1 }}>Noticias y Avisos</span>
              {activeTab === 'noticias' && (
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-600)'
                  }}
                />
              )}
            </button>

            {/* 2. Buzón */}
            <button
              type="button"
              onClick={() => setActiveTab('buzon')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                backgroundColor:
                  activeTab === 'buzon'
                    ? 'var(--sigav-soft, rgba(114, 86, 130, 0.12))'
                    : 'transparent',
                color:
                  activeTab === 'buzon'
                    ? 'var(--primary-700)'
                    : 'var(--text-main)',
                fontWeight: activeTab === 'buzon' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <Mailbox size={18} />
              <span style={{ flex: 1 }}>Buzón de Socias</span>
              {activeTab === 'buzon' && (
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-600)'
                  }}
                />
              )}
            </button>

            <div
              style={{
                height: '1px',
                backgroundColor: 'var(--border-subtle)',
                margin: '0.5rem 0'
              }}
            />

            {/* 3. Cerrar Sesión */}
            <button
              type="button"
              onClick={handleCerrarSesion}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--error-text, #c62828)',
                fontWeight: 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor =
                  'var(--error-bg, rgba(239, 68, 68, 0.08))')
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = 'transparent')
              }
            >
              <LogOut size={18} />
              <span>Cerrar Sesión</span>
            </button>
          </aside>

          {/* Panel de Contenido Dinámico según sección activa */}
          <main style={{ minWidth: 0 }}>
            {/* SECCIÓN 1: NOTICIAS Y COMUNICADOS GREMIALES */}
            {activeTab === 'noticias' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Cabecera de Noticias con Filtros */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '1.25rem 1.5rem',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <h2
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        margin: 0
                      }}
                    >
                      Noticias y Avisos Oficiales
                    </h2>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        margin: '0.25rem 0 0 0'
                      }}
                    >
                      Información de transferencias a federación, liquidación de convenios y comunicados gremiales
                    </p>
                  </div>

                  {/* Filtros de Categoría */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['TODAS', 'FEDERACION', 'CONVENIO', 'COMUNICADO'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFiltroCategoria(cat)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          border:
                            filtroCategoria === cat
                              ? '1px solid var(--primary-600)'
                              : '1px solid var(--border-light)',
                          backgroundColor:
                            filtroCategoria === cat
                              ? 'var(--sigav-soft, rgba(114, 86, 130, 0.15))'
                              : 'var(--bg-surface-subtle)',
                          color:
                            filtroCategoria === cat
                              ? 'var(--primary-700)'
                              : 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        {cat === 'TODAS'
                          ? 'Todas'
                          : cat === 'FEDERACION'
                          ? 'Federación'
                          : cat === 'CONVENIO'
                          ? 'Convenios'
                          : 'Comunicados'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista de Noticias */}
                {loadingNoticias ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '3rem',
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-xl)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    Cargando noticias y avisos oficiales...
                  </div>
                ) : noticiasError ? (
                  <div
                    style={{
                      padding: '1.5rem',
                      backgroundColor: 'var(--error-bg)',
                      border: '1px solid var(--error-border)',
                      borderRadius: 'var(--radius-xl)',
                      color: 'var(--error-text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}
                  >
                    <AlertCircle size={20} />
                    <span>{noticiasError}</span>
                  </div>
                ) : filteredNoticias.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '3rem',
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-xl)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    No hay publicaciones disponibles en esta categoría.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredNoticias.map((item) => (
                      <article
                        key={item.id}
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderRadius: 'var(--radius-xl)',
                          padding: '1.5rem',
                          border: item.destacado
                            ? '1px solid var(--primary-300)'
                            : '1px solid var(--border-light)',
                          boxShadow: 'var(--shadow-card)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.5rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {getCategoriaBadge(item.categoria)}
                            {item.destacado === 1 && (
                              <Badge variant="neutral">Destacado</Badge>
                            )}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)'
                            }}
                          >
                            <Calendar size={14} />
                            <span>
                              {item.fecha || item.fecha_publicacion || 'Reciente'}
                            </span>
                          </div>
                        </div>

                        <h3
                          style={{
                            fontSize: '1.15rem',
                            fontWeight: 700,
                            color: 'var(--text-main)',
                            margin: 0
                          }}
                        >
                          {item.titulo}
                        </h3>

                        <p
                          style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-main)',
                            lineHeight: 1.6,
                            margin: 0
                          }}
                        >
                          {item.contenido}
                        </p>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: '0.5rem',
                            paddingTop: '0.75rem',
                            borderTop: '1px solid var(--border-subtle)',
                            fontSize: '0.775rem',
                            color: 'var(--text-muted)'
                          }}
                        >
                          <span>
                            Publicado por: <strong>{item.autor || 'Directiva VTF'}</strong>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={13} style={{ color: 'var(--primary-600)' }} />
                            Información Oficial Verificada
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SECCIÓN 2: BUZÓN DE SOCIAS */}
            {activeTab === 'buzon' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Cabecera del Buzón con selector de sub-pestaña */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '1.25rem 1.5rem',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <h2
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        margin: 0
                      }}
                    >
                      Buzón de Socias
                    </h2>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        margin: '0.25rem 0 0 0'
                      }}
                    >
                      Canal confidencial directo con la directiva para sugerencias, reclamos, consultas y felicitaciones
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      type="button"
                      variant={buzonSubTab === 'nuevo' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setBuzonSubTab('nuevo')}
                    >
                      Redactar Mensaje
                    </Button>
                    <Button
                      type="button"
                      variant={buzonSubTab === 'historial' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setBuzonSubTab('historial')}
                    >
                      Mis Mensajes Enviados
                    </Button>
                  </div>
                </div>

                {/* Sub-Pestaña: Redactar Mensaje */}
                {buzonSubTab === 'nuevo' && (
                  <form
                    onSubmit={handleEnviarBuzon}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-xl)',
                      padding: '1.5rem',
                      border: '1px solid var(--border-light)',
                      boxShadow: 'var(--shadow-card)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem'
                    }}
                  >
                    {/* Alerta de Feedback */}
                    {buzonFeedback && (
                      <div
                        style={{
                          padding: '0.875rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          backgroundColor:
                            buzonFeedback.type === 'success'
                              ? 'var(--success-bg, rgba(46, 125, 50, 0.1))'
                              : 'var(--error-bg, rgba(239, 68, 68, 0.1))',
                          color:
                            buzonFeedback.type === 'success'
                              ? 'var(--success-text, #2e7d32)'
                              : 'var(--error-text, #c62828)',
                          border: `1px solid ${
                            buzonFeedback.type === 'success'
                              ? 'var(--success-border, rgba(46, 125, 50, 0.2))'
                              : 'var(--error-border, rgba(239, 68, 68, 0.2))'
                          }`
                        }}
                      >
                        {buzonFeedback.type === 'success' ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <AlertCircle size={18} />
                        )}
                        <span>{buzonFeedback.message}</span>
                      </div>
                    )}

                    {/* Selector de Tipo de Mensaje */}
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          marginBottom: '0.5rem'
                        }}
                      >
                        Tipo de Comunicación
                      </label>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: '0.5rem'
                        }}
                      >
                        {[
                          { id: 'Consultas', label: 'Consulta', icon: HelpCircle },
                          { id: 'Sugerencias', label: 'Sugerencia', icon: Sparkles },
                          { id: 'Felicitaciones', label: 'Felicitación', icon: ThumbsUp },
                          { id: 'Reclamos', label: 'Reclamo', icon: AlertCircle },
                          { id: 'Otro', label: 'Otro', icon: MessageSquare }
                        ].map((item) => {
                          const IconComp = item.icon;
                          const isSelected = tipoMensaje === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setTipoMensaje(item.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                padding: '0.65rem 0.5rem',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.8125rem',
                                fontWeight: isSelected ? 700 : 500,
                                border: isSelected
                                  ? '2px solid var(--primary-600)'
                                  : '1px solid var(--border-light)',
                                backgroundColor: isSelected
                                  ? 'var(--sigav-soft, rgba(114, 86, 130, 0.12))'
                                  : 'var(--bg-surface-subtle)',
                                color: isSelected
                                  ? 'var(--primary-700)'
                                  : 'var(--text-main)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <IconComp size={15} />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Campo Asunto */}
                    <div>
                      <label
                        htmlFor="socia-asunto"
                        style={{
                          display: 'block',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          marginBottom: '0.35rem'
                        }}
                      >
                        Asunto del Mensaje
                      </label>
                      <input
                        id="socia-asunto"
                        type="text"
                        value={asunto}
                        onChange={(e) => setAsunto(e.target.value)}
                        placeholder="Ej. Consulta sobre fecha de pago de federación o liquidación de crédito"
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-main)',
                          fontSize: '0.875rem',
                          outline: 'none'
                        }}
                        required
                      />
                    </div>

                    {/* Campo Mensaje */}
                    <div>
                      <label
                        htmlFor="socia-mensaje"
                        style={{
                          display: 'block',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          marginBottom: '0.35rem'
                        }}
                      >
                        Detalle del Mensaje
                      </label>
                      <textarea
                        id="socia-mensaje"
                        rows={5}
                        value={mensajeTexto}
                        onChange={(e) => setMensajeTexto(e.target.value)}
                        placeholder="Escribe aquí tu consulta, sugerencia o detalle para la directiva..."
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-main)',
                          fontSize: '0.875rem',
                          outline: 'none',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                        required
                      />
                    </div>

                    {/* Adjuntar Archivo Opcional (PDF o Imagen) */}
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          marginBottom: '0.35rem'
                        }}
                      >
                        Adjuntar Comprobante o Documento de Respaldo (Opcional)
                      </label>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          flexWrap: 'wrap'
                        }}
                      >
                        <label
                          htmlFor="socia-archivo-input"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.6rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px dashed var(--primary-400)',
                            backgroundColor: 'var(--bg-surface-subtle)',
                            color: 'var(--primary-700)',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Paperclip size={16} />
                          <span>Seleccionar Archivo (PDF o Imagen)</span>
                        </label>
                        <input
                          id="socia-archivo-input"
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/webp"
                          onChange={(e) =>
                            setArchivoAdjunto(e.target.files?.[0] || null)
                          }
                          style={{ display: 'none' }}
                        />
                        {archivoAdjunto && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.8rem',
                              color: 'var(--text-main)',
                              backgroundColor: 'var(--bg-surface-subtle)',
                              padding: '0.35rem 0.65rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-light)'
                            }}
                          >
                            <FileText size={14} style={{ color: 'var(--primary-600)' }} />
                            <span>{archivoAdjunto.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setArchivoAdjunto(null);
                                const fileInput = document.getElementById(
                                  'socia-archivo-input'
                                );
                                if (fileInput) fileInput.value = '';
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--error-text)',
                                cursor: 'pointer',
                                fontWeight: 700,
                                marginLeft: '0.25rem'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.725rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.25rem'
                        }}
                      >
                        Formatos permitidos: PDF, JPG, PNG. Tamaño máximo: 5 MB.
                      </span>
                    </div>

                    {/* Aviso de trazabilidad */}
                    <div
                      style={{
                        backgroundColor: 'var(--bg-surface-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.875rem 1rem',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <User size={16} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                      <span>
                        Este mensaje será remitido confidencialmente a nombre de{' '}
                        <strong>{user?.firstName || 'Socia'}</strong> del jardín{' '}
                        <strong>{user?.jardin || 'Jardín VTF'}</strong>.
                      </span>
                    </div>

                    {/* Botón de Enviar */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        type="submit"
                        variant="primary"
                        isLoading={enviandoBuzon}
                        icon={Send}
                        style={{ padding: '0.75rem 1.5rem' }}
                      >
                        Enviar Mensaje a la Directiva
                      </Button>
                    </div>
                  </form>
                )}

                {/* Sub-Pestaña: Historial de Mis Mensajes */}
                {buzonSubTab === 'historial' && (
                  <div
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-xl)',
                      padding: '1.5rem',
                      border: '1px solid var(--border-light)',
                      boxShadow: 'var(--shadow-card)'
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        marginTop: 0,
                        marginBottom: '1rem'
                      }}
                    >
                      Historial de Comunicaciones Enviadas
                    </h3>

                    {loadingMensajes ? (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '2rem',
                          color: 'var(--text-muted)'
                        }}
                      >
                        Cargando tus mensajes anteriores...
                      </div>
                    ) : misMensajes.length === 0 ? (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '3rem 1rem',
                          color: 'var(--text-muted)'
                        }}
                      >
                        <Mailbox size={36} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                          Aún no has enviado mensajes por el buzón.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        {misMensajes.map((msg) => (
                          <div
                            key={msg.id}
                            style={{
                              backgroundColor: 'var(--bg-surface-subtle)',
                              borderRadius: 'var(--radius-lg)',
                              padding: '1rem',
                              border: '1px solid var(--border-light)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem'
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Badge variant="primary">{msg.tipo}</Badge>
                                <span
                                  style={{
                                    fontSize: '0.95rem',
                                    fontWeight: 700,
                                    color: 'var(--text-main)'
                                  }}
                                >
                                  {msg.asunto}
                                </span>
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)'
                                }}
                              >
                                <Badge
                                  variant={
                                    msg.estado === 'RESPONDIDO'
                                      ? 'success'
                                      : msg.estado === 'EN_REVISION'
                                      ? 'warning'
                                      : 'neutral'
                                  }
                                >
                                  {msg.estado === 'PENDIENTE'
                                    ? 'Pendiente de Lectura'
                                    : msg.estado === 'EN_REVISION'
                                    ? 'En Revisión Directiva'
                                    : 'Respondido'}
                                </Badge>
                                <span>
                                  {msg.created_at
                                    ? new Date(msg.created_at).toLocaleDateString('es-CL')
                                    : ''}
                                </span>
                              </div>
                            </div>

                            <p
                              style={{
                                fontSize: '0.875rem',
                                color: 'var(--text-main)',
                                margin: 0,
                                lineHeight: 1.5
                              }}
                            >
                              {msg.mensaje}
                            </p>

                            {msg.archivo_adjunto && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.75rem',
                                  color: 'var(--primary-600)'
                                }}
                              >
                                <Paperclip size={13} />
                                <span>Archivo adjunto: {msg.archivo_adjunto}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
