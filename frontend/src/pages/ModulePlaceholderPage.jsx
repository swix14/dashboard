import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/common/Button.jsx';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';

export function ModulePlaceholderPage({ title, version, description, features = [] }) {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/dashboard')}>
          Volver
        </Button>
        <Badge variant="info">{version}</Badge>
      </div>

      <Card
        title={title}
        subtitle="Módulo planificado según la hoja de ruta de desarrollo incremental"
      >
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-main)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {description}
        </p>

        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          Funcionalidades comprendidas en esta fase:
        </div>

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '2rem' }}>
          {features.map((feat, idx) => (
            <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--sand-100)',
            border: '1px solid var(--sand-200)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem',
            color: 'var(--sand-700)'
          }}
        >
          💡 <strong>Nota del Sistema:</strong> En cumplimiento de la directiva de trabajo modular (V1 a V8),
          este módulo se integrará progresivamente garantizando validación y pruebas en cada iteración.
        </div>
      </Card>
    </div>
  );
}
