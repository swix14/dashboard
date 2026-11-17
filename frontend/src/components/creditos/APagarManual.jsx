import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { CreditoApiService } from '../../services/creditoService.js';
import { formatCurrencyCLP } from '../../utils/formatters.js';
import { mesTexto } from './creditoLabels.js';

/**
 * Panel para fijar a mano el monto A PAGAR de una empresa en un mes: cuando no llegó la
 * planilla o hay que corregir la que llegó. Sugiere la suma de las cuotas pendientes del mes.
 */
export function APagarManual({ fila, mes, anio, onSaved, onCancel }) {
  const sugerido = fila.cargado ? fila.aPagar : fila.montoCuotasPendientes;
  const [monto, setMonto] = useState(sugerido ? String(sugerido) : '');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const id = `a-pagar-${fila.codigo}`;

  const guardar = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      setError(null);
      const res = await CreditoApiService.definirAPagar({ mes, anio, empresa: fila.codigo, monto: Number(monto) });
      onSaved?.(res.message);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible guardar el monto.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="cred-accion-panel cred-comision-form" onSubmit={guardar}>
      <p className="cred-accion-texto">
        {fila.origenAPagar === 'PLANILLA' && <>Corrige el monto que trajo la planilla de {mesTexto(mes, anio)}.</>}
        {fila.origenAPagar === 'MANUAL' && <>Corrige el monto ingresado a mano para {mesTexto(mes, anio)}.</>}
        {!fila.cargado && <>No hay planilla de {mesTexto(mes, anio)}: ingrese el monto que se transfirió a {fila.nombre}.</>}{' '}
        {fila.cuotasPendientes > 0 && (
          <>Las {fila.cuotasPendientes} cuotas pendientes del mes suman <strong>{formatCurrencyCLP(fila.montoCuotasPendientes)}</strong>. </>
        )}
        Si después se carga la planilla del mes, su monto reemplaza a este.
      </p>
      {error && <p className="cred-accion-error" role="alert">{error}</p>}
      <div className="cred-accion-fila">
        <div className="cred-campo">
          <label className="vtf-label" htmlFor={id}>Monto a pagar</label>
          <input id={id} className="vtf-input" type="number" min="1" step="1" required autoFocus value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="cred-accion-botones">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" variant="primary" icon={Save} isLoading={guardando}>Guardar monto</Button>
        </div>
      </div>
    </form>
  );
}

export default APagarManual;
