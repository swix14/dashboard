import React from 'react';

export function Card({ children, title, subtitle, action, hover = false, className = '', ...props }) {
  return (
    <div className={`vtf-card ${hover ? 'vtf-card-hover' : ''} ${className}`} {...props}>
      {(title || subtitle || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <div>
            {title && (
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
