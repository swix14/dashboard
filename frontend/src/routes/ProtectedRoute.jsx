import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-page)',
          gap: '1rem'
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--primary-100)',
            borderTop: '3px solid var(--primary-500)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}
        />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
          Verificando credenciales institucionales...
        </p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
