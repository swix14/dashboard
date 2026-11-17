import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  HelpCircle,
  History,
  Mailbox,
  MessageSquare,
  Paperclip,
  PenLine,
  Send,
  Sparkles,
  ThumbsUp,
  User,
  X
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { api } from '../../services/api.js';

const TIPOS = [
  { id: 'CONSULTA', label: 'Consulta', icon: HelpCircle },
  { id: 'SUGERENCIA', label: 'Sugerencia', icon: Sparkles },
  { id: 'FELICITACION', label: 'Felicitación', icon: ThumbsUp },
  { id: 'RECLAMO', label: 'Reclamo', icon: AlertCircle },
  { id: 'OTRO', label: 'Otro', icon: MessageSquare }
];
const TIPO_LABEL = Object.fromEntries(TIPOS.map((t) => [t.id, t.label]));

// Estados que guarda el backend (buzon_mensajes.estado). Antes el portal esperaba
// 'EN_REVISION' y mostraba "Respondido" a un mensaje que la directiva solo había leído.
const ESTADOS = {
  PENDIENTE: { label: 'Enviado', variant: 'neutral' },
  LEIDO: { label: 'Leído por la directiva', variant: 'info' },
  RESPONDIDO: { label: 'Respondido', variant: 'success' }
};

// Mismos límites que valida el servidor (portalValidator y uploadComprobante)
const ASUNTO = { min: 3, max: 200 };
const MENSAJE = { min: 5, max: 5000 };
const ADJUNTO_TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const ADJUNTO_MAX_MB = 5;

const fechaChile = (valor) =>
  valor
    ? new Date(valor).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

