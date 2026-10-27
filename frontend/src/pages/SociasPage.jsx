import React, { useState, useEffect } from 'react';
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
  X,
  AlertCircle,
  Eye,
  Pencil,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { SociaApiService } from '../services/sociaService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { validateRut, formatRut } from '../utils/rut.js';

const PAGE_SIZE = 20;

const CARGO_LABELS = { DIRECTORA: 'Directora', EDUCADORA: 'Educadora', TECNICO: 'Técnico' };
const CREDITO_LABELS = { ISIMUNDO: 'Isi Mundo', 'S.O.S': 'S.O.S', OPTICA: 'Óptica', DENTAL: 'Dental' };
const DIRECTIVA_LABELS = {
  PRESIDENTA: 'Presidenta',
  TESORERA: 'Tesorera',
  SECRETARIA: 'Secretaria',
  DIRECTORA: 'Directora Directiva'
};

const EMPTY_FORM = {
  rut: '',
  firstName: '',
  lastName: '',
  cargo: 'EDUCADORA',
  estado: 'ACTIVA',
  jardinId: '',
  motivoTraslado: ''
};

const formatCLP = (value) => `$${(value || 0).toLocaleString('es-CL')}`;

const formatDate = (iso) => {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  marginBottom: '0.375rem'
};

