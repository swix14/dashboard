import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Save, Search, X } from 'lucide-react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { CreditoApiService } from '../../services/creditoService.js';
import { SociaApiService } from '../../services/sociaService.js';
import { formatCurrencyCLP } from '../../utils/formatters.js';
import { EMPRESAS, MESES, mesActualInput } from './creditoLabels.js';

const VACIO = {
  empresa: 'SOS',
  numeroCredito: '',
  valorCuota: '',
  totalCuotas: '',
  primeraCuota: mesActualInput(),
  cuotasPagadas: '0',
  montoOtorgado: '',
  fechaOtorgamiento: ''
};

const nombreSocia = (s) => [s.nombres, s.apellidoPaterno, s.apellidoMaterno].filter(Boolean).join(' ');

/** Mes AAAA-MM desplazado n meses, como texto "Marzo 2027" */
function mesMas(aaaamm, n) {
  const [a, m] = aaaamm.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${MESES[t % 12]} ${Math.floor(t / 12)}`;
}

/** Buscador de socias del padrón: escribe nombre o RUT y elige de la lista */
function SociaPicker({ value, onChange }) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) {
      setResultados([]);
      return undefined;
    }
    let cancelado = false;
    const t = setTimeout(() => {
      setBuscando(true);
      SociaApiService.getSocias({ search: q, limit: 8 })
        .then((r) => !cancelado && setResultados(r.items.filter((s) => s.estado !== 'RETIRADA')))
        .catch(() => !cancelado && setResultados([]))
        .finally(() => !cancelado && setBuscando(false));
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [texto]);

  if (value) {
    return (
      <div className="cred-socia-elegida">
        <div>
          <div className="cred-row-name">{nombreSocia(value)}</div>
          <div className="cred-muted">RUT {value.rut}</div>
        </div>
        <Button type="button" variant="outline" size="sm" icon={X} onClick={() => onChange(null)}>Cambiar</Button>
      </div>
    );
  }

  return (
    <div className="cred-socia-picker">
      <div className="cred-search-box">
        <Search size={16} aria-hidden="true" />
        <input
          id="cred-form-socia"
          className="vtf-input"
          placeholder="Nombre o RUT de la socia"
          value={texto}
          maxLength={100}
          autoComplete="off"
          autoFocus
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      {texto.trim().length >= 2 && (
        <ul className="cred-socia-lista" role="listbox" aria-label="Socias encontradas">
          {buscando && resultados.length === 0 && <li className="cred-muted cred-socia-vacio">Buscando…</li>}
          {!buscando && resultados.length === 0 && <li className="cred-muted cred-socia-vacio">Sin coincidencias en el padrón.</li>}
          {resultados.map((s) => (
            <li key={s.id}>
              <button type="button" role="option" aria-selected="false" onClick={() => onChange(s)}>
                <span className="cred-row-name">{nombreSocia(s)}</span>
                <span className="cred-muted">{s.rut}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Campo({ id, label, hint, children }) {
  return (
    <div className="cred-campo">
      <label className="vtf-label" htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="cred-hint">{hint}</span>}
    </div>
  );
}

/**
 * Nuevo crédito o edición de uno vigente, sin pasar por la planilla Excel.
 * credito = null → nuevo; credito = ficha → edición (solo cambian las cuotas pendientes).
 */
export function CreditoFormModal({ open, credito = null, onClose, onSaved }) {
  const editando = Boolean(credito);
  const [socia, setSocia] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSocia(null);
    setForm(
      credito
        ? {
            ...VACIO,
            empresa: credito.empresa,
            numeroCredito: credito.numeroCredito || '',
            valorCuota: String(credito.montoCuota),
            totalCuotas: String(credito.totalCuotas),
            montoOtorgado: String(credito.montoOtorgado || '')
          }
        : VACIO
    );
  }, [open, credito]);

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const esIsimundo = form.empresa === 'ISIMUNDO';
  const total = Number(form.totalCuotas) || 0;
  const valor = Number(form.valorCuota) || 0;
  const pagadas = Number(form.cuotasPagadas) || 0;

  const resumen = useMemo(() => {
    if (editando || !total || !valor || !form.primeraCuota) return null;
    return `${total} cuotas de ${formatCurrencyCLP(valor)}, de ${mesMas(form.primeraCuota, 0)} a ${mesMas(form.primeraCuota, total - 1)}` +
      (pagadas === 1 ? '; la primera queda como descontada.' : pagadas > 1 ? `; las primeras ${pagadas} quedan como descontadas.` : '.');
  }, [editando, total, valor, pagadas, form.primeraCuota]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editando && !socia) return setError('Seleccione la socia.');
    if (esIsimundo && !form.numeroCredito.trim()) return setError('ISIMUNDO requiere el N° de crédito.');
    try {
      setGuardando(true);
      setError(null);
      const datos = {
        numeroCredito: form.numeroCredito.trim() || null,
        valorCuota: form.valorCuota,
        totalCuotas: form.totalCuotas,
        montoOtorgado: form.montoOtorgado
      };
      const res = editando
        ? await CreditoApiService.editarCredito(credito.id, datos)
        : await CreditoApiService.crearCredito({
            ...datos,
            sociaId: socia.id,
            empresa: form.empresa,
            primeraCuota: form.primeraCuota,
            cuotasPagadas: form.cuotasPagadas || 0,
            fechaOtorgamiento: form.fechaOtorgamiento
          });
      onSaved(res.data?.id ?? credito?.id, res.message);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'No fue posible guardar el crédito.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      title={editando ? 'Editar crédito' : 'Nuevo crédito'}
      subtitle={editando ? `${credito.socia} · ${credito.empresaNombre}` : 'Ingreso manual, sin planilla Excel'}
      onClose={onClose}
      maxWidth="620px"
    >
      <form onSubmit={handleSubmit} className="cred-modal-body" noValidate>
        {error && (
          <div className="com-alert com-alert-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!editando && (
          <Campo id="cred-form-socia" label="Socia">
            <SociaPicker value={socia} onChange={(s) => { setSocia(s); setError(null); }} />
          </Campo>
        )}

        <div className="cred-form-grid">
          {!editando && (
            <Campo id="cred-form-empresa" label="Empresa">
              <select id="cred-form-empresa" className="vtf-input" value={form.empresa} onChange={set('empresa')}>
                {EMPRESAS.map((e) => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
              </select>
            </Campo>
          )}
          <Campo id="cred-form-numero" label={esIsimundo ? 'N° de crédito' : 'N° de crédito (opcional)'}>
            <input id="cred-form-numero" className="vtf-input" value={form.numeroCredito} maxLength={40} onChange={set('numeroCredito')} />
          </Campo>
          <Campo id="cred-form-valor" label="Valor cuota">
            <input id="cred-form-valor" className="vtf-input" type="number" inputMode="numeric" min="1" step="1" required value={form.valorCuota} onChange={set('valorCuota')} />
          </Campo>
          <Campo id="cred-form-total" label="Total de cuotas" hint={editando ? `Mínimo ${credito.cuotasPagadas || 1}: las ya pagadas no se tocan.` : null}>
            <input id="cred-form-total" className="vtf-input" type="number" inputMode="numeric" min="1" max="120" step="1" required value={form.totalCuotas} onChange={set('totalCuotas')} />
          </Campo>
          {!editando && (
            <>
              <Campo id="cred-form-primera" label="Mes de la primera cuota">
                <input id="cred-form-primera" className="vtf-input" type="month" required value={form.primeraCuota} onChange={set('primeraCuota')} />
              </Campo>
              <Campo id="cred-form-pagadas" label="Cuotas ya pagadas" hint="Si el crédito viene de antes.">
                <input id="cred-form-pagadas" className="vtf-input" type="number" inputMode="numeric" min="0" step="1" value={form.cuotasPagadas} onChange={set('cuotasPagadas')} />
              </Campo>
            </>
          )}
          <Campo id="cred-form-monto" label="Monto otorgado (opcional)" hint="Si se deja vacío: valor cuota × cuotas.">
            <input id="cred-form-monto" className="vtf-input" type="number" inputMode="numeric" min="0" step="1" value={form.montoOtorgado} onChange={set('montoOtorgado')} />
          </Campo>
          {!editando && (
            <Campo id="cred-form-fecha" label="Fecha de otorgamiento (opcional)">
              <input id="cred-form-fecha" className="vtf-input" type="date" value={form.fechaOtorgamiento} onChange={set('fechaOtorgamiento')} />
            </Campo>
          )}
        </div>

        {resumen && <p className="cred-form-resumen">{resumen}</p>}
        {editando && (
          <p className="cred-form-resumen">
            Solo cambian las cuotas pendientes. Si sube el total, las nuevas cuotas se agregan al final, mes a mes.
          </p>
        )}

        <div className="cred-actions">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" icon={Save} isLoading={guardando}>
            {editando ? 'Guardar cambios' : 'Ingresar crédito'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CreditoFormModal;
