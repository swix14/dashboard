import React from 'react';
import { Badge } from '../common/Badge.jsx';

/**
 * Recuadro de resumen de Tesorería (ingresos, egresos, saldos...).
 * Los colores de cada recuadro llegan como variables CSS (ver .tes-kpi en index.css).
 * @param {string} label - título en mayúsculas
 * @param {React.ReactNode} value - cifra principal
 * @param {string} hint - texto bajo la cifra
 * @param {boolean} [hintDestacado] - el texto bajo la cifra va en negrita y color de marca
 * @param {{ borde: string, texto: string, fondo?: string }} colores - variables CSS del recuadro
 * @param {React.ComponentType} [icon] - ícono a la derecha del título (si no, la etiqueta "C. Costo")
 */
export function KpiCard({ label, value, hint, hintDestacado = false, colores, icon: Icon }) {
  const vars = {
    '--kpi-borde': colores.borde,
    '--kpi-texto': colores.texto,
    '--kpi-fondo': colores.fondo || 'transparent'
  };

  return (
    <div className="vtf-card tes-kpi" style={vars}>
      <div className="tes-kpi-head">
        <span className="tes-kpi-label">{label}</span>
        {Icon ? (
          <div className="tes-kpi-icon" aria-hidden="true">
            <Icon size={18} />
          </div>
        ) : (
          <Badge variant="neutral">C. Costo</Badge>
        )}
      </div>
      <div className="tes-kpi-valor">{value}</div>
      <div className={hintDestacado ? 'tes-kpi-nota tes-kpi-nota-destacada' : 'tes-kpi-nota'}>{hint}</div>
    </div>
  );
}
