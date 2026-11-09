import React from 'react';
import { ArrowRightLeft, Pencil, UserMinus } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { formatCurrencyCLP, formatDateCLP } from '../../utils/formatters.js';
import { CARGO_LABELS, CREDITO_ESTADO_BADGE, ESTADO_BADGE, nombreCompleto } from './sociaLabels.js';

function InfoItem({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.15rem', overflowWrap: 'anywhere' }}>
        {children}
      </div>
    </div>
  );
}

const sectionTitle = {
  fontSize: '0.8125rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  letterSpacing: '0.05em',
  marginBottom: '0.75rem'
};

/**
 * Ficha de socia: datos de contacto, créditos (vigentes e históricos) e historial de traslados
 */
export function SociaDetailModal({ detail, onClose, canModify, onEdit, onRetirar }) {
  if (!detail) return null;
  const estado = ESTADO_BADGE[detail.estado] || ESTADO_BADGE.ACTIVA;

  return (
    <Modal
      title={nombreCompleto(detail)}
      subtitle={`RUT ${detail.rut} · ${detail.jardin?.name || 'Sin jardín asignado'}`}
      onClose={onClose}
      maxWidth="660px"
    >
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <InfoItem label="Cargo">{CARGO_LABELS[detail.cargo] || detail.cargo}</InfoItem>
          <InfoItem label="Estado">
            <Badge variant={estado.variant}>{estado.label}</Badge>
          </InfoItem>
          <InfoItem label="Fecha de ingreso">{detail.fechaIngreso ? formatDateCLP(detail.fechaIngreso) : 'Sin registro'}</InfoItem>
          <InfoItem label="Cuota social">
            {detail.cuotaMensual ? `${formatCurrencyCLP(detail.cuotaMensual)} / mes` : 'Sin cobro'}
          </InfoItem>
          <InfoItem label="Correo">{detail.correo || 'Sin registro'}</InfoItem>
          <InfoItem label="Celular">{detail.celular || 'Sin registro'}</InfoItem>
          <InfoItem label="Descuento créditos">{formatCurrencyCLP(detail.descuentoMensualCreditos)} / mes</InfoItem>
          {detail.esDelegada && <InfoItem label="Representación">Delegada de jardín</InfoItem>}
        </div>

        {detail.estado === 'SUSPENDIDA' && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--warning-text)' }}>
            Socia suspendida: no se cobra la cuota social mientras mantenga este estado.
          </div>
        )}
        {detail.estado === 'RETIRADA' && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--text-main)' }}>
            Retirada el {formatDateCLP(detail.fechaRetiro)}. Motivo: {detail.motivoRetiro}. Se conservan sus créditos e historial; para
            reactivarla, edite la ficha y elija un estado.
          </div>
        )}

        <div>
          <div style={sectionTitle}>Créditos y convenios</div>
          {!detail.creditos || detail.creditos.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>La socia no registra créditos.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {detail.creditos.map((c) => {
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

        {detail.historialJardin && detail.historialJardin.length > 0 && (
          <div>
            <div style={sectionTitle}>Historial de traslados</div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0, margin: 0 }}>
              {detail.historialJardin.map((h) => (
                <li key={h.id} style={{ display: 'flex', gap: '0.625rem', fontSize: '0.8125rem' }}>
                  <ArrowRightLeft size={15} style={{ color: 'var(--primary-500)', flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    <strong>{formatDateCLP(h.fecha)}</strong>: {h.jardinAnterior} → {h.jardinNuevo}. Motivo: {h.motivo}{' '}
                    <span style={{ color: 'var(--text-muted)' }}>({h.changedBy})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canModify && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
            {detail.estado !== 'RETIRADA' && onRetirar && (
              <Button variant="outline" icon={UserMinus} onClick={() => onRetirar(detail)}>
                Retirar socia
              </Button>
            )}
            {onEdit && (
              <Button variant="primary" icon={Pencil} onClick={() => onEdit(detail)}>
                {detail.estado === 'RETIRADA' ? 'Editar / reactivar' : 'Editar ficha'}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default SociaDetailModal;
