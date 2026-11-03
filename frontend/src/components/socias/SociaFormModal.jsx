import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowRightLeft } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { SociaApiService } from '../../services/sociaService.js';
import { validateRut, formatRut } from '../../utils/rut.js';

const EMPTY_FORM = {
  rut: '',
  firstName: '',
  lastName: '',
  cargo: 'EDUCADORA',
  estado: 'ACTIVA',
  jardinId: '',
  motivoTraslado: ''
};

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  marginBottom: '0.375rem'
};

/**
 * Modal modular para incorporación y edición de ficha de socia
 */
export function SociaFormModal({ formMode, editing, jardines, onClose, onSuccess }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (formMode === 'edit' && editing) {
      setFormData({
        rut: editing.rut,
        firstName: editing.firstName,
        lastName: editing.lastName,
        cargo: editing.cargo,
        estado: editing.estado,
        jardinId: editing.jardin?.id || (jardines[0]?.id || ''),
        motivoTraslado: ''
      });
    } else if (formMode === 'create') {
      setFormData({
        ...EMPTY_FORM,
        jardinId: jardines[0]?.id || ''
      });
    }
    setFormError(null);
  }, [formMode, editing, jardines]);

  if (!formMode) return null;

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
      onSuccess();
      onClose();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error al guardar la socia');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={formMode === 'create' ? 'Incorporar Nueva Socia' : 'Editar Ficha de Socia'}
      subtitle={formMode === 'edit' ? `RUT ${editing?.rut}` : 'Los cambios quedan registrados en la bitácora de auditoría'}
      onClose={onClose}
      maxWidth="560px"
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
              <option value="ASISTENTE">Asistente</option>
              <option value="AUXILIAR">Auxiliar</option>
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
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : formMode === 'create' ? 'Incorporar Socia' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default SociaFormModal;
