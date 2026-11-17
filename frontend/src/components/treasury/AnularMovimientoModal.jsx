import React, { useEffect, useState } from 'react';
import { AlertCircle, Ban } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { TreasuryApiService } from '../../services/treasuryService.js';
import { formatCurrencyCLP, formatDateCLP } from '../../utils/formatters.js';

/**
 * Anulación de un movimiento con motivo obligatorio.
 * El movimiento queda en el libro (tachado) para la comisión revisadora, pero deja de sumar en los saldos.
 */
export function AnularMovimientoModal({ movement, onClose, onSuccess }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMotivo('');
    setError(null);
  }, [movement]);

  if (!movement) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (motivo.trim().length < 3) return setError('Indique el motivo de la anulación.');
    try {
      setIsSaving(true);
      setError(null);
      const res = await TreasuryApiService.annulMovement(movement.id, motivo.trim());
      onSuccess(res.message);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible anular el movimiento.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title={`Anular movimiento ${movement.correlativo}`} subtitle={`${formatDateCLP(movement.fecha)} · ${movement.descripcion}`} onClose={onClose} maxWidth="480px">
      <form onSubmit={handleSubmit} className="tes-anular-form">
        <p className="tes-anular-texto">
          El {movement.tipo === 'INGRESO' ? 'ingreso' : 'egreso'} de <strong>{formatCurrencyCLP(movement.monto)}</strong> dejará de
          sumar en los saldos, el Inicio y el informe mensual. <strong>Seguirá visible en el libro</strong>, tachado y con su
          motivo, y no se puede deshacer.
        </p>
        {error && (
          <div className="com-alert com-alert-error" role="alert" style={{ marginBottom: 0 }}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        <div className="cred-campo">
          <label className="vtf-label" htmlFor="tes-anular-motivo">Motivo de la anulación</label>
          <input
            id="tes-anular-motivo"
            className="vtf-input"
            maxLength={255}
            placeholder="Ej: monto mal digitado, registrado dos veces"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            autoFocus
          />
        </div>
        <div className="cred-actions" style={{ marginTop: 0 }}>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="danger" icon={Ban} isLoading={isSaving}>Anular movimiento</Button>
        </div>
      </form>
    </Modal>
  );
}

export default AnularMovimientoModal;
