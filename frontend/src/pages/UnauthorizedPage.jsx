import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 1rem',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--warning-bg)',
          color: 'var(--warning-text)',
          border: '1px solid var(--warning-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem'
        }}
      >
        <ShieldAlert size={32} />
      </div>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
        Acceso No Autorizado (403)
      </h2>
      <p
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-muted)',
          maxWidth: '460px',
          margin: '0.5rem auto 1.5rem',
          lineHeight: 1.5
        }}
      >
        Su rol institucional ({user?.role?.name || user?.role?.code || 'Socia'}) no cuenta con privilegios
        para acceder a este módulo. Si requiere autorización, solicítela a la directiva de la asociación.
      </p>

      <Button variant="primary" icon={ArrowLeft} onClick={() => navigate('/dashboard')}>
        Volver al Dashboard
      </Button>
    </div>
  );
}
