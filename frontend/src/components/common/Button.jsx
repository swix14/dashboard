import React from 'react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  isLoading = false,
  icon: Icon,
  onClick,
  className = '',
  ...props
}) {
  const variantClass = `vtf-btn-${variant}`;

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`vtf-btn ${variantClass} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            width: '14px',
            height: '14px',
            border: '2px solid rgba(255,255,255,0.4)',
            borderTop: '2px solid currentColor',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 0.6s linear infinite'
          }}
        />
      ) : Icon ? (
        <Icon size={16} />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
