import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { hoyChile } from './fecha.js';

/**
 * Guarda un archivo subido en una carpeta histórica dentro de uploads (por ejemplo
 * creditos/comprobantes/2026/11/SOS) SIN sobrescribir nunca uno anterior.
 * @param {Buffer} buffer - contenido del archivo
 * @param {string[]} carpetas - subcarpetas relativas a UPLOADS_DIR (solo letras, números, guion)
 * @param {string} nombreOriginal - nombre enviado por el cliente (se limpia; solo informativo)
 * @returns {{ relative: string, absolute: string }}
 */
export function guardarArchivoHistorico(buffer, carpetas, nombreOriginal) {
  const seguras = carpetas.map((c) => String(c).replace(/[^\w-]+/g, '_'));
  const now = new Date();
  const [yyyy, mm, dd] = hoyChile(now).split('-');
  const hora = now.toLocaleTimeString('en-GB', { timeZone: 'America/Santiago', hour12: false }).replace(/:/g, '');
  const stamp = `${yyyy}-${mm}-${dd}_${hora}`;
  const base = path.basename(nombreOriginal || 'archivo').replace(/[^\w.\-]+/g, '_').slice(-80);
  const dir = path.join(env.UPLOADS_DIR, ...seguras);
  fs.mkdirSync(dir, { recursive: true });
  // 'wx' nunca sobrescribe: si ya existe un archivo con ese nombre en el mismo segundo, se numera
  for (let n = 1; n < 1000; n++) {
    const name = n === 1 ? `${stamp}_${base}` : `${stamp}_${n}_${base}`;
    const absolute = path.join(dir, name);
    try {
      fs.writeFileSync(absolute, buffer, { flag: 'wx' });
      return { relative: [...seguras, name].join('/'), absolute };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  throw new Error('No se pudo guardar el archivo: demasiadas cargas en el mismo segundo.');
}

/** Ruta absoluta de un archivo guardado con guardarArchivoHistorico, sin salir de UPLOADS_DIR */
export function resolverArchivoHistorico(relative) {
  const base = path.resolve(env.UPLOADS_DIR);
  const absolute = path.resolve(base, String(relative || ''));
  if (!absolute.startsWith(base + path.sep)) return null;
  return absolute;
}
