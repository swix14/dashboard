import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Campo de formulario del sistema.
 * Con type="password" agrega automáticamente el botón del ojo para mostrar/ocultar la clave.
 */
export const Input = forwardRef(function Input(
  { label, error, helperText, icon: Icon, className = '', type, ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && showPassword ? 'text' : type;

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
          type={effectiveType}
          className={`vtf-input ${className}`}
          style={{
            paddingLeft: Icon ? '2.25rem' : '0.875rem',
            paddingRight: isPassword ? '2.75rem' : undefined,
            borderColor: error ? 'var(--error-text)' : undefined
          }}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="vtf-password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={showPassword}
            title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
      {error && <span className="vtf-error-text">{error}</span>}
      {helperText && !error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{helperText}</span>
      )}
    </div>
  );
});
