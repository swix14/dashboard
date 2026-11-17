import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Ban, CheckCircle2, HandCoins, Pencil } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { CreditoApiService } from '../../services/creditoService.js';
import { formatCurrencyCLP, formatDateCLP } from '../../utils/formatters.js';
import { ESTADO_CREDITO_FICHA, ESTADO_CUOTA, hoyInput, mesTexto } from './creditoLabels.js';

function Dato({ label, children }) {
  return (
    <div className="cred-dato">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Confirmación de prepago: la socia paga todo el saldo de una vez */
function PanelPrepago({ credito, onCancel, onDone }) {
  const [fecha, setFecha] = useState(hoyInput());
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const confirmar = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      setError(null);
      const res = await CreditoApiService.prepagarCredito(credito.id, fecha);
      onDone(res.message);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible registrar el prepago.');
      setGuardando(false);
    }
  };

  return (
    <form className="cred-accion-panel" onSubmit={confirmar}>
      <div className="cred-accion-titulo">Registrar prepago</div>
      <p className="cred-accion-texto">
        La socia paga el saldo de <strong>{formatCurrencyCLP(credito.montoPendiente)}</strong>. Sus{' '}
        {credito.totalCuotas - credito.cuotasPagadas} cuotas pendientes quedan prepagadas y el crédito, pagado.
      </p>
      {error && <p className="cred-accion-error" role="alert">{error}</p>}
      <div className="cred-accion-fila">
        <div className="cred-campo">
          <label className="vtf-label" htmlFor="cred-prepago-fecha">Fecha del pago</label>
          <input id="cred-prepago-fecha" className="vtf-input" type="date" max={hoyInput()} required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="cred-accion-botones">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" variant="primary" icon={CheckCircle2} isLoading={guardando}>Confirmar prepago</Button>
        </div>
      </div>
    </form>
  );
}

/** Confirmación de anulación con motivo obligatorio */
function PanelAnular({ credito, onCancel, onDone }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const confirmar = async (e) => {
    e.preventDefault();
    if (motivo.trim().length < 3) return setError('Indique el motivo de la anulación.');
    try {
      setGuardando(true);
      setError(null);
      const res = await CreditoApiService.anularCredito(credito.id, motivo.trim());
      onDone(res.message);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible anular el crédito.');
      setGuardando(false);
    }
  };

  return (
    <form className="cred-accion-panel cred-accion-panel-danger" onSubmit={confirmar}>
      <div className="cred-accion-titulo">Anular crédito</div>
      <p className="cred-accion-texto">
        Para créditos ingresados por error. Deja de cobrarse y sale del historial; si la planilla vuelve a traerlo, sigue anulado.
      </p>
      {error && <p className="cred-accion-error" role="alert">{error}</p>}
      <div className="cred-accion-fila">
        <div className="cred-campo" style={{ flex: 1 }}>
          <label className="vtf-label" htmlFor="cred-anular-motivo">Motivo</label>
          <input id="cred-anular-motivo" className="vtf-input" maxLength={255} placeholder="Ej: ingresado dos veces" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </div>
        <div className="cred-accion-botones">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" variant="danger" icon={Ban} isLoading={guardando}>Anular</Button>
        </div>
      </div>
    </form>
  );
}

/**
 * Ficha del crédito con su calendario de cuotas.
 * Admin y Tesorera pueden editarlo, registrar un prepago o anularlo mientras esté vigente.
 */
