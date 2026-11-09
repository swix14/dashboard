/**
 * Utilidades centralizadas de formateo para el frontend de la Asociación VTF
 */

/**
 * Formatea un monto numérico a formato moneda chilena (CLP)
 * Ej: 280000 -> "$ 280.000"
 */
export function formatCurrencyCLP(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Formatea una fecha ISO o YYYY-MM-DD a DD/MM/YYYY
 * Ej: "2026-10-05" -> "05/10/2026"
 */
export function formatDateCLP(dateStr) {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Formatea un RUT chileno con puntos y guión
 * Ej: "12345678K" -> "12.345.678-K"
 */
export function formatRutCLP(rut) {
  if (!rut) return '';
  const clean = String(rut).replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  const dv = clean.slice(-1);
  const cuerpo = clean.slice(0, -1);
  const formattedCuerpo = new Intl.NumberFormat('es-CL').format(Number(cuerpo));
  return `${formattedCuerpo}-${dv}`;
}

/**
 * Formatea el tamaño de un archivo en bytes a KB o MB legibles
 */
export function formatFileSize(bytes) {
  const num = Number(bytes) || 0;
  if (num < 1024 * 1024) {
    return `${Math.max(1, Math.round(num / 1024))} KB`;
  }
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Celda CSV segura para Excel: comillas escapadas (un ";" no corre las columnas)
 * y sin fórmulas (=, +, -, @) que Excel ejecutaría al abrir el archivo.
 */
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
