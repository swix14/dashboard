import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  DollarSign,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  ShieldAlert,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function Sidebar({ isOpen, onClose }) {
  const { user, logout, isDirectiva, isTesorera, isSecretaria } = useAuth();

  const roleCode = user?.role?.code;

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard General',
      icon: LayoutDashboard,
      badge: 'V1 Activo',
      badgeVariant: 'success',
      allowed: true
    },
    {
      to: '/socias',
      label: 'Gestión de Socias',
      icon: Users,
      badge: 'V2',
      badgeVariant: 'neutral',
      allowed: isDirectiva || isSecretaria
    },
    {
      to: '/jardines',
      label: '23 Jardines VTF',
      icon: Building2,
      badge: 'V2',
      badgeVariant: 'neutral',
      allowed: true
    },
    {
      to: '/finanzas',
      label: 'Cuotas e Ingresos',
      icon: DollarSign,
      badge: 'V3',
      badgeVariant: 'neutral',
      allowed: isDirectiva || isTesorera
    },
    {
      to: '/creditos',
      label: 'Créditos y Convenios',
      icon: CreditCard,
      badge: 'V4',
      badgeVariant: 'neutral',
      allowed: isDirectiva || isTesorera
    },
    {
      to: '/comprobantes',
      label: 'Comprobantes y Pagos',
      icon: Receipt,
      badge: 'V5',
      badgeVariant: 'neutral',
      allowed: isDirectiva || isTesorera
    },
    {
      to: '/reportes',
      label: 'Reportes y Rendición',
      icon: FileSpreadsheet,
      badge: 'V6',
      badgeVariant: 'neutral',
      allowed: true
    },
    {
      to: '/auditoria',
      label: 'Bitácora de Auditoría',
      icon: ShieldAlert,
      badge: 'V7',
      badgeVariant: 'neutral',
      allowed: ['PRESIDENTA', 'TESORERA', 'SECRETARIA'].includes(roleCode)
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
          backgroundColor: 'var(--bg-surface)',
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
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary-500)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.125rem',
                boxShadow: '0 4px 10px rgba(109, 89, 122, 0.35)'
              }}
            >
              VTF
            </div>
            <div>
              <h1 style={{ fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.2 }}>
                Asociación VTF
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
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)' }}>
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
