import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, UserCheck } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { TreasuryApiService } from '../../services/treasuryService.js';
import { formatDateCLP } from '../../utils/formatters.js';

/**
 * Interruptor de suplencia de Tesorería. Solo lo ve el Admin: cuando la Tesorera no está,
 * activa a la Directora para que opere Tesorería y Créditos. Pide confirmación antes de cambiar.
 */
export function SuplenciaTesoreria() {
  const [estado, setEstado] = useState(null);
  const [elegida, setElegida] = useState('');
  const [confirmar, setConfirmar] = useState(null); // true = activar, false = desactivar
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  useEffect(() => {
    TreasuryApiService.getSuplencia()
      .then((data) => {
        setEstado(data);
        setElegida(String(data.suplente?.id || data.candidatas[0]?.id || ''));
      })
      .catch((err) => setError(err.response?.data?.message || 'No fue posible cargar la suplencia.'));
  }, []);

  if (!estado && !error) return null;

  const candidatas = estado?.candidatas || [];
  const persona = estado?.suplente || candidatas.find((c) => String(c.id) === elegida) || null;
  const nombre = persona?.nombre || 'la Directora';

  const aplicar = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await TreasuryApiService.setSuplencia(confirmar, confirmar ? Number(elegida) : undefined);
      setEstado(res.data);
      setOk(res.message);
      setConfirmar(null);
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible cambiar la suplencia.');
      setConfirmar(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`sup-card${estado?.activa ? ' is-on' : ''}`} aria-label="Suplencia de Tesorería">
      <div className="sup-icon" aria-hidden="true">
        <UserCheck size={20} />
      </div>
      <div className="sup-body">
        <div className="sup-title">
          Suplencia de Tesorería
          <span className="sup-solo-admin">Solo Admin</span>
        </div>
        <p className="sup-text">
          {estado?.activa
            ? <><strong>{estado.suplente.nombre}</strong> está operando Tesorería y Créditos en reemplazo de la Tesorera.</>
            : candidatas.length === 0
            ? 'No hay una Directora activa que pueda reemplazar a la Tesorera.'
            : <>Cuando la Tesorera no esté, active a <strong>{nombre}</strong> (Directora) para que la reemplace.</>}
        </p>
        {estado?.actualizadoPor && (
          <span className="sup-meta">Último cambio: {estado.actualizadoPor}, {formatDateCLP(estado.actualizadoAt)}</span>
        )}
        {!estado?.activa && candidatas.length > 1 && (
          <select className="vtf-input sup-select" aria-label="Directora que reemplaza" value={elegida} onChange={(e) => setElegida(e.target.value)}>
            {candidatas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
        {error && (
          <div className="com-alert com-alert-error sup-alert" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {ok && (
          <div className="com-alert com-alert-ok sup-alert" role="status">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{ok}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={Boolean(estado?.activa)}
        aria-label={estado?.activa ? 'Desactivar suplencia de Tesorería' : 'Activar suplencia de Tesorería'}
        className="sup-switch"
        disabled={!estado || (!estado.activa && candidatas.length === 0)}
        onClick={() => { setOk(null); setConfirmar(!estado.activa); }}
      >
        <span className="sup-switch-thumb" />
      </button>

      {confirmar !== null && (
        <Modal
          title={confirmar ? '¿Activar la suplencia de Tesorería?' : '¿Desactivar la suplencia de Tesorería?'}
          onClose={() => !saving && setConfirmar(null)}
          maxWidth="460px"
        >
          <div className="sup-confirm">
            <div className={`sup-warning${confirmar ? '' : ' is-off'}`}>
              <AlertTriangle size={18} aria-hidden="true" />
              {confirmar ? (
                <p>
                  <strong>{nombre}</strong> podrá registrar, editar y anular ingresos y egresos, cargar la planilla de créditos y
                  verificar pagos, con los mismos permisos de la Tesorera. Todo lo que haga quedará a su nombre en la bitácora.
                </p>
              ) : (
                <p>
                  <strong>{nombre}</strong> dejará de tener acceso a Tesorería y Créditos de inmediato. Lo que ya registró se
                  mantiene a su nombre.
                </p>
              )}
            </div>
            <div className="cred-actions" style={{ marginTop: 0 }}>
              <Button type="button" variant="outline" onClick={() => setConfirmar(null)} disabled={saving}>Cancelar</Button>
              <Button type="button" variant={confirmar ? 'primary' : 'danger'} onClick={aplicar} isLoading={saving}>
                {confirmar ? 'Sí, activar' : 'Sí, desactivar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default SuplenciaTesoreria;
