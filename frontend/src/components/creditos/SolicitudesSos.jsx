import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, LifeBuoy, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Card } from '../common/Card.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { SosApiService, ESTADO_SOS } from '../../services/sosService.js';
import { formatCurrencyCLP } from '../../utils/formatters.js';
import { MESES, mesActualInput, periodoActual } from './creditoLabels.js';

const fecha = (v) => (v ? new Date(v).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/** Próximo mes como AAAA-MM: por defecto la primera cuota se descuenta en la planilla siguiente */
function mesSiguienteInput() {
  const { anio, mes } = periodoActual();
  return mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

function mesInputTexto(aaaamm) {
  const [a, m] = aaaamm.split('-').map(Number);
  return a && m ? `${MESES[m - 1]} ${a}` : '';
}

/** Panel de revisión de una solicitud pendiente: aprobar (crea el crédito) o rechazar con motivo */
function RevisionPanel({ solicitud, modo, onCancel, onDone }) {
  const [valorCuota, setValorCuota] = useState(String(Math.ceil(solicitud.monto / solicitud.cuotas)));
  const [primeraCuota, setPrimeraCuota] = useState(mesSiguienteInput());
  const [texto, setTexto] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const aprobar = modo === 'aprobar';
  const id = `sos-${solicitud.id}`;
  const total = Number(valorCuota) * solicitud.cuotas;

  const guardar = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      setError(null);
      const res = aprobar
        ? await SosApiService.aprobar(solicitud.id, { valorCuota: Number(valorCuota), primeraCuota, respuesta: texto.trim() })
        : await SosApiService.rechazar(solicitud.id, texto.trim());
      onDone(res.message);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible guardar la revisión.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className={`cred-accion-panel sos-revision${aprobar ? '' : ' cred-accion-panel-danger'}`} onSubmit={guardar}>
      <p className="cred-accion-texto">
        {aprobar ? (
          <>Se crea el crédito <strong>S.O.S</strong> de {solicitud.sociaNombre} con {solicitud.cuotas} {solicitud.cuotas === 1 ? 'cuota' : 'cuotas'}, que entran a la liquidación desde {mesInputTexto(primeraCuota)}. El egreso en Tesorería (Cena Anual) se registra aparte, con el comprobante de la transferencia.</>
        ) : (
          <>La socia verá este motivo en su portal y podrá enviar una nueva solicitud.</>
        )}
      </p>
      {error && <p className="cred-accion-error" role="alert">{error}</p>}
      <div className="cred-accion-fila">
        {aprobar && (
          <>
            <div className="cred-campo">
              <label className="vtf-label" htmlFor={`${id}-cuota`}>Valor cuota</label>
              <input id={`${id}-cuota`} className="vtf-input" type="number" min="1" step="1" required value={valorCuota} onChange={(e) => setValorCuota(e.target.value)} />
            </div>
            <div className="cred-campo">
              <label className="vtf-label" htmlFor={`${id}-mes`}>Primera cuota</label>
              <input id={`${id}-mes`} className="vtf-input" type="month" required min={mesActualInput()} value={primeraCuota} onChange={(e) => setPrimeraCuota(e.target.value)} />
            </div>
          </>
        )}
        <div className="cred-campo sos-revision-texto">
          <label className="vtf-label" htmlFor={`${id}-texto`}>{aprobar ? 'Mensaje a la socia (opcional)' : 'Motivo del rechazo'}</label>
          <input
            id={`${id}-texto`}
            className="vtf-input"
            maxLength={255}
            required={!aprobar}
            placeholder={aprobar ? 'Ej. La transferencia se hace el viernes' : 'Ej. El fondo no tiene saldo este mes'}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
      </div>
      {aprobar && Number(valorCuota) > 0 && total !== solicitud.monto && (
        <p className="cred-hint">
          {solicitud.cuotas} × {formatCurrencyCLP(Number(valorCuota))} = {formatCurrencyCLP(total)} (pidió {formatCurrencyCLP(solicitud.monto)}).
        </p>
      )}
      <div className="cred-accion-botones">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button
          type="submit"
          variant="primary"
          className={aprobar ? '' : 'vtf-btn-danger'}
          icon={aprobar ? ThumbsUp : ThumbsDown}
          isLoading={guardando}
        >
          {aprobar ? 'Aprobar y crear crédito' : 'Rechazar solicitud'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Solicitudes S.O.S que envían las socias desde su portal. Admin y Tesorera las aprueban
 * (crea el crédito S.O.S) o rechazan; la Presidenta las ve.
 */
export function SolicitudesSos({ puedeGestionar, onChanged }) {
  const [filtro, setFiltro] = useState('PENDIENTE');
  const [items, setItems] = useState([]);
  const [pendientes, setPendientes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);
  // { id, modo: 'aprobar' | 'rechazar' } de la solicitud que se está revisando
  const [revision, setRevision] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await SosApiService.listar(filtro);
      setItems(res.items);
      setPendientes(res.pendientes);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible cargar las solicitudes S.O.S.');
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <Card
      className="sos-card"
      title={
        <span className="sos-card-titulo">
          <LifeBuoy size={18} aria-hidden="true" /> Solicitudes S.O.S
          {pendientes > 0 && <span className="sos-contador" aria-label={`${pendientes} pendientes`}>{pendientes}</span>}
        </span>
      }
      subtitle="Las envían las socias desde su portal. Al aprobar se crea su crédito S.O.S."
      action={
        <div className="cred-view-toggle" role="group" aria-label="Filtrar solicitudes">
          {[['PENDIENTE', 'Pendientes'], ['TODAS', 'Todas']].map(([valor, label]) => (
            <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => { setFiltro(valor); setRevision(null); }}>
              {label}
            </button>
          ))}
        </div>
      }
    >
      {error && (
        <div className="com-alert com-alert-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {ok && (
        <div className="com-alert com-alert-ok" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{ok}</span>
        </div>
      )}

      {!loading && items.length === 0 ? (
        <p className="sos-vacio">{filtro === 'PENDIENTE' ? 'No hay solicitudes pendientes.' : 'Aún no hay solicitudes S.O.S.'}</p>
      ) : (
        <ul className="sos-lista" aria-busy={loading}>
          {items.map((s) => {
            const estado = ESTADO_SOS[s.estado];
            const enRevision = revision?.id === s.id;
            return (
              <li key={s.id} className={`sos-item is-${s.estado.toLowerCase()}`}>
                <div className="sos-item-cabecera">
                  <strong>{s.sociaNombre}</strong>
                  <span className="cred-muted">RUT {s.sociaRut}{s.sociaJardin ? ` · ${s.sociaJardin}` : ''}</span>
                  <Badge variant={estado.variant}>{estado.label}</Badge>
                </div>
                <div className="sos-item-monto">
                  <span>{formatCurrencyCLP(s.monto)}</span> en {s.cuotas} {s.cuotas === 1 ? 'cuota' : 'cuotas'} · pedida el {fecha(s.createdAt)}
                </div>
                <p className="sos-item-motivo">{s.motivo}</p>
                {s.estado !== 'PENDIENTE' && (
                  <p className="sos-item-respuesta">
                    <span>{s.estado === 'APROBADA' ? 'Aprobada' : 'Rechazada'} por {s.revisadoPor} el {fecha(s.revisadoAt)}</span>
                    {s.respuesta ? `: ${s.respuesta}` : '.'}
                  </p>
                )}

                {s.estado === 'PENDIENTE' && puedeGestionar && !enRevision && (
                  <div className="sos-item-acciones">
                    <Button size="sm" variant="primary" icon={ThumbsUp} onClick={() => { setRevision({ id: s.id, modo: 'aprobar' }); setOk(null); }}>Aprobar</Button>
                    <Button size="sm" variant="outline" icon={ThumbsDown} onClick={() => { setRevision({ id: s.id, modo: 'rechazar' }); setOk(null); }}>Rechazar</Button>
                  </div>
                )}
                {enRevision && (
                  <RevisionPanel
                    solicitud={s}
                    modo={revision.modo}
                    onCancel={() => setRevision(null)}
                    onDone={(mensaje) => {
                      setRevision(null);
                      setOk(mensaje);
                      cargar();
                      onChanged?.();
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default SolicitudesSos;
