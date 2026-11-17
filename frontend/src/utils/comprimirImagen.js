/**
 * Reduce una foto del celular antes de adjuntarla: una foto de 12 MP pesa de 3 a 6 MB
 * y superaba el máximo de 5 MB del comprobante. Se lleva a 2000 px por lado en JPEG,
 * suficiente para leer el texto. Los PDF y las imágenes livianas quedan tal cual
 * (un pantallazo PNG pequeño conserva su nitidez).
 */
const LADO_MAX = 2000;
const UMBRAL_BYTES = 1.5 * 1024 * 1024;

export async function comprimirImagen(file) {
  if (!file?.type?.startsWith('image/') || typeof createImageBitmap !== 'function') return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // formato que el navegador no decodifica: se deja que el servidor responda
  }
  const lado = Math.max(bitmap.width, bitmap.height);
  if (file.size <= UMBRAL_BYTES && lado <= LADO_MAX) {
    bitmap.close?.();
    return file;
  }
  const escala = Math.min(1, LADO_MAX / lado);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // fondo blanco para PNG con transparencia
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob || blob.size >= file.size) return file;
  const nombre = file.name.replace(/\.[^.]+$/, '') || 'comprobante';
  return new File([blob], `${nombre}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
