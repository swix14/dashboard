import React from 'react';
import { Menu } from 'lucide-react';
import { ProfileMenu } from './ProfileMenu.jsx';

export function Navbar({ onToggleSidebar }) {

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

      {/* Espaciador: el buscador se quitó porque no buscaba nada */}
      <div style={{ flex: '1 1 auto' }} />

      {/* Perfil: al hacer clic se despliegan cambiar contraseña, tema y cerrar sesión */}
      <div style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
        <ProfileMenu />
      </div>

      <style>{`
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
