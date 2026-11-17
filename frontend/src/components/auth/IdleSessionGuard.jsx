import React, { useCallback } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useIdleTimeout } from '../../hooks/useIdleTimeout.js';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { IDLE_LOGOUT_FLAG } from '../../utils/idleSession.js';

// 10 minutos sin actividad cierran la sesión; el aviso aparece 1 minuto antes
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
export const IDLE_WARNING_MS = 60 * 1000;

export function IdleSessionGuard() {
  const { isAuthenticated, isSocia, logout } = useAuth();

  const handleTimeout = useCallback(async () => {
    const loginPath = isSocia ? '/socia/login' : '/login';
    try {
      sessionStorage.setItem(IDLE_LOGOUT_FLAG, '1');
    } catch {
      // Sin sessionStorage solo se pierde el mensaje explicativo
    }
    await logout();
    window.location.replace(loginPath);
  }, [isSocia, logout]);

  const { secondsLeft, stayActive } = useIdleTimeout({
    enabled: isAuthenticated,
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onTimeout: handleTimeout
  });

  if (secondsLeft === null) return null;

  return (
    <Modal
      title="¿Sigues ahí?"
      subtitle="Por seguridad, la sesión se cierra tras 10 minutos sin actividad"
      onClose={stayActive}
      maxWidth="420px"
      footer={
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="outline" icon={LogOut} onClick={handleTimeout}>
            Cerrar sesión
          </Button>
          <Button variant="primary" onClick={stayActive}>
            Seguir conectada
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1.5rem' }} role="alert" aria-live="assertive">
        <Clock size={28} style={{ color: 'var(--warning-text)', flexShrink: 0 }} aria-hidden="true" />
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-main)' }}>
          Tu sesión se cerrará en{' '}
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{secondsLeft} s</strong>.
        </p>
      </div>
    </Modal>
  );
}
