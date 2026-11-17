import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Card } from '../common/Card.jsx';
import { ReporteApiService } from '../../services/reporteService.js';
import { formatCurrencyCLP } from '../../utils/formatters.js';

// Un cero se muestra atenuado para que resalten los jardines con movimiento
const num = (v) => <span className={v ? undefined : 'cj-cero'}>{v}</span>;

/**
 * Cifras por jardín (directiva): los jardines activos con totales de socias, créditos,
 * S.O.S y aporte mensual. Cada delegada ve solo la fila de su jardín en el portal.
 */
export function CifrasJardinesCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    ReporteApiService.cifrasJardines()
      .then((d) => !cancelado && setData(d))
      .catch((err) => !cancelado && setError(err.response?.data?.message || 'No fue posible cargar las cifras por jardín.'));
    return () => {
      cancelado = true;
    };
  }, []);

  const t = data?.totales;
  return (
    <Card
      title="Cifras por jardín"
      subtitle={data ? `Lo mismo que ve cada delegada en "Mi jardín" del portal · movimiento del año ${data.anio}` : 'Cargando…'}
    >
      {error && (
        <div className="com-alert com-alert-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {data && (
        <>
          <div className="cj-resumen">
            <span className="cj-chip">{data.jardines.length} jardines</span>
            <span className="cj-chip">{t.activas} socias activas</span>
            <span className="cj-chip">Aporte {formatCurrencyCLP(t.aporteMensual)} / mes</span>
            <span className={`cj-chip${t.sinDelegada ? ' is-alerta' : ''}`}>
              {t.sinDelegada ? `${t.sinDelegada} sin delegada marcada` : 'Todos con delegada'}
            </span>
          </div>
          <div className="cj-tabla-wrap" tabIndex={0} role="region" aria-label="Tabla de cifras por jardín">
            <table className="cj-tabla">
              <thead>
                <tr>
                  <th scope="col">Jardín</th>
                  <th scope="col">Activas</th>
                  <th scope="col">Susp.</th>
                  <th scope="col">Ingresos {data.anio}</th>
                  <th scope="col">Retiros {data.anio}</th>
                  <th scope="col">Traslados</th>
                  <th scope="col">Con crédito</th>
                  <th scope="col">S.O.S {data.anio}</th>
                  <th scope="col">Aporte mensual</th>
                </tr>
              </thead>
              <tbody>
                {data.jardines.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <span className="cj-jardin">
                        <strong>{j.codigo} · {j.nombre}</strong>
                        {!j.tieneDelegada && <span className="cj-sin-delegada">Sin delegada marcada</span>}
                      </span>
                    </td>
                    <td>{num(j.socias.activas)}</td>
                    <td>{num(j.socias.suspendidas)}</td>
                    <td>{num(j.socias.ingresosAnio)}</td>
                    <td>{num(j.socias.retirosAnio)}</td>
                    <td>
                      <span className={j.socias.trasladosEntrada + j.socias.trasladosSalida ? undefined : 'cj-cero'}>
                        +{j.socias.trasladosEntrada} / −{j.socias.trasladosSalida}
                      </span>
                    </td>
                    <td>{num(j.creditos.sociasConCredito)}</td>
                    <td>{num(j.sos.pendientes + j.sos.aprobadas + j.sos.rechazadas)}</td>
                    <td>{formatCurrencyCLP(j.aporteMensual)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{t.activas}</td>
                  <td>{t.suspendidas}</td>
                  <td>{t.ingresosAnio}</td>
                  <td>{t.retirosAnio}</td>
                  <td>—</td>
                  <td>{t.sociasConCredito}</td>
                  <td>{t.sosAnio}</td>
                  <td>{formatCurrencyCLP(t.aporteMensual)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="rep-note">
            Aporte mensual = cuota social de {formatCurrencyCLP(data.cuotaSocial)} × socias activas. "Con crédito" cuenta socias con al
            menos un crédito vigente. Para que una delegada vea su jardín, márquela como delegada en el Padrón de Socias.
          </p>
        </>
      )}
    </Card>
  );
}
