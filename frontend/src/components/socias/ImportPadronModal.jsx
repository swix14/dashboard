import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { SociaApiService } from '../../services/sociaService.js';

const STAT_TONES = {
  nuevas: 'var(--success-text)',
  actualizadas: 'var(--primary-700)',
  noIncluidas: 'var(--warning-text)',
  errores: 'var(--error-text)'
};

function Stat({ label, value, tone }) {
  return (
    <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '0.75rem', minWidth: 0 }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: tone || 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function Section({ title, count, children, defaultOpen = false }) {
  if (!count) return null;
  return (
    <details open={defaultOpen} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>
        {title} ({count})
      </summary>
      <div style={{ marginTop: '0.75rem', maxHeight: '220px', overflowY: 'auto' }}>{children}</div>
    </details>
  );
}

const rowStyle = { fontSize: '0.8125rem', padding: '0.375rem 0', borderBottom: '1px solid var(--border-light)', color: 'var(--text-main)' };
const muted = { color: 'var(--text-muted)' };

/**
 * Carga mensual de la planilla "Maestra Socias": elegir archivo → vista previa → aplicar.
 * La vista previa no modifica nada; al aplicar se envía el mismo archivo.
 */
export function ImportPadronModal({ open, onClose, onApplied }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'preview' | 'apply'

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = async (e) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    reset();
    setFile(selected);
    try {
      setBusy('preview');
      setPreview(await SociaApiService.previsualizarPlanilla(selected));
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible leer la planilla.');
    } finally {
      setBusy(null);
    }
  };

  const handleApply = async () => {
    try {
      setBusy('apply');
      setError(null);
      const res = await SociaApiService.aplicarPlanilla(file);
      setResult(res);
      setPreview(null);
      onApplied?.();
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible aplicar la planilla. No se modificó el padrón.');
    } finally {
      setBusy(null);
    }
  };

  const r = preview?.resumen;
  const hayCambios = r && r.nuevas + r.actualizadas > 0;

  return (
    <Modal
      title="Cargar planilla Maestra Socias"
      subtitle="Actualiza el padrón con el Excel mensual. Primero verá los cambios; nada se guarda hasta confirmar."
      onClose={close}
      maxWidth="720px"
    >
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {!result && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              border: '2px dashed var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              cursor: busy ? 'wait' : 'pointer',
              backgroundColor: 'var(--bg-surface-subtle)'
            }}
          >
            <FileSpreadsheet size={28} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-main)', minWidth: 0 }}>
              {busy === 'preview' ? 'Leyendo planilla…' : file ? <strong style={{ overflowWrap: 'anywhere' }}>{file.name}</strong> : 'Elegir archivo .xlsx'}
              <span style={{ display: 'block', fontSize: '0.75rem', ...muted }}>
                Columnas: RUT, Apellido paterno, Apellido materno, Nombres, Cargo, Celular, Correo, Jardín
              </span>
            </span>
            <input type="file" accept=".xlsx" onChange={handleFile} disabled={Boolean(busy)} style={{ display: 'none' }} />
          </label>
        )}

        {error && (
          <div role="alert" style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-md)', color: 'var(--error-text)', fontSize: '0.8125rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {preview && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
              <Stat label="Socias nuevas" value={r.nuevas} tone={STAT_TONES.nuevas} />
              <Stat label="Con cambios" value={r.actualizadas} tone={STAT_TONES.actualizadas} />
              <Stat label="Sin cambios" value={r.sinCambios} />
              <Stat label="No vienen en la planilla" value={r.noIncluidas} tone={STAT_TONES.noIncluidas} />
              <Stat label="Filas con error" value={r.errores} tone={STAT_TONES.errores} />
            </div>

            <Section title="Socias nuevas" count={preview.nuevas.length} defaultOpen>
              {preview.nuevas.map((n) => (
                <div key={n.rut} style={rowStyle}>
                  <strong>{n.nombre}</strong> <span style={muted}>· {n.rut} · {n.jardin || 'sin jardín'} · fila {n.fila}</span>
                </div>
              ))}
            </Section>

            <Section title="Cambios en socias existentes" count={preview.actualizadas.length} defaultOpen>
              {preview.actualizadas.map((u) => (
                <div key={u.rut} style={rowStyle}>
                  <strong>{u.nombre}</strong> <span style={muted}>· {u.rut}</span>
                  <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                    {u.cambios.map((c) => (
                      <li key={c.campo}>
                        {c.campo}: <span style={muted}>{c.anterior || 'vacío'}</span> → <strong>{c.nuevo || 'vacío'}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Section>

            <Section title="No vienen en la planilla (no se dan de baja)" count={preview.noIncluidas.length}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', ...muted }}>
                Revíselas y, si corresponde, retírelas manualmente desde el padrón.
              </p>
              {preview.noIncluidas.map((s) => (
                <div key={s.rut} style={rowStyle}>
                  {s.nombre} <span style={muted}>· {s.rut} · {s.jardin || 'sin jardín'}</span>
                </div>
              ))}
            </Section>

            <Section title="Retiradas que aparecen en la planilla" count={preview.retiradasEnPlanilla.length}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', ...muted }}>Siguen retiradas; edítelas si deben reactivarse.</p>
              {preview.retiradasEnPlanilla.map((s) => (
                <div key={s.rut} style={rowStyle}>{s.nombre} <span style={muted}>· {s.rut}</span></div>
              ))}
            </Section>

            <Section title="Filas con error (no se cargan)" count={preview.errores.length} defaultOpen>
              {preview.errores.map((e) => (
                <div key={`${e.fila}-${e.rut}`} style={rowStyle}>
                  Fila {e.fila}: <strong>{e.motivo}</strong> <span style={muted}>· {e.rut || 'sin RUT'} {e.nombre}</span>
                </div>
              ))}
            </Section>

            <Section title="Avisos" count={preview.advertencias.length}>
              {preview.advertencias.map((a, i) => (
                <div key={i} style={rowStyle}>
                  Fila {a.fila}: {a.motivo} <span style={muted}>· {a.rut}</span>
                </div>
              ))}
            </Section>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button variant="primary" icon={Upload} onClick={handleApply} isLoading={busy === 'apply'} disabled={!hayCambios}>
                {hayCambios ? `Aplicar ${r.nuevas + r.actualizadas} cambios` : 'No hay cambios que aplicar'}
              </Button>
            </div>
          </>
        )}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div role="status" style={{ padding: '1rem', backgroundColor: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-md)', color: 'var(--success-text)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '0.875rem' }}>
                {result.message} La planilla quedó guardada como respaldo ({result.data.archivoGuardado}).
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={close}>
                Listo
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default ImportPadronModal;
