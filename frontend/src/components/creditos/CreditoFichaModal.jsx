import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Badge } from '../common/Badge.jsx';
import { CreditoApiService } from '../../services/creditoService.js';
import { formatCurrencyCLP, formatDateCLP } from '../../utils/formatters.js';
import { ESTADO_CREDITO, ESTADO_CUOTA, mesTexto } from './creditoLabels.js';

function Dato({ label, children }) {
  return (
    <div className="cred-dato">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Ficha del crédito: datos de la planilla Maestra Créditos y su calendario de cuotas */
export function CreditoFichaModal({ creditoId, onClose }) {
  const [credito, setCredito] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!creditoId) return undefined;
    let cancelado = false;
    setCredito(null);
    setError(null);
    CreditoApiService.getCredito(creditoId)
      .then((c) => !cancelado && setCredito(c))
      .catch((err) => !cancelado && setError(err.response?.data?.message || 'No fue posible cargar el crédito.'));
    return () => {
      cancelado = true;
    };
  }, [creditoId]);

  if (!creditoId) return null;
  const estado = credito ? ESTADO_CREDITO[credito.estado] : null;

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
              {credito.fechaPagado && <Dato label="Pagado el">{formatDateCLP(credito.fechaPagado)}</Dato>}
            </dl>

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
