import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  CreditCard,
  Building2,
  Search,
  PlusCircle,
  Download,
  Lock,
  AlertCircle,
  Eye,
  Pencil,
  UserMinus,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileDown,
  Loader2,
  Wallet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { SociaApiService } from '../services/sociaService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { SociaDetailModal } from '../components/socias/SociaDetailModal.jsx';
import { CreditoDetailModal } from '../components/socias/CreditoDetailModal.jsx';
import { ROLES_ACCESO } from '../utils/permissions.js';
import { SociaFormModal } from '../components/socias/SociaFormModal.jsx';
import { RetirarSociaModal } from '../components/socias/RetirarSociaModal.jsx';
import { ImportPadronModal } from '../components/socias/ImportPadronModal.jsx';
import { CARGOS, CARGO_LABELS, ESTADO_BADGE, labelStyle, nombreCompleto } from '../components/socias/sociaLabels.js';
import { formatCurrencyCLP, csvCell } from '../utils/formatters.js';

const PAGE_SIZE = 20;

function KpiCard({ label, value, hint, icon: Icon, accent }) {
  return (
    <div className="vtf-card" style={{ borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </span>
        <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-subtle)', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} />
        </div>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>{hint}</div>
    </div>
  );
}

export function SociasPage() {
  const { hasRole } = useAuth();
  const canModify = hasRole(...ROLES_ACCESO.SOCIAS_MODIFICAR);
  // Ficha de crédito solo para Admin, Presidenta y Tesorera (la Secretaria y la Directora ven solo la ficha personal)
  const verCreditos = hasRole(...ROLES_ACCESO.FICHA_CREDITO);

  const [summary, setSummary] = useState(null);
  const [jardines, setJardines] = useState([]);
  const [socias, setSocias] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('PADRON'); // PADRON | JARDINES

  // Filtros
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterJardin, setFilterJardin] = useState('TODOS');
  const [filterEstado, setFilterEstado] = useState('TODOS');
  const [filterCargo, setFilterCargo] = useState('TODOS');
  const [filterCredito, setFilterCredito] = useState('TODOS');
  const [page, setPage] = useState(1);

  // Modales
  const [detail, setDetail] = useState(null);
  // 'socia' = ficha personal | 'credito' = ficha de crédito
  const [detailMode, setDetailMode] = useState('socia');
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [editing, setEditing] = useState(null);
  const [retirando, setRetirando] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const filters = {
    search: debouncedSearch || undefined,
    jardinId: filterJardin,
    estado: filterEstado,
    cargo: filterCargo,
    credito: filterCredito
  };

  const loadOverview = useCallback(async () => {
    const [summaryRes, jardinesRes] = await Promise.all([SociaApiService.getSummary(), SociaApiService.getJardines()]);
    setSummary(summaryRes);
    setJardines(jardinesRes);
  }, []);

  const loadSocias = async (targetPage = page) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await SociaApiService.getSocias({ ...filters, page: targetPage, limit: PAGE_SIZE });
      setSocias(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar el padrón de socias');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview().catch((err) => setError(err.response?.data?.message || 'Error al cargar el resumen del padrón'));
  }, [loadOverview]);

  // Búsqueda con retardo para no consultar en cada tecla
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Un cambio de filtros vuelve a la página 1
  useEffect(() => {
    setPage(1);
    loadSocias(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterJardin, filterEstado, filterCargo, filterCredito]);

  const goToPage = (p) => {
    setPage(p);
    loadSocias(p);
  };

  const refresh = () => {
    loadOverview().catch(() => {});
    loadSocias(page);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilters =
    search || filterJardin !== 'TODOS' || filterEstado !== 'TODOS' || filterCargo !== 'TODOS' || filterCredito !== 'TODOS';

  const clearFilters = () => {
    setSearch('');
    setFilterJardin('TODOS');
    setFilterEstado('TODOS');
    setFilterCargo('TODOS');
    setFilterCredito('TODOS');
  };

  // Resumen de créditos en PDF (pedido de la directiva: el botón de crédito genera un PDF)
  const [pdfLoadingId, setPdfLoadingId] = useState(null);
  const descargarPdf = async (socia) => {
    try {
      setPdfLoadingId(socia.id);
      await SociaApiService.descargarCreditosPdf(socia.id, socia.rut);
    } catch (err) {
      setError('No fue posible generar el PDF de créditos.');
    } finally {
      setPdfLoadingId(null);
    }
  };

  const openDetail = async (sociaId, mode = 'socia') => {
    try {
      setDetailLoadingId(`${sociaId}-${mode}`);
      const ficha = await SociaApiService.getSocia(sociaId);
      setDetailMode(mode);
      setDetail(ficha);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible cargar la ficha de la socia.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  const openEdit = (socia) => {
    setEditing(socia);
    setDetail(null);
    setFormMode('edit');
  };

  const openRetirar = (socia) => {
    setDetail(null);
    setRetirando(socia);
  };

  // Exporta TODAS las socias que cumplen los filtros (no solo la página visible)
  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const { items } = await SociaApiService.getSocias({ ...filters, limit: 0 });
      if (items.length === 0) {
        setError('No hay socias para exportar con los filtros seleccionados.');
        return;
      }
      const headers = ['RUT', 'Nombres', 'Apellido Paterno', 'Apellido Materno', 'Correo', 'Celular', 'Jardin', 'Cargo', 'Estado', 'Cuota Mensual (CLP)', ...(verCreditos ? ['Credito'] : []), 'Fecha Ingreso'];
      const rows = items.map((s) => [
        s.rut,
        s.nombres,
        s.apellidoPaterno,
        s.apellidoMaterno,
        s.correo,
        s.celular,
        s.jardin?.name || '',
        CARGO_LABELS[s.cargo] || s.cargo,
        ESTADO_BADGE[s.estado]?.label || s.estado,
        s.cuotaMensual,
        ...(verCreditos ? [s.tieneCredito ? 'SI' : 'NO'] : []),
        s.fechaIngreso || ''
      ]);
      const csvContent = '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Padron_Socias_VTF_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible exportar el padrón.');
    } finally {
      setIsExporting(false);
    }
  };

  const tabStyle = (tab) => ({
    padding: '0.75rem 1.25rem',
    border: 'none',
    background: 'transparent',
    borderBottom: activeTab === tab ? '3px solid var(--primary-500)' : '3px solid transparent',
    fontWeight: 700,
    fontSize: '0.875rem',
    color: activeTab === tab ? 'var(--primary-700)' : 'var(--text-muted)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    whiteSpace: 'nowrap'
  });

  const pendientes = (summary?.sociasSinJardin || 0) + (summary?.sociasSinCargo || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera del módulo */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.5rem clamp(1rem, 4vw, 2rem)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ minWidth: 0 }}>
          {!canModify && (
            <div style={{ marginBottom: '0.375rem' }}>
              <Badge variant="warning" icon={Lock}>
                Modo Consulta: Solo Lectura
              </Badge>
            </div>
          )}
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>Socias</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Padrón de los {summary?.totalJardines ?? '—'} jardines VTF de Temuco y Labranza, con su cuota y créditos por convenio.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button variant="outline" icon={Download} onClick={handleExportCSV} isLoading={isExporting}>
            Exportar
          </Button>
          {canModify && (
            <>
              <Button variant="outline" icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>
                Cargar Excel
              </Button>
              <Button variant="primary" icon={PlusCircle} onClick={() => { setEditing(null); setFormMode('create'); }} disabled={jardines.length === 0}>
                Agregar Socia
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Recuadros KPI (según especificación de la sección Socias) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1.25rem' }}>
        <KpiCard
          label="Socias Activas"
          value={summary?.sociasActivas ?? '—'}
          hint={summary ? `Recaudación esperada ${formatCurrencyCLP(summary.recaudacionMensualEsperada)}/mes` : ''}
          icon={UserCheck}
          accent="var(--success-text)"
        />
        <KpiCard
          label="Socias Suspendidas"
          value={summary?.sociasSuspendidas ?? '—'}
          hint={summary ? `Sin cobro de cuota · ${summary.sociasRetiradas} retiradas` : ''}
          icon={UserX}
          accent="var(--accent-pink-500)"
        />
        {verCreditos && (
        <KpiCard
          label="Con Crédito Vigente"
          value={summary?.sociasConCredito ?? '—'}
          hint={summary ? `Saldo por cobrar ${formatCurrencyCLP(summary.saldoCreditosPendiente)}` : ''}
          icon={CreditCard}
          accent="var(--sand-500)"
        />
        )}
        <KpiCard
          label="Valor Cuota Mensual"
          value={summary ? formatCurrencyCLP(summary.valorCuotaMensual) : '—'}
          hint="Federación $1.000 · Asociación $1.000 · Cena $2.000"
          icon={Wallet}
          accent="var(--primary-500)"
        />
      </div>

      {canModify && pendientes > 0 && (
        <div
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--warning-text)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: '1 1 260px' }}>
            Datos por completar: {summary.sociasSinJardin} socias sin jardín y {summary.sociasSinCargo} sin cargo.
          </span>
          {summary.sociasSinJardin > 0 && (
            <Button variant="outline" size="sm" onClick={() => { clearFilters(); setFilterJardin('SIN_JARDIN'); setActiveTab('PADRON'); }}>
              Ver sin jardín
            </Button>
          )}
          {summary.sociasSinCargo > 0 && (
            <Button variant="outline" size="sm" onClick={() => { clearFilters(); setFilterCargo('SIN DATO'); setActiveTab('PADRON'); }}>
              Ver sin cargo
            </Button>
          )}
        </div>
      )}

      {/* Pestañas */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', overflowX: 'auto' }}>
        <button type="button" style={tabStyle('PADRON')} onClick={() => setActiveTab('PADRON')}>
          <Users size={16} /> Padrón de Socias
        </button>
        <button type="button" style={tabStyle('JARDINES')} onClick={() => setActiveTab('JARDINES')}>
          <Building2 size={16} /> Jardines ({jardines.length})
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '0.875rem 1rem',
            backgroundColor: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--error-text)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'PADRON' && (
        <>
          <Card title="Búsqueda y Filtros" subtitle="Busque por nombre, RUT, jardín o correo y combine filtros">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle} htmlFor="filtro-busqueda">Buscar</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    id="filtro-busqueda"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ej: González o 12.345.678"
                    className="vtf-input"
                    style={{ paddingLeft: '2.25rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle} htmlFor="filtro-jardin">Jardín</label>
                <select id="filtro-jardin" value={filterJardin} onChange={(e) => setFilterJardin(e.target.value)} className="vtf-input">
                  <option value="TODOS">Todos los jardines</option>
                  <option value="SIN_JARDIN">Sin jardín asignado</option>
                  {jardines.map((j) => (
                    <option key={j.id} value={String(j.id)}>
                      {j.code} · {j.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="filtro-estado">Estado</label>
                <select id="filtro-estado" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="vtf-input">
                  <option value="TODOS">Activas y suspendidas</option>
                  <option value="ACTIVA">Activas</option>
                  <option value="SUSPENDIDA">Suspendidas</option>
                  <option value="RETIRADA">Retiradas</option>
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="filtro-cargo">Cargo</label>
                <select id="filtro-cargo" value={filterCargo} onChange={(e) => setFilterCargo(e.target.value)} className="vtf-input">
                  <option value="TODOS">Todos</option>
                  {CARGOS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {verCreditos && (
              <div>
                <label style={labelStyle} htmlFor="filtro-credito">Crédito</label>
                <select id="filtro-credito" value={filterCredito} onChange={(e) => setFilterCredito(e.target.value)} className="vtf-input">
                  <option value="TODOS">Todos</option>
                  <option value="SI">Con crédito (SI)</option>
                  <option value="NO">Sin crédito (NO)</option>
                </select>
              </div>
              )}
            </div>

            {hasActiveFilters && (
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{total} socias coinciden con los filtros</span>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              </div>
            )}
          </Card>

          <Card title="Listado de Socias" subtitle="Cuota social de $4.000 mensuales; las suspendidas y retiradas no generan cobro">
            <div className="vtf-table-container" style={{ opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <table className="vtf-table">
                <thead>
                  <tr>
                    <th>Socia</th>
                    <th>Jardín</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Cargo</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Estado</th>
                    {verCreditos && <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Crédito</th>}
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {socias.length === 0 ? (
                    <tr>
                      <td colSpan={verCreditos ? 6 : 5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        {isLoading ? 'Cargando padrón de socias…' : 'No se encontraron socias para los filtros seleccionados.'}
                      </td>
                    </tr>
                  ) : (
                    socias.map((s) => {
                      const estado = ESTADO_BADGE[s.estado] || ESTADO_BADGE.ACTIVA;
                      return (
                        <tr key={s.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{nombreCompleto(s)}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{s.rut}</span>
                              {s.esDelegada && <Badge variant="info">Delegada</Badge>}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.8125rem' }}>
                            {s.jardin ? s.jardin.name : <span style={{ color: 'var(--warning-text)', fontWeight: 600 }}>Sin jardín</span>}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {s.cargo === 'SIN DATO' ? <span style={{ color: 'var(--text-muted)' }}>Sin dato</span> : CARGO_LABELS[s.cargo] || s.cargo}
                          </td>
                          <td>
                            <Badge variant={estado.variant}>{estado.label}</Badge>
                          </td>
                          {verCreditos && (
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {s.tieneCredito ? (
                              <button
                                type="button"
                                onClick={() => openDetail(s.id, 'credito')}
                                title="Ver créditos vigentes"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.25rem 0.625rem',
                                  borderRadius: 'var(--radius-sm)',
                                  backgroundColor: 'var(--warning-bg)',
                                  border: '1px solid var(--warning-border)',
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  color: 'var(--warning-text)',
                                  cursor: 'pointer'
                                }}
                              >
                                SI · {s.creditosActivos.map((c) => `${c.tipo} ${c.cuotasPagadas}/${c.totalCuotas}`).join(', ')}
                              </button>
                            ) : null}
                            {s.tieneCredito ? (
                              <button
                                type="button"
                                className="soc-pdf-btn"
                                onClick={() => descargarPdf(s)}
                                disabled={pdfLoadingId === s.id}
                                title="Descargar resumen de créditos en PDF"
                                aria-label={`Descargar PDF de créditos de ${nombreCompleto(s)}`}
                              >
                                {pdfLoadingId === s.id ? <Loader2 size={14} className="soc-spin" /> : <FileDown size={14} />}
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>NO</span>
                            )}
                          </td>
                          )}
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={Eye}
                                isLoading={detailLoadingId === `${s.id}-socia`}
                                onClick={() => openDetail(s.id, 'socia')}
                                aria-label={`Ver ficha de socia de ${nombreCompleto(s)}`}
                              >
                                Ficha socia
                              </Button>
                              {verCreditos && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={CreditCard}
                                  isLoading={detailLoadingId === `${s.id}-credito`}
                                  onClick={() => openDetail(s.id, 'credito')}
                                  aria-label={`Ver ficha de crédito de ${nombreCompleto(s)}`}
                                >
                                  Ficha crédito
                                </Button>
                              )}
                              {canModify && (
                                <Button variant="outline" size="sm" icon={Pencil} onClick={() => openEdit(s)} aria-label={`Editar a ${nombreCompleto(s)}`}>
                                  Editar
                                </Button>
                              )}
                              {canModify && s.estado !== 'RETIRADA' && (
                                <Button variant="ghost" size="sm" icon={UserMinus} onClick={() => openRetirar(s)} aria-label={`Retirar a ${nombreCompleto(s)}`}>
                                  Retirar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {total > PAGE_SIZE && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total} socias
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page === 1 || isLoading} onClick={() => goToPage(page - 1)}>
                    Anterior
                  </Button>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
                    {page} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" icon={ChevronRight} disabled={page === totalPages || isLoading} onClick={() => goToPage(page + 1)}>
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {activeTab === 'JARDINES' && (
        <Card title="Jardines VTF Temuco y Labranza" subtitle="Socias por establecimiento y delegada que lo representa ante la asamblea">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(250px, 100%), 1fr))', gap: '1rem' }}>
            {jardines.map((j) => (
              <div
                key={j.id}
                style={{
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <Badge variant="neutral">{j.code}</Badge>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {j.sociasActivas} / {j.totalSocias} activas
                  </span>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{j.name}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-main)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase' }}>Delegada: </span>
                  {j.delegada ? j.delegada.nombre : <span style={{ color: 'var(--text-muted)' }}>Sin asignar</span>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Users}
                  onClick={() => {
                    clearFilters();
                    setFilterJardin(String(j.id));
                    setActiveTab('PADRON');
                  }}
                >
                  Ver socias
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <CreditoDetailModal detail={detailMode === 'credito' ? detail : null} onClose={() => setDetail(null)} />

      <SociaDetailModal
        detail={detailMode === 'socia' ? detail : null}
        onClose={() => setDetail(null)}
        canModify={canModify}
        onEdit={openEdit}
        onRetirar={openRetirar}
      />

      <SociaFormModal
        formMode={formMode}
        editing={editing}
        jardines={jardines}
        onClose={() => setFormMode(null)}
        onSuccess={refresh}
      />

      <RetirarSociaModal socia={retirando} onClose={() => setRetirando(null)} onSuccess={refresh} />

      <ImportPadronModal open={importOpen} onClose={() => setImportOpen(false)} onApplied={refresh} />
    </div>
  );
}
