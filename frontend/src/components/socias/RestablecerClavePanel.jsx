import React, { useState } from 'react';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { SociaApiService } from '../../services/sociaService.js';

/**
 * Recuperación de clave hecha por la directiva desde la ficha de la socia.
 * Pide confirmación en el mismo lugar (sin otro modal) y avisa qué clave debe usar la socia.
 */
export function RestablecerClavePanel({ socia }) {
  const [step, setStep] = useState('idle'); // idle | confirm | done
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const confirmar = async () => {
    setIsLoading(true);
    setError('');
    try {
      await SociaApiService.restablecerClave(socia.id);
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo restablecer la clave. Intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const box = {
    padding: '0.875rem 1rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-light)',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.8125rem',
    color: 'var(--text-main)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  };

  if (step === 'done') {
    return (
      <div style={{ ...box, flexDirection: 'row', alignItems: 'flex-start', gap: '0.625rem', borderColor: 'var(--success-border)', backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }} role="status">
        <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>
          Clave restablecida. La socia ingresa al portal con los <strong>6 primeros dígitos de su RUT</strong> y el sistema
          le pedirá crear una clave nueva. Sus sesiones abiertas se cerraron.
        </span>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div style={box}>
        <span>
          ¿Restablecer la clave de esta socia? Su clave actual dejará de funcionar y volverá a ingresar con los
          6 primeros dígitos de su RUT.
        </span>
        {error && <span style={{ color: 'var(--error-text)' }} role="alert">{error}</span>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="ghost" size="sm" onClick={() => { setStep('idle'); setError(''); }} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" icon={KeyRound} onClick={confirmar} isLoading={isLoading}>
            Sí, restablecer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button variant="outline" icon={KeyRound} onClick={() => setStep('confirm')}>
      Restablecer clave
    </Button>
  );
}

export default RestablecerClavePanel;
