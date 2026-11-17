import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { LAST_ACTIVITY_KEY } from '../hooks/useIdleTimeout.js';
import { clearIdleLogoutFlag } from '../utils/idleSession.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Un valor dañado en el navegador no debe dejar la aplicación en blanco: se trata como sin sesión
    try {
      return JSON.parse(localStorage.getItem('vtf_user') || 'null');
    } catch {
      localStorage.removeItem('vtf_user');
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('vtf_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const storedToken = localStorage.getItem('vtf_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          if (res.data?.data?.user) {
            setUser(res.data.data.user);
            localStorage.setItem('vtf_user', JSON.stringify(res.data.data.user));
          }
        } catch (err) {
          // Solo un rechazo del servidor (sesión inválida, expirada o cuenta inactiva) cierra la sesión.
          // Sin conexión o con el servidor arrancando (cPanel) se conserva la sesión guardada.
          const status = err.response?.status;
          if (status === 401 || status === 403) {
            localStorage.removeItem('vtf_token');
            localStorage.removeItem('vtf_user');
            setUser(null);
            setToken(null);
          }
        }
      }
      setIsLoading(false);
    }

    checkAuth();
  }, []);

  const setAuthenticatedSession = (receivedToken, receivedUser) => {
    localStorage.setItem('vtf_token', receivedToken);
    localStorage.setItem('vtf_user', JSON.stringify(receivedUser));
    // Sesión nueva: el contador de inactividad parte de cero
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    // El aviso "sesión cerrada por inactividad" se muestra hasta el siguiente ingreso
    clearIdleLogoutFlag();
    setToken(receivedToken);
    setUser(receivedUser);
  };

  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    const { token: receivedToken, user: receivedUser } = res.data.data;

    setAuthenticatedSession(receivedToken, receivedUser);
    return receivedUser;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignorar errores al cerrar sesión
    } finally {
      localStorage.removeItem('vtf_token');
      localStorage.removeItem('vtf_user');
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      setUser(null);
      setToken(null);
    }
  };

  const hasRole = (...allowedRoles) => {
    if (!user || !user.role) return false;
    const currentCode = user.role.code || user.role;
    return allowedRoles.includes(currentCode);
  };

  const currentRoleCode = user?.role?.code || user?.role;
  const isDirectiva = [
    'ADMIN',
    'PRESIDENTA',
    'TESORERA',
    'SECRETARIA',
    'DIRECTORA'
  ].includes(currentRoleCode);

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    setAuthenticatedSession,
    logout,
    hasRole,
    isDirectiva,
    isAdmin: currentRoleCode === 'ADMIN',
    isTesorera: currentRoleCode === 'TESORERA',
    isDirectora: currentRoleCode === 'DIRECTORA',
    isSecretaria: currentRoleCode === 'SECRETARIA',
    isDelegada: currentRoleCode === 'DELEGADA',
    isSocia: currentRoleCode === 'SOCIA'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}
