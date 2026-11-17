import React, { useState } from 'react';
import { AlertCircle, FileDown, Landmark } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { ReporteApiService } from '../../services/reporteService.js';

const CONTENIDO = ['Resumen del año', 'Fondos', 'Mes a mes', 'Por categoría'];

/**
 * Balance Anual en PDF para la asamblea: cifras consolidadas de Tesorería
 * (sin socias ni deudas individuales), por eso también lo descargan las delegadas.
 */
export function BalanceAnualCard({ anios, anioActual }) {
  const [anio, setAnio] = useState(anioActual);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState(null);

  const descargar = async () => {
    try {
      setDescargando(true);
      setError(null);
      await ReporteApiService.descargarBalanceAnual(anio);
    } catch (err) {
      setError(err.message || 'No fue posible generar el balance.');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <section className="vtf-card rep-balance" aria-labelledby="rep-balance-title">
      <div className="rep-balance-icon" aria-hidden="true">
        <Landmark size={22} />
      </div>
      <div className="rep-balance-body">
        <h2 id="rep-balance-title" className="rep-balance-title">Balance Anual</h2>
        <p className="rep-balance-text">
          Rendición de cuentas en PDF para la asamblea.
          {anio === anioActual && ' El año en curso se emite con corte al día de hoy.'}
        </p>
        <ul className="rep-balance-chips" aria-label="Contenido del balance">
          {CONTENIDO.map((c) => <li key={c}>{c}</li>)}
        </ul>
        {error && (
          <p className="rep-balance-error" role="alert">
            <AlertCircle size={15} aria-hidden="true" /> {error}
          </p>
        )}
      </div>
      <div className="rep-controls rep-balance-controls">
        <div>
          <label className="vtf-label" htmlFor="rep-balance-anio">Año</label>
          <select id="rep-balance-anio" className="vtf-input" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <Button variant="primary" icon={FileDown} onClick={descargar} isLoading={descargando}>
          Descargar PDF
        </Button>
      </div>
    </section>
  );
}
