import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Building,
  DollarSign,
  Download,
  PlusCircle,
  Filter,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Upload,
  Lock,
  Calendar,
  Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { TreasuryApiService } from '../services/treasuryService.js';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { NewMovementModal } from '../components/treasury/NewMovementModal.jsx';
import { formatCurrencyCLP, formatDateCLP, formatFileSize } from '../utils/formatters.js';

// Con responseType 'blob' el mensaje de error del backend también llega como Blob
const readBlobErrorMessage = async (err) => {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message;
    } catch {
      return null;
    }
  }
  return data?.message;
};

export function TreasuryPage() {
  const { user, isTesorera, isAdmin } = useAuth();
  const canModify = isTesorera || isAdmin;

  // Estados de datos
  const [summary, setSummary] = useState(null);
  const [movements, setMovements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [filterTipo, setFilterTipo] = useState('TODOS');
  const [filterCentroCosto, setFilterCentroCosto] = useState('TODOS');
  const [filterMetodo, setFilterMetodo] = useState('TODOS');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');

  // Modal Nuevo Movimiento
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openingReceiptId, setOpeningReceiptId] = useState(null);

  // Carga inicial y por filtros
  const loadTreasuryData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [summaryRes, movementsRes] = await Promise.all([
        TreasuryApiService.getSummary(),
        TreasuryApiService.getMovements({
          tipo: filterTipo,
          centroCosto: filterCentroCosto,
          metodo: filterMetodo,
          fechaDesde: filterFechaDesde || undefined,
          fechaHasta: filterFechaHasta || undefined
        })
      ]);
      setSummary(summaryRes);
      setMovements(movementsRes);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar los datos de tesorería');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTreasuryData();
  }, [filterTipo, filterCentroCosto, filterMetodo, filterFechaDesde, filterFechaHasta]);

  // Abre el comprobante en una pestaña nueva (PDF e imágenes se visualizan en el navegador)
  const handleOpenComprobante = async (mov) => {
    // La pestaña se abre antes de la descarga para que el navegador no la bloquee como popup
    const previewWindow = window.open('', '_blank');
    try {
      setOpeningReceiptId(mov.id);
      const blob = await TreasuryApiService.getComprobante(mov.id);
      const url = URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.location.assign(url);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      previewWindow?.close();
      alert((await readBlobErrorMessage(err)) || 'No fue posible abrir el comprobante.');
    } finally {
      setOpeningReceiptId(null);
    }
  };

  // Exportar a CSV compatible con Excel
  const handleExportCSV = () => {
    if (!movements || movements.length === 0) {
      alert('No hay movimientos disponibles para exportar con los filtros seleccionados.');
      return;
    }

    const headers = ['Correlativo', 'Fecha', 'Tipo', 'Centro de Costo', 'Categoria', 'Descripcion', 'Metodo', 'Monto (CLP)', 'Responsable', 'Comprobante'];
    const rows = movements.map((m) => [
      m.correlativo,
      m.fecha,
      m.tipo,
      m.centroCosto,
      m.categoria,
      `"${m.descripcion.replace(/"/g, '""')}"`,
      m.metodo,
      m.monto,
      `"${m.responsable}"`,
      m.comprobante || 'Sin Comprobante'
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Tesoreria_VTF_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading && !summary) {
    return (
      <div style={{ padding: '4rem 0', textAlign: 'center' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--primary-100)',
            borderTop: '3px solid var(--primary-500)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1.25rem'
          }}
        />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', fontWeight: 500 }}>
          Cargando módulo contable de Tesorería...
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera de Tesorería: Título + Acciones Exportar / Agregar Movimiento */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
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
              Módulo Financiero V2
            </span>
            {!canModify && (
              <Badge variant="warning" icon={Lock}>
                Modo Supervisión: Solo Lectura
              </Badge>
            )}
          </div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
            Tesorería y Gestión de Fondos
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Control contable por centros de costo, verificación de egresos y trazabilidad con comprobantes respaldados.
          </p>
        </div>

        {/* Botones de Cabecera: Exportar / Agregar Movimiento */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            icon={Download}
            onClick={handleExportCSV}
          >
            Exportar Movimientos
          </Button>

          {canModify ? (
            <Button
              variant="primary"
              icon={PlusCircle}
              onClick={() => {
                setFormError(null);
                setIsModalOpen(true);
              }}
            >
              Agregar Movimiento
            </Button>
          ) : (
            <div
              style={{
                padding: '0.625rem 1rem',
                backgroundColor: 'var(--sand-50)',
                border: '1px solid var(--sand-200)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                color: 'var(--sand-700)',
                fontWeight: 600
              }}
            >
              Solo la Tesorera y Admin pueden ingresar movimientos
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          RECUADROS INFORMACIÓN VISIBLE (7 RECUADROS KPI EXIGIDOS)
          1. RECUADRO INGRESOS (solo suma total de ingresos)
          2. RECUADRO EGRESOS (solo suma total egresos)
          3. RECUADRO SALDO TOTAL (suma de ASOCIACIÓN y CENA ANUAL)
          4. RECUADRO MOVIMIENTOS (total de movimientos realizados)
          5. RECUADRO FEDERACIÓN (montos totales pagados a federación)
          6. RECUADRO ASOCIACIÓN (saldo total existente de centro de costo asociación)
          7. RECUADRO CENA ANUAL (saldo total existente de centro de costo cena anual)
         ========================================================================= */}
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.875rem' }}>
          Balance y Centros de Costo en Vivo
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1.25rem'
          }}
        >
          {/* 1. RECUADRO INGRESOS */}
          <div className="vtf-card" style={{ borderLeft: '4px solid var(--success-border)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--success-text)' }}>
                Total Ingresos
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowUpRight size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrencyCLP(summary?.totalIngresos)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
              Cuotas, cenas y comisión 2%
            </div>
          </div>

          {/* 2. RECUADRO EGRESOS */}
          <div className="vtf-card" style={{ borderLeft: '4px solid var(--accent-pink-500)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-pink-600)' }}>
                Total Egresos
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--accent-pink-100)', color: 'var(--accent-pink-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowDownRight size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrencyCLP(summary?.totalEgresos)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
              Pagos con respaldo verificado
            </div>
          </div>

          {/* 3. RECUADRO SALDO TOTAL */}
          <div className="vtf-card" style={{ borderLeft: '4px solid var(--primary-500)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-700)' }}>
                Saldo Total Disponible
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrencyCLP(summary?.saldoTotal)}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-800)', marginTop: '0.375rem' }}>
              Suma: Asociación + Cena Anual
            </div>
          </div>

          {/* 4. RECUADRO MOVIMIENTOS */}
          <div className="vtf-card" style={{ borderLeft: '4px solid var(--sand-500)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--sand-700)' }}>
                Total Movimientos
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--sand-100)', color: 'var(--sand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
              {summary?.totalMovimientos ?? movements.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
              Transacciones auditadas
            </div>
          </div>

          {/* 5. RECUADRO FEDERACIÓN */}
          <div className="vtf-card" style={{ borderLeft: '4px solid var(--primary-400)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--info-text)' }}>
                Pagos a Federación
              </span>
              <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--info-bg)', color: 'var(--primary-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building size={18} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrencyCLP(summary?.totalPagadoFederacion)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
              Aportes gremiales al día (Solo Egresos)
            </div>
          </div>

          {/* 6. RECUADRO ASOCIACIÓN */}
          <div className="vtf-card" style={{ borderLeft: '4px solid var(--primary-400)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-700)' }}>
                Saldo Asociación
              </span>
              <Badge variant="neutral">C. Costo</Badge>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrencyCLP(summary?.saldoAsociacion)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
              Gastos operacionales y bienestar
            </div>
          </div>

          {/* 7. RECUADRO CENA ANUAL */}
          <div className="vtf-card" style={{ borderLeft: '4px solid var(--accent-pink-400)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-pink-600)' }}>
                Saldo Cena Anual
              </span>
              <Badge variant="neutral">C. Costo</Badge>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrencyCLP(summary?.saldoCenaAnual)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
              Fondo evento fin de año y S.O.S
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          BARRA DE FILTRADO (TIPOS, CENTROS DE COSTO, MÉTODO, RANGO DE FECHAS)
         ========================================================================= */}
      <Card
        title="Filtros de Búsqueda y Auditoría"
        subtitle="Seleccione los parámetros para segmentar y exportar la vista de movimientos"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            alignItems: 'flex-end'
          }}
        >
          {/* Tipo */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
              Tipo de Movimiento
            </label>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="vtf-input"
            >
              <option value="TODOS">Todos los Tipos</option>
              <option value="INGRESO">Ingresos</option>
              <option value="EGRESO">Egresos</option>
            </select>
          </div>

          {/* Centro de Costo */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
              Centro de Costo
            </label>
            <select
              value={filterCentroCosto}
              onChange={(e) => setFilterCentroCosto(e.target.value)}
              className="vtf-input"
            >
              <option value="TODOS">Todos los Centros</option>
              <option value="ASOCIACION">Asociación</option>
              <option value="CENA ANUAL">Cena Anual</option>
              <option value="FEDERACION">Federación</option>
              <option value="ISI MUNDO COMISION">Isi Mundo Comisión</option>
            </select>
          </div>

          {/* Método */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
              Método de Pago
            </label>
            <select
              value={filterMetodo}
              onChange={(e) => setFilterMetodo(e.target.value)}
              className="vtf-input"
            >
              <option value="TODOS">Todos los Métodos</option>
              <option value="Transferencia">Transferencia Bancaria</option>
              <option value="Descuento">Descuento Planilla</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          {/* Fecha Desde */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
              Fecha Desde
            </label>
            <input
              type="date"
              value={filterFechaDesde}
              onChange={(e) => setFilterFechaDesde(e.target.value)}
              className="vtf-input"
            />
          </div>

          {/* Fecha Hasta */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
              Fecha Hasta
            </label>
            <input
              type="date"
              value={filterFechaHasta}
              onChange={(e) => setFilterFechaHasta(e.target.value)}
              className="vtf-input"
            />
          </div>
        </div>

        {/* Resumen de filtros activos */}
        {(filterTipo !== 'TODOS' || filterCentroCosto !== 'TODOS' || filterMetodo !== 'TODOS' || filterFechaDesde || filterFechaHasta) && (
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Mostrando {movements.length} movimientos filtrados
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterTipo('TODOS');
                setFilterCentroCosto('TODOS');
                setFilterMetodo('TODOS');
                setFilterFechaDesde('');
                setFilterFechaHasta('');
              }}
            >
              Limpiar Filtros
            </Button>
          </div>
        )}
      </Card>

      {/* =========================================================================
          VISTA LISTADO MOVIMIENTOS
          fecha, tipo, centro de costo, descripcion, metodo, monto, comprobante
          (ok, no debe haber egreso sin comprobante)
         ========================================================================= */}
      <Card
        title="Libro de Movimientos de Tesorería"
        subtitle="Registro oficial de transacciones con número correlativo y respaldo documental"
      >
        <div className="vtf-table-container">
          <table className="vtf-table">
            <thead>
              <tr>
                <th style={{ width: '130px', whiteSpace: 'nowrap' }}>Correlativo</th>
                <th style={{ width: '100px', whiteSpace: 'nowrap' }}>Fecha</th>
                <th style={{ width: '95px', whiteSpace: 'nowrap' }}>Tipo</th>
                <th style={{ width: '160px', whiteSpace: 'nowrap' }}>Centro de Costo</th>
                <th>Descripción y Categoría</th>
                <th style={{ width: '150px', whiteSpace: 'nowrap' }}>Método</th>
                <th style={{ width: '130px', textAlign: 'right', whiteSpace: 'nowrap' }}>Monto</th>
                <th style={{ width: '160px', textAlign: 'center', whiteSpace: 'nowrap' }}>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No se encontraron movimientos registrados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                movements.map((mov) => {
                  const isIngreso = mov.tipo === 'INGRESO';
                  return (
                    <tr key={mov.id}>
                      <td style={{ fontWeight: 700, color: 'var(--primary-700)', fontVariantNumeric: 'tabular-nums' }}>
                        {mov.correlativo}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {formatDateCLP(mov.fecha)}
                      </td>
                      <td>
                        <Badge variant={isIngreso ? 'success' : 'neutral'}>
                          {isIngreso ? '+ INGRESO' : '- EGRESO'}
                        </Badge>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor:
                              mov.centroCosto === 'ASOCIACION'
                                ? 'var(--primary-50)'
                                : mov.centroCosto === 'CENA ANUAL'
                                ? 'var(--accent-pink-50)'
                                : mov.centroCosto === 'FEDERACION'
                                ? 'var(--info-bg)'
                                : 'var(--sand-50)',
                            color:
                              mov.centroCosto === 'ASOCIACION'
                                ? 'var(--primary-800)'
                                : mov.centroCosto === 'CENA ANUAL'
                                ? 'var(--accent-pink-700)'
                                : mov.centroCosto === 'FEDERACION'
                                ? 'var(--info-text)'
                                : 'var(--sand-800)'
                          }}
                        >
                          {mov.centroCosto}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{mov.descripcion}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Cat: {mov.categoria} • Resp: {mov.responsable}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {mov.metodo}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          fontSize: '0.9375rem',
                          fontVariantNumeric: 'tabular-nums',
                          color: isIngreso ? 'var(--success-text)' : 'var(--text-main)'
                        }}
                      >
                        {isIngreso ? '+' : '-'}{formatCurrencyCLP(mov.monto)}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {mov.comprobanteArchivo ? (
                          <button
                            type="button"
                            title={`${mov.comprobante} (${formatFileSize(mov.comprobanteArchivo.size)})`}
                            disabled={openingReceiptId === mov.id}
                            onClick={() => handleOpenComprobante(mov)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.25rem 0.625rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-surface-subtle)',
                              border: '1px solid var(--border-light)',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              color: 'var(--primary-700)',
                              cursor: 'pointer'
                            }}
                          >
                            <FileText size={13} />
                            {openingReceiptId === mov.id
                              ? 'Abriendo...'
                              : `Ver (${mov.comprobanteArchivo.mimeType === 'application/pdf' ? 'PDF' : 'Imagen'})`}
                          </button>
                        ) : mov.comprobante ? (
                          // Registros históricos: el respaldo existe en papel, sin archivo digital en el sistema
                          <span
                            title={`Respaldo físico: ${mov.comprobante}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}
                          >
                            <FileText size={13} /> Respaldo físico
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--error-text)', fontWeight: 600 }}>
                            {mov.tipo === 'EGRESO' ? 'Falta Respaldo' : 'N/A'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Modular de Nuevo Movimiento */}
      <NewMovementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadTreasuryData}
        user={user}
      />
    </div>
  );
}
