import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowRightLeft } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { SociaApiService } from '../../services/sociaService.js';
import { validateRut, formatRut } from '../../utils/rut.js';
import { CARGOS, labelStyle } from './sociaLabels.js';

const EMPTY_FORM = {
  rut: '',
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  cargo: 'EDUCADORA',
  estado: 'ACTIVA',
  jardinId: '',
  celular: '',
  correo: '',
  fechaIngreso: '',
  esDelegada: false,
  motivoTraslado: ''
};

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Modal de incorporación y edición de la ficha de socia.
 * Una socia nueva entra ACTIVA por defecto; el RUT no se puede cambiar después.
 */
export function SociaFormModal({ formMode, editing, jardines, onClose, onSuccess }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (formMode === 'edit' && editing) {
      setFormData({
        rut: editing.rut,
        nombres: editing.nombres || '',
        apellidoPaterno: editing.apellidoPaterno || '',
        apellidoMaterno: editing.apellidoMaterno || '',
        cargo: editing.cargo || 'SIN DATO',
        estado: editing.estado,
        jardinId: editing.jardin?.id ? String(editing.jardin.id) : '',
        celular: editing.celular || '',
        correo: editing.correo || '',
        fechaIngreso: editing.fechaIngreso || '',
        esDelegada: Boolean(editing.esDelegada),
        motivoTraslado: ''
      });
    } else if (formMode === 'create') {
      setFormData({ ...EMPTY_FORM, fechaIngreso: hoy() });
    }
    setFormError(null);
  }, [formMode, editing]);

  if (!formMode) return null;

  const set = (field) => (e) =>
    setFormData({ ...formData, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const jardinAnteriorId = editing?.jardin?.id ? String(editing.jardin.id) : '';
  // Cambiar de un jardín a otro es un traslado (pide motivo); asignar a quien no tenía, no
  const isTransfer = formMode === 'edit' && jardinAnteriorId && formData.jardinId !== jardinAnteriorId;
  const isRetirada = editing?.estado === 'RETIRADA';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (formMode === 'create' && !validateRut(formData.rut)) {
      setFormError('El RUT ingresado no es válido. Revise el dígito verificador.');
      return;
    }
    if (formData.nombres.trim().length < 2 || formData.apellidoPaterno.trim().length < 2) {
      setFormError('Nombres y apellido paterno son obligatorios.');
      return;
    }
    if (!formData.jardinId) {
      setFormError('Seleccione el jardín de la socia.');
      return;
    }
    if (isTransfer && formData.motivoTraslado.trim().length < 3) {
      setFormError('Indique el motivo del traslado de jardín.');
      return;
    }

    const payload = {
      nombres: formData.nombres,
      apellidoPaterno: formData.apellidoPaterno,
      apellidoMaterno: formData.apellidoMaterno,
      cargo: formData.cargo,
      estado: formData.estado === 'RETIRADA' ? undefined : formData.estado,
      jardinId: Number(formData.jardinId),
      celular: formData.celular.trim() || null,
      correo: formData.correo.trim() || null,
      fechaIngreso: formData.fechaIngreso || null
    };

    try {
      setIsSubmitting(true);
      if (formMode === 'create') {
        await SociaApiService.createSocia({ ...payload, rut: formData.rut });
      } else {
        await SociaApiService.updateSocia(editing.id, {
          ...payload,
          esDelegada: formData.esDelegada,
          ...(isTransfer && { motivoTraslado: formData.motivoTraslado })
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error al guardar la socia');
    } finally {
      setIsSubmitting(false);
    }
  };

  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' };

  return (
    <Modal
      title={formMode === 'create' ? 'Agregar Socia' : 'Editar Ficha de Socia'}
      subtitle={formMode === 'edit' ? `RUT ${editing?.rut}` : 'Los cambios quedan registrados en la bitácora de auditoría'}
      onClose={onClose}
      maxWidth="620px"
    >
      <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {formError && (
          <div
            role="alert"
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

        <div>
          <label style={labelStyle} htmlFor="socia-nombres">Nombres</label>
          <input id="socia-nombres" required value={formData.nombres} onChange={set('nombres')} className="vtf-input" />
        </div>

        <div style={grid}>
          <div>
            <label style={labelStyle} htmlFor="socia-ap-paterno">Apellido paterno</label>
            <input id="socia-ap-paterno" required value={formData.apellidoPaterno} onChange={set('apellidoPaterno')} className="vtf-input" />
          </div>
          <div>
            <label style={labelStyle} htmlFor="socia-ap-materno">Apellido materno</label>
            <input id="socia-ap-materno" value={formData.apellidoMaterno} onChange={set('apellidoMaterno')} className="vtf-input" />
          </div>
        </div>

        <div style={grid}>
          <div>
            <label style={labelStyle} htmlFor="socia-correo">Correo</label>
            <input id="socia-correo" type="email" placeholder="nombre@correo.cl" value={formData.correo} onChange={set('correo')} className="vtf-input" />
          </div>
          <div>
            <label style={labelStyle} htmlFor="socia-celular">Celular</label>
            <input id="socia-celular" type="tel" placeholder="+56912345678" value={formData.celular} onChange={set('celular')} className="vtf-input" />
          </div>
        </div>

        <div style={grid}>
          <div>
            <label style={labelStyle} htmlFor="socia-cargo">Cargo</label>
            <select id="socia-cargo" value={formData.cargo} onChange={set('cargo')} className="vtf-input">
              {CARGOS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="socia-estado">Estado</label>
            <select id="socia-estado" value={formData.estado} onChange={set('estado')} className="vtf-input">
              {isRetirada && <option value="RETIRADA" disabled>Retirada (elija un estado para reactivarla)</option>}
              <option value="ACTIVA">Activa (cuota $4.000)</option>
              <option value="SUSPENDIDA">Suspendida (sin cobro)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor="socia-ingreso">Fecha de ingreso</label>
            <input id="socia-ingreso" type="date" value={formData.fechaIngreso} onChange={set('fechaIngreso')} className="vtf-input" />
          </div>
        </div>

        <div>
          <label style={labelStyle} htmlFor="socia-jardin">Jardín</label>
          <select id="socia-jardin" value={formData.jardinId} onChange={set('jardinId')} className="vtf-input" required>
            <option value="" disabled>Seleccione un jardín…</option>
            {jardines.map((j) => (
              <option key={j.id} value={String(j.id)}>
                {j.code} · {j.name}
              </option>
            ))}
          </select>
        </div>

        {formMode === 'edit' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-main)', cursor: 'pointer' }}>
            <input type="checkbox" checked={formData.esDelegada} onChange={set('esDelegada')} />
            Delegada de su jardín ante la asamblea
          </label>
        )}

        {isTransfer && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--warning-bg)',
              border: '1px solid var(--warning-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '0.8125rem', color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600 }}>
              <ArrowRightLeft size={15} /> Traslado desde {editing.jardin?.name}
              {editing.esDelegada && ' (dejará de ser delegada de ese jardín)'}
            </span>
            <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor="socia-motivo">Motivo del traslado</label>
            <input
              id="socia-motivo"
              required
              placeholder="Ej: Cambio de establecimiento por reubicación"
              value={formData.motivoTraslado}
              onChange={set('motivoTraslado')}
              className="vtf-input"
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {formMode === 'create' ? 'Agregar Socia' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default SociaFormModal;
