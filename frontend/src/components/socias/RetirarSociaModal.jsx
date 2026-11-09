import React, { useState, useEffect } from 'react';
import { AlertCircle, UserMinus } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { SociaApiService } from '../../services/sociaService.js';
import { labelStyle, nombreCompleto } from './sociaLabels.js';

/**
 * Confirmación de retiro (baja lógica) con motivo obligatorio
 */
export function RetirarSociaModal({ socia, onClose, onSuccess }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMotivo('');
    setError(null);
  }, [socia]);

  if (!socia) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (motivo.trim().length < 3) {
      setError('Indique el motivo del retiro.');
      return;
    }
    try {
      setIsSaving(true);
      setError(null);
      await SociaApiService.retirarSocia(socia.id, motivo.trim());
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible retirar a la socia.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Retirar socia del padrón" subtitle={`${nombreCompleto(socia)} · RUT ${socia.rut}`} onClose={onClose} maxWidth="480px">
      <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
          La socia dejará de aparecer en el padrón y de pagar la cuota. <strong>Sus créditos e historial se conservan</strong> y
          puede reactivarse más adelante desde el filtro «Retiradas».
        </p>
        {error && (
          <div role="alert" style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', color: 'var(--error-text)', fontSize: '0.8125rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        <div>
          <label style={labelStyle} htmlFor="retiro-motivo">Motivo del retiro</label>
          <input
            id="retiro-motivo"
            className="vtf-input"
            placeholder="Ej: Renuncia voluntaria, término de contrato"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" icon={UserMinus} isLoading={isSaving}>
            Retirar socia
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default RetirarSociaModal;
