import React, { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { Card } from '../common/Card.jsx';

// Dos series: los créditos vigentes se dividen en "en curso" y "en su última cuota".
// Colores validados (CVD y contraste) en claro y oscuro: tokens --cred-serie-1 y --cred-serie-2.
const SERIES = [
  { key: 'enCurso', label: 'En curso', color: 'var(--cred-serie-1)' },
  { key: 'ultimaCuota', label: 'Última cuota', color: 'var(--cred-serie-2)' }
];

/** Créditos vigentes por empresa, separando los que están en su última cuota */
export function CreditosGrafico({ empresas }) {
  const [vista, setVista] = useState('grafico');
  const [tip, setTip] = useState(null);

  const filas = empresas.map((e) => ({
    codigo: e.codigo,
    nombre: e.nombre,
    enCurso: Math.max(e.vigentes - e.ultimaCuota, 0),
    ultimaCuota: e.ultimaCuota,
    total: e.vigentes
  }));
  const max = Math.max(...filas.map((f) => f.total), 1);

  const toggle = (
    <div className="cred-view-toggle" role="group" aria-label="Vista del gráfico">
      <button type="button" aria-pressed={vista === 'grafico'} onClick={() => setVista('grafico')}>
        <BarChart3 size={15} aria-hidden="true" /> Gráfico
      </button>
      <button type="button" aria-pressed={vista === 'tabla'} onClick={() => setVista('tabla')}>
        <Table2 size={15} aria-hidden="true" /> Tabla
      </button>
    </div>
  );

  return (
    <Card title="Créditos vigentes por empresa" subtitle="Cantidad de créditos en curso y en su última cuota." action={toggle}>
      {vista === 'tabla' ? (
        <div className="vtf-table-container">
          <table className="vtf-table cred-table-compact">
            <thead>
              <tr><th>Empresa</th><th className="num">En curso</th><th className="num">Última cuota</th><th className="num">Total vigentes</th></tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.codigo}>
                  <td>{f.nombre}</td>
                  <td className="num">{f.enCurso}</td>
                  <td className="num">{f.ultimaCuota}</td>
                  <td className="num">{f.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cred-chart">
          <ul className="cred-legend" aria-label="Leyenda">
            {SERIES.map((s) => (
              <li key={s.key}><span className="cred-legend-swatch" style={{ background: s.color }} aria-hidden="true" />{s.label}</li>
            ))}
          </ul>
          <div className="cred-bars" role="img" aria-label={filas.map((f) => `${f.nombre}: ${f.enCurso} en curso y ${f.ultimaCuota} en última cuota`).join('; ')}>
            {filas.map((f) => (
              <div key={f.codigo} className="cred-bar-row">
                <span className="cred-bar-label">{f.nombre}</span>
                <div className="cred-bar-track">
                  <div className="cred-bar" style={{ width: `${(f.total / max) * 100}%` }}>
                    {SERIES.map((s) =>
                      f[s.key] > 0 ? (
                        <span
                          key={s.key}
                          className="cred-bar-seg"
                          style={{ flexGrow: f[s.key], background: s.color }}
                          onMouseEnter={(ev) => {
                            const box = ev.currentTarget.closest('.cred-chart').getBoundingClientRect();
                            const seg = ev.currentTarget.getBoundingClientRect();
                            setTip({ x: seg.left - box.left + seg.width / 2, y: seg.top - box.top, empresa: f.nombre, serie: s.label, n: f[s.key], color: s.color });
                          }}
                          onMouseLeave={() => setTip(null)}
                        />
                      ) : null
                    )}
                  </div>
                  <span className="cred-bar-value">{f.total}</span>
                </div>
              </div>
            ))}
          </div>
          {tip && (
            <div className="cred-tooltip" style={{ left: tip.x, top: tip.y }} role="status">
              <span className="cred-legend-swatch" style={{ background: tip.color }} aria-hidden="true" />
              <span>{tip.empresa} · {tip.serie}</span>
              <strong>{tip.n}</strong>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default CreditosGrafico;
