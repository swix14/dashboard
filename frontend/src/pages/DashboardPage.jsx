import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
  // El backend decide qué secciones financieras ve cada rol
  const verFinanzas = data.secciones?.finanzas === true;
  // Años con movimientos reales; si el elegido no existe se muestra el más reciente
  const recaudacion = inicioData.graficos?.recaudacionMensual || {};
  const aniosDisponibles = Object.keys(recaudacion).sort().reverse();
  const anioVisible = recaudacion[selectedYear] ? selectedYear : aniosDisponibles[0] || selectedYear;
  const monthlyData = recaudacion[anioVisible] || [];
  const maxMonthValue = Math.max(...monthlyData.map((d) => Math.max(d.ingresos, d.egresos)), 1);

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
                Directiva
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
          gridTemplateColumns: verFinanzas
            ? 'var(--dashboard-kpi-columns)'
            : 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
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
              {inicioData.sociasActivas ?? '—'}
            </div>
          </div>
          <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>De un padrón de {data.totalSocias ?? '—'}</span>
            {data.totalSocias > 0 && (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success-text)', backgroundColor: 'var(--success-bg)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-full)' }}>
                {(((inicioData.sociasActivas || 0) / data.totalSocias) * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 })}% activas
              </span>
            )}
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
              {inicioData.sociasSuspendidas ?? '—'}
            </div>
          </div>
          <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pausadas temporalmente</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--warning-text)', backgroundColor: 'var(--warning-bg)', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-full)' }}>
              Sin cobro cuota
            </span>
          </div>
        </div>

        {/* RECUADRO SALDO TOTAL: solo roles con acceso a Tesorería */}
        {verFinanzas && (
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
              {formatCurrencyCLP(inicioData.saldoTotal ?? 0)}
            </div>
          </div>
          <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
              <span>Cena Anual:</span>
              <strong style={{ color: 'var(--text-main)' }}>{formatCurrencyCLP(inicioData.saldoCenaAnual ?? 0)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Asociación:</span>
              <strong style={{ color: 'var(--text-main)' }}>{formatCurrencyCLP(inicioData.saldoAsociacion ?? 0)}</strong>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Fila 2 solo para roles con acceso a Tesorería (la Secretaria y la Directora no la ven) */}
      {verFinanzas && (
      <>
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
            {(inicioData.ultimosPagosFederacion || []).length === 0 && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                Aún no hay pagos a Federación registrados en Tesorería.
              </p>
            )}
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
                      color: task.urgencia === 'alerta' ? 'var(--text-inverse)' : 'var(--sand-700)'
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

        {/* RECUADRO ALERTAS (estilos en .dash-alerta*: el contenido fluye desde arriba y se
            acomoda en pantallas angostas, sin salirse del recuadro) */}
        <Card
          title="Alertas y Notificaciones"
          subtitle="Vigilancia de cuotas y compromisos gremiales"
        >
          <div className="dash-alertas">
            {/* Alerta de cuotas restantes (cifras reales de Créditos) */}
            <div className="dash-alerta dash-alerta-warning">
              <div className="dash-alerta-info">
                <AlertTriangle size={24} aria-hidden="true" className="dash-alerta-icono" />
                <div>
                  <div className="dash-alerta-titulo">Socias con 1 Cuota Restante</div>
                  <div className="dash-alerta-detalle">
                    {inicioData.alertas?.sociasUltimaCuotaIsimundo ?? 0} en Isi Mundo • {inicioData.alertas?.sociasUltimaCuotaSos ?? 0} en S.O.S
                  </div>
                </div>
              </div>
              <div className="dash-alerta-accion">
                <Button variant="outline" size="sm" onClick={() => navigate('/creditos?estado=ULTIMA_CUOTA')}>
                  Revisar
                </Button>
              </div>
            </div>

            {/* Pago a Federación: calculado con el último pago real */}
            {(() => {
              const alDia = Boolean(inicioData.alertas?.pagoFederacionAlDia);
              const fecha = inicioData.alertas?.pagoFederacionFecha;
              const tono = alDia ? 'success' : 'warning';
              const Icono = alDia ? CheckCircle2 : AlertTriangle;
              return (
                <div className={`dash-alerta dash-alerta-${tono}`}>
                  <div className="dash-alerta-info">
                    <Icono size={24} aria-hidden="true" className="dash-alerta-icono" />
                    <div>
                      <div className="dash-alerta-titulo">{alDia ? 'Pago Federación al Día' : 'Pago Federación pendiente'}</div>
                      <div className="dash-alerta-detalle">
                        {fecha ? `Último pago registrado: ${formatDateCLP(fecha)}` : 'Sin pagos a Federación registrados'}
                      </div>
                    </div>
                  </div>
                  <div className="dash-alerta-accion">
                    <Badge variant={tono}>{alDia ? 'Al Día' : 'Revisar'}</Badge>
                  </div>
                </div>
              );
            })()}
          </div>
        </Card>
      </div>
      </>
      )}

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
        {verFinanzas && (
        <>
        {/* GRÁFICO RECAUDACIÓN MENSUAL */}
        <Card
          title="Recaudación Mensual (Ingresos vs Egresos)"
          subtitle={`Flujo financiero consolidado correspondiente al período ${anioVisible}`}
        >
          {/* Leyenda y filtro por año: en pantallas angostas el filtro baja de línea en vez de chocar con la leyenda */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem 1rem', marginBottom: '1.25rem' }}>
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
                value={anioVisible}
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
                {(aniosDisponibles.length ? aniosDisponibles : [anioVisible]).map((anio) => (
                  <option key={anio} value={anio}>
                    {anio}
                  </option>
                ))}
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
        </>
        )}

        {/* GRÁFICO ESTADO DE SOCIAS Y CRÉDITOS VIGENTES */}
        <Card
          title="Estado de Socias y Convenios Vigentes"
          subtitle={`Distribución del padrón de ${inicioData.sociasActivas ?? '—'} socias activas`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
            {/* Barras calculadas con los datos reales (antes eran números fijos: 38, 24, 19 y 195) */}
            {(() => {
              const stats = inicioData.graficos?.estadoSociasCreditos || {};
              const base = stats.totalActivas || 0;
              const pct = (n) => (base > 0 ? Math.round(((n || 0) / base) * 1000) / 10 : 0);
              const filas = [
                { key: 'isi', label: 'Activas con Crédito Vigente ISI MUNDO', n: stats.activasConIsimundo, color: 'var(--primary-500)', text: 'var(--primary-700)' },
                { key: 'sos', label: 'Activas con Crédito Vigente S.O.S (Fondo Cena Anual)', n: stats.activasConSos, color: 'var(--accent-pink-500)', text: 'var(--accent-pink-600)' },
                { key: 'otros', label: 'Activas con Convenio ÓPTICA, DENTAL o ABOGADA', n: stats.activasConDentalOptica, color: 'var(--sand-500)', text: 'var(--sand-700)' },
                { key: 'sin', label: 'Activas sin Créditos Vigentes (Solo Cuota Social)', n: stats.activasSinCredito, color: 'hsl(145, 45%, 45%)', text: 'var(--success-text)' }
              ];
              return filas.map((f) => (
                <div key={f.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{f.label}</span>
                    <span style={{ fontWeight: 700, color: f.text, whiteSpace: 'nowrap' }}>
                      {f.n ?? 0} socias ({pct(f.n).toLocaleString('es-CL')}%)
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct(f.n)}%`, height: '100%', backgroundColor: f.color, borderRadius: 'var(--radius-full)' }} />
                  </div>
                </div>
              ));
            })()}

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
