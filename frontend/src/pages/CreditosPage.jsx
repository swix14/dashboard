import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Eye, FileSpreadsheet } from 'lucide-react';
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
          <Button variant="primary" icon={FileSpreadsheet} onClick={() => setCargaOpen(true)}>
            Cargar planilla del mes
          </Button>
        )}
      </header>

      {error && (
        <div className="com-alert com-alert-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <EmpresaCards empresas={empresas} loading={loading} />

      <VerificacionPagos puedeGestionar={puedeGestionar} onVerified={refrescar} refreshKey={refreshKey} />

      <CreditosHistorial onOpen={setFichaId} refreshKey={refreshKey} />

      {empresas.length > 0 && <CreditosGrafico empresas={empresas} />}

      <CargaPlanillaModal open={cargaOpen} onClose={() => setCargaOpen(false)} onApplied={refrescar} />
      <CreditoFichaModal creditoId={fichaId} onClose={() => setFichaId(null)} />
    </div>
  );
}

export default CreditosPage;