function Modal({ title, subtitle, onClose, children, maxWidth = '560px' }) {
  useEffect(() => {
    const handleKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(18, 24, 38, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem'
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: 'calc(100vh - 2rem)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            backgroundColor: 'var(--bg-surface-subtle)'
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{title}</h3>
            {subtitle && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</span>}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

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

function InfoItem({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.15rem' }}>{children}</div>
    </div>
  );
}

export function SociasPage() {
  const { hasRole } = useAuth();
  const canModify = hasRole('ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA');

  // Estados de datos
  const [summary, setSummary] = useState(null);
  const [jardines, setJardines] = useState([]);
  const [socias, setSocias] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Ficha de socia
  const [detail, setDetail] = useState(null);
  const [detailLoadingId, setDetailLoadingId] = useState(null);

  // Formulario alta / edición
  const [formMode, setFormMode] = useState(null); // null | 'create' | 'edit'
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOverview = async () => {
    const [summaryRes, jardinesRes] = await Promise.all([
      SociaApiService.getSummary(),
      SociaApiService.getJardines()
    ]);
    setSummary(summaryRes);
    setJardines(jardinesRes);
  };

  const loadSocias = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const list = await SociaApiService.getSocias({
        search: debouncedSearch || undefined,
        jardinId: filterJardin,
        estado: filterEstado,
        cargo: filterCargo,
        credito: filterCredito
      });
      setSocias(list);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar el padrón de socias');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview().catch((err) =>
      setError(err.response?.data?.message || 'Error al cargar el resumen del padrón')
    );
  }, []);

  // Búsqueda con retardo para no consultar en cada tecla
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
    loadSocias();
  }, [debouncedSearch, filterJardin, filterEstado, filterCargo, filterCredito]);

  const totalPages = Math.max(1, Math.ceil(socias.length / PAGE_SIZE));
  const pageItems = socias.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasActiveFilters =
    search || filterJardin !== 'TODOS' || filterEstado !== 'TODOS' || filterCargo !== 'TODOS' || filterCredito !== 'TODOS';

  const clearFilters = () => {
    setSearch('');
    setFilterJardin('TODOS');
    setFilterEstado('TODOS');
    setFilterCargo('TODOS');
    setFilterCredito('TODOS');
  };

  const openDetail = async (sociaId) => {
    try {
      setDetailLoadingId(sociaId);
      setDetail(await SociaApiService.getSocia(sociaId));
    } catch (err) {
      alert(err.response?.data?.message || 'No fue posible cargar la ficha de la socia.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  const openCreate = () => {
    setFormData({ ...EMPTY_FORM, jardinId: jardines[0]?.id || '' });
    setEditing(null);
    setFormError(null);
    setFormMode('create');
  };

  const openEdit = (socia) => {
    setFormData({
      rut: socia.rut,
      firstName: socia.firstName,
      lastName: socia.lastName,
      cargo: socia.cargo,
      estado: socia.estado,
      jardinId: socia.jardin?.id || '',
      motivoTraslado: ''
    });
    setEditing(socia);
    setFormError(null);
    setDetail(null);
    setFormMode('edit');
  };

  const isTransfer = formMode === 'edit' && editing && formData.jardinId !== editing.jardin?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (formMode === 'create' && !validateRut(formData.rut)) {
      setFormError('El RUT ingresado no es válido. Revise el dígito verificador.');
      return;
    }
    if (formData.firstName.trim().length < 2 || formData.lastName.trim().length < 2) {
      setFormError('Nombres y apellidos son obligatorios.');
      return;
    }
    if (isTransfer && formData.motivoTraslado.trim().length < 3) {
      setFormError('Indique el motivo del traslado de jardín.');
      return;
    }

    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      cargo: formData.cargo,
      estado: formData.estado,
      jardinId: formData.jardinId
    };

    try {
      setIsSubmitting(true);
      if (formMode === 'create') {
        await SociaApiService.createSocia({ ...payload, rut: formData.rut });
      } else {
        await SociaApiService.updateSocia(editing.id, {
          ...payload,
          ...(isTransfer && { motivoTraslado: formData.motivoTraslado })
        });
      }
      setFormMode(null);
      await Promise.all([loadOverview(), loadSocias()]);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error al guardar la socia');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Exportar padrón filtrado a CSV compatible con Excel
  const handleExportCSV = () => {
    if (socias.length === 0) {
      alert('No hay socias para exportar con los filtros seleccionados.');
      return;
    }

    const headers = ['RUT', 'Nombres', 'Apellidos', 'Cargo', 'Jardin', 'Estado', 'Cuota Mensual (CLP)', 'Credito', 'Delegada'];
    const rows = socias.map((s) => [
      s.rut,
      `"${s.firstName}"`,
      `"${s.lastName}"`,
      CARGO_LABELS[s.cargo],
      `"${s.jardin?.name || ''}"`,
      s.estado,
      s.cuotaMensual,
      s.tieneCredito ? 'SI' : 'NO',
      s.esDelegada ? 'SI' : 'NO'
    ]);

    const csvContent = '﻿' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Padron_Socias_VTF_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    gap: '0.5rem'
  });

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
          padding: '1.5rem 2rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--primary-100)',
                color: 'var(--primary-800)',
                letterSpacing: '0.04em'
              }}
            >
              Módulo Padrón V3
            </span>
            {!canModify && (
              <Badge variant="warning" icon={Lock}>
                Modo Consulta: Solo Lectura
              </Badge>
            )}
          </div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
            Padrón de Socias y Créditos
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Socias activas y suspendidas de los {summary?.totalJardines ?? 23} jardines VTF de Temuco, con su estado de cuota y créditos por convenio.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
          <Button variant="outline" icon={Download} onClick={handleExportCSV}>
            Exportar Padrón
          </Button>
          {canModify && (
            <Button variant="primary" icon={PlusCircle} onClick={openCreate} disabled={jardines.length === 0}>
              Nueva Socia
            </Button>
          )}
        </div>
      </div>

      {/* Recuadros KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <KpiCard
          label="Total Socias"
          value={summary?.totalSocias ?? '—'}
          hint={summary ? `${summary.porCargo.DIRECTORA} directoras · ${summary.porCargo.EDUCADORA} educadoras · ${summary.porCargo.TECNICO} técnicos` : ''}
          icon={Users}
          accent="var(--primary-500)"
        />
        <KpiCard
          label="Socias Activas"
          value={summary?.sociasActivas ?? '—'}
          hint={summary ? `Recaudación esperada ${formatCLP(summary.recaudacionMensualEsperada)}/mes` : ''}
          icon={UserCheck}
          accent="var(--success-border)"
        />
        <KpiCard
          label="Socias Suspendidas"
          value={summary?.sociasSuspendidas ?? '—'}
          hint="Sin cobro de cuota social"
          icon={UserX}
          accent="var(--accent-pink-500)"
        />
        <KpiCard
          label="Con Crédito Vigente"
          value={summary?.sociasConCredito ?? '—'}
          hint={summary ? `Saldo por cobrar ${formatCLP(summary.saldoCreditosPendiente)}` : ''}
          icon={CreditCard}
          accent="var(--sand-500)"
        />
      </div>

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
          {/* Filtros */}
          <Card title="Búsqueda y Filtros" subtitle="Busque por nombre o RUT y combine filtros para segmentar el padrón">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>Nombre o RUT</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
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
                <label style={labelStyle}>Jardín</label>
                <select value={filterJardin} onChange={(e) => setFilterJardin(e.target.value)} className="vtf-input">
                  <option value="TODOS">Todos los Jardines</option>
                  {jardines.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.code} · {j.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Estado</label>
                <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="vtf-input">
                  <option value="TODOS">Todos</option>
                  <option value="ACTIVA">Activas</option>
                  <option value="SUSPENDIDA">Suspendidas</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Cargo</label>
                <select value={filterCargo} onChange={(e) => setFilterCargo(e.target.value)} className="vtf-input">
                  <option value="TODOS">Todos</option>
                  <option value="DIRECTORA">Directora</option>
                  <option value="EDUCADORA">Educadora</option>
                  <option value="TECNICO">Técnico</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Crédito</label>
                <select value={filterCredito} onChange={(e) => setFilterCredito(e.target.value)} className="vtf-input">
                  <option value="TODOS">Todos</option>
                  <option value="SI">Con crédito (SI)</option>
                  <option value="NO">Sin crédito (NO)</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {socias.length} socias coinciden con los filtros
                </span>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Limpiar Filtros
                </Button>
              </div>
            )}
          </Card>

          {/* Tabla del padrón */}
          <Card title="Padrón Oficial de Socias" subtitle="Cuota social fija de $4.000 CLP mensuales; las socias suspendidas no generan cobro">
            <div className="vtf-table-container" style={{ opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <table className="vtf-table">
                <thead>
                  <tr>
                    <th>Socia</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Cargo</th>
                    <th>Jardín</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Estado</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Cuota</th>
                    <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Crédito</th>
                    <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        {isLoading ? 'Cargando padrón de socias...' : 'No se encontraron socias para los filtros seleccionados.'}
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {s.firstName} {s.lastName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{s.rut}</span>
                            {s.cargoDirectiva && <Badge variant="info" icon={Star}>{DIRECTIVA_LABELS[s.cargoDirectiva]}</Badge>}
                            {s.esDelegada && <Badge variant="info">Delegada</Badge>}
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{CARGO_LABELS[s.cargo]}</td>
                        <td style={{ fontSize: '0.8125rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary-700)' }}>{s.jardin?.code}</span>{' '}
                          {s.jardin?.name?.replace('Jardín ', '')}
                        </td>
                        <td>
                          <Badge variant={s.estado === 'ACTIVA' ? 'success' : 'error'}>
                            {s.estado === 'ACTIVA' ? 'Activa' : 'Suspendida'}
                          </Badge>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: s.cuotaMensual ? 'var(--text-main)' : 'var(--text-muted)' }}>
                          {s.cuotaMensual ? formatCLP(s.cuotaMensual) : 'Sin cobro'}
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {s.tieneCredito ? (
                            <button
                              type="button"
                              onClick={() => openDetail(s.id)}
                              title="Ver créditos vigentes"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.25rem 0.625rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--sand-50)',
                                border: '1px solid var(--sand-300)',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                color: 'var(--sand-800)',
                                cursor: 'pointer'
                              }}
                            >
                              SI ·{' '}
                              {s.creditosActivos
                                .map((c) => `${CREDITO_LABELS[c.tipo]} ${c.cuotasPagadas}/${c.totalCuotas}`)
                                .join(', ')}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>NO</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Eye}
                              isLoading={detailLoadingId === s.id}
                              onClick={() => openDetail(s.id)}
                              aria-label={`Ver ficha de ${s.firstName} ${s.lastName}`}
                            >
                              Ficha
                            </Button>
                            {canModify && (
                              <Button
                                variant="outline"
                                size="sm"
                                icon={Pencil}
                                onClick={() => openEdit(s)}
                                aria-label={`Editar a ${s.firstName} ${s.lastName}`}
                              >
                                Editar
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {socias.length > PAGE_SIZE && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, socias.length)} de {socias.length} socias
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page === 1} onClick={() => setPage(page - 1)}>
                    Anterior
                  </Button>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
                    {page} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" icon={ChevronRight} disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {activeTab === 'JARDINES' && (
        <Card title="Catálogo de Jardines VTF Temuco" subtitle="Socias por establecimiento y delegada electa que lo representa ante la asamblea">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
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
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{j.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{j.address}</div>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-main)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase' }}>Delegada: </span>
                  {j.delegada ? j.delegada.nombre : <span style={{ color: 'var(--error-text)' }}>Sin asignar</span>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Users}
                  onClick={() => {
                    setFilterJardin(j.id);
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

      {/* Ficha de socia con créditos e historial */}
      {detail && (
        <Modal
          title={`${detail.firstName} ${detail.lastName}`}
          subtitle={`RUT ${detail.rut} · ${detail.jardin?.name || ''}`}
          onClose={() => setDetail(null)}
          maxWidth="640px"
        >
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              <InfoItem label="Cargo">{CARGO_LABELS[detail.cargo]}</InfoItem>
              <InfoItem label="Estado">
                <Badge variant={detail.estado === 'ACTIVA' ? 'success' : 'error'}>
                  {detail.estado === 'ACTIVA' ? 'Activa' : 'Suspendida'}
                </Badge>
              </InfoItem>
              <InfoItem label="Incorporación">{formatDate(detail.fechaIncorporacion)}</InfoItem>
              <InfoItem label="Cuota social">{detail.cuotaMensual ? `${formatCLP(detail.cuotaMensual)} / mes` : 'Sin cobro'}</InfoItem>
              <InfoItem label="Descuento créditos">{formatCLP(detail.descuentoMensualCreditos)} / mes</InfoItem>
              {(detail.cargoDirectiva || detail.esDelegada) && (
                <InfoItem label="Representación">
                  {[detail.cargoDirectiva && DIRECTIVA_LABELS[detail.cargoDirectiva], detail.esDelegada && 'Delegada de jardín']
                    .filter(Boolean)
                    .join(' · ')}
                </InfoItem>
              )}
            </div>

            {detail.estado === 'SUSPENDIDA' && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: 'var(--error-text)' }}>
                Socia suspendida: no se genera cobro de la cuota social mientras mantenga este estado.
              </div>
            )}

            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Créditos y convenios
              </div>
              {detail.creditos.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>La socia no registra créditos.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {detail.creditos.map((c) => {
                    const progress = Math.round((c.cuotasPagadas / c.totalCuotas) * 100);
                    return (
                      <div key={c.id} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.625rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.tipoNombre}</span>
                          <Badge variant={c.estado === 'ACTIVO' ? 'warning' : 'success'}>
                            {c.estado === 'ACTIVO' ? 'Vigente' : 'Finalizado'}
                          </Badge>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                          <span>Cuota {c.cuotasPagadas} de {c.totalCuotas}</span>
                          <span>{progress}%</span>
                        </div>
                        <div style={{ height: '6px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-surface-subtle)', overflow: 'hidden', marginBottom: '0.75rem' }}>
                          <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--primary-500)' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                          <InfoItem label="Monto">{formatCLP(c.montoSolicitado)}</InfoItem>
                          <InfoItem label="Valor cuota">{formatCLP(c.valorCuota)}</InfoItem>
                          <InfoItem label="Saldo pendiente">{formatCLP(c.saldoPendiente)}</InfoItem>
                          <InfoItem label="Período">
                            {formatDate(c.fechaInicio)} – {formatDate(c.fechaTermino)}
                          </InfoItem>
                          {c.comisionAsociacion > 0 && (
                            <InfoItem label="Comisión 2% Asoc.">{formatCLP(c.comisionAsociacion)}</InfoItem>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {detail.historialJardin.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  Historial de traslados
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0, margin: 0 }}>
                  {detail.historialJardin.map((h) => (
                    <li key={h.id} style={{ display: 'flex', gap: '0.625rem', fontSize: '0.8125rem' }}>
                      <ArrowRightLeft size={15} style={{ color: 'var(--primary-500)', flexShrink: 0, marginTop: '2px' }} />
                      <span>
                        <strong>{formatDate(h.fecha)}</strong>: {h.jardinAnterior} → {h.jardinNuevo}. Motivo: {h.motivo}{' '}
                        <span style={{ color: 'var(--text-muted)' }}>({h.changedBy})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canModify && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="outline" icon={Pencil} onClick={() => openEdit(detail)}>
                  Editar ficha
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Alta y edición de socia */}
      {formMode && (
        <Modal
          title={formMode === 'create' ? 'Incorporar Nueva Socia' : 'Editar Ficha de Socia'}
          subtitle={formMode === 'edit' ? `RUT ${editing?.rut}` : 'Los cambios quedan registrados en la bitácora de auditoría'}
          onClose={() => setFormMode(null)}
        >
          <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--error-bg)',
                  border: '1px solid var(--error-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--error-text)',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            {formMode === 'create' && (
              <div>
                <label style={labelStyle} htmlFor="socia-rut">RUT</label>
                <input
                  id="socia-rut"
                  required
                  inputMode="text"
                  placeholder="Ej: 12.345.678-5"
                  value={formData.rut}
                  onChange={(e) => setFormData({ ...formData, rut: formatRut(e.target.value) })}
                  className="vtf-input"
                  style={{ borderColor: formData.rut.length >= 9 && !validateRut(formData.rut) ? 'var(--error-text)' : undefined }}
                />
                {formData.rut.length >= 9 && !validateRut(formData.rut) && (
                  <span className="vtf-error-text">Dígito verificador incorrecto</span>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle} htmlFor="socia-nombres">Nombres</label>
                <input
                  id="socia-nombres"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="vtf-input"
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="socia-apellidos">Apellidos</label>
                <input
                  id="socia-apellidos"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="vtf-input"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={labelStyle} htmlFor="socia-cargo">Cargo</label>
                <select
                  id="socia-cargo"
                  value={formData.cargo}
                  onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                  className="vtf-input"
                >
                  <option value="DIRECTORA">Directora</option>
                  <option value="EDUCADORA">Educadora</option>
                  <option value="TECNICO">Técnico</option>
                </select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="socia-estado">Estado</label>
                <select
                  id="socia-estado"
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  className="vtf-input"
                >
                  <option value="ACTIVA">Activa (cobra cuota $4.000)</option>
                  <option value="SUSPENDIDA">Suspendida (sin cobro)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle} htmlFor="socia-jardin">Jardín</label>
              <select
                id="socia-jardin"
                value={formData.jardinId}
                onChange={(e) => setFormData({ ...formData, jardinId: e.target.value })}
                className="vtf-input"
              >
                {jardines.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} · {j.name}
                  </option>
                ))}
              </select>
            </div>

            {isTransfer && (
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--sand-50)',
                  border: '1px solid var(--sand-200)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '0.8125rem', color: 'var(--sand-800)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600 }}>
                  <ArrowRightLeft size={15} /> Traslado desde {editing.jardin?.name}
                  {editing.esDelegada && ' (dejará de ser delegada de ese jardín)'}
                </span>
                <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor="socia-motivo">Motivo del traslado</label>
                <input
                  id="socia-motivo"
                  required
                  placeholder="Ej: Cambio de establecimiento por reubicación"
                  value={formData.motivoTraslado}
                  onChange={(e) => setFormData({ ...formData, motivoTraslado: e.target.value })}
                  className="vtf-input"
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="outline" onClick={() => setFormMode(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                {formMode === 'create' ? 'Incorporar Socia' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
