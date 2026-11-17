import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCheck,
  Inbox,
  Mail,
  MailOpen,
  Megaphone,
  Paperclip,
  RotateCcw,
  Send,
  Star,
  Trash2
} from 'lucide-react';
import { ComunicacionesApiService } from '../services/comunicacionesService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { formatDateCLP } from '../utils/formatters.js';

const TIPO_MENSAJE = {
  CONSULTA: { label: 'Consulta', variant: 'info' },
  SUGERENCIA: { label: 'Sugerencia', variant: 'primary' },
  RECLAMO: { label: 'Reclamo', variant: 'error' },
  FELICITACION: { label: 'Felicitación', variant: 'success' },
  OTRO: { label: 'Otro', variant: 'neutral' }
};

const ESTADO_MENSAJE = {
  PENDIENTE: { label: 'Sin leer', variant: 'warning' },
  LEIDO: { label: 'Leído', variant: 'info' },
  RESPONDIDO: { label: 'Respondido', variant: 'success' }
};

const CATEGORIAS_NOTICIA = [
  { value: 'COMUNICADO', label: 'Comunicado' },
  { value: 'FEDERACION', label: 'Federación' },
  { value: 'CONVENIO', label: 'Convenio' },
  { value: 'BENEFICIO', label: 'Beneficio' }
];

const NOTICIA_VACIA = { titulo: '', contenido: '', categoria: 'COMUNICADO', destacado: false };

const errorDe = (err, fallback) => err.response?.data?.message || fallback;

/**
 * Noticias y Buzón: la directiva publica noticias para el portal de socias
 * y lee los mensajes que las socias envían por el buzón.
 */
