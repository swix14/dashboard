/**
 * Límite de intentos fallidos de inicio de sesión (directiva y socias).
 *
 * Cuenta solo los intentos rechazados (HTTP 401) por cuenta (RUT o correo) y por IP.
 * Tras MAX_FALLOS en VENTANA_MS la cuenta queda bloqueada BLOQUEO_MS y se responde 429.
 * Un ingreso correcto limpia el contador. Se guarda en memoria del proceso: basta para
 * frenar ataques de fuerza bruta en una sola instancia de Passenger.
 */
const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const BLOQUEO_MS = 15 * 60 * 1000;
const MAX_CLAVES = 10000;

function normalizarIdentificador(valor) {
  const texto = String(valor || '').trim().toLowerCase();
  // El RUT puede venir con o sin puntos y guion: se cuenta como la misma cuenta
  return texto.includes('@') ? texto : texto.replace(/[^0-9k]/g, '');
}

export function createLoginLimiter({ maxFallos = MAX_FALLOS, ventanaMs = VENTANA_MS, bloqueoMs = BLOQUEO_MS, campo = 'identifier' } = {}) {
  const registros = new Map();

  function limpiarVencidos(ahora) {
    if (registros.size < MAX_CLAVES) return;
    for (const [clave, r] of registros) {
      if ((r.bloqueadoHasta || 0) < ahora && ahora - r.inicio > ventanaMs) registros.delete(clave);
    }
  }

  return function loginLimiter(req, res, next) {
    const identificador = normalizarIdentificador(req.body?.[campo]);
    if (!identificador) return next();

    const clave = `${identificador}|${req.ip}`;
    const ahora = Date.now();
    const registro = registros.get(clave);

    if (registro?.bloqueadoHasta && registro.bloqueadoHasta > ahora) {
      const minutos = Math.ceil((registro.bloqueadoHasta - ahora) / 60000);
      res.set('Retry-After', String(Math.ceil((registro.bloqueadoHasta - ahora) / 1000)));
      return res.status(429).json({
        success: false,
        code: 'DEMASIADOS_INTENTOS',
        message: `Demasiados intentos fallidos. Por seguridad, espere ${minutos} minuto(s) antes de volver a intentar.`
      });
    }

    res.on('finish', () => {
      const momento = Date.now();
      if (res.statusCode === 401) {
        limpiarVencidos(momento);
        const actual = registros.get(clave);
        const vigente = actual && momento - actual.inicio <= ventanaMs ? actual : { inicio: momento, fallos: 0 };
        vigente.fallos += 1;
        if (vigente.fallos >= maxFallos) {
          vigente.bloqueadoHasta = momento + bloqueoMs;
          vigente.fallos = 0;
          vigente.inicio = momento;
        }
        registros.set(clave, vigente);
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        registros.delete(clave);
      }
    });

    next();
  };
}
