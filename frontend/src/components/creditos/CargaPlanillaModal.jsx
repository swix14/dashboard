import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { CreditoApiService } from '../../services/creditoService.js';
import { formatCurrencyCLP } from '../../utils/formatters.js';
import { MESES, aniosDisponibles, mesTexto, periodoActual } from './creditoLabels.js';

function Stat({ label, value, tone }) {
  return (
    <div className="cred-stat">
      <div className="cred-stat-value" style={{ color: tone }}>{value}</div>
      <div className="cred-stat-label">{label}</div>
    </div>
  );
}

function Lista({ title, items, render }) {
  if (!items?.length) return null;
  return (
    <details className="cred-details">
      <summary>{title} ({items.length})</summary>
      <ul>{items.map(render)}</ul>
    </details>
  );
}

/**
 * Carga de la planilla Maestra Créditos (día 18): mes → archivo → vista previa → aplicar.
 * La vista previa no modifica nada; al aplicar se envía el mismo archivo.
 */
export function CargaPlanillaModal({ open, onClose, onApplied }) {
  const actual = periodoActual();
  const [mes, setMes] = useState(actual.mes);
  const [anio, setAnio] = useState(actual.anio);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const run = async (fn) => {
    try {
      setBusy(true);
      setError(null);
      await fn();
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible procesar la planilla.');
    } finally {
      setBusy(false);
    }
  };

  const previsualizar = () => run(async () => setPreview(await CreditoApiService.previsualizarPlanilla(file, mes, anio)));
  const aplicar = () =>
    run(async () => {
      const res = await CreditoApiService.aplicarPlanilla(file, mes, anio);
      setResult(res);
      onApplied?.();
    });

  const r = preview?.resumen;

  return (
    <Modal
      title="Cargar planilla Maestra Créditos"
      subtitle="Se sube el día 18 de cada mes y actualiza el monto a pagar de cada empresa."
      onClose={close}
      maxWidth="720px"
    >
      <div className="cred-modal-body">
        {error && (
          <div className="com-alert com-alert-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {result ? (
          <>
            <div className="com-alert com-alert-ok" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{result.message}</span>
            </div>
            <div className="cred-actions">
              <Button variant="primary" onClick={close}>Listo</Button>
            </div>
          </>
        ) : (
          <>
            <div className="cred-form-row">
              <div>
                <label className="vtf-label" htmlFor="carga-mes">Mes de descuento</label>
                <select id="carga-mes" className="vtf-input" value={mes} disabled={Boolean(preview)} onChange={(e) => setMes(Number(e.target.value))}>
                  {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="vtf-label" htmlFor="carga-anio">Año</label>
                <select id="carga-anio" className="vtf-input" value={anio} disabled={Boolean(preview)} onChange={(e) => setAnio(Number(e.target.value))}>
                  {aniosDisponibles().map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <label className="cred-file">
                <FileSpreadsheet size={18} aria-hidden="true" />
                <span>{file ? file.name : 'Elegir planilla .xlsx'}</span>
                <input
                  type="file"
                  accept=".xlsx"
                  disabled={Boolean(preview)}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setPreview(null);
                  }}
                />
              </label>
            </div>

            {preview && (
              <div className="cred-preview">
                <div className="cred-stats">
                  <Stat label="Créditos nuevos" value={r.nuevos} tone="var(--success-text)" />
                  <Stat label="Actualizados" value={r.actualizados} tone="var(--primary-700)" />
                  <Stat label="Sin cambios" value={r.sinCambios} />
                  <Stat label="No incluidos" value={r.noIncluidos} tone="var(--warning-text)" />
                  <Stat label="Con error" value={r.errores} tone="var(--error-text)" />
                </div>

                <div className="vtf-table-container">
                  <table className="vtf-table cred-table-compact">
                    <thead>
                      <tr><th>Empresa</th><th className="num">Créditos</th><th className="num">A pagar · {mesTexto(mes, anio)}</th></tr>
                    </thead>
                    <tbody>
                      {preview.empresas.map((e) => (
                        <tr key={e.codigo}>
                          <td>{e.nombre}{e.yaVerificado && <span className="cred-muted"> (ya verificado)</span>}</td>
                          <td className="num">{e.creditos}</td>
                          <td className="num">{formatCurrencyCLP(e.aPagar)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {preview.advertencias.length > 0 && (
                  <div className="cred-warnings">
                    {preview.advertencias.map((a) => (
                      <p key={a}><AlertTriangle size={14} aria-hidden="true" /> {a}</p>
                    ))}
                  </div>
                )}

                <Lista title="Filas con error (no se cargan)" items={preview.errores} render={(e) => (
                  <li key={`${e.empresa}-${e.fila}`}>{e.empresa}, fila {e.fila}: {e.rut} {e.nombre} — <strong>{e.motivo}</strong></li>
                )} />
                <Lista title="Créditos vigentes que la planilla no trae (revisar a mano)" items={preview.noIncluidos} render={(e) => (
                  <li key={e.creditoId}>{e.empresa}: {e.rut} (crédito {e.clave})</li>
                )} />
                <Lista title="Créditos nuevos" items={preview.nuevos} render={(e) => (
                  <li key={`${e.empresa}-${e.fila}`}>{e.empresa}: {e.nombre} · {e.cuotas} cuotas de {formatCurrencyCLP(e.montoCuota)}</li>
                )} />
                <Lista title="Créditos actualizados" items={preview.actualizados} render={(e) => (
                  <li key={`${e.empresa}-${e.fila}`}>{e.empresa}: {e.nombre} — {e.cambios.join(', ')}</li>
                )} />
              </div>
            )}

            <div className="cred-actions">
              {preview ? (
                <>
                  <Button variant="ghost" onClick={reset} disabled={busy}>Elegir otro archivo</Button>
                  <Button variant="primary" icon={Upload} onClick={aplicar} isLoading={busy}>Aplicar planilla</Button>
                </>
              ) : (
                <Button variant="primary" icon={FileSpreadsheet} onClick={previsualizar} isLoading={busy} disabled={!file}>
                  Ver vista previa
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default CargaPlanillaModal;
