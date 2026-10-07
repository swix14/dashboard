import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('vtf_user');
    return saved ? JSON.parse(saved) : null;
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
        } catch {
          // Token inválido o expirado
          localStorage.removeItem('vtf_token');
          localStorage.removeItem('vtf_user');
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    }

    checkAuth();
  }, []);

  const login = async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    const { token: receivedToken, user: receivedUser } = res.data.data;

    localStorage.setItem('vtf_token', receivedToken);
    localStorage.setItem('vtf_user', JSON.stringify(receivedUser));

    setToken(receivedToken);
    setUser(receivedUser);
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
    'PRESIDENTA',
    'TESORERA',
    'SECRETARIA',
    'PRIMERA_DIRECTORA',
    'SEGUNDA_DIRECTORA'
  ].includes(currentRoleCode);

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    hasRole,
    isDirectiva,
    isTesorera: currentRoleCode === 'TESORERA',
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
