import React, { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Campo de formulario del sistema.
 * Con type="password" agrega automáticamente el botón del ojo para mostrar/ocultar la clave.
 */
export const Input = forwardRef(function Input(
  { label, error, helperText, icon: Icon, className = '', type, id, ...props },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && showPassword ? 'text' : type;
  // La etiqueta queda asociada al campo (lector de pantalla y clic en la etiqueta)
  const autoId = useId();
  const inputId = id || autoId;
  const hintId = `${inputId}-hint`;
  const hint = error || helperText;

  return (
    <div className="vtf-form-group">
      {label && <label className="vtf-label" htmlFor={inputId}>{label}</label>}
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
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint ? hintId : undefined}
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
      {error && <span id={hintId} className="vtf-error-text">{error}</span>}
      {helperText && !error && (
        <span id={hintId} className="vtf-helper-text">{helperText}</span>
      )}
    </div>
  );
});
