import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChangePasswordModal } from '../auth/ChangePasswordModal.jsx';
import {
  KeyRound,
  LayoutDashboard,
  Users,
  DollarSign,
  FolderOpen,
  FileSpreadsheet,
  ShieldAlert,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function Sidebar({ isOpen, onClose }) {
  const { user, logout, isDirectiva, isTesorera, isSecretaria } = useAuth();

  const roleCode = user?.role?.code;
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const navItems = [
    {
      to: '/dashboard',
      label: 'Inicio Institucional',
      icon: LayoutDashboard,
      allowed: true
    },
    {
      to: '/tesoreria',
      label: 'Tesorería y Fondos',
      icon: DollarSign,
      allowed: ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA'].includes(roleCode)
    },
    {
      to: '/socias',
      label: 'Socias y Créditos',
      icon: Users,
      allowed: isDirectiva || isSecretaria
    },
    {
      to: '/documentos',
      label: 'Gestión Documental',
      icon: FolderOpen,
      allowed: isDirectiva || isTesorera
    },
    {
      to: '/reportes',
      label: 'Reportes y Delegadas',
      icon: FileSpreadsheet,
      allowed: true
    },
    {
      to: '/auditoria',
      label: 'Bitácora de Auditoría',
      icon: ShieldAlert,
      allowed: ['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA'].includes(roleCode)
    }
  ];

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(18, 24, 38, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 40
          }}
          className="mobile-sidebar-overlay"
        />
      )}

      <aside
        className={`vtf-sidebar ${isOpen ? 'open' : ''}`}
        style={{
          width: '270px',
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 50,
          transition: 'transform var(--transition-normal)'
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '1.5rem 1.25rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src="/logo-vtf.png"
              alt="Logo Asociación VTF Temuco"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                objectFit: 'cover',
                backgroundColor: 'white',
                padding: '2px',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)'
              }}
            />
            <div>
              <h1 style={{ fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.2, color: 'var(--text-main)' }}>
                Asociación VTF Temuco
              </h1>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Gestión Institucional
              </span>
            </div>
          </div>
          {/* Botón cerrar en móvil */}
          <button
            onClick={onClose}
            className="mobile-close-btn"
            aria-label="Cerrar menú"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'none',
              padding: '0.25rem'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* User Card Resumen en Sidebar */}
        <div
          style={{
            padding: '1rem 1.25rem',
            margin: '0.75rem 0.875rem',
            background: 'var(--primary-50)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--primary-100)'
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--primary-700)', fontWeight: 600 }}>
            {user?.role?.name || user?.role?.code || 'Socia'}
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.125rem' }}>
            {user?.firstName} {user?.lastName}
          </div>
          {user?.socia?.jardin?.name && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              📍 {user.socia.jardin.name}
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav style={{ flex: 1, padding: '0.5rem 0.75rem', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-subtle)', padding: '0.5rem 0.75rem' }}>
            Menú de Navegación
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {navItems
              .filter((item) => item.allowed)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => {
                        if (window.innerWidth < 1024) onClose();
                      }}
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.625rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--primary-700)' : 'var(--text-main)',
                        backgroundColor: isActive ? 'var(--primary-100)' : 'transparent',
                        transition: 'all var(--transition-fast)'
                      })}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Icon size={18} style={{ color: 'inherit' }} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            padding: '0.125rem 0.375rem',
                            borderRadius: 'var(--radius-full)',
                            fontWeight: 600,
                            backgroundColor:
                              item.badgeVariant === 'success'
                                ? 'var(--success-bg)'
                                : 'var(--bg-surface-subtle)',
                            color:
                              item.badgeVariant === 'success'
                                ? 'var(--success-text)'
                                : 'var(--text-muted)',
                            border: `1px solid ${
                              item.badgeVariant === 'success'
                                ? 'var(--success-border)'
                                : 'var(--border-light)'
                            }`
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
          </ul>
        </nav>

        {/* Footer Sidebar */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)', display: 'grid', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.625rem 0.875rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              background: 'transparent',
              color: 'var(--text-main)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <KeyRound size={16} />
            <span>Cambiar contraseña</span>
          </button>
          <button
            onClick={logout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.625rem 0.875rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              background: 'transparent',
              color: 'var(--error-text)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background var(--transition-fast)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--error-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          onDone={() => setShowPasswordModal(false)}
        />
      )}

      <style>{`
        @media (max-width: 1023px) {
          .vtf-sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-100%);
            box-shadow: var(--shadow-lg);
          }
          .vtf-sidebar.open {
            transform: translateX(0);
          }
          .mobile-close-btn {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
