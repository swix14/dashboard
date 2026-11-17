import { useCallback, useEffect, useRef, useState } from 'react';

// Clave compartida entre pestañas: la actividad en una pestaña mantiene viva la sesión en las demás
export const LAST_ACTIVITY_KEY = 'vtf_last_activity';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'];
// Para no escribir en localStorage en cada movimiento del mouse
const WRITE_THROTTLE_MS = 5000;
const CHECK_INTERVAL_MS = 1000;

function readLastActivity() {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastActivity(ts) {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(ts));
  } catch {
    // Sin almacenamiento disponible: se usa solo el valor en memoria
  }
}

/**
 * Detecta inactividad del usuario.
 * @param {object} opts
 * @param {boolean} opts.enabled  - solo cuenta mientras hay sesión
 * @param {number} opts.timeoutMs - tiempo sin actividad para cerrar la sesión
 * @param {number} opts.warningMs - cuánto antes del cierre se muestra el aviso
 * @param {() => void} opts.onTimeout
 * @returns {{ secondsLeft: number|null, stayActive: () => void }} secondsLeft es null fuera del período de aviso
 */
export function useIdleTimeout({ enabled, timeoutMs, warningMs, onTimeout }) {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const lastWriteRef = useRef(0);
  const warningRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const markActivity = useCallback((force = false) => {
    const now = Date.now();
    if (force || now - lastWriteRef.current > WRITE_THROTTLE_MS) {
      lastWriteRef.current = now;
      writeLastActivity(now);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSecondsLeft(null);
      warningRef.current = false;
      return undefined;
    }

    // Si la última actividad registrada ya venció (pestaña cerrada y reabierta tarde), se cierra al tiro
    const previous = readLastActivity();
    if (previous && Date.now() - previous >= timeoutMs) {
      onTimeoutRef.current();
      return undefined;
    }
    markActivity(true);

    // Durante el aviso, mover el mouse no cuenta: hay que confirmar con el botón
    const handleActivity = () => {
      if (!warningRef.current) markActivity();
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    const interval = setInterval(() => {
      const idleFor = Date.now() - readLastActivity();
      if (idleFor >= timeoutMs) {
        clearInterval(interval);
        warningRef.current = false;
        setSecondsLeft(null);
        onTimeoutRef.current();
      } else if (idleFor >= timeoutMs - warningMs) {
        warningRef.current = true;
        setSecondsLeft(Math.ceil((timeoutMs - idleFor) / 1000));
      } else if (warningRef.current) {
        // Otra pestaña registró actividad: se quita el aviso
        warningRef.current = false;
        setSecondsLeft(null);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [enabled, timeoutMs, warningMs, markActivity]);

  const stayActive = useCallback(() => {
    warningRef.current = false;
    setSecondsLeft(null);
    markActivity(true);
  }, [markActivity]);

  return { secondsLeft, stayActive };
}
