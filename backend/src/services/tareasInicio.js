import { query } from '../config/db.js';
import { hoyChile } from '../utils/fecha.js';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const dosDigitos = (n) => String(n).padStart(2, '0');
const fechaCL = (iso) => String(iso).slice(0, 10).split('-').reverse().join('/');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Tarea del pago a Federación: aparece mientras no haya pago registrado en el mes en curso.
 * Si además el aporte está atrasado (tampoco hubo pago el mes anterior) se marca como alerta.
 */
export function tareaFederacion(ultimoPago, alDia, hoy = hoyChile()) {
  if (ultimoPago && String(ultimoPago).slice(0, 7) === hoy.slice(0, 7)) return null;
  const [anio, mes] = hoy.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return {
    id: 'federacion',
    titulo: 'Pago mensual a Federación',
    fechaLimite: alDia ? `Hasta el ${dosDigitos(ultimoDia)}/${dosDigitos(mes)}/${anio}` : 'Atrasado',
    urgencia: alDia ? 'media' : 'alerta',
    descripcion: alDia
      ? `Aún no se registra en Tesorería el pago de ${MESES[mes - 1]}.`
      : ultimoPago
        ? `El último pago registrado es del ${fechaCL(ultimoPago)}.`
        : 'No hay pagos a Federación registrados en Tesorería.'
  };
}

/**
 * Pendientes reales de la directiva calculados desde la base (antes eran tres tareas fijas,
 * con una "deuda morosa" inventada). Una lista vacía significa que no hay nada pendiente.
 */
export async function calcularProximasTareas({ ultimoPagoFederacion, federacionAlDia, puedeVerBuzon, hoy = hoyChile() }) {
  const [anio, mes] = hoy.split('-').map(Number);
  const tareas = [];

  const federacion = tareaFederacion(ultimoPagoFederacion, federacionAlDia, hoy);
  if (federacion) tareas.push(federacion);

  // Pagos a convenios de meses ya vencidos o en curso que aún no tienen el pago verificado
  const sinVerificar = await query(
    `SELECT cv.codigo, p.mes, p.anio
     FROM pagos_convenio p JOIN convenios cv ON cv.id = p.convenio_id
     WHERE p.verificado_at IS NULL AND p.monto_a_pagar > 0 AND p.anio * 12 + p.mes <= ?
     ORDER BY p.anio, p.mes, cv.codigo`,
    [anio * 12 + mes]
  );
  if (sinVerificar.length > 0) {
    const detalle = sinVerificar.slice(0, 3).map((p) => `${p.codigo} ${dosDigitos(p.mes)}/${p.anio}`).join(', ');
    tareas.push({
      id: 'verificar-convenios',
      titulo: 'Verificar pagos a convenios',
      fechaLimite: 'Pendiente',
      urgencia: 'alta',
      descripcion: `${plural(sinVerificar.length, 'pago sin verificar', 'pagos sin verificar')}: ${detalle}${sinVerificar.length > 3 ? '…' : ''}`
    });
  }

  const [sos] = await query(`SELECT COUNT(*) AS n FROM solicitudes_sos WHERE estado = 'PENDIENTE'`);
  const sosPendientes = Number(sos?.n || 0);
  if (sosPendientes > 0) {
    tareas.push({
      id: 'solicitudes-sos',
      titulo: 'Revisar solicitudes S.O.S',
      fechaLimite: 'Pendiente',
      urgencia: 'alta',
      descripcion: `${plural(sosPendientes, 'solicitud espera', 'solicitudes esperan')} aprobación o rechazo.`
    });
  }

  // El buzón lo atiende quien puede comunicar (la Tesorera no lo ve)
  if (puedeVerBuzon) {
    const [buzon] = await query(`SELECT COUNT(*) AS n FROM buzon_mensajes WHERE estado = 'PENDIENTE'`);
    const mensajes = Number(buzon?.n || 0);
    if (mensajes > 0) {
      tareas.push({
        id: 'buzon',
        titulo: 'Mensajes del buzón sin leer',
        fechaLimite: 'Pendiente',
        urgencia: 'media',
        descripcion: `${plural(mensajes, 'mensaje de socia sin revisar', 'mensajes de socias sin revisar')}.`
      });
    }
  }

  return tareas;
}
