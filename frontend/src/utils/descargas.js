// Utilidades comunes para descargar o abrir archivos recibidos del backend (antes repetidas en cada página)

/**
 * Mensaje de error del backend. Con responseType 'blob' el JSON de error también llega como Blob,
 * así que se lee su texto antes de mostrarlo.
 */
export async function mensajeDeBlob(err, fallback) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || fallback;
}

/** Guarda un Blob en el equipo con el nombre indicado */
export function guardarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Descarga texto plano como archivo (CSV para Excel, con BOM para que respete las tildes) */
export function guardarTexto(texto, nombre, tipo = 'text/csv;charset=utf-8;') {
  guardarBlob(new Blob([texto], { type: tipo }), nombre);
}

/**
 * Abre en una pestaña nueva el archivo que entrega obtenerBlob (PDF o imagen).
 * La pestaña se abre antes de la descarga para que el navegador no la bloquee como popup.
 * Si falla, cierra la pestaña y lanza un Error con el mensaje del backend.
 */
export async function abrirBlobEnPestana(obtenerBlob, fallback = 'No fue posible abrir el archivo.') {
  const ventana = window.open('', '_blank');
  try {
    const blob = await obtenerBlob();
    const url = URL.createObjectURL(blob);
    if (ventana) ventana.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    ventana?.close();
    throw new Error(await mensajeDeBlob(err, fallback));
  }
}
