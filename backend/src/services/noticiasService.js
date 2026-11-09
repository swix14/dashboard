import { isDatabaseReady, query } from '../config/db.js';
import { hoyChile } from '../utils/fecha.js';

const INITIAL_NOTICIAS = [
  {
    id: 1,
    titulo: 'Aporte Gremial Federación Octubre 2026 al Día',
    contenido: 'Informamos a todas nuestras socias que el aporte gremial nacional correspondiente al mes de Octubre de 2026 ha sido transferido satisfactoriamente a la Federación Nacional VTF por un monto de $280.000 CLP con comprobante respaldado en Tesorería.',
    categoria: 'FEDERACION',
    fecha: '2026-10-02',
    destacado: 1,
    autor: 'Tesorera General VTF'
  },
  {
    id: 2,
    titulo: 'Liquidación de Créditos y Convenio Isi Mundo',
    contenido: 'Se ha completado la conciliación y liquidación del convenio Isi Mundo con el abono del 2% de comisión a los fondos de la Asociación. Las socias con cuotas vigentes mantienen sus estados actualizados.',
    categoria: 'CONVENIO',
    fecha: '2026-10-04',
    destacado: 0,
    autor: 'Directiva VTF'
  },
  {
    id: 3,
    titulo: 'Comunicado Gremial: Concesión de Día Libre y Asamblea',
    contenido: 'Estimadas socias: Recordamos los acuerdos alcanzados para el ejercicio del día libre institucional y los puntos de tabla para la próxima asamblea general extraordinaria.',
    categoria: 'COMUNICADO',
    fecha: '2026-10-10',
    destacado: 1,
    autor: 'Presidencia VTF'
  }
];

export const NoticiasService = {
  /**
   * Obtiene la lista de noticias publicadas
   */
  async getNoticias() {
    // Con base de datos se muestra lo que hay en ella, aunque esté vacía (antes reaparecían
    // las noticias de ejemplo al borrar todas).
    if (isDatabaseReady()) {
      return query(
        `SELECT id, titulo, contenido, categoria, DATE_FORMAT(fecha_publicacion, '%Y-%m-%d') as fecha, destacado, autor, created_at
         FROM noticias
         ORDER BY destacado DESC, fecha_publicacion DESC, id DESC`
      );
    }
    return INITIAL_NOTICIAS;
  },

  /**
   * Permite al Administrador o Directiva publicar una nueva noticia
   */
  async createNoticia({ titulo, contenido, categoria, fechaPublicacion, destacado, autor }) {
    if (!titulo || !contenido) {
      throw new Error('El título y contenido de la noticia son obligatorios.');
    }

    const fecha = fechaPublicacion || hoyChile();
    const autorNombre = autor || 'Directiva VTF';
    const esDestacado = destacado ? 1 : 0;
    const cat = categoria || 'COMUNICADO';

    if (isDatabaseReady()) {
      const result = await query(
        `INSERT INTO noticias (titulo, contenido, categoria, fecha_publicacion, destacado, autor)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [titulo.trim(), contenido.trim(), cat, fecha, esDestacado, autorNombre]
      );
      return { id: result.insertId, titulo, contenido, categoria: cat, fecha, destacado: esDestacado, autor: autorNombre };
    }

    const newNoticia = {
      id: Date.now(),
      titulo,
      contenido,
      categoria: cat,
      fecha,
      destacado: esDestacado,
      autor: autorNombre
    };
    INITIAL_NOTICIAS.unshift(newNoticia);
    return newNoticia;
  }
};

