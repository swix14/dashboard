import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Send } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { SosApiService, SOS_MONTO_MAXIMO, ESTADO_SOS } from '../../services/sosService.js';
import { formatCurrencyCLP } from '../../utils/formatters.js';

const VACIO = { monto: '', cuotas: '', motivo: '' };
const MOTIVO_MAX = 1000;

const fechaCorta = (v) =>
  v ? new Date(v).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

/** Formulario de solicitud: los datos de la socia vienen de su sesión; ella completa monto, cuotas y motivo */
function SolicitudModal({ user, onClose, onSent }) {
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const set = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setError(null);
  };

  const monto = Number(form.monto);
  const cuotas = Number(form.cuotas);
  const valorCuota = monto > 0 && cuotas > 0 ? Math.ceil(monto / cuotas) : null;

  const enviar = async (e) => {
    e.preventDefault();
    // Todo es obligatorio (pedido de la directiva)
    if (!form.monto || !form.cuotas || !form.motivo.trim()) return setError('Faltan datos por completar: monto, cuotas y motivo son obligatorios.');
    if (!Number.isInteger(monto) || monto < 1000) return setError('Ingrese un monto válido (mínimo $1.000, sin puntos).');
    if (monto > SOS_MONTO_MAXIMO) return setError(`El monto máximo es ${formatCurrencyCLP(SOS_MONTO_MAXIMO)}.`);
    if (form.motivo.trim().length < 10) return setError('Cuéntenos un poco más del motivo (mínimo 10 caracteres).');
    try {
      setEnviando(true);
      await SosApiService.solicitar({ monto, cuotas, motivo: form.motivo.trim() });
      onSent();
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible enviar la solicitud. Intente nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal title="Solicitud S.O.S" subtitle="Crédito de emergencia de la Asociación" onClose={onClose} maxWidth="580px">
      <form className="sos-form" onSubmit={enviar} noValidate>
        {error && (
          <div className="com-alert com-alert-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <dl className="sos-identidad" aria-label="Sus datos del padrón">
          <div><dt>RUT</dt><dd>{user?.rut}</dd></div>
          {/* Sesiones iniciadas antes de este cambio no traen los apellidos por separado */}
          <div><dt>Nombres</dt><dd>{user?.nombres || user?.firstName}</dd></div>
          {user?.nombres ? (
            <>
              <div><dt>Apellido paterno</dt><dd>{user.apellidoPaterno || '—'}</dd></div>
              <div><dt>Apellido materno</dt><dd>{user.apellidoMaterno || '—'}</dd></div>
            </>
          ) : null}
          <div><dt>Jardín</dt><dd>{user?.jardin || 'Sin jardín'}</dd></div>
        </dl>

        <div className="sos-form-grid">
          <div className="cred-campo">
            <label className="vtf-label" htmlFor="sos-monto">Monto solicitado</label>
            <input
              id="sos-monto"
              className="vtf-input"
              type="number"
              inputMode="numeric"
              min="1000"
              max={SOS_MONTO_MAXIMO}
              step="1"
              required
              placeholder="Ej. 150000"
              value={form.monto}
              onChange={set('monto')}
            />
            <span className="cred-hint">{monto > 0 ? formatCurrencyCLP(monto) : 'Sin puntos ni signo $'}</span>
          </div>
          <div className="cred-campo">
            <label className="vtf-label" htmlFor="sos-cuotas">Número de cuotas</label>
            <select id="sos-cuotas" className="vtf-input" required value={form.cuotas} onChange={set('cuotas')}>
              <option value="">Seleccione…</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? 'cuota' : 'cuotas'}</option>
              ))}
            </select>
            <span className="cred-hint">{valorCuota ? `Aprox. ${formatCurrencyCLP(valorCuota)} por mes` : 'Se descuentan por planilla'}</span>
          </div>
        </div>

        <div className="cred-campo">
          <label className="vtf-label" htmlFor="sos-motivo">Motivo</label>
          <textarea
            id="sos-motivo"
            className="vtf-input sos-motivo"
            rows={4}
            required
            maxLength={MOTIVO_MAX}
            placeholder="Cuéntenos brevemente para qué necesita el S.O.S"
            value={form.motivo}
            onChange={set('motivo')}
          />
          <span className="cred-hint">{form.motivo.length}/{MOTIVO_MAX}</span>
        </div>

        <div className="cred-actions">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" icon={Send} isLoading={enviando}>Enviar solicitud</Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Sección S.O.S del portal: botón grande "Pide tu S.O.S aquí", formulario y el estado de sus solicitudes.
 * Al enviar, muestra la confirmación y vuelve al inicio (onDone).
 */
