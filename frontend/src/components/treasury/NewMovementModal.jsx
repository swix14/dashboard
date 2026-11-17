import React, { useEffect, useState } from 'react';
import { AlertCircle, FileText, Upload, X } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { TreasuryApiService } from '../../services/treasuryService.js';
import { formatFileSize } from '../../utils/formatters.js';

const COMPROBANTE_MAX_MB = 5;
const COMPROBANTE_TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

// Fecha de hoy en Chile al abrir el modal (toISOString usa UTC: desde las 21:00 daba el día siguiente)
const hoyChile = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

const initialForm = () => ({
  fecha: hoyChile(),
  monto: '',
  metodo: 'Transferencia Bancaria',
  descripcion: '',
  centroCosto: 'ASOCIACION',
  categoria: 'ASOCIACION',
  archivoComprobante: null
});

const DESCRIPCION_FEDERACION = 'Cuota Federación Nacional VTF';

/** Pestaña que corresponde a un movimiento existente */
const tabDe = (mov) => (mov.centroCosto === 'FEDERACION' ? 'FEDERACION' : mov.tipo);

/**
 * Modal modular para registrar un movimiento nuevo o corregir uno existente.
 * movement = null → alta; movement = fila del libro → edición (el tipo no cambia;
 * el comprobante nuevo es opcional y reemplaza al anterior).
 */
export function NewMovementModal({ isOpen, onClose, onSuccess, user, movement = null }) {
  const editing = Boolean(movement);
  const [modalTab, setModalTab] = useState('INGRESO'); // INGRESO | EGRESO | FEDERACION
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Al abrir en modo edición se cargan los datos del movimiento
  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    if (movement) {
      setModalTab(tabDe(movement));
      setFormData({
        fecha: movement.fecha,
        monto: String(movement.monto),
        metodo: movement.metodo,
        descripcion: movement.descripcion,
        centroCosto: movement.centroCosto,
        categoria: movement.categoria,
        archivoComprobante: null
      });
    } else {
      setModalTab('INGRESO');
      setFormData(initialForm());
    }
  }, [isOpen, movement]);

  if (!isOpen) return null;

  const handleTabChange = (tab) => {
    setModalTab(tab);
    setFormError(null);
    // La descripción automática de Federación no debe quedar al pasar a Ingreso o Egreso;
    // si la tesorera la escribió a mano, se respeta.
    const sinDescripcionFederacion = (prev) =>
      prev.descripcion === DESCRIPCION_FEDERACION ? '' : prev.descripcion;
    if (tab === 'INGRESO') {
      setFormData((prev) => ({
        ...prev,
        centroCosto: 'ASOCIACION',
        categoria: 'ASOCIACION',
        descripcion: sinDescripcionFederacion(prev)
      }));
    } else if (tab === 'EGRESO') {
      setFormData((prev) => ({
        ...prev,
        centroCosto: 'CENA ANUAL',
        categoria: 'S.O.S',
        descripcion: sinDescripcionFederacion(prev)
      }));
    } else if (tab === 'FEDERACION') {
      setFormData((prev) => ({
        ...prev,
        centroCosto: 'FEDERACION',
        categoria: 'PAGO FEDERACION',
        descripcion: prev.descripcion.trim() ? prev.descripcion : DESCRIPCION_FEDERACION
      }));
    }
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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

  const handleSubmit = async (e) => {
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

    const isEgresoType = modalTab === 'EGRESO' || modalTab === 'FEDERACION';
    // Al editar, el egreso conserva su comprobante si no se adjunta uno nuevo
    const tieneRespaldo = formData.archivoComprobante || (editing && movement.comprobante);
    if (isEgresoType && !tieneRespaldo) {
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

      const datos = {
        fecha: formData.fecha,
        descripcion: formData.descripcion,
        centroCosto: payloadCentroCosto,
        categoria: payloadCategoria,
        monto: numMonto,
        metodo: formData.metodo,
        archivoComprobante: formData.archivoComprobante
      };
      let mensaje = 'Movimiento registrado.';
      if (editing) {
        mensaje = (await TreasuryApiService.updateMovement(movement.id, datos)).message;
      } else {
        await TreasuryApiService.createMovement({ ...datos, tipo: modalTab === 'INGRESO' ? 'INGRESO' : 'EGRESO' });
      }

      setFormData(initialForm());
      onSuccess(mensaje);
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error al registrar movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={editing ? `Editar movimiento ${movement.correlativo}` : 'Registrar Nuevo Movimiento'}
      subtitle={
        editing
          ? `${movement.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'} · el tipo no se cambia: si está mal, anúlelo y regístrelo de nuevo`
          : `Operador: ${user?.firstName || ''} ${user?.lastName || ''} (${user?.cargo || 'Tesorera'})`
      }
      onClose={onClose}
      maxWidth="560px"
    >
      {/* Pestañas de Tipo de Movimiento (al editar, el tipo queda fijo) */}
      <div
        style={{
          display: editing ? 'none' : 'flex',
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
              ) : editing && movement.comprobante ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Se mantiene: {movement.comprobante} (adjunte otro para reemplazarlo)
                </span>
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
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Confirmar y Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default NewMovementModal;
