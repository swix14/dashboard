import React, { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  { label, error, helperText, icon: Icon, className = '', ...props },
  ref
) {
  return (
    <div className="vtf-form-group">
      {label && <label className="vtf-label">{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {Icon && (
          <div
            style={{
              position: 'absolute',
              left: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none'
            }}
          >
            <Icon size={16} />
          </div>
        )}
        <input
          ref={ref}
          className={`vtf-input ${className}`}
          style={{
            paddingLeft: Icon ? '2.25rem' : '0.875rem',
            borderColor: error ? 'var(--error-text)' : undefined
          }}
          {...props}
        />
      </div>
      {error && <span className="vtf-error-text">{error}</span>}
      {helperText && !error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{helperText}</span>
      )}
    </div>
  );
});
