/**
 * Documentos PDF institucionales (pdfkit): encabezado con logo, título, tablas con salto de
 * página y pie con quién lo emitió, fecha y número de página.
 * Lo usan el resumen de créditos de una socia y, más adelante, el Balance Anual (V7).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const LOGO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/logo-vtf.png');

// Paleta sobria acorde a la app (morado institucional) y legible en impresión en blanco y negro
export const COLOR = {
  primario: '#5b4468',
  texto: '#24212a',
  suave: '#6b6475',
  linea: '#d9d3de',
  fondo: '#f4f0f6'
};

const MARGEN = 50;

/** $1.234.567 */
export const clp = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;

/** Fecha y hora actuales en Chile, ej. "17-11-2026 15:42" */
export function ahoraChile() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

/**
 * Documento tamaño carta con el encabezado de la Asociación.
 * @param {{titulo: string, subtitulo?: string, emitidoPor: string}} opciones
 */
export function crearDocumento({ titulo, subtitulo, emitidoPor }) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: MARGEN, bottom: MARGEN + 20, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: { Title: titulo, Author: 'Asociación de Jardines VTF Temuco', Creator: 'Sistema de Gestión VTF' }
  });
  doc._vtf = { emitidoPor, emitidoAt: ahoraChile() };

  const ancho = doc.page.width - MARGEN * 2;
  const top = MARGEN;
  if (fs.existsSync(LOGO)) doc.image(LOGO, MARGEN, top, { width: 46 });
  doc.fillColor(COLOR.primario).font('Helvetica-Bold').fontSize(13).text('Asociación de Jardines VTF Temuco', MARGEN + 58, top + 6, { width: ancho - 58 });
  doc.fillColor(COLOR.suave).font('Helvetica').fontSize(9).text('Jardines Infantiles VTF de Temuco y Labranza', MARGEN + 58, top + 24, { width: ancho - 58 });
  doc.moveTo(MARGEN, top + 58).lineTo(MARGEN + ancho, top + 58).lineWidth(1).strokeColor(COLOR.primario).stroke();

  doc.y = top + 74;
  doc.x = MARGEN;
  doc.fillColor(COLOR.texto).font('Helvetica-Bold').fontSize(16).text(titulo, { width: ancho });
  if (subtitulo) doc.moveDown(0.2).fillColor(COLOR.suave).font('Helvetica').fontSize(10).text(subtitulo, { width: ancho });
  doc.moveDown(1);
  return doc;
}

/** Bloque de datos clave: pares etiqueta/valor en columnas */
export function datos(doc, pares, columnas = 2) {
  const ancho = doc.page.width - MARGEN * 2;
  const colAncho = ancho / columnas;
  const filas = Math.ceil(pares.length / columnas);
  const alto = filas * 30 + 12;
  const y0 = doc.y;
  doc.roundedRect(MARGEN, y0, ancho, alto, 6).fill(COLOR.fondo);
  pares.forEach(([etiqueta, valor], i) => {
    const x = MARGEN + 12 + (i % columnas) * colAncho;
    const y = y0 + 8 + Math.floor(i / columnas) * 30;
    doc.fillColor(COLOR.suave).font('Helvetica-Bold').fontSize(7.5).text(etiqueta.toUpperCase(), x, y, { width: colAncho - 20, characterSpacing: 0.4 });
    doc.fillColor(COLOR.texto).font('Helvetica').fontSize(10.5).text(String(valor ?? '—'), x, y + 11, { width: colAncho - 20, ellipsis: true, lineBreak: false });
  });
  doc.x = MARGEN;
  doc.y = y0 + alto + 16;
}

/** Título de sección */
export function seccion(doc, texto) {
  // Un título no queda solo al final de la página: si no caben al menos unas filas, pasa a la siguiente
  if (doc.y > doc.page.height - doc.page.margins.bottom - 90) doc.addPage();
  doc.x = MARGEN;
  doc.fillColor(COLOR.primario).font('Helvetica-Bold').fontSize(11).text(texto);
  doc.moveDown(0.4);
}

