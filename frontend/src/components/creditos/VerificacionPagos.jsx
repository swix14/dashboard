import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Paperclip, ShieldCheck } from 'lucide-react';
import { Card } from '../common/Card.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { CreditoApiService } from '../../services/creditoService.js';
import { formatCurrencyCLP, formatFileSize } from '../../utils/formatters.js';
import { MESES, aniosDisponibles, mesTexto, periodoActual } from './creditoLabels.js';

// Por defecto se verifica el mes anterior: el pago se hace entre el 1 y el 5 del mes siguiente
function mesAnterior() {
  const { mes, anio } = periodoActual();
  return mes === 1 ? { mes: 12, anio: anio - 1 } : { mes: mes - 1, anio };
}

/**
 * Verificación mensual de pagos (días 1 al 5): un comprobante por empresa y un botón que
 * descuenta las cuotas del mes y deja el comprobante guardado.
 */
export function VerificacionPagos({ puedeGestionar, onVerified, refreshKey }) {
  const inicial = mesAnterior();
  const [mes, setMes] = useState(inicial.mes);
  const [anio, setAnio] = useState(inicial.anio);
  const [filas, setFilas] = useState([]);
  const [archivos, setArchivos] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setFilas(await CreditoApiService.getPeriodo(mes, anio));
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible cargar el estado de los pagos.');
    } finally {
      setLoading(false);
    }
  }, [mes, anio]);

  useEffect(() => {
    setArchivos({});
    setOk(null);
    cargar();
  }, [cargar, refreshKey]);

  const adjuntos = Object.keys(archivos);

  const verificar = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await CreditoApiService.verificarPagos(mes, anio, archivos);
      setOk(res.message);
      setArchivos({});
      await cargar();
      onVerified?.();
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible verificar los pagos.');
    } finally {
      setSaving(false);
    }
  };

  const descargar = (fila) =>
    CreditoApiService.descargarComprobante(fila.pago.id, `comprobante-${fila.codigo}-${anio}-${String(mes).padStart(2, '0')}`).catch(() =>
      setError('No fue posible descargar el comprobante.')
    );

  return (
    <Card
      title="Verificación de pagos mensuales"
      subtitle="Entre el 1 y el 5 de cada mes: adjunte el comprobante de cada empresa y confirme para descontar las cuotas."
    >
      <div className="cred-verif-head">
        <div className="cred-form-row">
          <div>
            <label className="vtf-label" htmlFor="verif-mes">Mes pagado</label>
            <select id="verif-mes" className="vtf-input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="vtf-label" htmlFor="verif-anio">Año</label>
            <select id="verif-anio" className="vtf-input" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
              {aniosDisponibles().map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="com-alert com-alert-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {ok && (
        <div className="com-alert com-alert-ok" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{ok}</span>
        </div>
      )}

      <ul className="cred-verif-list" aria-busy={loading}>
        {filas.map((f) => (
          <li key={f.codigo} className={`cred-verif-item${f.verificado ? ' is-done' : ''}`}>
            <div className="cred-verif-main">
              <strong>{f.nombre}</strong>
              <span className="cred-muted">
                {!f.cargado
                  ? `Sin planilla de ${mesTexto(mes, anio)}`
                  : `A pagar ${formatCurrencyCLP(f.aPagar)} · ${f.cuotasPendientes} cuotas pendientes`}
              </span>
            </div>

            {f.verificado ? (
              <div className="cred-verif-side">
                <Badge variant="success" icon={ShieldCheck}>Verificado {formatCurrencyCLP(f.pago.montoPagado)}</Badge>
                <Button variant="ghost" size="sm" icon={Download} onClick={() => descargar(f)} aria-label={`Descargar comprobante de ${f.nombre}`}>
                  Comprobante
                </Button>
              </div>
            ) : puedeGestionar && f.cargado ? (
              <label className={`cred-file cred-file-sm${archivos[f.codigo] ? ' has-file' : ''}`}>
                <Paperclip size={16} aria-hidden="true" />
                <span>
                  {archivos[f.codigo]
                    ? `${archivos[f.codigo].name} (${formatFileSize(archivos[f.codigo].size)})`
                    : 'Adjuntar comprobante'}
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  aria-label={`Comprobante de pago de ${f.nombre}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setArchivos((prev) => {
                      const next = { ...prev };
                      if (file) next[f.codigo] = file;
                      else delete next[f.codigo];
                      return next;
                    });
                  }}
                />
              </label>
            ) : (
              <Badge variant="neutral">{f.cargado ? 'Pendiente' : 'Sin datos'}</Badge>
            )}
          </li>
        ))}
      </ul>

      {puedeGestionar && (
        <div className="cred-actions">
          <Button variant="primary" icon={ShieldCheck} onClick={verificar} isLoading={saving} disabled={adjuntos.length === 0}>
            {adjuntos.length > 1 ? `Verificar ${adjuntos.length} pagos` : 'Verificar pago'}
          </Button>
        </div>
      )}
    </Card>
  );
}

export default VerificacionPagos;
