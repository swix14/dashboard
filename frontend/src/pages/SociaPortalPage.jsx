import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, LifeBuoy, Mailbox, Newspaper, School } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { ProfileMenu } from '../components/layout/ProfileMenu.jsx';
import { SociaChangePasswordModal } from '../components/auth/SociaChangePasswordModal.jsx';
import { DirectivaOficial } from '../components/portal/DirectivaOficial.jsx';
import { NoticiasSocia } from '../components/portal/NoticiasSocia.jsx';
import { BuzonSocia } from '../components/portal/BuzonSocia.jsx';
import { SosSocia } from '../components/portal/SosSocia.jsx';
import { MiJardin } from '../components/portal/MiJardin.jsx';
import { CARGO_LABELS } from '../components/socias/sociaLabels.js';

/**
 * Portal de socias (V5): cabecera, directiva, identificación, menú y la sección activa.
 * Cada sección vive en components/portal/. En celular el menú queda arriba como pestañas
 * y la directiva baja al final (ver .sp-* en index.css).
 */
export function SociaPortalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [seccion, setSeccion] = useState('noticias'); // noticias | buzon | sos | jardin

  const cerrarSesion = async () => {
    await logout();
    navigate('/socia/login', { replace: true });
  };

  // Al cambiar de sección en celular, se vuelve al menú para ver el contenido desde arriba
  const irA = (destino) => {
    setSeccion(destino);
    const nav = document.getElementById('sp-nav');
    if (nav && nav.getBoundingClientRect().top < 0) nav.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  // label = [texto completo, texto corto para celular]
  const navBtn = (id, [largo, corto], Icon, className = 'sp-nav-btn', extra = null) => (
    <button
      type="button"
      onClick={() => irA(id)}
      aria-current={seccion === id ? 'page' : undefined}
      aria-label={largo}
      className={`${className}${seccion === id ? ' is-active' : ''}`}
    >
      <Icon size={18} aria-hidden="true" />
      <span aria-hidden="true">
        <span className="sp-nav-largo">{largo}</span>
        <span className="sp-nav-corto">{corto}</span>
      </span>
      {extra}
    </button>
  );

  return (
    <div className="sp-page">
      <header className="sp-header">
        <div className="sp-header-inner">
          <div className="sp-brand">
            <img src="/logo-vtf.png" alt="" />
            <div className="sp-brand-text">
              <div className="sp-brand-title">
                <h1>Asociación VTF Temuco</h1>
                <span className="sp-brand-tag">Portal de socias</span>
              </div>
              <p>Avisos gremiales, buzón directo y S.O.S en línea</p>
            </div>
          </div>
          <ProfileMenu
            subtitle={`Socia • ${user?.jardin || 'Sin jardín'}`}
            onLogout={cerrarSesion}
            renderPasswordModal={(onClose) => <SociaChangePasswordModal onClose={onClose} />}
          />
        </div>
      </header>

      <div className="sp-container">
        <DirectivaOficial />

        <section className="sp-card sp-identidad" aria-label="Sus datos">
          <span className="sp-identidad-avatar" aria-hidden="true">{user?.firstName?.charAt(0) || 'S'}</span>
          <div className="sp-identidad-body">
            <div className="sp-identidad-nombre">
              <h2>{`${user?.firstName || 'Socia'} ${user?.lastName || ''}`.trim()}</h2>
              <Badge variant="success">Socia activa</Badge>
            </div>
            <ul className="sp-identidad-datos">
              <li><strong>RUT:</strong> {user?.rut || 'Sin registrar'}</li>
              <li>
                <Building2 size={14} aria-hidden="true" /> <strong>Jardín:</strong> {user?.jardin || 'Sin jardín asignado'}
              </li>
              {user?.cargo && <li><strong>Cargo:</strong> {CARGO_LABELS[user.cargo] || user.cargo}</li>}
            </ul>
          </div>
        </section>

        <div className="sp-layout">
          <nav id="sp-nav" className="sp-card sp-nav" aria-label="Secciones del portal">
            <span className="sp-nav-label">Menú</span>
            {navBtn('noticias', ['Noticias y avisos', 'Noticias'], Newspaper)}
            {navBtn('buzon', ['Buzón de socias', 'Buzón'], Mailbox)}
            {navBtn('sos', ['Pide tu S.O.S', 'S.O.S'], LifeBuoy, 'sos-nav')}
            {/* Solo la socia marcada como delegada en el padrón; el backend lo verifica en cada consulta */}
            {user?.esDelegada &&
              navBtn('jardin', ['Mi jardín', 'Mi jardín'], School, 'mj-nav', <span className="mj-nav-tag" aria-hidden="true">Delegada</span>)}
          </nav>

          <main className="sp-main">
            {seccion === 'noticias' && <NoticiasSocia />}
            {seccion === 'buzon' && <BuzonSocia user={user} />}
            {seccion === 'sos' && <SosSocia user={user} onDone={() => irA('noticias')} />}
            {seccion === 'jardin' && user?.esDelegada && <MiJardin />}
          </main>
        </div>
      </div>
    </div>
  );
}

export default SociaPortalPage;
