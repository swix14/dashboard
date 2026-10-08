import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';

export function ThemeToggle({
  size = 'md',
  showLabel = false,
  className = '',
  style = {}
}) {
  const { isDark, toggleTheme } = useTheme();

  const iconSize = size === 'sm' ? 16 : 18;
  const padding = size === 'sm' ? '0.375rem 0.5rem' : '0.5rem 0.625rem';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`vtf-theme-toggle ${className}`}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding,
        background: 'var(--bg-surface-subtle)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        color: isDark ? 'hsl(45, 95%, 65%)' : 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        outline: 'none',
        userSelect: 'none',
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary-300)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-light)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform var(--transition-normal)'
        }}
      >
        {isDark ? (
          <Sun size={iconSize} style={{ color: 'hsl(45, 95%, 65%)' }} />
        ) : (
          <Moon size={iconSize} style={{ color: 'var(--primary-600)' }} />
        )}
      </div>

      {showLabel && (
        <span
          style={{
            fontSize: size === 'sm' ? '0.75rem' : '0.8125rem',
            fontWeight: 600,
            color: 'var(--text-main)'
          }}
        >
          {isDark ? 'Modo Claro' : 'Modo Oscuro'}
        </span>
      )}
    </button>
  );
}
