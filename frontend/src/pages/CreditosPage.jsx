import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, FileSpreadsheet, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { CreditoApiService } from '../services/creditoService.js';
import { ROLES_ACCESO } from '../utils/permissions.js';
import { EmpresaCards } from '../components/creditos/EmpresaCards.jsx';
import { CargaPlanillaModal } from '../components/creditos/CargaPlanillaModal.jsx';
import { VerificacionPagos } from '../components/creditos/VerificacionPagos.jsx';
import { CreditosHistorial } from '../components/creditos/CreditosHistorial.jsx';
import { CreditoFichaModal } from '../components/creditos/CreditoFichaModal.jsx';
import { CreditosGrafico } from '../components/creditos/CreditosGrafico.jsx';
import { CreditoFormModal } from '../components/creditos/CreditoFormModal.jsx';
import { LiquidacionCard } from '../components/creditos/LiquidacionCard.jsx';
import { SolicitudesSos } from '../components/creditos/SolicitudesSos.jsx';
import { ESTADO_CREDITO } from '../components/creditos/creditoLabels.js';

/**
 * V4 — Créditos y Convenios.
 * Admin y Tesorera cargan la planilla del día 18 y verifican los pagos; la Presidenta solo mira.
 */
export function CreditosPage() {
  const { hasRole } = useAuth();
  const puedeGestionar = hasRole(...ROLES_ACCESO.CREDITOS_GESTIONAR);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cargaOpen, setCargaOpen] = useState(false);
  const [fichaId, setFichaId] = useState(null);
  // Modal de crédito a mano: null = cerrado, 'nuevo' = nuevo crédito, objeto = edición de esa ficha
  const [formCredito, setFormCredito] = useState(null);
  const [aviso, setAviso] = useState(null);
  // Filtro de estado inicial desde el Inicio (ej. /creditos?estado=ULTIMA_CUOTA)
  const [searchParams] = useSearchParams();
  const estadoInicial = ESTADO_CREDITO[searchParams.get('estado')] ? searchParams.get('estado') : 'TODOS';
  // Cambia cuando se carga una planilla o se verifica un pago: refresca historial y verificación
  const [refreshKey, setRefreshKey] = useState(0);

  const cargarResumen = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setEmpresas(await CreditoApiService.getResumen());
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible cargar los créditos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  const refrescar = () => {
    cargarResumen();
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="cred-page">
      <header className="rep-header">
        <div style={{ minWidth: 0 }}>
          {!puedeGestionar && (
            <div style={{ marginBottom: '0.375rem' }}>
              <Badge variant="info" icon={Eye}>Solo vista</Badge>
            </div>
          )}
          <h1 className="cred-title">Créditos y Convenios</h1>
          <p className="cred-subtitle">S.O.S, ISIMUNDO, Óptica, Dental y Abogada: montos a pagar, pagos verificados y créditos de cada socia.</p>
        </div>
        {puedeGestionar && (
          <div className="cred-header-actions">
            <Button variant="outline" icon={Plus} onClick={() => setFormCredito('nuevo')}>
              Nuevo crédito
            </Button>
            <Button variant="primary" icon={FileSpreadsheet} onClick={() => setCargaOpen(true)}>
              Cargar planilla del mes
            </Button>
          </div>
        )}
      </header>

      {error && (
        <div className="com-alert com-alert-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {aviso && (
        <div className="com-alert com-alert-ok" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{aviso}</span>
        </div>
      )}

      <EmpresaCards empresas={empresas} loading={loading} />

      <SolicitudesSos puedeGestionar={puedeGestionar} onChanged={refrescar} />

      <VerificacionPagos puedeGestionar={puedeGestionar} onVerified={refrescar} refreshKey={refreshKey} />

      <LiquidacionCard refreshKey={refreshKey} />

      <CreditosHistorial onOpen={setFichaId} refreshKey={refreshKey} estadoInicial={estadoInicial} />

      {empresas.length > 0 && <CreditosGrafico empresas={empresas} />}

      <CargaPlanillaModal open={cargaOpen} onClose={() => setCargaOpen(false)} onApplied={refrescar} />
      <CreditoFichaModal
        creditoId={fichaId}
        puedeGestionar={puedeGestionar}
        onClose={() => setFichaId(null)}
        onChanged={refrescar}
        onEditar={(c) => {
          setFichaId(null);
          setFormCredito(c);
        }}
      />
      <CreditoFormModal
        open={Boolean(formCredito)}
        credito={formCredito === 'nuevo' ? null : formCredito}
        onClose={() => setFormCredito(null)}
        onSaved={(id, mensaje) => {
          setAviso(mensaje);
          refrescar();
          // Al guardar se abre la ficha del crédito para revisar su calendario
          setFichaId(id);
        }}
      />
    </div>
  );
}

export default CreditosPage;
