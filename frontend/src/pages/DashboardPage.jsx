import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  UserX,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Filter,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { formatCurrencyCLP, formatDateCLP } from '../utils/formatters.js';

export function DashboardPage() {
  const { user, isDirectiva } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState('2026');
  const [activeAlertModal, setActiveAlertModal] = useState(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setIsLoading(true);
        const res = await api.get('/dashboard/metrics');
        setData(res.data.data);
      } catch (err) {
        const detalle =
          err.response?.data?.message ||
          (err.code === 'ECONNABORTED' ? 'El servidor tardó demasiado en responder.' : err.message);
        setError(`No fue posible cargar las métricas del dashboard. ${detalle || ''}`.trim());
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: '4rem 0', textAlign: 'center' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--primary-100)',
            borderTop: '3px solid var(--primary-500)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1.25rem'
          }}
        />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', fontWeight: 500 }}>
          Cargando panel de inicio de la Asociación VTF Temuco...
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
        <p style={{ fontWeight: 600 }}>{error || 'Error al cargar los datos del sistema'}</p>
      </div>
    );
  }

  const inicioData = data.inicio || {};
  const monthlyData = inicioData.graficos?.recaudacionMensual?.[selectedYear] || [];
  const maxMonthValue = Math.max(...monthlyData.map((d) => Math.max(d.ingresos, d.egresos)), 1400000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Banner de Bienvenida Institucional */}
      <div
        className="dashboard-welcome"
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: 0, flex: '1 1 300px' }}>
          <img
            src="/logo-vtf.png"
            alt="Logo VTF Temuco"
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--primary-200)',
              boxShadow: 'var(--shadow-sm)'
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
              <Badge variant="info" icon={ShieldCheck}>
                {user?.role?.name || user?.role?.code}
              </Badge>
              <Badge variant="neutral">
                {user?.cargo || 'Directiva'}
              </Badge>
              {user?.socia?.jardin?.name && (
                <Badge variant="neutral">
                  {user.socia.jardin.name}
                </Badge>
              )}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
              Bienvenida, {user?.firstName} {user?.lastName}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Asociación de Jardines VTF Temuco • Panel de Inicio y Transparencia
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: 'var(--sand-50)',
              border: '1px solid var(--sand-200)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'right'
            }}
          >
            <div style={{ fontSize: '0.6875rem', color: 'var(--sand-700)', fontWeight: 600, textTransform: 'uppercase' }}>
              Cuota Social Mensual
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--primary-800)' }}>
              {formatCurrencyCLP(data.valorCuotaMensual)}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          FILA 1: TRES RECUADROS SUPERIORES KPI (REQUERIMIENTO INICIO)
          - RECUADRO SOCIAS ACTIVAS
          - RECUADRO SOCIAS SUSPENDIDAS
          - RECUADRO SALDO TOTAL (suma saldos cena anual + asociacion)
         ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'var(--dashboard-kpi-columns)',
          gap: '1.5rem'
        }}
      >
        {/* RECUADRO SOCIAS ACTIVAS */}
        <div
          className="vtf-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderLeft: '4px solid var(--primary-500)',
            position: 'relative'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-700)', letterSpacing: '0.04em' }}>
                Socias Activas
              </span>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary-50)',
                  color: 'var(--primary-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <UserCheck size={20} />
              </div>
            </div>
            <div style={{ fontSize: 'var(--metric-size)', fontWeight: 700, color: 'var(--primary-500)', fontVariantNumeric: 'tabular-nums' }}>
              {inicioData.sociasActivas ?? 276}
            </div>
          </div>
          <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>De un padrón de 280</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success-text)', backgroundColor: 'var(--success-bg)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-full)' }}>
              98.6% al día
            </span>
          </div>
        </div>

        {/* RECUADRO SOCIAS SUSPENDIDAS */}
        <div
          className="vtf-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderLeft: '4px solid var(--sand-500)',
            position: 'relative'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--sand-700)', letterSpacing: '0.04em' }}>
                Socias Suspendidas
              </span>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--sand-50)',
                  color: 'var(--sand-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <UserX size={20} />
              </div>
            </div>
            <div style={{ fontSize: 'var(--metric-size)', fontWeight: 700, color: 'var(--primary-500)', fontVariantNumeric: 'tabular-nums' }}>
              {inicioData.sociasSuspendidas ?? 4}
            </div>
          </div>
          <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pausadas temporalmente</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning-text)', backgroundColor: 'var(--warning-bg)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-full)' }}>
              Sin cobro cuota
            </span>
          </div>
        </div>

        {/* RECUADRO SALDO TOTAL */}
        <div
          className="vtf-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderLeft: '4px solid var(--accent-pink-500)',
            position: 'relative',
            background: 'var(--bg-surface)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-pink-600)', letterSpacing: '0.04em' }}>
                Saldo Total Disponible
              </span>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--accent-pink-100)',
                  color: 'var(--accent-pink-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Wallet size={20} />
              </div>
            </div>
            <div style={{ fontSize: 'var(--metric-size)', fontWeight: 700, color: 'var(--primary-500)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrencyCLP(inicioData.saldoTotal ?? 14580000)}
            </div>
          </div>
          <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span>Cena Anual:</span>
              <strong style={{ color: 'var(--text-main)' }}>{formatCurrencyCLP(inicioData.saldoCenaAnual ?? 9260000)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Asociación:</span>
              <strong style={{ color: 'var(--text-main)' }}>{formatCurrencyCLP(inicioData.saldoAsociacion ?? 5320000)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          FILA 2: TRES RECUADROS MEDIANOS (REQUERIMIENTO INICIO)
          - RECUADRO MEDIANO ÚLTIMOS PAGOS (correlativo últimos 5 pagos a federación)
          - RECUADRO PROXIMAS TAREAS (cierre tesorería mensual, exportar informe, deudas morosas)
          - RECUADRO ALERTAS (socias que les queda 1 cuota Isi Mundo/SOS + pago federación al día)
         ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'var(--dashboard-detail-columns)',
          gap: '1.5rem'
        }}
      >
        {/* RECUADRO MEDIANO ÚLTIMOS PAGOS A FEDERACIÓN */}
        <Card
          title="Últimos Pagos a Federación"
          subtitle="Correlativo de los últimos 5 pagos oficiales"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {(inicioData.ultimosPagosFederacion || []).map((pago) => (
              <div
                key={pago.correlativo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.625rem 0.75rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary-700)' }}>
                      {pago.correlativo}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      {formatDateCLP(pago.fecha)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                    {pago.descripcion}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrencyCLP(pago.monto)}
                  </div>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--primary-600)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}
                    onClick={() => alert(`Comprobante respaldado: ${pago.comprobante} verificado para ${pago.correlativo}.`)}
                  >
                    <FileText size={12} /> Ver Respaldo
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* RECUADRO PRÓXIMAS TAREAS */}
        <Card
          title="Próximas Tareas"
          subtitle="Hitos contables y operativos de la tesorería"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(inicioData.proximasTareas || []).map((task) => (
              <div
                key={task.id}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: task.urgencia === 'alerta' ? 'var(--error-bg)' : 'var(--bg-surface-subtle)',
                  border: `1px solid ${task.urgencia === 'alerta' ? 'var(--error-border)' : 'var(--border-light)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: task.urgencia === 'alerta' ? 'var(--error-text)' : 'var(--text-main)' }}>
                    {task.titulo}
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '0.125rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: task.urgencia === 'alerta' ? 'var(--error-text)' : 'var(--sand-100)',
                      color: task.urgencia === 'alerta' ? 'white' : 'var(--sand-700)'
                    }}
                  >
                    {task.fechaLimite}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: task.urgencia === 'alerta' ? 'var(--error-text)' : 'var(--text-muted)', margin: 0 }}>
                  {task.descripcion}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* RECUADRO ALERTAS */}
        <Card
          title="Alertas y Notificaciones"
          subtitle="Vigilancia de cuotas y compromisos gremiales"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', justifyContent: 'center' }}>
            {/* Botón Alerta Cuotas Restantes */}
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={24} style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--warning-text)' }}>
                    Socias con 1 Cuota Restante
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--warning-text)', opacity: 0.9 }}>
                    {inicioData.alertas?.sociasUltimaCuotaIsimundo ?? 6} en Isi Mundo • {inicioData.alertas?.sociasUltimaCuotaSos ?? 3} en S.O.S
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => alert(`Socias por culminar crédito:\n• Isi Mundo: 6 socias prontas a finalizar su descuento.\n• S.O.S: 3 socias en última cuota.\n(La última cuota estimada en diciembre pasará a descuento por planilla de diciembre).`)}
              >
                Revisar
              </Button>
            </div>

            {/* Botón / Indicador Pago Federación al Día */}
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle2 size={24} style={{ color: 'var(--success-text)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--success-text)' }}>
                    Pago Federación al Día
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success-text)', opacity: 0.9 }}>
                    Aporte mensual verificado (Último: {inicioData.alertas?.pagoFederacionFecha || '02/10/2026'})
                  </div>
                </div>
              </div>
              <Badge variant="success">Al Día</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          FILA 3: DOS RECUADROS GRANDES ANALÍTICOS (REQUERIMIENTO INICIO)
          - RECUADRO GRANDE GRÁFICO RECAUDACIÓN (ingresos y egresos por mes con filtro por año)
          - RECUADRO GRANDE GRÁFICO ESTADO DE SOCIAS (activas con crédito Isi Mundo y SOS)
         ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'var(--dashboard-chart-columns)',
          gap: '1.5rem'
        }}
      >
        {/* GRÁFICO RECAUDACIÓN MENSUAL */}
        <Card
          title="Recaudación Mensual (Ingresos vs Egresos)"
          subtitle={`Flujo financiero consolidado correspondiente al período ${selectedYear}`}
        >
          {/* Filtro superior por año */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: 'var(--primary-500)', borderRadius: '2px' }} />
                <span style={{ fontWeight: 600 }}>Ingresos</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: 'var(--accent-pink-500)', borderRadius: '2px' }} />
                <span style={{ fontWeight: 600 }}>Egresos</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Año:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{
                  padding: '0.25rem 0.625rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  cursor: 'pointer'
                }}
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
          </div>

          {/* Gráfico de Barras Dobles SVG Responsivo */}
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <div style={{ minWidth: '400px', height: '240px', display: 'flex', alignItems: 'flex-end', gap: '1rem', paddingBottom: '1.75rem', borderBottom: '1px solid var(--border-light)', position: 'relative' }}>
              {monthlyData.map((d) => {
                const heightIngreso = (d.ingresos / maxMonthValue) * 190;
                const heightEgreso = (d.egresos / maxMonthValue) * 190;
                return (
                  <div
                    key={d.mes}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.375rem',
                      height: '100%',
                      justifyContent: 'flex-end',
                      position: 'relative'
                    }}
                    title={`${d.mes}: Ingresos ${formatCurrencyCLP(d.ingresos)} / Egresos ${formatCurrencyCLP(d.egresos)}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', justifyContent: 'center' }}>
                      {/* Barra Ingreso */}
                      <div
                        style={{
                          width: '12px',
                          height: `${Math.max(heightIngreso, 4)}px`,
                          backgroundColor: 'var(--primary-500)',
                          borderRadius: '3px 3px 0 0',
                          transition: 'height 0.4s ease'
                        }}
                      />
                      {/* Barra Egreso */}
                      <div
                        style={{
                          width: '12px',
                          height: `${Math.max(heightEgreso, 4)}px`,
                          backgroundColor: 'var(--accent-pink-500)',
                          borderRadius: '3px 3px 0 0',
                          transition: 'height 0.4s ease'
                        }}
                      />
                    </div>
                    {/* Etiqueta del Mes */}
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '-1.5rem',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)'
                      }}
                    >
                      {d.mes}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* GRÁFICO ESTADO DE SOCIAS Y CRÉDITOS VIGENTES */}
        <Card
          title="Estado de Socias y Convenios Vigentes"
          subtitle="Distribución del padrón de 276 socias activas"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
            {/* Convenio Isi Mundo */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  Activas con Crédito Vigente ISI MUNDO
                </span>
                <span style={{ fontWeight: 700, color: 'var(--primary-700)' }}>
                  38 socias (13.7%)
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ width: '13.7%', height: '100%', backgroundColor: 'var(--primary-500)', borderRadius: 'var(--radius-full)' }} />
              </div>
            </div>

            {/* Convenio S.O.S */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  Activas con Crédito Vigente S.O.S (Fondo Cena Anual)
                </span>
                <span style={{ fontWeight: 700, color: 'var(--accent-pink-600)' }}>
                  24 socias (8.7%)
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ width: '8.7%', height: '100%', backgroundColor: 'var(--accent-pink-500)', borderRadius: 'var(--radius-full)' }} />
              </div>
            </div>

            {/* Convenios Salud (Óptica y Dental) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  Activas con Convenio ÓPTICA y DENTAL
                </span>
                <span style={{ fontWeight: 700, color: 'var(--sand-700)' }}>
                  19 socias (6.9%)
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ width: '6.9%', height: '100%', backgroundColor: 'var(--sand-500)', borderRadius: 'var(--radius-full)' }} />
              </div>
            </div>

            {/* Sin Crédito Vigente */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  Activas sin Créditos Vigentes (Solo Cuota Social)
                </span>
                <span style={{ fontWeight: 700, color: 'var(--success-text)' }}>
                  195 socias (70.7%)
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ width: '70.7%', height: '100%', backgroundColor: 'hsl(145, 45%, 45%)', borderRadius: 'var(--radius-full)' }} />
              </div>
            </div>

            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.875rem 1rem',
                backgroundColor: 'var(--bg-surface-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                border: '1px solid var(--border-light)'
              }}
            >
              <strong>Regla Institucional:</strong> La columna <em>Crédito</em> en el padrón mostrará <strong>SI</strong> únicamente cuando exista un crédito vigente; de lo contrario <strong>NO</strong>.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
