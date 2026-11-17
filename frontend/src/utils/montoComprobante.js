/**
 * Busca el monto pagado en el texto de un comprobante (PDF de transferencia, pantallazo
 * de la app del banco o foto de una boleta). Solo propone: la tesorera siempre lo revisa.
 *
 * Reglas, en orden:
 *  1. Líneas con palabras de total ("Monto transferido", "Total a pagar", "Total"…).
 *  2. Líneas con palabras de monto ("Monto", "Importe", "Valor"…).
 *  3. Si no hay palabras clave, el mayor monto escrito con "$".
 * Se descartan subtotal, IVA, neto, saldo, efectivo, vuelto y similares, que en una boleta
 * o en la app del banco no son lo pagado. La etiqueta puede estar en una línea y el monto
 * en la siguiente (así se ven muchos pantallazos).
 */

// Mismo tope que valida el backend (treasuryValidator.MONTO_MAXIMO)
export const MONTO_MAXIMO = 100_000_000;

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Separador de miles: punto, coma o espacio duro (algunos PDF usan U+00A0)
const SEP = '[.,\\u00a0]';

const TOTAL = [
  /monto\s+(?:total\s+)?transferid[oa]/,
  /total\s+(?:a\s+)?pag(?:ar|ado)/,
  /monto\s+(?:total\s+)?pagado/,
  /monto\s+de\s+(?:la\s+)?transferencia/,
  /monto\s+total/,
  /\btotal\b/
];
const MONTO = [/\bmonto\b/, /\bimporte\b/, /\bvalor\b/, /\bcargo\b/, /\babono\b/, /\btransferiste\b/, /\bpagaste\b/];
const DESCARTE = [
  /sub\s*-?\s*total/,
  /\biva\b/,
  /\bneto\b/,
  /\bsaldo/,
  /\befectivo\b/,
  /\bvuelto\b/,
  /\bcambio\b/,
  /\bdescuento/,
  /\bdisponible/,
  /\bexento\b/,
  /\bpropina\b/,
  /\bcupo\b/,
  /\blimite\b/
];

// Montos chilenos: $1.250.000 · $ 12.990 · 12.990,00 · 50000 (sin separador, 4 a 9 dígitos)
const MONTO_RE = new RegExp(`(\\$\\s*)?(\\d{1,3}(?:${SEP}\\d{3})+|\\d{3,9})(?:,(\\d{1,2}))?(?![\\d.,]*\\d)`, 'g');
const AGRUPADO_RE = new RegExp(`${SEP}\\d{3}$`);
const SEP_RE = new RegExp(SEP, 'g');

// Lo que parece monto pero no lo es: RUT, fechas, horas, porcentajes y códigos con guion
const RUIDO = [
  /\b\d{1,2}\.?\d{3}\.?\d{3}\s*-\s*[\dkK]\b/g, // RUT
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, // fecha 17/11/2026
  /\b\d{4}-\d{2}-\d{2}\b/g, // fecha ISO
  /\b\d{1,2}:\d{2}(?::\d{2})?\b/g, // hora
  /\b\d+(?:[.,]\d+)?\s*%/g // porcentaje
];

function limpiarLinea(linea) {
  let s = linea;
  for (const re of RUIDO) s = s.replace(re, ' ');
  return s;
}

/** Montos de una línea: [{ valor, conPeso }] */
export function montosEnLinea(linea) {
  const out = [];
  const s = limpiarLinea(linea);
  for (const m of s.matchAll(MONTO_RE)) {
    const conPeso = Boolean(m[1]);
    const crudo = m[2];
    const agrupado = AGRUPADO_RE.test(crudo);
    // Sin "$" ni separador de miles, un número de 3 dígitos suele ser un código: se ignora
    if (!conPeso && !agrupado && crudo.length < 4) continue;
    const valor = Number(crudo.replace(SEP_RE, ''));
    if (!Number.isFinite(valor) || valor <= 0 || valor > MONTO_MAXIMO) continue;
    out.push({ valor, conPeso });
  }
  return out;
}

const coincide = (texto, lista) => lista.some((re) => re.test(texto));

/**
 * @param {string} texto - texto leído del comprobante
 * @returns {{ monto: number, regla: 'total' | 'monto' | 'mayor', linea: string } | null}
 */
export function extraerMonto(texto) {
  if (!texto || typeof texto !== 'string') return null;
  const lineas = texto
    .split(/\r?\n/)
    // El espacio duro como separador de miles pasa a punto antes de normalizar espacios
    .map((l) => l.replace(/(\d) (?=\d{3}(?!\d))/g, '$1.').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const candidatos = []; // { monto, prioridad, linea }
  lineas.forEach((linea, i) => {
    const clave = sinTildes(linea.toLowerCase());
    if (coincide(clave, DESCARTE)) return;
    const prioridad = coincide(clave, TOTAL) ? 2 : coincide(clave, MONTO) ? 1 : 0;
    if (!prioridad) return;

    let montos = montosEnLinea(linea);
    let origen = linea;
    // Etiqueta sola ("Monto transferido") y el valor en la línea siguiente
    if (montos.length === 0) {
      for (const sig of lineas.slice(i + 1, i + 3)) {
        if (coincide(sinTildes(sig.toLowerCase()), DESCARTE)) break;
        montos = montosEnLinea(sig);
        if (montos.length) {
          origen = `${linea} ${sig}`;
          break;
        }
      }
    }
    for (const m of montos) candidatos.push({ monto: m.valor, prioridad, linea: origen, conPeso: m.conPeso });
  });

  if (candidatos.length) {
    const mejor = Math.max(...candidatos.map((c) => c.prioridad));
    const deEsa = candidatos.filter((c) => c.prioridad === mejor);
    // Preferimos montos con "$"; entre ellos, el mayor (en una boleta el total supera a cada ítem)
    const conPeso = deEsa.filter((c) => c.conPeso);
    const pool = conPeso.length ? conPeso : deEsa;
    const elegido = pool.reduce((a, b) => (b.monto > a.monto ? b : a));
    return { monto: elegido.monto, regla: mejor === 2 ? 'total' : 'monto', linea: elegido.linea };
  }

  // Sin palabras clave: el mayor monto con "$" fuera de las líneas descartadas
  let mayor = null;
  for (const linea of lineas) {
    if (coincide(sinTildes(linea.toLowerCase()), DESCARTE)) continue;
    for (const m of montosEnLinea(linea)) {
      if (m.conPeso && (!mayor || m.valor > mayor.monto)) mayor = { monto: m.valor, regla: 'mayor', linea };
    }
  }
  return mayor;
}
