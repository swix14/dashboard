import React from 'react';
import { CreditCard } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Badge } from '../common/Badge.jsx';
import { formatCurrencyCLP, formatDateCLP } from '../../utils/formatters.js';
import { CREDITO_ESTADO_BADGE, nombreCompleto } from './sociaLabels.js';
import { InfoItem, sectionTitle } from './SociaDetailModal.jsx';

/**
 * Ficha de crédito: SOLO los créditos y convenios de la socia (vigentes e históricos).
 * Visible para Admin, Presidenta y Tesorera; el backend no envía estos datos a otros roles.
 */
export function CreditoDetailModal({ detail, onClose }) {
  if (!detail) return null;
  const creditos = detail.creditos || [];
  const vigentes = creditos.filter((c) => c.estado === 'vigente');
  const saldoTotal = vigentes.reduce((sum, c) => sum + (Number(c.saldoPendiente) || 0), 0);

  return (
    <Modal
      title={`Ficha de crédito · ${nombreCompleto(detail)}`}
      subtitle={`RUT ${detail.rut} · ${detail.jardin?.name || 'Sin jardín asignado'}`}
      onClose={onClose}
      maxWidth="660px"
    >
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <InfoItem label="Créditos vigentes">{vigentes.length}</InfoItem>
          <InfoItem label="Descuento mensual">{formatCurrencyCLP(detail.descuentoMensualCreditos || 0)} / mes</InfoItem>
          <InfoItem label="Saldo pendiente total">{formatCurrencyCLP(saldoTotal)}</InfoItem>
        </div>

        <div>
          <div style={sectionTitle}>Créditos y convenios</div>
          {creditos.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '1rem',
                border: '1px dashed var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--text-muted)',
                fontSize: '0.875rem'
              }}
            >
              <CreditCard size={18} aria-hidden="true" />
              La socia no registra créditos.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {creditos.map((c) => {
                const progress = c.totalCuotas ? Math.round((c.cuotasPagadas / c.totalCuotas) * 100) : 0;
                const badge = CREDITO_ESTADO_BADGE[c.estado] || { variant: 'neutral', label: c.estado };
                return (
                  <div key={c.id} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.625rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.tipoNombre}</span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      <span>Cuota {c.cuotasPagadas} de {c.totalCuotas}</span>
                      <span>{progress}%</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      style={{ height: '6px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-surface-subtle)', overflow: 'hidden', marginBottom: '0.75rem' }}
                    >
                      <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--primary-500)' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                      <InfoItem label="Monto">{formatCurrencyCLP(c.montoSolicitado)}</InfoItem>
                      <InfoItem label="Valor cuota">{formatCurrencyCLP(c.valorCuota)}</InfoItem>
                      <InfoItem label="Saldo pendiente">{formatCurrencyCLP(c.saldoPendiente)}</InfoItem>
                      <InfoItem label="Período">
                        {formatDateCLP(c.fechaInicio)} – {formatDateCLP(c.fechaTermino)}
                      </InfoItem>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