/**
 * Tabla simple con encabezado repetido al cambiar de página.
 * @param {{titulo: string, ancho: number, align?: 'left'|'right'|'center'}[]} columnas - anchos relativos
 * @param {(string|number)[][]} filas
 * @param {{totales?: (string|number)[]}} opciones - fila final destacada
 */
export function tabla(doc, columnas, filas, { totales } = {}) {
  const ancho = doc.page.width - MARGEN * 2;
  const suma = columnas.reduce((s, c) => s + c.ancho, 0);
  const cols = columnas.map((c) => ({ ...c, w: (c.ancho / suma) * ancho }));
  const PAD = 6;

  const dibujarFila = (celdas, { encabezado = false, destacada = false, par = false } = {}) => {
    const fuente = () => doc.font(encabezado || destacada ? 'Helvetica-Bold' : 'Helvetica').fontSize(encabezado ? 8 : 9.5);
    fuente();
    const alto = Math.max(...celdas.map((v, i) => doc.heightOfString(String(v ?? ''), { width: cols[i].w - PAD * 2 }))) + PAD * 2;
    if (doc.y + alto > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      if (!encabezado) dibujarFila(cols.map((c) => c.titulo.toUpperCase()), { encabezado: true });
      // El encabezado repetido cambia la fuente: se restaura la de esta fila
      fuente();
    }
    const y = doc.y;
    if (encabezado) doc.rect(MARGEN, y, ancho, alto).fill(COLOR.primario);
    else if (destacada) doc.rect(MARGEN, y, ancho, alto).fill(COLOR.fondo);
    else if (par) doc.rect(MARGEN, y, ancho, alto).fill('#faf8fb');
    let x = MARGEN;
    celdas.forEach((v, i) => {
      doc.fillColor(encabezado ? '#ffffff' : COLOR.texto)
        .text(String(v ?? ''), x + PAD, y + PAD, { width: cols[i].w - PAD * 2, align: cols[i].align || 'left' });
      x += cols[i].w;
    });
    doc.moveTo(MARGEN, y + alto).lineTo(MARGEN + ancho, y + alto).lineWidth(0.5).strokeColor(COLOR.linea).stroke();
    doc.y = y + alto;
  };

  dibujarFila(cols.map((c) => c.titulo.toUpperCase()), { encabezado: true });
  filas.forEach((f, i) => dibujarFila(f, { par: i % 2 === 1 }));
  if (totales) dibujarFila(totales, { destacada: true });
  doc.x = MARGEN;
  doc.moveDown(1);
}

/** Párrafo de nota en gris */
export function nota(doc, texto) {
  doc.x = MARGEN;
  doc.fillColor(COLOR.suave).font('Helvetica').fontSize(8.5).text(texto, { width: doc.page.width - MARGEN * 2 });
}

/** Cierra el documento con el pie en cada página y entrega el PDF como Buffer */
export function finalizar(doc) {
  return new Promise((resolve, reject) => {
    const partes = [];
    doc.on('data', (c) => partes.push(c));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const { start, count } = doc.bufferedPageRange();
    for (let i = start; i < start + count; i++) {
      doc.switchToPage(i);
      const y = doc.page.height - MARGEN;
      const ancho = doc.page.width - MARGEN * 2;
      // Sin margen inferior temporal: escribir en el pie no debe crear páginas nuevas
      const margenInferior = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.moveTo(MARGEN, y - 6).lineTo(MARGEN + ancho, y - 6).lineWidth(0.5).strokeColor(COLOR.linea).stroke();
      doc.fillColor(COLOR.suave).font('Helvetica').fontSize(7.5)
        .text(`Emitido por ${doc._vtf.emitidoPor} el ${doc._vtf.emitidoAt} · Documento interno de la Asociación`, MARGEN, y, { width: ancho - 80, lineBreak: false });
      doc.text(`Página ${i - start + 1} de ${count}`, MARGEN + ancho - 80, y, { width: 80, align: 'right', lineBreak: false });
      doc.page.margins.bottom = margenInferior;
    }
    doc.end();
  });
}
