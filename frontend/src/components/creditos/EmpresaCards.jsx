import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { formatCurrencyCLP } from '../../utils/formatters.js';
import { mesTexto } from './creditoLabels.js';

/**
 * Una tarjeta por empresa: monto A PAGAR del último mes cargado (planilla del día 18)
 * y último pago verificado con comprobante.
 */
export function EmpresaCards({ empresas, loading }) {
  if (loading && !empresas.length) {
    return (
      <div className="cred-cards" aria-busy="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="vtf-card cred-card is-loading" />
        ))}
      </div>
    );
  }
  return (
    <section className="cred-cards" aria-label="Montos por empresa">
      {empresas.map((e) => (
        <article key={e.codigo} className="vtf-card cred-card">
          <header className="cred-card-head">
            <h3 className="cred-card-name">{e.nombre}</h3>
            <span className="cred-card-count">{e.vigentes} vigentes</span>
          </header>
          <div className="cred-card-label">
            A pagar{e.aPagar ? ` · ${mesTexto(e.aPagar.mes, e.aPagar.anio)}` : ''}
          </div>
          <div className="cred-card-amount">{e.aPagar ? formatCurrencyCLP(e.aPagar.monto) : '—'}</div>
          {e.aPagar && (
            <div className={`cred-card-status ${e.aPagar.verificado ? 'is-ok' : 'is-pending'}`}>
              {e.aPagar.verificado ? <CheckCircle2 size={13} aria-hidden="true" /> : <Clock size={13} aria-hidden="true" />}
              {e.aPagar.verificado ? 'Pagado y verificado' : 'Pago por verificar'}
            </div>
          )}
          <footer className="cred-card-foot">
            <span>Último pago</span>
            <strong>
              {e.ultimoPago ? `${formatCurrencyCLP(e.ultimoPago.monto)} · ${mesTexto(e.ultimoPago.mes, e.ultimoPago.anio)}` : 'Sin pagos verificados'}
            </strong>
          </footer>
        </article>
      ))}
    </section>
  );
}

export default EmpresaCards;
