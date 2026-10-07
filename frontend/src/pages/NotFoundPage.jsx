import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button.jsx';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '70vh',
        textAlign: 'center',
        padding: '2rem'
      }}
    >
      <div
        style={{
          fontSize: '4rem',
          fontWeight: 800,
          color: 'var(--primary-400)',
          fontFamily: 'var(--font-family-display)',
          lineHeight: 1
        }}
      >
        404
      </div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>
        Página no encontrada
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        La ruta solicitada no existe o fue reubicada en el sistema institucional.
      </p>
      <Button variant="primary" icon={ArrowLeft} onClick={() => navigate('/dashboard')}>
        Volver al Inicio
      </Button>
    </div>
  );
}
