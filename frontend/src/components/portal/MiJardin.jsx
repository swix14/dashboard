import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeftRight, CreditCard, FileDown, FileSpreadsheet, LifeBuoy, School, Users, Wallet } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { ReporteApiService } from '../../services/reporteService.js';
import { formatCurrencyCLP } from '../../utils/formatters.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "1 retiro" / "2 retiros"
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function mesActual() {
  const [anio, mes] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date()).split('-').map(Number);
  return { anio, mes };
}

function Cifra({ icon: Icon, label, value, detalle, tono = 'primario' }) {
  return (
    <div className={`mj-cifra mj-tono-${tono}`}>
      <span className="mj-cifra-icon" aria-hidden="true"><Icon size={18} /></span>
      <span className="mj-cifra-label">{label}</span>
      <span className="mj-cifra-valor">{value}</span>
      {detalle && <span className="mj-cifra-detalle">{detalle}</span>}
    </div>
  );
}

/**
 * "Mi jardín" (V7): cifras del establecimiento para la delegada, solo totales (decisión D2:
 * sin nombres, RUT ni deudas individuales), más el informe mensual y el Balance Anual.
 */
export function MiJardin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [descarga, setDescarga] = useState(null); // 'excel' | 'pdf'
  const [errorDescarga, setErrorDescarga] = useState(null);
  const actual = mesActual();

  useEffect(() => {
    let cancelado = false;
    ReporteApiService.miJardin()
      .then((d) => !cancelado && setData(d))
      .catch((err) => !cancelado && setError(err.response?.data?.message || 'No fue posible cargar las cifras de su jardín.'));
    return () => {
      cancelado = true;
    };
  }, []);

  const descargar = async (tipo) => {
    try {
      setDescarga(tipo);
      setErrorDescarga(null);
      if (tipo === 'pdf') await ReporteApiService.descargarBalanceAnual(actual.anio);
      else await ReporteApiService.descargarInformeMensual(actual.anio, actual.mes);
    } catch (err) {
      setErrorDescarga(err.message);
    } finally {
      setDescarga(null);
    }
  };

  if (error) {
    return (
      <div className="com-alert com-alert-error" role="alert">
        <AlertCircle size={18} aria-hidden="true" />
        <span>{error}</span>
      </div>
    );
  }
  if (!data) return <div className="mj-cargando" aria-busy="true">Cargando las cifras de su jardín…</div>;

  const { jardin: j, anio, cuotaSocial } = data;
  const empresas = j.creditos.porEmpresa.filter((e) => e.socias > 0);
  const totalSos = j.sos.pendientes + j.sos.aprobadas + j.sos.rechazadas;

  return (
    <section className="mj-seccion" aria-labelledby="mj-titulo">
      <header className="mj-hero">
        <span className="mj-hero-icon" aria-hidden="true"><School size={24} /></span>
        <div style={{ minWidth: 0 }}>
          <span className="mj-hero-eyebrow">Delegada · Jardín {j.codigo}</span>
          <h2 id="mj-titulo">{j.nombre}</h2>
          <p>Cifras de su jardín para informar en la asamblea. Son totales: no incluyen nombres ni deudas de cada socia.</p>
        </div>
      </header>

      <div className="mj-grid">
        <Cifra
          icon={Users}
          label="Socias activas"
          value={j.socias.activas}
          detalle={j.socias.suspendidas ? plural(j.socias.suspendidas, 'suspendida', 'suspendidas') : 'Sin suspendidas'}
        />
        <Cifra
          icon={Wallet}
          label="Aporte mensual"
          value={formatCurrencyCLP(j.aporteMensual)}
          detalle={`Cuota social ${formatCurrencyCLP(cuotaSocial)} × ${j.socias.activas}`}
          tono="exito"
        />
        <Cifra
          icon={ArrowLeftRight}
          label={`Movimiento ${anio}`}
          value={`+${j.socias.ingresosAnio + j.socias.trasladosEntrada} / −${j.socias.retirosAnio + j.socias.trasladosSalida}`}
          detalle={[
            plural(j.socias.ingresosAnio, 'incorporación', 'incorporaciones'),
            plural(j.socias.retirosAnio, 'retiro', 'retiros'),
            `${j.socias.trasladosEntrada} ${j.socias.trasladosEntrada === 1 ? 'llega' : 'llegan'} por traslado`,
            `${j.socias.trasladosSalida} ${j.socias.trasladosSalida === 1 ? 'se va' : 'se van'}`
          ].join(' · ')}
          tono="info"
        />
        <Cifra
          icon={LifeBuoy}
          label={`Solicitudes S.O.S ${anio}`}
          value={totalSos}
          detalle={[
            plural(j.sos.aprobadas, 'aprobada', 'aprobadas'),
            `${j.sos.pendientes} en revisión`,
            plural(j.sos.rechazadas, 'rechazada', 'rechazadas')
          ].join(' · ')}
          tono="rosa"
        />
      </div>

      <div className="mj-panel">
        <div className="mj-panel-head">
          <CreditCard size={18} aria-hidden="true" />
          <h3>Créditos y convenios vigentes</h3>
          <span className="mj-panel-total">{plural(j.creditos.sociasConCredito, 'socia', 'socias')}</span>
        </div>
        {empresas.length === 0 ? (
          <p className="mj-vacio">Ninguna socia del jardín tiene créditos vigentes.</p>
        ) : (
          <ul className="mj-barras">
            {empresas.map((e) => (
              <li key={e.codigo}>
                <span className="mj-barra-nombre">{e.nombre}</span>
                <span className="mj-barra-pista" aria-hidden="true">
                  <span style={{ width: `${Math.max((e.socias / Math.max(j.socias.activas, 1)) * 100, 4)}%` }} />
                </span>
                <span className="mj-barra-valor">{e.socias}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mj-nota">Cantidad de socias con al menos un crédito vigente en cada empresa. Una socia puede tener créditos en más de una.</p>
      </div>

      <div className="mj-panel">
        <div className="mj-panel-head">
          <FileDown size={18} aria-hidden="true" />
          <h3>Documentos para la asamblea</h3>
        </div>
        <div className="mj-docs">
          <Button variant="secondary" icon={FileSpreadsheet} onClick={() => descargar('excel')} isLoading={descarga === 'excel'} disabled={Boolean(descarga)}>
            Informe de {MESES[actual.mes - 1]} (Excel)
          </Button>
          <Button variant="primary" icon={FileDown} onClick={() => descargar('pdf')} isLoading={descarga === 'pdf'} disabled={Boolean(descarga)}>
            Balance Anual {actual.anio} (PDF)
          </Button>
        </div>
        {errorDescarga && (
          <p className="mj-error" role="alert"><AlertCircle size={15} aria-hidden="true" /> {errorDescarga}</p>
        )}
      </div>
    </section>
  );
}
