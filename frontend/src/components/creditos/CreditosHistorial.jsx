import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Card } from '../common/Card.jsx';
import { Badge } from '../common/Badge.jsx';
import { Button } from '../common/Button.jsx';
import { CreditoApiService } from '../../services/creditoService.js';
import { formatCurrencyCLP } from '../../utils/formatters.js';
import { EMPRESAS, ESTADO_CREDITO } from './creditoLabels.js';

const LIMIT = 15;

/**
 * Historial de créditos: una fila por crédito (una socia con SOS e ISIMUNDO aparece dos veces).
 * Los pagados se muestran solo hasta un mes después de pagarse.
 */
export function CreditosHistorial({ onOpen, refreshKey }) {
  const [search, setSearch] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [convenio, setConvenio] = useState('TODOS');
  const [estado, setEstado] = useState('TODOS');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // La búsqueda se aplica al dejar de escribir
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    CreditoApiService.getCreditos({ search: busqueda || undefined, convenio, estado, page, limit: LIMIT })
      .then((r) => !cancelado && setData(r))
      .catch((err) => !cancelado && setError(err.response?.data?.message || 'No fue posible cargar los créditos.'))
      .finally(() => !cancelado && setLoading(false));
    return () => {
      cancelado = true;
    };
  }, [busqueda, convenio, estado, page, refreshKey]);

  const totalPages = Math.max(Math.ceil(data.total / LIMIT), 1);

  return (
    <Card title="Historial de créditos" subtitle="Haga clic en un crédito para ver su detalle y calendario de cuotas.">
      <div className="cred-filters">
        <div className="cred-search">
          <label className="vtf-label" htmlFor="cred-buscar">Buscar</label>
          <div className="cred-search-box">
            <Search size={16} aria-hidden="true" />
            <input
              id="cred-buscar"
              className="vtf-input"
              placeholder="Nombre o RUT"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="vtf-label" htmlFor="cred-empresa">Empresa</label>
          <select id="cred-empresa" className="vtf-input" value={convenio} onChange={(e) => { setConvenio(e.target.value); setPage(1); }}>
            <option value="TODOS">Todas</option>
            {EMPRESAS.map((e) => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="vtf-label" htmlFor="cred-estado">Estado</label>
          <select id="cred-estado" className="vtf-input" value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
            <option value="TODOS">Todos</option>
            {Object.entries(ESTADO_CREDITO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="com-alert com-alert-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="vtf-table-container" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }} aria-busy={loading}>
        <table className="vtf-table cred-hist-table">
          <thead>
            <tr>
              <th>Socia</th>
              <th>Empresa</th>
              <th>Estado</th>
              <th className="num">Cuota</th>
              <th className="num">Cuotas</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && !loading ? (
              <tr><td colSpan={5} className="cred-empty">No hay créditos con estos filtros.</td></tr>
            ) : (
              data.items.map((c) => {
                const e = ESTADO_CREDITO[c.estado];
                return (
                  <tr key={c.id} className="cred-row" tabIndex={0} onClick={() => onOpen(c.id)} onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onOpen(c.id))}>
                    <td>
                      <div className="cred-row-name">{c.socia}</div>
                      <div className="cred-muted">{c.rut}</div>
                    </td>
                    <td>{c.empresaNombre}</td>
                    <td><Badge variant={e.variant}>{e.label}</Badge></td>
                    <td className="num">{formatCurrencyCLP(c.montoCuota)}</td>
                    <td className="num">
                      <span className="cred-progress" aria-label={`${c.cuotasPagadas} de ${c.totalCuotas} cuotas pagadas`}>
                        <span style={{ width: `${Math.min((c.cuotasPagadas / c.totalCuotas) * 100, 100)}%` }} />
                      </span>
                      {c.cuotasPagadas}/{c.totalCuotas}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="cred-pagination">
        <span className="cred-muted">{data.total.toLocaleString('es-CL')} créditos</span>
        <div>
          <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="cred-muted">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" icon={ChevronRight} disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      </div>
    </Card>
  );
}

export default CreditosHistorial;
