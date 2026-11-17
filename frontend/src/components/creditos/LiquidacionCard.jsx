import React, { useEffect, useState } from 'react';
import { AlertCircle, Download } from 'lucide-react';
import { Card } from '../common/Card.jsx';
import { Button } from '../common/Button.jsx';
import { CreditoApiService } from '../../services/creditoService.js';
import { formatCurrencyCLP } from '../../utils/formatters.js';
import { MESES, aniosDisponibles, periodoActual } from './creditoLabels.js';

/**
 * Liquidación del mes para el empleador: cuánto se descuenta por planilla a las socias
 * (cuota social + cada convenio) y descarga del Excel con una fila por socia.
 */
export function LiquidacionCard({ refreshKey }) {
  const actual = periodoActual();
  const [mes, setMes] = useState(actual.mes);
  const [anio, setAnio] = useState(actual.anio);
  const [liq, setLiq] = useState(null);
  const [error, setError] = useState(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setError(null);
    CreditoApiService.getLiquidacion(mes, anio)
      .then((d) => !cancelado && setLiq(d))
      .catch((err) => !cancelado && setError(err.response?.data?.message || 'No fue posible calcular la liquidación.'));
    return () => {
      cancelado = true;
    };
  }, [mes, anio, refreshKey]);

  const descargar = async () => {
    try {
      setDescargando(true);
      setError(null);
      await CreditoApiService.descargarLiquidacion(mes, anio);
    } catch {
      setError('No fue posible descargar el Excel.');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Card
      title="Liquidación para el empleador"
      subtitle="Lo que se descuenta por planilla a cada socia en el mes: cuota social y cuota de cada convenio."
    >
      <div className="cred-liq-controles">
        <div className="cred-campo">
          <label className="vtf-label" htmlFor="liq-mes">Mes</label>
          <select id="liq-mes" className="vtf-input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="cred-campo">
          <label className="vtf-label" htmlFor="liq-anio">Año</label>
          <select id="liq-anio" className="vtf-input" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {aniosDisponibles().map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <Button variant="primary" icon={Download} isLoading={descargando} disabled={!liq || liq.totalSocias === 0} onClick={descargar}>
          Descargar Excel
        </Button>
      </div>

      {error && (
        <div className="com-alert com-alert-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {liq && (
        <div className="cred-stats cred-liq-stats" aria-live="polite">
          <div className="cred-stat cred-liq-total">
            <div className="cred-stat-label">Total a descontar · {liq.totalSocias} socias</div>
            <div className="cred-stat-value">{formatCurrencyCLP(liq.totalGeneral)}</div>
          </div>
          <div className="cred-stat">
            <div className="cred-stat-label">Cuota social · {liq.cuotaSocial.socias}</div>
            <div className="cred-stat-value">{formatCurrencyCLP(liq.cuotaSocial.total)}</div>
          </div>
          {liq.empresas.map((e) => (
            <div className="cred-stat" key={e.codigo}>
              <div className="cred-stat-label">{e.nombre} · {e.socias}</div>
              <div className="cred-stat-value">{formatCurrencyCLP(e.total)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default LiquidacionCard;
