import { extraerMonto } from '../utils/montoComprobante.js';

/**
 * Lee el texto de un comprobante en el navegador y propone el monto pagado.
 * - PDF: texto incrustado con pdf.js (transferencias bancarias; exacto y rápido).
 * - Imagen: reconocimiento de texto (OCR) con Tesseract en español.
 * Las librerías se cargan solo al adjuntar un comprobante, y los archivos del OCR se
 * sirven desde /ocr/ del mismo sitio: el comprobante no sale del equipo de la tesorera.
 */

const OCR_BASE = `${import.meta.env.BASE_URL || '/'}ocr`;
// Detecta WebAssembly SIMD (mismos bytes que wasm-feature-detect) para usar el núcleo rápido
const SIMD_WASM = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

let workerPromesa = null;

async function obtenerWorkerOcr() {
  if (!workerPromesa) {
    workerPromesa = (async () => {
      const { createWorker } = await import('tesseract.js');
      const simd = typeof WebAssembly === 'object' && WebAssembly.validate(SIMD_WASM);
      const worker = await createWorker('spa', 1, {
        workerPath: `${OCR_BASE}/worker.min.js`,
        corePath: `${OCR_BASE}/${simd ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'}`,
        langPath: OCR_BASE,
        workerBlobURL: false
      });
      await worker.setParameters({ preserve_interword_spaces: '1' });
      return worker;
    })().catch((err) => {
      workerPromesa = null; // permite reintentar con el siguiente archivo
      throw err;
    });
  }
  return workerPromesa;
}

// Imagen a un tamaño razonable: fotos de 12 MP hacen lento el OCR sin mejorar la lectura
async function prepararImagen(file) {
  const MAX = 2000;
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  if (escala === 1) {
    bitmap.close?.();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
}

// Modos de segmentación de Tesseract, en orden de intento:
// - '3' automático: los pantallazos bancarios (monto grande y en negrita, separado de su etiqueta).
// - '6' bloque único: las boletas (descripción y precio en la misma línea; con '3' la
//   columna de precios quedaba en otro bloque y se perdía).
const MODOS_OCR = ['3', '6'];

async function textoDeImagen(imagen, modo) {
  const worker = await obtenerWorkerOcr();
  await worker.setParameters({ tessedit_pageseg_mode: modo });
  const { data } = await worker.recognize(imagen);
  return data?.text || '';
}

async function textoDePdf(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // En pdf.js 6 se libera la tarea de carga (el documento ya no expone destroy())
  const tarea = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  try {
    const doc = await tarea.promise;
    const paginas = Math.min(doc.numPages, 3); // un comprobante cabe en las primeras páginas
    let texto = '';
    for (let n = 1; n <= paginas; n += 1) {
      const pagina = await doc.getPage(n);
      const contenido = await pagina.getTextContent();
      // Reconstruye las líneas: un salto cuando cambia la altura del texto o el ítem lo indica
      let ultimaY = null;
      for (const item of contenido.items) {
        const y = item.transform?.[5];
        if (ultimaY !== null && y !== undefined && Math.abs(y - ultimaY) > 2) texto += '\n';
        texto += item.str;
        texto += item.hasEOL ? '\n' : ' ';
        if (y !== undefined) ultimaY = y;
      }
      texto += '\n';
    }
    return texto;
  } finally {
    tarea.destroy();
  }
}

/** Texto del comprobante en cada modo de lectura (sirve para diagnosticar una lectura fallida) */
export async function leerTextoComprobante(file) {
  if (file.type === 'application/pdf') return [await textoDePdf(file)];
  const imagen = await prepararImagen(file);
  const textos = [];
  for (const modo of MODOS_OCR) textos.push(await textoDeImagen(imagen, modo));
  return textos;
}

/**
 * @param {File} file - PDF o imagen (JPG, PNG, WEBP)
 * @returns {Promise<{ monto: number, regla: string, linea: string, fuente: 'pdf' | 'imagen' } | null>}
 */
export async function leerMontoComprobante(file) {
  if (!file) return null;
  if (file.type === 'application/pdf') {
    // Un PDF escaneado no trae texto: no se intenta OCR de PDF (se ingresa a mano)
    const resultado = extraerMonto(await textoDePdf(file));
    return resultado ? { ...resultado, fuente: 'pdf' } : null;
  }
  const imagen = await prepararImagen(file);
  // El segundo modo solo se usa si el primero no encontró un monto
  for (const modo of MODOS_OCR) {
    const resultado = extraerMonto(await textoDeImagen(imagen, modo));
    if (resultado) return { ...resultado, fuente: 'imagen' };
  }
  return null;
}
