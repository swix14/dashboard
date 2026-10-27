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

const formatFullDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

// Debe coincidir con las reglas del backend (uploadMiddleware.js)
const COMPROBANTE_MAX_MB = 5;
const COMPROBANTE_TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const formatFileSize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

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
  const [modalTab, setModalTab] = useState('INGRESO'); // INGRESO | EGRESO | FEDERACION
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: '',
    metodo: 'Transferencia Bancaria',
    descripcion: '',
    centroCosto: 'ASOCIACION',
    categoria: 'ASOCIACION',
    archivoComprobante: null
  });
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Manejo de cambio de pestaña en modal
  const handleTabChange = (tab) => {
    setModalTab(tab);
    setFormError(null);
    if (tab === 'INGRESO') {
      setFormData((prev) => ({
        ...prev,
        centroCosto: 'ASOCIACION',
        categoria: 'ASOCIACION'
      }));
    } else if (tab === 'EGRESO') {
      setFormData((prev) => ({
        ...prev,
        centroCosto: 'CENA ANUAL',
        categoria: 'S.O.S'
      }));
    } else if (tab === 'FEDERACION') {
      setFormData((prev) => ({
        ...prev,
        centroCosto: 'FEDERACION',
        categoria: 'PAGO FEDERACION',
        descripcion: 'Cuota Federación Nacional VTF'
      }));
    }
  };

  // Enviar nuevo movimiento
  const handleCreateMovement = async (e) => {
    e.preventDefault();
    setFormError(null);

    const numMonto = Number(formData.monto);
    if (!numMonto || numMonto <= 0) {
      setFormError('El monto debe ser un valor numérico mayor a cero.');
      return;
    }

    if (!formData.descripcion.trim()) {
      setFormError('La descripción del movimiento es obligatoria.');
      return;
    }

    // Regla crítica: en EGRESO o FEDERACION el archivo del comprobante es obligatorio
    const isEgresoType = modalTab === 'EGRESO' || modalTab === 'FEDERACION';
    if (isEgresoType && !formData.archivoComprobante) {
      setFormError('El comprobante de egreso es estrictamente OBLIGATORIO: adjunte el archivo (PDF o imagen).');
      return;
    }

    try {
      setIsSubmitting(true);
      let payloadCentroCosto = formData.centroCosto;
      let payloadCategoria = formData.categoria;

      if (modalTab === 'FEDERACION') {
        payloadCentroCosto = 'FEDERACION';
        payloadCategoria = 'PAGO FEDERACION';
      } else if (modalTab === 'EGRESO') {
        if (formData.categoria === 'S.O.S' || formData.categoria === 'CENA') {
          payloadCentroCosto = 'CENA ANUAL';
        } else {
          payloadCentroCosto = 'ASOCIACION';
        }
      }

      await TreasuryApiService.createMovement({
        tipo: modalTab === 'INGRESO' ? 'INGRESO' : 'EGRESO',
        fecha: formData.fecha,
        descripcion: formData.descripcion,
        centroCosto: payloadCentroCosto,
        categoria: payloadCategoria,
        monto: numMonto,
        metodo: formData.metodo,
        archivoComprobante: formData.archivoComprobante
      });

      setIsModalOpen(false);
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        monto: '',
        metodo: 'Transferencia Bancaria',
        descripcion: '',
        centroCosto: 'ASOCIACION',
        categoria: 'ASOCIACION',
        archivoComprobante: null
      });
      loadTreasuryData();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error al registrar movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selección y validación local del archivo de comprobante
  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // Permite volver a elegir el mismo archivo
    if (!file) return;

    if (!COMPROBANTE_TIPOS.includes(file.type)) {
      setFormError('Formato de comprobante no permitido. Use PDF, JPG, PNG o WEBP.');
      return;
    }
    if (file.size > COMPROBANTE_MAX_MB * 1024 * 1024) {
      setFormError(`El comprobante supera el tamaño máximo de ${COMPROBANTE_MAX_MB} MB.`);
      return;
    }

    setFormError(null);
    setFormData((prev) => ({ ...prev, archivoComprobante: file }));
  };

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
              ${summary?.totalIngresos?.toLocaleString('es-CL')}
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
              ${summary?.totalEgresos?.toLocaleString('es-CL')}
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
              ${summary?.saldoTotal?.toLocaleString('es-CL')}
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
              ${summary?.totalPagadoFederacion?.toLocaleString('es-CL')}
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
              ${summary?.saldoAsociacion?.toLocaleString('es-CL')}
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
              ${summary?.saldoCenaAnual?.toLocaleString('es-CL')}
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
                        {formatFullDate(mov.fecha)}
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
                        {isIngreso ? '+' : '-'}${mov.monto?.toLocaleString('es-CL')}
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

      {/* =========================================================================
          MODAL TRANSACCIONAL: NUEVO MOVIMIENTO
          Pestañas: Ingreso, Egreso, Pago Federación
          - Ingreso: ASOCIACION, CENA ANUAL, ISI MUNDO COMISION
          - Egreso: S.O.S (Cena Anual), CENA (Cena Anual), OTROS (Asociación)
          - Pago Federación: Centro de Costo Fijo FEDERACION (Solo Egreso)
          - Comprobante de Egreso Obligatorio
         ========================================================================= */}
      {isModalOpen && (
        <div
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
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-surface-subtle)'
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Registrar Nuevo Movimiento
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Operador: {user?.firstName} {user?.lastName} ({user?.cargo || 'Tesorera'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Pestañas de Tipo de Movimiento */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-page)'
              }}
            >
              <button
                type="button"
                onClick={() => handleTabChange('INGRESO')}
                style={{
                  flex: 1,
                  padding: '0.875rem 0.5rem',
                  border: 'none',
                  background: modalTab === 'INGRESO' ? 'var(--bg-surface)' : 'transparent',
                  borderBottom: modalTab === 'INGRESO' ? '3px solid var(--success-border)' : '3px solid transparent',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  color: modalTab === 'INGRESO' ? 'var(--success-text)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                + Ingreso a Fondo
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('EGRESO')}
                style={{
                  flex: 1,
                  padding: '0.875rem 0.5rem',
                  border: 'none',
                  background: modalTab === 'EGRESO' ? 'var(--bg-surface)' : 'transparent',
                  borderBottom: modalTab === 'EGRESO' ? '3px solid var(--accent-pink-500)' : '3px solid transparent',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  color: modalTab === 'EGRESO' ? 'var(--accent-pink-600)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                - Egreso / Gasto
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('FEDERACION')}
                style={{
                  flex: 1,
                  padding: '0.875rem 0.5rem',
                  border: 'none',
                  background: modalTab === 'FEDERACION' ? 'var(--bg-surface)' : 'transparent',
                  borderBottom: modalTab === 'FEDERACION' ? '3px solid var(--primary-400)' : '3px solid transparent',
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  color: modalTab === 'FEDERACION' ? 'var(--info-text)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                Aporte Federación
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleCreateMovement} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

              {/* Fila Fecha y Monto */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                    Fecha del Movimiento
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="vtf-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                    Monto (CLP)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ej: 280000"
                    value={formData.monto}
                    onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                    className="vtf-input"
                  />
                </div>
              </div>

              {/* Categoría y Centro de Costo según Pestaña */}
              {modalTab === 'INGRESO' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                    Categoría de Ingreso (Afecta Centro de Costo)
                  </label>
                  <select
                    value={formData.centroCosto}
                    onChange={(e) => setFormData({ ...formData, centroCosto: e.target.value, categoria: e.target.value })}
                    className="vtf-input"
                  >
                    <option value="ASOCIACION">ASOCIACIÓN (Cuota Social Asociación)</option>
                    <option value="CENA ANUAL">CENA ANUAL (Cuota Fondo Cena)</option>
                    <option value="ISI MUNDO COMISION">ISI MUNDO COMISIÓN (2% Retorno Convenio)</option>
                  </select>
                </div>
              )}

              {modalTab === 'EGRESO' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                    Categoría de Egreso (Centro de Costo Vinculado)
                  </label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => {
                      const cat = e.target.value;
                      const cc = (cat === 'S.O.S' || cat === 'CENA') ? 'CENA ANUAL' : 'ASOCIACION';
                      setFormData({ ...formData, categoria: cat, centroCosto: cc });
                    }}
                    className="vtf-input"
                  >
                    <option value="S.O.S">S.O.S (Afecta Centro de Costo Cena Anual)</option>
                    <option value="CENA">CENA (Afecta Centro de Costo Cena Anual)</option>
                    <option value="OTROS">OTROS (Afecta Centro de Costo Asociación)</option>
                  </select>
                </div>
              )}

              {modalTab === 'FEDERACION' && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--info-bg)',
                    border: '1px solid var(--info-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    color: 'var(--info-text)'
                  }}
                >
                  <strong>Centro de Costo Fijo:</strong> FEDERACIÓN. Esta sección es exclusiva para registrar pagos del aporte gremial nacional.
                </div>
              )}

              {/* Método de Pago */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Método de Pago
                </label>
                <select
                  value={formData.metodo}
                  onChange={(e) => setFormData({ ...formData, metodo: e.target.value })}
                  className="vtf-input"
                >
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Descuento Planilla">Descuento Planilla</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              {/* Descripción */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Descripción Detallada
                </label>
                <textarea
                  rows="2"
                  required
                  placeholder="Detalle el motivo, destinatario o concepto del movimiento..."
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="vtf-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Comprobante de Respaldo */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Comprobante de Respaldo
                  </label>
                  {modalTab !== 'INGRESO' && (
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--error-text)' }}>
                      * OBLIGATORIO PARA EGRESOS
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                  <div
                    className="vtf-input"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      backgroundColor: 'var(--bg-surface-subtle)'
                    }}
                  >
                    {formData.archivoComprobante ? (
                      <>
                        <FileText size={15} style={{ flexShrink: 0, color: 'var(--primary-600)' }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {formData.archivoComprobante.name}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {formatFileSize(formData.archivoComprobante.size)}
                        </span>
                        <button
                          type="button"
                          aria-label="Quitar archivo"
                          onClick={() => setFormData({ ...formData, archivoComprobante: null })}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}
                        >
                          <X size={15} />
                        </button>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        {modalTab === 'INGRESO'
                          ? 'Sin archivo (opcional para ingresos)'
                          : `Adjunte PDF, JPG, PNG o WEBP (máx. ${COMPROBANTE_MAX_MB} MB)`}
                      </span>
                    )}
                  </div>
                  <label
                    style={{
                      padding: '0.5rem 0.875rem',
                      backgroundColor: 'var(--sand-100)',
                      border: '1px solid var(--sand-300)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--sand-700)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Upload size={14} /> Adjuntar
                    <input
                      type="file"
                      accept={COMPROBANTE_TIPOS.join(',')}
                      style={{ display: 'none' }}
                      onChange={handleFileSelected}
                    />
                  </label>
                </div>
              </div>

              {/* Responsable según sesión */}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.25rem' }}>
                <strong>Responsable de Registro:</strong> {user?.firstName} {user?.lastName} ({user?.cargo || 'Tesorera'})
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Registrando...' : 'Confirmar y Guardar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
