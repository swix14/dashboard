import React, { useEffect, useState } from 'react';
import { Check, HandCoins, Percent, Pencil, X } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { CreditoApiService } from '../../services/creditoService.js';
import { formatCurrencyCLP } from '../../utils/formatters.js';
import { hoyInput } from './creditoLabels.js';

const pctTexto = (pct) => `${Number(pct).toLocaleString('es-CL', { maximumFractionDigits: 2 })} %`;

/**
 * % de comisión de Isi Mundo con edición en línea (Admin y Tesorera).
 * El cambio rige para los pagos que se verifiquen desde ahora; los meses ya verificados no cambian.
 */
export function ComisionPctEditor({ puedeGestionar, onChanged }) {
  const [config, setConfig] = useState(null);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    CreditoApiService.getComision().then(setConfig).catch(() => setConfig(null));
  }, []);

  if (!config) return null;

  const guardar = async (e) => {
    e.preventDefault();
    const pct = Number(String(valor).replace(',', '.'));
    if (!Number.isFinite(pct) || pct < 0 || pct > 20) return setError('Entre 0 y 20 %.');
    try {
      setGuardando(true);
      setError(null);
      const res = await CreditoApiService.setComision(pct);
      setConfig(res.data);
      setEditando(false);
      onChanged?.(res.message);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  if (editando) {
    return (
      <form className="cred-comision-editor" onSubmit={guardar}>
        <label className="vtf-label" htmlFor="comision-pct">Comisión Isi Mundo</label>
        <div className="cred-comision-input">
          <input
            id="comision-pct"
            className="vtf-input"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
            aria-describedby="comision-pct-ayuda"
          />
          <span aria-hidden="true">%</span>
          <button type="submit" className="tes-accion" aria-label="Guardar porcentaje" disabled={guardando}><Check size={15} /></button>
          <button type="button" className="tes-accion" aria-label="Cancelar" onClick={() => { setEditando(false); setError(null); }}><X size={15} /></button>
        </div>
        <span id="comision-pct-ayuda" className={error ? 'cred-accion-error' : 'cred-hint'}>
          {error || 'Rige para los pagos que se verifiquen desde ahora.'}
        </span>
      </form>
    );
  }

  return (
    <div className="cred-comision-chip" title={config.actualizadoPor ? `Último ajuste: ${config.actualizadoPor}` : undefined}>
      <Percent size={14} aria-hidden="true" />
      <span>Comisión Isi Mundo <strong>{pctTexto(config.pct)}</strong></span>
      {puedeGestionar && (
        <button
          type="button"
          className="cred-comision-edit"
          aria-label="Ajustar porcentaje de comisión de Isi Mundo"
          onClick={() => { setValor(String(config.pct).replace('.', ',')); setEditando(true); }}
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}

/**
 * Comisión de un mes verificado de ISIMUNDO: monto calculado y registro como ingreso en Tesorería.
 * El monto se puede ajustar a lo que realmente transfirió la empresa.
 */
export function ComisionPago({ comision, puedeGestionar, onRegistered }) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(String(comision.monto));
  const [fecha, setFecha] = useState(hoyInput());
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const registrar = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      setError(null);
      const res = await CreditoApiService.registrarComision(comision.pagoId, Number(monto), fecha);
      setAbierto(false);
      onRegistered?.(res.message);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible registrar la comisión.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="cred-comision-pago">
      <span className="cred-muted">
        Comisión {pctTexto(comision.pct)}: <strong>{formatCurrencyCLP(comision.monto)}</strong>
      </span>
      {comision.registrada ? (
        <Badge variant="success">En Tesorería · {comision.correlativo}</Badge>
      ) : puedeGestionar && !abierto ? (
        <Button variant="outline" size="sm" icon={HandCoins} onClick={() => setAbierto(true)}>Registrar en Tesorería</Button>
      ) : !puedeGestionar ? (
        <Badge variant="neutral">Sin registrar</Badge>
      ) : null}

      {abierto && (
        <form className="cred-accion-panel cred-comision-form" onSubmit={registrar}>
          <p className="cred-accion-texto">
            Se registra como <strong>ingreso</strong> en el centro de costo Isi Mundo Comisión. Ajuste el monto si la empresa transfirió otro valor.
          </p>
          {error && <p className="cred-accion-error" role="alert">{error}</p>}
          <div className="cred-accion-fila">
            <div className="cred-campo">
              <label className="vtf-label" htmlFor={`comision-monto-${comision.pagoId}`}>Monto recibido</label>
              <input id={`comision-monto-${comision.pagoId}`} className="vtf-input" type="number" min="1" step="1" required value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div className="cred-campo">
              <label className="vtf-label" htmlFor={`comision-fecha-${comision.pagoId}`}>Fecha</label>
              <input id={`comision-fecha-${comision.pagoId}`} className="vtf-input" type="date" max={hoyInput()} required value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="cred-accion-botones">
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" icon={HandCoins} isLoading={guardando}>Registrar ingreso</Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
