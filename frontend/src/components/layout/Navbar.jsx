import React, { useState } from 'react';
import { LogOut, Menu, Search, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ThemeToggle } from '../common/ThemeToggle.jsx';

export function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header
      className="vtf-navbar"
      style={{
        height: '72px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        gap: '1rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '0 0 auto' }}>
        <button
          onClick={onToggleSidebar}
          className="navbar-menu-btn"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <img
            src="/logo-vtf.png"
            alt="Logo VTF"
            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <span
            className="navbar-brand-name"
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--primary-700)',
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap'
            }}
          >
            Asociación VTF Temuco
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              padding: '0.125rem 0.5rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success-text)',
              border: '1px solid var(--success-border)',
              display: 'none'
            }}
            className="badge-v1-desktop"
          >
            V2 Activa
          </span>
        </div>
      </div>

      {/* Buscador Institucional: Buscar en sistema... */}
      <div
        style={{
          flex: '1 1 auto',
          maxWidth: '420px',
          margin: '0 0.5rem',
          display: 'flex',
          alignItems: 'center',
          position: 'relative'
        }}
        className="navbar-search-container"
      >
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: '0.875rem',
            color: 'var(--text-muted)',
            pointerEvents: 'none'
          }}
        />
        <input
          type="text"
          placeholder="Buscar en sistema..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            height: '36px',
            padding: '0 1rem 0 2.5rem',
            fontSize: '0.8125rem',
            backgroundColor: 'var(--bg-page)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--text-main)',
            outline: 'none',
            transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--primary-400)';
            e.target.style.boxShadow = '0 0 0 3px var(--primary-100)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-light)';
            e.target.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Icono con nombre de quien ingresó a la app (sesión, perfil, cargo) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: '0 0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.25rem 0.625rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-light)'
          }}
          className="user-profile-badge"
        >
          {/* Avatar con iniciales o icono */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-500)',
              color: 'var(--on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8125rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {user?.firstName ? user.firstName.charAt(0) : <User size={16} />}
          </div>

          {/* Nombre, perfil y cargo */}
          <div style={{ textAlign: 'left', lineHeight: 1.25 }} className="user-details-text">
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {user?.firstName} {user?.lastName}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--primary-700)', fontWeight: 600 }}>
              {user?.role?.name || user?.role?.code} • {user?.cargo || 'Directiva'}
            </div>
          </div>
        </div>

        {/* Toggle Modo Oscuro / Claro */}
        <ThemeToggle size="sm" />
        <button
          type="button"
          className="navbar-logout-btn"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-label={isLoggingOut ? 'Cerrando sesión' : 'Cerrar sesión'}
          title="Cerrar sesión"
        >
          <LogOut size={18} aria-hidden="true" />
          <span>{isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
        </button>
      </div>

      <style>{`
        .navbar-logout-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          min-height: 40px;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--error-text);
          font: inherit;
          font-size: 0.8125rem;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
        }
        .navbar-logout-btn:hover {
          background: var(--error-bg);
        }
        .navbar-logout-btn:focus-visible {
          outline: 2px solid var(--primary-500);
          outline-offset: 2px;
        }
        .navbar-logout-btn:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        @media (max-width: 639px) {
          .navbar-logout-btn span {
            display: none;
          }
        }
        .navbar-menu-btn {
          background: transparent;
          border: none;
          color: var(--text-main);
          cursor: pointer;
          padding: 0.375rem;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (min-width: 1024px) {
          .navbar-menu-btn {
            display: none !important;
          }
        }

        @media (min-width: 640px) {
          .user-text-md {
            display: block !important;
          }
        }
      `}</style>
    </header>
  );
}
