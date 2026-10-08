import React from 'react';
import { Menu, Bell, ShieldCheck, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ThemeToggle } from '../common/ThemeToggle.jsx';

export function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 30
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main)',
            cursor: 'pointer',
            padding: '0.375rem',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--primary-700)',
              letterSpacing: '0.01em'
            }}
          >
            Sistema de Gestión VTF
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              padding: '0.125rem 0.5rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success-text)',
              border: '1px solid var(--success-border)'
            }}
          >
            V1 Activa
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Indicador de Rol */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.375rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--sand-100)',
            border: '1px solid var(--sand-200)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--sand-700)'
          }}
        >
          <ShieldCheck size={14} />
          <span>{user?.role?.name || user?.role?.code || 'Socia'}</span>
        </div>

        {/* Perfil Usuario y Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right', display: 'none' }} className="user-text-md">
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {user?.firstName} {user?.lastName}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              RUT: {user?.rut}
            </div>
          </div>

          {/* Selector de Modo Oscuro / Claro */}
          <ThemeToggle size="sm" />

          <button
            onClick={logout}
            title="Cerrar sesión"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '0.375rem 0.5rem',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.75rem',
              transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--error-text)';
              e.currentTarget.style.borderColor = 'var(--error-border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.borderColor = 'var(--border-light)';
            }}
          >
            <LogOut size={14} />
            <span style={{ fontWeight: 500 }}>Salir</span>
          </button>
        </div>
      </div>

      <style>{`
        @media (min-width: 640px) {
          .user-text-md {
            display: block !important;
          }
        }
      `}</style>
    </header>
  );
}
