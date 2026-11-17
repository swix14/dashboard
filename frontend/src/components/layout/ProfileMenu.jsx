import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, KeyRound, LogOut, Moon, Sun, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { ChangePasswordModal } from '../auth/ChangePasswordModal.jsx';

/**
 * Menú de perfil (directiva y portal de socias): al hacer clic en el nombre se despliegan
 * cambiar contraseña, modo claro/oscuro y cerrar sesión.
 * @param {string} [subtitle] - segunda línea bajo el nombre (por defecto: rol • cargo)
 * @param {Function} [onLogout] - cierre de sesión propio (el portal vuelve a su login)
 * @param {Function} [renderPasswordModal] - recibe onClose y devuelve el modal de cambio de clave
 */
export function ProfileMenu({ subtitle, onLogout, renderPasswordModal }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  // Cierra con clic afuera o con Escape (devolviendo el foco al botón)
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await (onLogout ? onLogout() : logout());
    } finally {
      setIsLoggingOut(false);
    }
  };

  const openPassword = () => {
    setOpen(false);
    setShowPassword(true);
  };

  const nombre = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const rol = user?.role?.name || user?.role?.code || 'Directiva';

  return (
    <div className="vtf-profile" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="vtf-profile-trigger user-profile-badge"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de perfil de ${nombre || 'usuario'}`}
      >
        <span className="vtf-profile-avatar" aria-hidden="true">
          {user?.firstName ? user.firstName.charAt(0) : <User size={16} />}
        </span>
        <span className="vtf-profile-text user-details-text">
          <span className="vtf-profile-name">{nombre}</span>
          <span className="vtf-profile-role">{subtitle || `${rol} • Directiva`}</span>
        </span>
        <ChevronDown size={16} className="vtf-profile-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="vtf-profile-menu" role="menu" aria-label="Opciones de perfil">
          <div className="vtf-profile-head">
            <span className="vtf-profile-name">{nombre}</span>
            <span className="vtf-profile-role">{rol}</span>
            {user?.rut && <span className="vtf-profile-rut">RUT {user.rut}</span>}
          </div>

          <button type="button" role="menuitem" className="vtf-profile-item" onClick={openPassword}>
            <KeyRound size={16} aria-hidden="true" />
            <span>Cambiar contraseña</span>
          </button>

          {/* El tema cambia sin cerrar el menú, para ver el resultado al instante */}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={isDark}
            className="vtf-profile-item"
            onClick={toggleTheme}
          >
            {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            <span>{isDark ? 'Modo claro' : 'Modo oscuro'}</span>
            <span className={`vtf-profile-switch${isDark ? ' is-on' : ''}`} aria-hidden="true" />
          </button>

          <div className="vtf-profile-sep" role="separator" />

          <button
            type="button"
            role="menuitem"
            className="vtf-profile-item is-danger"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut size={16} aria-hidden="true" />
            <span>{isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
          </button>
        </div>
      )}

      {showPassword &&
        (renderPasswordModal ? (
          renderPasswordModal(() => setShowPassword(false))
        ) : (
          <ChangePasswordModal onClose={() => setShowPassword(false)} onDone={() => setShowPassword(false)} />
        ))}
    </div>
  );
}

export default ProfileMenu;
