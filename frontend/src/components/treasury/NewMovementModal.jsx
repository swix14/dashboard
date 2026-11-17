import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, ScanText, Sparkles } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { ComprobanteInput, COMPROBANTE_MAX_MB, COMPROBANTE_TIPOS } from './ComprobanteInput.jsx';
import { TreasuryApiService } from '../../services/treasuryService.js';
import { leerMontoComprobante } from '../../services/lectorComprobante.js';
import { comprimirImagen } from '../../utils/comprimirImagen.js';
import { formatCurrencyCLP } from '../../utils/formatters.js';

// Estado de la lectura del monto del comprobante: idle | leyendo | leido (se llenó el campo) |
// sugerencia (ya había un monto escrito) | sinMonto | error
const LECTURA_INICIAL = { estado: 'idle', monto: null };

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

/** Aviso bajo el monto con el resultado de la lectura del comprobante */
function LecturaMonto({ lectura, montoActual, onUsar }) {
  if (lectura.estado === 'idle') return null;
  const valor = lectura.monto ? formatCurrencyCLP(lectura.monto) : '';
  // Si la tesorera cambió el monto leído, se le ofrece volver a usarlo
  const estado = lectura.estado === 'leido' && String(lectura.monto) !== String(montoActual) ? 'sugerencia' : lectura.estado;

  const contenido = {
    leyendo: (
      <>
        <Loader2 size={15} className="mov-lectura-spin" aria-hidden="true" />
        <span>Leyendo el monto del comprobante… puede seguir completando el formulario.</span>
      </>
    ),
    leido: (
      <>
        <Sparkles size={15} aria-hidden="true" />
        <span>
          Monto leído del comprobante: <strong>{valor}</strong>. Revíselo antes de guardar.
        </span>
      </>
    ),
    sugerencia: (
      <>
        <ScanText size={15} aria-hidden="true" />
        <span>
          El comprobante dice <strong>{valor}</strong>.
        </span>
        <button type="button" className="mov-lectura-usar" onClick={onUsar}>
          Usar {valor}
        </button>
      </>
    ),
    sinMonto: (
      <>
        <AlertCircle size={15} aria-hidden="true" />
        <span>No se encontró el monto en el comprobante. Ingréselo a mano.</span>
      </>
    ),
    error: (
      <>
        <AlertCircle size={15} aria-hidden="true" />
        <span>No se pudo leer el comprobante. Ingrese el monto a mano.</span>
      </>
    )
  }[estado];

  return (
    <p id="mov-monto-lectura" className={`mov-lectura is-${estado}`} role="status" aria-live="polite">
      {contenido}
    </p>
  );
}

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
  const [lectura, setLectura] = useState(LECTURA_INICIAL);
  // Cada archivo nuevo invalida la lectura anterior (si la tesorera cambia de archivo a mitad)
  const lecturaId = useRef(0);
  // Monto vigente al terminar la lectura (el closure de leerMonto quedaría desactualizado)
  const montoActual = useRef('');
  montoActual.current = formData.monto;

  // Al abrir en modo edición se cargan los datos del movimiento
  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    lecturaId.current += 1;
    setLectura(LECTURA_INICIAL);
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

  // Lee el monto en segundo plano: nunca bloquea el formulario ni guarda nada por sí sola
  const leerMonto = async (file) => {
    const id = ++lecturaId.current;
    setLectura({ estado: 'leyendo', monto: null });
    try {
      const resultado = await leerMontoComprobante(file);
      if (id !== lecturaId.current) return; // llegó otro archivo o se quitó este
      if (!resultado) {
        setLectura({ estado: 'sinMonto', monto: null });
        return;
      }
      // Solo se llena si el campo está vacío: lo escrito a mano no se pisa
      if (String(montoActual.current ?? '').trim()) {
        setLectura({ estado: 'sugerencia', monto: resultado.monto });
      } else {
        setFormData((prev) => ({ ...prev, monto: String(resultado.monto) }));
        setLectura({ estado: 'leido', monto: resultado.monto });
      }
    } catch (err) {
      if (id !== lecturaId.current) return;
      console.warn('No se pudo leer el comprobante:', err);
      setLectura({ estado: 'error', monto: null });
    }
  };

  const handleFileSelected = async (original) => {
    if (!COMPROBANTE_TIPOS.includes(original.type)) {
      setFormError('Formato de comprobante no permitido. Use PDF, JPG, PNG o WEBP.');
      return;
    }
    // Las fotos del celular se achican antes de validar el tamaño
    const file = await comprimirImagen(original);
    if (file.size > COMPROBANTE_MAX_MB * 1024 * 1024) {
      setFormError(`El comprobante supera el tamaño máximo de ${COMPROBANTE_MAX_MB} MB.`);
      return;
    }

    setFormError(null);
    setFormData((prev) => ({ ...prev, archivoComprobante: file }));
    leerMonto(file);
  };

  const quitarComprobante = () => {
    lecturaId.current += 1;
    setLectura(LECTURA_INICIAL);
    setFormData((prev) => ({ ...prev, archivoComprobante: null }));
  };

  const usarMontoLeido = () => {
    setFormData((prev) => ({ ...prev, monto: String(lectura.monto) }));
    setLectura((l) => ({ ...l, estado: 'leido' }));
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

        {/* Comprobante primero: al adjuntarlo se lee el monto y se propone abajo */}
        <ComprobanteInput
          archivo={formData.archivoComprobante}
          onSeleccion={handleFileSelected}
          onQuitar={quitarComprobante}
          obligatorio={modalTab !== 'INGRESO'}
          vacio={
            editing && movement.comprobante
              ? `Se mantiene: ${movement.comprobante} (adjunte otro para reemplazarlo)`
              : modalTab === 'INGRESO'
                ? 'Sin archivo (opcional para ingresos)'
                : `PDF, JPG, PNG o WEBP (máx. ${COMPROBANTE_MAX_MB} MB)`
          }
        />

        {/* Fila Fecha y Monto */}
        <div className="mov-fila-2">
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
            <label htmlFor="mov-monto" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
              Monto (CLP)
            </label>
            <input
              id="mov-monto"
              type="number"
              inputMode="numeric"
              required
              min="1"
              placeholder="Ej: 280000"
              value={formData.monto}
              onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              className={`vtf-input${lectura.estado === 'leido' && String(lectura.monto) === formData.monto ? ' mov-monto-leido' : ''}`}
              aria-describedby={lectura.estado !== 'idle' ? 'mov-monto-lectura' : undefined}
            />
          </div>
        </div>
        <LecturaMonto lectura={lectura} montoActual={formData.monto} onUsar={usarMontoLeido} />

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