function Historial() {
  const [mensajes, setMensajes] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    api
      .get('/socia/buzon/mis-mensajes')
      .then((res) => !cancelado && setMensajes(res.data?.data || []))
      .catch(() => !cancelado && setError('No fue posible cargar sus mensajes. Intente nuevamente.'));
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="sp-card sp-historial">
      <h3>Mensajes enviados</h3>
      {error ? (
        <p className="sp-alerta is-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" /> {error}
        </p>
      ) : !mensajes ? (
        <div className="sp-estado" aria-busy="true">Cargando sus mensajes…</div>
      ) : mensajes.length === 0 ? (
        <div className="sp-estado">
          <Mailbox size={36} aria-hidden="true" />
          <p>Aún no ha enviado mensajes por el buzón.</p>
        </div>
      ) : (
        <ul className="sp-mensajes">
          {mensajes.map((m) => {
            const estado = ESTADOS[m.estado] || ESTADOS.PENDIENTE;
            return (
              <li key={m.id} className="sp-mensaje">
                <div className="sp-mensaje-head">
                  <div className="sp-mensaje-titulo">
                    <Badge variant="primary">{TIPO_LABEL[m.tipo] || m.tipo}</Badge>
                    <strong>{m.asunto}</strong>
                  </div>
                  <div className="sp-mensaje-estado">
                    <Badge variant={estado.variant}>{estado.label}</Badge>
                    <span>{fechaChile(m.createdAt)}</span>
                  </div>
                </div>
                <p>{m.mensaje}</p>
                {m.archivoAdjunto && (
                  <span className="sp-mensaje-adjunto">
                    <Paperclip size={13} aria-hidden="true" /> Con archivo adjunto
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Buzón de socias: redactar un mensaje a la directiva y ver los enviados. */
export function BuzonSocia({ user }) {
  const [vista, setVista] = useState('nuevo'); // 'nuevo' | 'historial'
  const [tipo, setTipo] = useState('CONSULTA');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [adjunto, setAdjunto] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: 'ok' | 'error', texto }
  const fileRef = useRef(null);

  const quitarAdjunto = () => {
    setAdjunto(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // Se valida al elegir el archivo para no esperar al envío
  const elegirAdjunto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ADJUNTO_TIPOS.includes(file.type)) {
      setAviso({ tipo: 'error', texto: 'Formato no permitido. Adjunte un PDF o una imagen JPG, PNG o WEBP.' });
      quitarAdjunto();
      return;
    }
    if (file.size > ADJUNTO_MAX_MB * 1024 * 1024) {
      setAviso({ tipo: 'error', texto: `El archivo supera el máximo de ${ADJUNTO_MAX_MB} MB.` });
      quitarAdjunto();
      return;
    }
    setAviso(null);
    setAdjunto(file);
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (asunto.trim().length < ASUNTO.min || mensaje.trim().length < MENSAJE.min) {
      setAviso({
        tipo: 'error',
        texto: `Escriba un asunto (mínimo ${ASUNTO.min} caracteres) y el detalle del mensaje (mínimo ${MENSAJE.min}).`
      });
      return;
    }
    try {
      setEnviando(true);
      setAviso(null);
      const data = new FormData();
      data.append('tipo', tipo);
      data.append('asunto', asunto.trim());
      data.append('mensaje', mensaje.trim());
      if (adjunto) data.append('adjunto', adjunto);
      await api.post('/socia/buzon', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAviso({ tipo: 'ok', texto: 'Su mensaje fue enviado a la directiva. Puede revisarlo en "Enviados".' });
      setAsunto('');
      setMensaje('');
      quitarAdjunto();
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.response?.data?.message || 'No fue posible enviar el mensaje. Intente nuevamente.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="sp-seccion" aria-labelledby="sp-buzon-titulo">
      <div className="sp-card sp-seccion-head">
        <div>
          <h2 id="sp-buzon-titulo">Buzón de socias</h2>
          <p>Canal confidencial con la directiva para consultas, sugerencias, reclamos y felicitaciones.</p>
        </div>
        <div className="sp-tabs" role="group" aria-label="Vista del buzón">
          <button
            type="button"
            aria-pressed={vista === 'nuevo'}
            className={`sp-tab${vista === 'nuevo' ? ' is-active' : ''}`}
            onClick={() => setVista('nuevo')}
          >
            <PenLine size={15} aria-hidden="true" /> Redactar
          </button>
          <button
            type="button"
            aria-pressed={vista === 'historial'}
            className={`sp-tab${vista === 'historial' ? ' is-active' : ''}`}
            onClick={() => setVista('historial')}
          >
            <History size={15} aria-hidden="true" /> Enviados
          </button>
        </div>
      </div>

      {vista === 'historial' ? (
        <Historial />
      ) : (
        <form className="sp-card sp-buzon-form" onSubmit={enviar} noValidate>
          {aviso && (
            <p className={`sp-alerta ${aviso.tipo === 'ok' ? 'is-ok' : 'is-error'}`} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
              {aviso.tipo === 'ok' ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
              <span>{aviso.texto}</span>
            </p>
          )}

          <fieldset className="sp-campo">
            <legend className="sp-campo-label">Tipo de mensaje</legend>
            <div className="sp-tipos">
              {TIPOS.map(({ id, label, icon: Icon }) => (
                <label key={id} className="sp-tipo">
                  <input type="radio" name="tipo" value={id} checked={tipo === id} onChange={() => setTipo(id)} />
                  <Icon size={15} aria-hidden="true" />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="sp-campo">
            <label className="sp-campo-label" htmlFor="buzon-asunto">Asunto</label>
            <input
              id="buzon-asunto"
              className="vtf-input"
              type="text"
              value={asunto}
              maxLength={ASUNTO.max}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Ej. Consulta sobre el pago a la Federación"
            />
          </div>

          <div className="sp-campo">
            <label className="sp-campo-label" htmlFor="buzon-mensaje">Detalle del mensaje</label>
            <textarea
              id="buzon-mensaje"
              className="vtf-input"
              rows={5}
              value={mensaje}
              maxLength={MENSAJE.max}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escriba aquí su consulta, sugerencia o detalle para la directiva…"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div className="sp-campo-pie">
              <span />
              <span>{mensaje.length.toLocaleString('es-CL')} / {MENSAJE.max.toLocaleString('es-CL')}</span>
            </div>
          </div>

          <div className="sp-campo">
            <span className="sp-campo-label" id="buzon-adjunto-label">Documento de respaldo (opcional)</span>
            <div className="sp-adjunto">
              <button
                type="button"
                className="sp-adjunto-btn"
                aria-describedby="buzon-adjunto-ayuda"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip size={16} aria-hidden="true" /> {adjunto ? 'Cambiar archivo' : 'Adjuntar PDF o imagen'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={elegirAdjunto}
                aria-labelledby="buzon-adjunto-label"
                hidden
              />
              {adjunto && (
                <span className="sp-adjunto-archivo">
                  <FileText size={14} aria-hidden="true" />
                  <span title={adjunto.name}>{adjunto.name}</span>
                  <button type="button" className="sp-adjunto-quitar" onClick={quitarAdjunto} aria-label={`Quitar ${adjunto.name}`}>
                    <X size={14} aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
            <span className="sp-campo-pie" id="buzon-adjunto-ayuda">PDF, JPG, PNG o WEBP. Máximo {ADJUNTO_MAX_MB} MB.</span>
          </div>

          <p className="sp-nota">
            <User size={16} aria-hidden="true" />
            <span>
              Se envía a la directiva a nombre de <strong>{user?.firstName || 'Socia'}</strong>, del jardín{' '}
              <strong>{user?.jardin || 'sin jardín asignado'}</strong>.
            </span>
          </p>

          <div className="sp-enviar">
            <Button type="submit" variant="primary" isLoading={enviando} icon={Send}>
              Enviar a la directiva
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

export default BuzonSocia;
