import React, { useEffect, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, Newspaper } from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { api } from '../../services/api.js';
import { formatDateCLP } from '../../utils/formatters.js';

const CATEGORIAS = [
  { id: 'TODAS', label: 'Todas' },
  { id: 'FEDERACION', label: 'Federación' },
  { id: 'CONVENIO', label: 'Convenios' },
  { id: 'COMUNICADO', label: 'Comunicados' }
];

const BADGE_CATEGORIA = {
  FEDERACION: { variant: 'success', label: 'Federación Nacional' },
  CONVENIO: { variant: 'warning', label: 'Convenio Comercial' },
  COMUNICADO: { variant: 'primary', label: 'Comunicado Oficial' }
};

/** Noticias y avisos que publica la directiva, con filtro por categoría. */
export function NoticiasSocia() {
  const [noticias, setNoticias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState('TODAS');

  useEffect(() => {
    let cancelado = false;
    api
      .get('/socia/noticias')
      .then((res) => !cancelado && setNoticias(res.data?.data || []))
      .catch(() => !cancelado && setError('No fue posible cargar las noticias. Intente nuevamente en unos minutos.'))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, []);

  const visibles = categoria === 'TODAS' ? noticias : noticias.filter((n) => n.categoria?.toUpperCase() === categoria);

  let contenido;
  if (cargando) {
    contenido = <div className="sp-card sp-estado" aria-busy="true">Cargando noticias y avisos…</div>;
  } else if (error) {
    contenido = (
      <p className="sp-alerta is-error" role="alert">
        <AlertCircle size={18} aria-hidden="true" /> {error}
      </p>
    );
  } else if (visibles.length === 0) {
    contenido = (
      <div className="sp-card sp-estado">
        <Newspaper size={36} aria-hidden="true" />
        <p>{noticias.length === 0 ? 'La directiva aún no ha publicado noticias.' : 'No hay publicaciones en esta categoría.'}</p>
      </div>
    );
  } else {
    contenido = (
      <ul className="sp-noticias">
        {visibles.map((n) => {
          const badge = BADGE_CATEGORIA[n.categoria?.toUpperCase()] || BADGE_CATEGORIA.COMUNICADO;
          const destacada = Number(n.destacado) === 1;
          return (
            <li key={n.id}>
              <article className={`sp-card sp-noticia${destacada ? ' is-destacada' : ''}`}>
                <div className="sp-noticia-meta">
                  <div className="sp-noticia-badges">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    {destacada && <Badge variant="neutral">Destacado</Badge>}
                  </div>
                  {n.fecha && (
                    <time dateTime={n.fecha}>
                      <Calendar size={14} aria-hidden="true" /> {formatDateCLP(n.fecha)}
                    </time>
                  )}
                </div>
                <h3>{n.titulo}</h3>
                <p className="sp-noticia-texto">{n.contenido}</p>
                <div className="sp-noticia-pie">
                  <span>
                    Publicado por: <strong>{n.autor || 'Directiva VTF'}</strong>
                  </span>
                  <span>
                    <CheckCircle2 size={13} aria-hidden="true" /> Información oficial
                  </span>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="sp-seccion" aria-labelledby="sp-noticias-titulo">
      <div className="sp-card sp-seccion-head">
        <div>
          <h2 id="sp-noticias-titulo">Noticias y avisos oficiales</h2>
          <p>Transferencias a la Federación, convenios y comunicados de la directiva.</p>
        </div>
        <div className="sp-chips" role="group" aria-label="Filtrar por categoría">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`sp-chip${categoria === c.id ? ' is-active' : ''}`}
              aria-pressed={categoria === c.id}
              onClick={() => setCategoria(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {contenido}
    </section>
  );
}

export default NoticiasSocia;