export function SosSocia({ user, onDone }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [enviada, setEnviada] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSolicitudes(await SosApiService.misSolicitudes());
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible cargar sus solicitudes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const pendiente = solicitudes.find((s) => s.estado === 'PENDIENTE');

  return (
    <div className="sos-seccion">
      <section className="sos-hero">
        <div className="sos-hero-texto">
          <h2>Crédito de emergencia S.O.S</h2>
          <p>
            Para imprevistos urgentes. Indique el monto, en cuántas cuotas (1 a 4) y el motivo. La directiva revisa su
            solicitud y le responde por este portal; las cuotas se descuentan por planilla.
          </p>
        </div>
        <button
          type="button"
          className="sos-boton"
          onClick={() => setAbierto(true)}
          disabled={Boolean(pendiente) || loading}
          aria-describedby={pendiente ? 'sos-pendiente-aviso' : undefined}
        >
          <span className="sos-boton-arriba">Pide tu</span>
          <span className="sos-boton-sigla">S.O.S</span>
          <span className="sos-boton-abajo">aquí</span>
        </button>
      </section>

      {pendiente && (
        <div id="sos-pendiente-aviso" className="com-alert sos-aviso" role="status">
          <Clock size={18} aria-hidden="true" />
          <span>
            Su solicitud del {fechaCorta(pendiente.createdAt)} por {formatCurrencyCLP(pendiente.monto)} está en revisión. Podrá pedir
            otra cuando la directiva responda.
          </span>
        </div>
      )}

      <section className="sos-historial" aria-labelledby="sos-historial-titulo">
        <h3 id="sos-historial-titulo">Mis solicitudes</h3>
        {error && <p className="cred-accion-error" role="alert">{error}</p>}
        {loading ? (
          <p className="cred-muted">Cargando…</p>
        ) : solicitudes.length === 0 ? (
          <p className="sos-vacio">Aún no ha pedido un S.O.S.</p>
        ) : (
          <ul className="sos-lista">
            {solicitudes.map((s) => {
              const estado = ESTADO_SOS[s.estado];
              return (
                <li key={s.id} className={`sos-item is-${s.estado.toLowerCase()}`}>
                  <div className="sos-item-cabecera">
                    <strong>{formatCurrencyCLP(s.monto)}</strong>
                    <span className="cred-muted">en {s.cuotas} {s.cuotas === 1 ? 'cuota' : 'cuotas'} · {fechaCorta(s.createdAt)}</span>
                    <Badge variant={estado.variant}>{estado.label}</Badge>
                  </div>
                  <p className="sos-item-motivo">{s.motivo}</p>
                  {s.respuesta && (
                    <p className="sos-item-respuesta">
                      <span>Respuesta de la directiva:</span> {s.respuesta}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {abierto && (
        <SolicitudModal
          user={user}
          onClose={() => setAbierto(false)}
          onSent={() => {
            setAbierto(false);
            setEnviada(true);
          }}
        />
      )}

      {enviada && (
        <Modal title="Solicitud enviada" onClose={onDone} maxWidth="420px">
          <div className="sos-enviada">
            <CheckCircle2 size={40} aria-hidden="true" />
            <p>Su solicitud S.O.S fue enviada a la directiva. Verá la respuesta en la sección S.O.S de este portal.</p>
            <Button variant="primary" onClick={onDone}>Volver al inicio</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default SosSocia;
