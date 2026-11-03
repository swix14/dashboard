import React from 'react';
import { ArrowRightLeft, Pencil } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { formatCurrencyCLP, formatDateCLP } from '../../utils/formatters.js';

const CARGO_LABELS = {
  DIRECTORA: 'Directora',
  EDUCADORA: 'Educadora',
  TECNICO: 'Técnico',
  ASISTENTE: 'Asistente',
  AUXILIAR: 'Auxiliar'
};
const DIRECTIVA_LABELS = {
  PRESIDENTA: 'Presidenta',
  TESORERA: 'Tesorera',
  SECRETARIA: 'Secretaria',
  DIRECTORA: 'Directora Directiva'
};

function InfoItem({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.15rem' }}>{children}</div>
    </div>
  );
}

/**
 * Modal detallado de ficha de socia con créditos e historial de traslados
 */
export function SociaDetailModal({ detail, onClose, canModify, onEdit }) {
  if (!detail) return null;

  return (
    <Modal
      title={`${detail.firstName} ${detail.lastName}`}
      subtitle={`RUT ${detail.rut} · ${detail.jardin?.name || ''}`}
      onClose={onClose}
      maxWidth="640px"
    >
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <InfoItem label="Cargo">{CARGO_LABELS[detail.cargo] || detail.cargo}</InfoItem>
          <InfoItem label="Estado">
            <Badge variant={detail.estado === 'ACTIVA' ? 'success' : 'error'}>
              {detail.estado === 'ACTIVA' ? 'Activa' : 'Suspendida'}
            </Badge>
          </InfoItem>
          <InfoItem label="Incorporación">{formatDateCLP(detail.fechaIncorporacion)}</InfoItem>
          <InfoItem label="Cuota social">
            {detail.cuotaMensual ? `${formatCurrencyCLP(detail.cuotaMensual)} / mes` : 'Sin cobro'}
          </InfoItem>
          <InfoItem label="Descuento créditos">
            {formatCurrencyCLP(detail.descuentoMensualCreditos)} / mes
          </InfoItem>
          {(detail.cargoDirectiva || detail.esDelegada) && (
            <InfoItem label="Representación">
              {[detail.cargoDirectiva && DIRECTIVA_LABELS[detail.cargoDirectiva], detail.esDelegada && 'Delegada de jardín']
                .filter(Boolean)
                .join(' · ')}
            </InfoItem>
          )}
        </div>

        {detail.estado === 'SUSPENDIDA' && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--error-text)' }}>
            Socia suspendida: no se genera cobro de la cuota social mientras mantenga este estado.
          </div>
        )}

        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Créditos y convenios
          </div>
          {!detail.creditos || detail.creditos.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>La socia no registra créditos.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {detail.creditos.map((c) => {
                const progress = Math.round((c.cuotasPagadas / c.totalCuotas) * 100);
                return (
                  <div key={c.id} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.625rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.tipoNombre}</span>
                      <Badge variant={c.estado === 'ACTIVO' ? 'warning' : 'success'}>
                        {c.estado === 'ACTIVO' ? 'Vigente' : 'Finalizado'}
                      </Badge>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      <span>Cuota {c.cuotasPagadas} de {c.totalCuotas}</span>
                      <span>{progress}%</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-surface-subtle)', overflow: 'hidden', marginBottom: '0.75rem' }}>
                      <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--primary-500)' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                      <InfoItem label="Monto">{formatCurrencyCLP(c.montoSolicitado)}</InfoItem>
                      <InfoItem label="Valor cuota">{formatCurrencyCLP(c.valorCuota)}</InfoItem>
                      <InfoItem label="Saldo pendiente">{formatCurrencyCLP(c.saldoPendiente)}</InfoItem>
                      <InfoItem label="Período">
                        {formatDateCLP(c.fechaInicio)} – {formatDateCLP(c.fechaTermino)}
                      </InfoItem>
                      {c.comisionAsociacion > 0 && (
                        <InfoItem label="Comisión 2% Asoc.">{formatCurrencyCLP(c.comisionAsociacion)}</InfoItem>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {detail.historialJardin && detail.historialJardin.length > 0 && (
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Historial de traslados
            </div>
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

        {canModify && onEdit && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="outline" icon={Pencil} onClick={() => onEdit(detail)}>
              Editar ficha
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default SociaDetailModal;
