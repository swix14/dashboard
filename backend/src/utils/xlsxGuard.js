/**
 * Revisión del contenedor ZIP de un .xlsx ANTES de abrirlo con exceljs (auditoría H-016).
 * Un .xlsx es un ZIP: un archivo pequeño puede declarar contenido descomprimido enorme
 * ("bomba ZIP") y agotar la memoria del servidor. Aquí se lee solo el índice del ZIP
 * (directorio central), sin descomprimir nada.
 */

export const XLSX_LIMITES = {
  maxEntradas: 300,
  maxDescomprimidoBytes: 40 * 1024 * 1024, // 40 MB en total
  maxRatio: 200 // tamaño descomprimido / comprimido por archivo interno
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/**
 * @param {Buffer} buffer
 * @returns {string|null} motivo del rechazo, o null si el contenedor es aceptable
 */
export function revisarContenedorXlsx(buffer, limites = XLSX_LIMITES) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) return 'El archivo está vacío o dañado.';

  // El fin del directorio central está en los últimos 22 bytes + comentario (máx. 64 KB)
  let eocd = -1;
  const desde = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= desde; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return 'El archivo no es una planilla Excel válida.';

  const totalEntradas = buffer.readUInt16LE(eocd + 10);
  const tamanoDirectorio = buffer.readUInt32LE(eocd + 12);
  const inicioDirectorio = buffer.readUInt32LE(eocd + 16);

  // Valores máximos = formato ZIP64 (archivos gigantes): no corresponde a una planilla del padrón
  if (totalEntradas === 0xffff || inicioDirectorio === 0xffffffff || tamanoDirectorio === 0xffffffff) {
    return 'La planilla es demasiado grande.';
  }
  if (totalEntradas > limites.maxEntradas) return 'La planilla tiene una estructura inesperada (demasiados elementos).';
  if (inicioDirectorio + tamanoDirectorio > eocd) return 'El archivo no es una planilla Excel válida.';

  let offset = inicioDirectorio;
  let totalDescomprimido = 0;
  for (let n = 0; n < totalEntradas; n++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      return 'El archivo no es una planilla Excel válida.';
    }
    const comprimido = buffer.readUInt32LE(offset + 20);
    const descomprimido = buffer.readUInt32LE(offset + 24);
    if (comprimido === 0xffffffff || descomprimido === 0xffffffff) return 'La planilla es demasiado grande.';

    totalDescomprimido += descomprimido;
    if (totalDescomprimido > limites.maxDescomprimidoBytes) return 'La planilla es demasiado grande al descomprimirla.';
    // Proporción de compresión anormal: típico de una bomba ZIP (con piso de 1 KB para archivos diminutos)
    if (descomprimido > 1024 * 1024 && descomprimido / Math.max(comprimido, 1) > limites.maxRatio) {
      return 'La planilla tiene un contenido comprimido anómalo.';
    }

    const largoNombre = buffer.readUInt16LE(offset + 28);
    const largoExtra = buffer.readUInt16LE(offset + 30);
    const largoComentario = buffer.readUInt16LE(offset + 32);
    offset += 46 + largoNombre + largoExtra + largoComentario;
  }
  return null;
}
