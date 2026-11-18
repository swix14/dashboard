import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Building, Download, Eye, Layers, Wallet } from 'lucide-react';
import { api } from '../services/api.js';
import { ReporteApiService } from '../services/reporteService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { formatCurrencyCLP, formatDateCLP } from '../utils/formatters.js';
import { BalanceAnualCard } from '../components/reportes/BalanceAnualCard.jsx';
import { CifrasJardinesCard } from '../components/reportes/CifrasJardinesCard.jsx';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Mes y año actuales en hora de Chile
function periodoActual() {
  const [anio, mes] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' })
    .format(new Date())
    .split('-')
    .map(Number);
  return { anio, mes };
}

function Metric({ label, value, hint, icon: Icon, accent }) {
  return (
    <div className="vtf-card rep-metric" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="rep-metric-head">
        <span className="rep-metric-label">{label}</span>
        <span className="rep-metric-icon" style={{ color: accent }} aria-hidden="true">
          <Icon size={18} />
        </span>
      </div>
      <div className="rep-metric-value">{value}</div>
      {hint && <div className="rep-metric-hint">{hint}</div>}
    </div>
  );
}

/**
 * Reportes y Delegadas: informe mensual de cuentas (no la rendición anual).
 * Las delegadas solo pueden verlo y exportarlo.
 */
export function ReportesPage() {
  const { isDelegada } = useAuth();
  const actual = periodoActual();
  const [anio, setAnio] = useState(actual.anio);
  const [mes, setMes] = useState(actual.mes);
  const [informe, setInforme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Años desde el inicio de los registros (2026) hasta el actual
  const anios = Array.from({ length: Math.max(actual.anio - 2026 + 1, 1) }, (_, i) => actual.anio - i);
  // En el año en curso no se ofrecen meses futuros
  const mesesDisponibles = MESES.map((nombre, i) => ({ nombre, valor: i + 1 })).filter(
    (m) => anio < actual.anio || m.valor <= actual.mes
  );

  useEffect(() => {
    if (anio === actual.anio && mes > actual.mes) {
      setMes(actual.mes);
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get('/reportes/mensual', { params: { anio, mes } });
        if (!cancelado) setInforme(res.data.data);
      } catch (err) {
        if (!cancelado) setError(err.response?.data?.message || 'No fue posible cargar el informe mensual.');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [anio, mes]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportar = async () => {
    try {
      setExporting(true);
      setError(null);
      await ReporteApiService.descargarInformeMensual(anio, mes);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const valor = (n) => (loading || !informe ? '—' : formatCurrencyCLP(n));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="rep-header">
        <div style={{ minWidth: 0 }}>
          {isDelegada && (
            <div style={{ marginBottom: '0.375rem' }}>
              <Badge variant="info" icon={Eye}>Solo vista</Badge>
            </div>
          )}
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>Reportes y Delegadas</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Informe mensual de cuentas de la Asociación y Balance Anual en PDF para la asamblea.
          </p>
        </div>

        <div className="rep-controls">
          <div>
            <label className="vtf-label" htmlFor="rep-mes">Mes</label>
            <select id="rep-mes" className="vtf-input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {mesesDisponibles.map((m) => (
                <option key={m.valor} value={m.valor}>{m.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="vtf-label" htmlFor="rep-anio">Año</label>
            <select id="rep-anio" className="vtf-input" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
              {anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <Button variant="primary" icon={Download} onClick={exportar} isLoading={exporting} disabled={loading || !informe}>
            Exportar Excel
          </Button>
        </div>
      </header>

      {error && (
        <div className="com-alert com-alert-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <section aria-label={`Informe de ${MESES[mes - 1]} ${anio}`} aria-busy={loading} className="rep-grid">
        <Metric
          label="Pago a Federación"
          value={valor(informe?.pagoFederacion)}
          hint="Cuotas transferidas a la Federación en el mes"
          icon={Building}
          accent="var(--info-text)"
        />
        <Metric
          label="Total egresos"
          value={valor(informe?.totalEgresos)}
          hint={informe ? `Ingresos del mes: ${formatCurrencyCLP(informe.totalIngresos)}` : ''}
          icon={ArrowDownRight}
          accent="var(--accent-pink-500)"
        />
        <Metric
          label="Total disponible"
          value={valor(informe?.totalDisponible)}
          hint={
            informe
              ? `Asociación ${formatCurrencyCLP(informe.disponiblePorFondo.asociacion)} · Cena ${formatCurrencyCLP(informe.disponiblePorFondo.cenaAnual)}`
              : ''
          }
          icon={Wallet}
          accent="var(--success-text)"
        />
        <Metric
          label="Total de movimientos"
          value={loading || !informe ? '—' : informe.cantidadMovimientos.toLocaleString('es-CL')}
          hint={informe ? `${informe.cantidadIngresos} ingresos · ${informe.cantidadEgresos} egresos` : ''}
          icon={Layers}
          accent="var(--primary-500)"
        />
      </section>

      <Card title="Detalle del período" subtitle={informe ? `Del ${formatDateCLP(informe.periodo.desde)} al ${formatDateCLP(informe.periodo.hasta)}` : ''}>
        <dl className="rep-detail">
          <div><dt><ArrowUpRight size={15} aria-hidden="true" /> Ingresos del mes</dt><dd>{valor(informe?.totalIngresos)}</dd></div>
          <div><dt><ArrowDownRight size={15} aria-hidden="true" /> Egresos del mes</dt><dd>{valor(informe?.totalEgresos)}</dd></div>
          <div><dt><Building size={15} aria-hidden="true" /> Pago a Federación</dt><dd>{valor(informe?.pagoFederacion)}</dd></div>
          <div className="rep-detail-total"><dt><Wallet size={15} aria-hidden="true" /> Disponible al cierre</dt><dd>{valor(informe?.totalDisponible)}</dd></div>
        </dl>
        <p className="rep-note">
          El disponible es el saldo acumulado de los fondos Asociación y Cena Anual al último día del mes. Los pagos a
          Federación se registran aparte y no descuentan esos fondos.
        </p>
      </Card>

      <BalanceAnualCard anios={anios} anioActual={actual.anio} />

      {/* La cuenta DELEGADA de la consola no ve los demás jardines (decisión D2) */}
      {!isDelegada && <CifrasJardinesCard />}
    </div>
  );
}
