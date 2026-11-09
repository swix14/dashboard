import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Componente modal accesible y reutilizable
 * Diseñado bajo los estándares del sistema VTF con backdrop difuminado y cierre con ESC
 */
export function Modal({ title, subtitle, onClose, children, maxWidth = '560px', footer = null, dismissible = true }) {
  useEffect(() => {
    if (!dismissible) return undefined;
    const handleKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, dismissible]);

  return (
    <div
      onClick={dismissible ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18, 24, 38, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem'
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: 'calc(100vh - 2rem)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            backgroundColor: 'var(--bg-surface-subtle)'
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {title}
            </h3>
            {subtitle && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {subtitle}
              </span>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              aria-label="Cerrar modal"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                padding: '0.25rem',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Cuerpo con scroll independiente */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Pie de modal opcional */}
        {footer && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-surface-subtle)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
