import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Users,
  CheckCircle,
  Clock,
  CreditCard,
  Building2,
  TrendingUp,
  Receipt,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';

// Formatea fecha en estándar completo DD/MM/AAAA con dígitos tabulares
const formatFullDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export function DashboardPage() {
  const { user, isDirectiva, isTesorera } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setIsLoading(true);
        const res = await api.get('/dashboard/metrics');
        setData(res.data.data);
      } catch (err) {
        setError('No fue posible cargar las métricas del dashboard');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: '3rem 0', textAlign: 'center' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid var(--primary-100)',
            borderTop: '3px solid var(--primary-500)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem'
          }}
        />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Cargando métricas institucionales...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          padding: '2rem',
          backgroundColor: 'var(--error-bg)',
          border: '1px solid var(--error-border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--error-text)'
        }}
      >
        <p style={{ fontWeight: 600 }}>{error || 'Error al cargar los datos'}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Banner de Bienvenida Institucional */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.75rem 2rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <Badge variant="info" icon={ShieldCheck}>
              Rol Activo: {user?.role?.name || user?.role?.code}
            </Badge>
            {user?.socia?.jardin?.name && (
              <Badge variant="neutral">
                {user.socia.jardin.name}
              </Badge>
            )}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Bienvenida, {user?.firstName} {user?.lastName}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Panel institucional adaptado a su nivel de autorización en la Asociación de Jardines VTF.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.625rem 1rem',
              backgroundColor: 'var(--primary-50)',
              border: '1px solid var(--primary-100)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'right'
            }}
          >
            <div style={{ fontSize: '0.6875rem', color: 'var(--primary-700)', fontWeight: 600, textTransform: 'uppercase' }}>
              Cuota Social Mensual
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--primary-900)' }}>
              ${data.valorCuotaMensual.toLocaleString('es-CL')} CLP
            </div>
          </div>
        </div>
      </div>

      {/* Grid de KPIs Adaptativo */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem'
        }}
      >
        {data.kpis?.map((kpi) => (
          <div
            key={kpi.id}
            className="vtf-card vtf-card-hover"
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {kpi.label}
              </div>
              <div
                style={{
                  fontSize: '1.625rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginTop: '0.5rem',
                  letterSpacing: '-0.02em'
                }}
              >
                {kpi.value}
              </div>
            </div>
            {(kpi.change || kpi.sublabel) && (
              <div
                style={{
                  marginTop: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color:
                    kpi.type === 'positive'
                      ? 'var(--success-text)'
                      : kpi.type === 'warning'
                      ? 'var(--warning-text)'
                      : 'var(--text-muted)'
                }}
              >
                {kpi.change || kpi.sublabel}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desglose de Cuota Mensual y Distribución Financiera */}
      <div className={`dashboard-finance-grid ${isDirectiva ? 'has-movements' : ''}`}>
        {/* Desglose de la Cuota Obligatoria */}
        <Card
          title="Estructura de la Cuota Social ($4.000 CLP)"
          subtitle="Distribución estatutaria aprobada por la asociación"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-surface-subtle)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Fondo Cena Anual</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Ahorro reservado para la actividad de fin de año
                </div>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-700)' }}>
                ${data.distribucionCuota?.cenaAnual?.toLocaleString('es-CL')} (50%)
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-surface-subtle)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Fondo Asociación</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Gastos de funcionamiento, convenios y bienestar
                </div>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-700)' }}>
                ${data.distribucionCuota?.asociacion?.toLocaleString('es-CL')} (25%)
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-surface-subtle)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Aporte Federación</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Cuota gremial nacional representativa
                </div>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-700)' }}>
                ${data.distribucionCuota?.federacion?.toLocaleString('es-CL')} (25%)
              </div>
            </div>
          </div>
        </Card>

        {/* Movimientos Recientes (Solo Directiva / Tesorera) */}
        {isDirectiva && data.movimientosRecientes && (
          <Card
            title="Movimientos Financieros Recientes"
            subtitle="Trazabilidad con comprobantes respaldados"
          >
            <div className="vtf-table-container">
              <table className="vtf-table">
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap', width: '120px' }}>Fecha</th>
                    <th style={{ whiteSpace: 'nowrap', width: '90px' }}>Tipo</th>
                    <th>Categoría</th>
                    <th style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>Monto</th>
                    <th style={{ whiteSpace: 'nowrap', textAlign: 'center', width: '110px' }}>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {data.movimientosRecientes.map((mov) => (
                    <tr key={mov.id}>
                      <td
                        style={{
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 600,
                          color: 'var(--text-main)'
                        }}
                      >
                        {formatFullDate(mov.fecha)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Badge variant={mov.tipo === 'INGRESO' ? 'success' : 'neutral'}>
                          {mov.tipo}
                        </Badge>
                      </td>
                      <td style={{ fontWeight: 500 }}>{mov.categoria}</td>
                      <td
                        style={{
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: mov.tipo === 'INGRESO' ? 'var(--success-text)' : 'var(--text-main)'
                        }}
                      >
                        {mov.tipo === 'INGRESO' ? '+' : '-'}${mov.monto.toLocaleString('es-CL')}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {mov.comprobante ? (
                          <Badge variant="info">Verificado</Badge>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Privacidad de Delegadas y Socias */}
      {!isDirectiva && (
        <div
          style={{
            backgroundColor: 'var(--primary-50)',
            border: '1px solid var(--primary-100)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem'
          }}
        >
          <AlertCircle size={22} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-900)' }}>
              Política de Privacidad y Transparencia Institucional
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--primary-800)', marginTop: '0.25rem', lineHeight: 1.5 }}>
              Por disposición del estatuto VTF, las delegadas y socias tienen acceso directo al estado general
              del fondo común y sus propios registros. La información de créditos y deudas individuales de otras
              socias permanece bajo estricta confidencialidad para resguardar la privacidad de cada trabajadora.
            </p>
          </div>
        </div>
      )}

      <style>{`
        .dashboard-finance-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        @media (min-width: 1024px) {
          .dashboard-finance-grid.has-movements {
            grid-template-columns: 360px 1fr;
          }
        }
      `}</style>
    </div>
  );
}