export function ComunicacionesPage() {
  const [tab, setTab] = useState('buzon');
  const [mensajes, setMensajes] = useState([]);
  const [noticias, setNoticias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = async () => {
    try {
      setLoading(true);
      setError(null);
      const [m, n] = await Promise.all([ComunicacionesApiService.getMensajes(), ComunicacionesApiService.getNoticias()]);
      setMensajes(m);
      setNoticias(n);
    } catch (err) {
      setError(errorDe(err, 'No fue posible cargar las comunicaciones.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const sinLeer = mensajes.filter((m) => m.estado === 'PENDIENTE').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>Noticias y Buzón</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Lee los mensajes que envían las socias y publica noticias en su portal.
        </p>
      </header>

      <div className="com-tabs" role="tablist" aria-label="Secciones de comunicaciones">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'buzon'}
          className={`com-tab ${tab === 'buzon' ? 'is-active' : ''}`}
          onClick={() => setTab('buzon')}
        >
          <Inbox size={17} aria-hidden="true" />
          Buzón de socias
          {sinLeer > 0 && <span className="com-tab-count" aria-label={`${sinLeer} sin leer`}>{sinLeer}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'noticias'}
          className={`com-tab ${tab === 'noticias' ? 'is-active' : ''}`}
          onClick={() => setTab('noticias')}
        >
          <Megaphone size={17} aria-hidden="true" />
          Noticias publicadas
        </button>
      </div>

      {error && (
        <div className="com-alert com-alert-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {tab === 'buzon' ? (
        <BuzonPanel mensajes={mensajes} setMensajes={setMensajes} loading={loading} />
      ) : (
        <NoticiasPanel noticias={noticias} setNoticias={setNoticias} loading={loading} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buzón                                                                */
/* ------------------------------------------------------------------ */

function BuzonPanel({ mensajes, setMensajes, loading }) {
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [abiertoId, setAbiertoId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const visibles = useMemo(
    () =>
      mensajes.filter(
        (m) => (filtroEstado === 'TODOS' || m.estado === filtroEstado) && (filtroTipo === 'TODOS' || m.tipo === filtroTipo)
      ),
    [mensajes, filtroEstado, filtroTipo]
  );

  const cambiarEstado = async (mensaje, estado) => {
    try {
      setBusyId(`${mensaje.id}-${estado}`);
      setActionError(null);
      await ComunicacionesApiService.cambiarEstadoMensaje(mensaje.id, estado);
      setMensajes((prev) => prev.map((m) => (m.id === mensaje.id ? { ...m, estado } : m)));
    } catch (err) {
      setActionError(errorDe(err, 'No fue posible actualizar el mensaje.'));
    } finally {
      setBusyId(null);
    }
  };

  // Al abrir un mensaje sin leer se marca como leído automáticamente
  const toggleAbrir = (mensaje) => {
    const abrir = abiertoId !== mensaje.id;
    setAbiertoId(abrir ? mensaje.id : null);
    if (abrir && mensaje.estado === 'PENDIENTE') cambiarEstado(mensaje, 'LEIDO');
  };

  const descargar = async (mensaje) => {
    try {
      setBusyId(`${mensaje.id}-adjunto`);
      setActionError(null);
      const { blob, fileName } = await ComunicacionesApiService.descargarAdjunto(mensaje.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      let message = 'No fue posible descargar el adjunto.';
      if (err.response?.data instanceof Blob) {
        try {
          message = JSON.parse(await err.response.data.text()).message || message;
        } catch {
          // Respuesta no JSON: se mantiene el mensaje genérico
        }
      }
      setActionError(message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <div className="com-filters">
        <div>
          <label className="vtf-label" htmlFor="filtro-estado-buzon">Estado</label>
          <select id="filtro-estado-buzon" className="vtf-input" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="TODOS">Todos</option>
            <option value="PENDIENTE">Sin leer</option>
            <option value="LEIDO">Leídos</option>
            <option value="RESPONDIDO">Respondidos</option>
          </select>
        </div>
        <div>
          <label className="vtf-label" htmlFor="filtro-tipo-buzon">Tipo</label>
          <select id="filtro-tipo-buzon" className="vtf-input" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="TODOS">Todos</option>
            {Object.entries(TIPO_MENSAJE).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <span className="com-filters-count">{visibles.length} de {mensajes.length} mensajes</span>
      </div>

      {actionError && (
        <div className="com-alert com-alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={18} aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {loading ? (
        <p className="com-empty">Cargando mensajes…</p>
      ) : visibles.length === 0 ? (
        <div className="com-empty">
          <Inbox size={28} aria-hidden="true" />
          <p>{mensajes.length === 0 ? 'Aún no llegan mensajes de las socias.' : 'Ningún mensaje coincide con los filtros.'}</p>
        </div>
      ) : (
        <ul className="com-list">
          {visibles.map((m) => {
            const tipo = TIPO_MENSAJE[m.tipo] || TIPO_MENSAJE.OTRO;
            const estado = ESTADO_MENSAJE[m.estado] || ESTADO_MENSAJE.PENDIENTE;
            const abierto = abiertoId === m.id;
            return (
              <li key={m.id} className={`com-item ${m.estado === 'PENDIENTE' ? 'is-unread' : ''}`}>
                <button
                  type="button"
                  className="com-item-head"
                  onClick={() => toggleAbrir(m)}
                  aria-expanded={abierto}
                >
                  <span className="com-item-icon" aria-hidden="true">
                    {m.estado === 'PENDIENTE' ? <Mail size={18} /> : <MailOpen size={18} />}
                  </span>
                  <span className="com-item-main">
                    <span className="com-item-title">{m.asunto}</span>
                    <span className="com-item-meta">
                      {m.sociaNombre} · {m.sociaRut} · {m.sociaJardin}
                    </span>
                  </span>
                  <span className="com-item-side">
                    <Badge variant={tipo.variant}>{tipo.label}</Badge>
                    <Badge variant={estado.variant}>{estado.label}</Badge>
                    <span className="com-item-date">{m.createdAt ? formatDateCLP(m.createdAt) : ''}</span>
                  </span>
                </button>

                {abierto && (
                  <div className="com-item-body">
                    <p className="com-item-text">{m.mensaje}</p>
                    <div className="com-item-actions">
                      {m.archivoAdjunto && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Paperclip}
                          isLoading={busyId === `${m.id}-adjunto`}
                          onClick={() => descargar(m)}
                        >
                          Descargar adjunto
                        </Button>
                      )}
                      {m.estado !== 'RESPONDIDO' && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={CheckCheck}
                          isLoading={busyId === `${m.id}-RESPONDIDO`}
                          onClick={() => cambiarEstado(m, 'RESPONDIDO')}
                        >
                          Marcar respondido
                        </Button>
                      )}
                      {m.estado !== 'PENDIENTE' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={RotateCcw}
                          isLoading={busyId === `${m.id}-PENDIENTE`}
                          onClick={() => cambiarEstado(m, 'PENDIENTE')}
                        >
                          Marcar sin leer
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Noticias                                                             */
/* ------------------------------------------------------------------ */

function NoticiasPanel({ noticias, setNoticias, loading }) {
  const [form, setForm] = useState(NOTICIA_VACIA);
  const [formError, setFormError] = useState(null);
  const [okMessage, setOkMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [porEliminar, setPorEliminar] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const publicar = async (e) => {
    e.preventDefault();
    setOkMessage(null);
    if (form.titulo.trim().length < 3) return setFormError('El título debe tener al menos 3 caracteres.');
    if (form.contenido.trim().length < 10) return setFormError('El contenido debe tener al menos 10 caracteres.');
    try {
      setIsSaving(true);
      setFormError(null);
      const nueva = await ComunicacionesApiService.publicarNoticia(form);
      setNoticias((prev) => [nueva, ...prev]);
      setForm(NOTICIA_VACIA);
      setOkMessage('Noticia publicada. Ya aparece en el portal de socias.');
    } catch (err) {
      setFormError(errorDe(err, 'No fue posible publicar la noticia.'));
    } finally {
      setIsSaving(false);
    }
  };

  const eliminar = async () => {
    try {
      setIsDeleting(true);
      await ComunicacionesApiService.eliminarNoticia(porEliminar.id);
      setNoticias((prev) => prev.filter((n) => n.id !== porEliminar.id));
      setPorEliminar(null);
    } catch (err) {
      setFormError(errorDe(err, 'No fue posible eliminar la noticia.'));
      setPorEliminar(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="com-news-layout">
      <Card title="Publicar noticia" subtitle="Se muestra de inmediato en el portal de socias">
        <form onSubmit={publicar} noValidate>
          <Input label="Título" value={form.titulo} onChange={update('titulo')} maxLength={200} placeholder="ej. Asamblea general de diciembre" />

          <div className="vtf-form-group">
            <label className="vtf-label" htmlFor="noticia-categoria">Categoría</label>
            <select id="noticia-categoria" className="vtf-input" value={form.categoria} onChange={update('categoria')}>
              {CATEGORIAS_NOTICIA.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="vtf-form-group">
            <label className="vtf-label" htmlFor="noticia-contenido">Contenido</label>
            <textarea
              id="noticia-contenido"
              className="vtf-input"
              rows={6}
              maxLength={5000}
              value={form.contenido}
              onChange={update('contenido')}
              placeholder="Escribe el comunicado para las socias…"
              style={{ resize: 'vertical', minHeight: '140px', paddingTop: '0.625rem' }}
            />
            <span className="com-char-count">{form.contenido.length} / 5000</span>
          </div>

          <label className="com-check">
            <input type="checkbox" checked={form.destacado} onChange={update('destacado')} />
            <span>Destacar (aparece primero en el portal)</span>
          </label>

          {formError && (
            <div className="com-alert com-alert-error" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}
          {okMessage && (
            <div className="com-alert com-alert-ok" role="status">
              <CheckCheck size={18} aria-hidden="true" />
              <span>{okMessage}</span>
            </div>
          )}

          <Button type="submit" variant="primary" icon={Send} isLoading={isSaving} style={{ width: '100%' }}>
            Publicar noticia
          </Button>
        </form>
      </Card>

      <Card title="Noticias publicadas" subtitle={`${noticias.length} en el portal`}>
        {loading ? (
          <p className="com-empty">Cargando noticias…</p>
        ) : noticias.length === 0 ? (
          <div className="com-empty">
            <Megaphone size={28} aria-hidden="true" />
            <p>Aún no hay noticias publicadas.</p>
          </div>
        ) : (
          <ul className="com-list">
            {noticias.map((n) => (
              <li key={n.id} className="com-news">
                <div className="com-news-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="com-item-title">
                      {Number(n.destacado) === 1 && <Star size={14} className="com-star" aria-label="Destacada" />}
                      {n.titulo}
                    </div>
                    <div className="com-item-meta">
                      {(CATEGORIAS_NOTICIA.find((c) => c.value === n.categoria) || {}).label || n.categoria} ·{' '}
                      {n.fecha ? formatDateCLP(n.fecha) : ''} · {n.autor}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setPorEliminar(n)}
                    aria-label={`Eliminar la noticia ${n.titulo}`}
                  >
                    Eliminar
                  </Button>
                </div>
                <p className="com-item-text com-news-text">{n.contenido}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {porEliminar && (
        <Modal
          title="Eliminar noticia"
          subtitle="Dejará de verse en el portal de socias"
          onClose={() => !isDeleting && setPorEliminar(null)}
          maxWidth="440px"
          footer={
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="outline" onClick={() => setPorEliminar(null)} disabled={isDeleting}>
                Cancelar
              </Button>
              <Button variant="primary" icon={Trash2} onClick={eliminar} isLoading={isDeleting}>
                Eliminar
              </Button>
            </div>
          }
        >
          <p style={{ margin: 0, padding: '1.5rem', color: 'var(--text-main)' }}>
            ¿Eliminar <strong>{porEliminar.titulo}</strong>? Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </div>
  );
}
