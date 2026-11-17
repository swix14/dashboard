import React from 'react';
import { Mail, Sparkles } from 'lucide-react';
import { DIRECTIVA_OFICIAL } from '../../utils/directiva.js';

/** Contactos de la directiva en el portal (datos en utils/directiva.js). */
export function DirectivaOficial() {
  return (
    <section className="sp-card sp-directiva" aria-labelledby="sp-directiva-titulo">
      <div className="sp-directiva-head">
        <h2 id="sp-directiva-titulo">
          <Sparkles size={18} aria-hidden="true" /> Directiva oficial de la Asociación
        </h2>
        <span>Canales oficiales de representación institucional</span>
      </div>
      <ul className="sp-directiva-grid">
        {DIRECTIVA_OFICIAL.map((dir) => (
          <li key={dir.correo} className="sp-dir" style={{ borderLeftColor: dir.borderVar }}>
            <span
              className="sp-dir-avatar"
              aria-hidden="true"
              style={{ background: dir.bgVar, color: dir.textVar, borderColor: dir.borderVar }}
            >
              {dir.nombre.charAt(0)}
            </span>
            <div className="sp-dir-body">
              <span className="sp-dir-nombre">{dir.nombre}</span>
              <span className="sp-dir-cargo" style={{ background: dir.bgVar, color: dir.textVar, borderColor: dir.borderVar }}>
                {dir.cargo}
              </span>
              <a className="sp-dir-correo" href={`mailto:${dir.correo}`}>
                <Mail size={13} aria-hidden="true" />
                {dir.correo}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default DirectivaOficial;