export function CreditoFichaModal({ creditoId, puedeGestionar = false, onClose, onEditar, onChanged }) {
  const [credito, setCredito] = useState(null);
  const [error, setError] = useState(null);
  const [accion, setAccion] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(() => {
    if (!creditoId) return () => {};
    let cancelado = false;
    setError(null);
    CreditoApiService.getCredito(creditoId)
      .then((c) => !cancelado && setCredito(c))
      .catch((err) => !cancelado && setError(err.response?.data?.message || 'No fue posible cargar el crédito.'));
    return () => {
      cancelado = true;
    };
  }, [creditoId]);

  useEffect(() => {
    setCredito(null);
    setAccion(null);
    setAviso(null);
    return cargar();
  }, [cargar]);

  if (!creditoId) return null;
  const estado = credito ? ESTADO_CREDITO_FICHA[credito.estado] : null;
  const editable = puedeGestionar && credito && credito.estado !== 'PAGADO' && credito.estado !== 'ANULADO';

  const terminarAccion = (mensaje) => {
    setAccion(null);
    setAviso(mensaje);
    cargar();
    onChanged?.();
  };

  return (
    <Modal
      title={credito ? credito.socia : 'Ficha del crédito'}
      subtitle={credito ? `RUT ${credito.rut} · ${credito.empresaNombre}${credito.numeroCredito ? ` · N° ${credito.numeroCredito}` : ''}` : ''}
      onClose={onClose}
      maxWidth="640px"
    >
      <div className="cred-modal-body">
        {error && (
          <div className="com-alert com-alert-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {aviso && (
          <div className="com-alert com-alert-ok" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{aviso}</span>
          </div>
        )}
        {!credito && !error && <p className="cred-muted">Cargando…</p>}
        {credito && (
          <>
            <dl className="cred-datos">
              <Dato label="Estado"><Badge variant={estado.variant}>{estado.label}</Badge></Dato>
              <Dato label="Fecha de inicio">{formatDateCLP(credito.fechaInicio)}</Dato>
              <Dato label="Fecha de término">{formatDateCLP(credito.fechaTermino)}</Dato>
              <Dato label="Monto otorgado">{formatCurrencyCLP(credito.montoOtorgado)}</Dato>
              <Dato label="Valor cuota">{formatCurrencyCLP(credito.montoCuota)}</Dato>
              <Dato label="Cuotas pagadas">{credito.cuotasPagadas} de {credito.totalCuotas}</Dato>
              <Dato label="Monto pendiente">{formatCurrencyCLP(credito.montoPendiente)}</Dato>
              <Dato label="Origen">{credito.origen === 'MANUAL' ? 'Ingresado a mano' : 'Planilla Maestra'}</Dato>
              {credito.fechaPagado && <Dato label="Pagado el">{formatDateCLP(credito.fechaPagado)}</Dato>}
              {credito.estado === 'ANULADO' && (
                <Dato label="Anulado el">
                  {formatDateCLP(credito.fechaAnulacion)}
                  {credito.motivoAnulacion && <span className="cred-muted cred-dato-nota">{credito.motivoAnulacion}</span>}
                </Dato>
              )}
            </dl>

            {editable && !accion && (
              <div className="cred-ficha-acciones">
                <Button variant="outline" size="sm" icon={Pencil} onClick={() => onEditar?.(credito)}>Editar</Button>
                <Button variant="outline" size="sm" icon={HandCoins} onClick={() => { setAviso(null); setAccion('prepago'); }}>Registrar prepago</Button>
                <Button variant="ghost" size="sm" icon={Ban} className="cred-btn-anular" onClick={() => { setAviso(null); setAccion('anular'); }}>Anular</Button>
              </div>
            )}
            {accion === 'prepago' && <PanelPrepago credito={credito} onCancel={() => setAccion(null)} onDone={terminarAccion} />}
            {accion === 'anular' && <PanelAnular credito={credito} onCancel={() => setAccion(null)} onDone={terminarAccion} />}

            <div className="vtf-table-container cred-cuotas">
              <table className="vtf-table cred-table-compact">
                <thead>
                  <tr><th>Cuota</th><th>Mes</th><th className="num">Monto</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {credito.cuotas.map((q) => {
                    const e = ESTADO_CUOTA[q.estado] || { label: q.estado, variant: 'neutral' };
                    return (
                      <tr key={q.numero}>
                        <td>{q.numero} / {credito.totalCuotas}</td>
                        <td>{mesTexto(q.mes, q.anio)}</td>
                        <td className="num">{formatCurrencyCLP(q.monto)}</td>
                        <td><Badge variant={e.variant}>{e.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default CreditoFichaModal;
