/**
 * PDF "Resumen de créditos" de una socia (pedido de la directiva en la sección Socias):
 * todos sus créditos sin detalle de cuotas, ej. "ISIMUNDO $600.000 · cuotas 3/6".
 * Los créditos anulados no aparecen.
 */
import { SociaService } from './sociaService.js';
import { crearDocumento, datos, seccion, tabla, nota, finalizar, clp } from '../utils/pdf.js';

const nombreCompleto = (s) => [s.nombres, s.apellidoPaterno, s.apellidoMaterno].filter(Boolean).join(' ');

function estadoTexto(c) {
  if (c.estado === 'FINALIZADO') return 'Pagado';
  const restantes = c.totalCuotas - c.cuotasPagadas;
  if (restantes <= 1) return 'Última cuota';
  if (restantes === 2) return 'Quedan 2 cuotas';
  return 'Vigente';
}

/** Nombre de archivo seguro: creditos-12345678-9.pdf */
const nombreArchivo = (rut) => `creditos-${String(rut || 'socia').replace(/[^0-9kK-]/g, '')}.pdf`;

export const SociaPdfService = {
  async creditosSocia(sociaId, emitidoPor) {
    const socia = await SociaService.getSociaById(sociaId);
    const creditos = (socia.creditos || []).filter((c) => c.estado !== 'ANULADO');
    const vigentes = creditos.filter((c) => c.estado === 'VIGENTE');
    const saldo = vigentes.reduce((s, c) => s + c.saldoPendiente, 0);

    const doc = crearDocumento({ titulo: 'Resumen de créditos', subtitulo: 'Créditos y convenios registrados a nombre de la socia', emitidoPor });
    datos(doc, [
      ['Socia', nombreCompleto(socia)],
      ['RUT', socia.rut],
      ['Jardín', socia.jardin?.name || 'Sin jardín asignado'],
      ['Estado en el padrón', socia.estado ? socia.estado.charAt(0) + socia.estado.slice(1).toLowerCase() : '—'],
      ['Créditos vigentes', String(vigentes.length)],
      ['Descuento mensual', `${clp(socia.descuentoMensualCreditos || 0)} / mes`]
    ]);

    seccion(doc, 'Créditos');
    if (creditos.length === 0) {
      nota(doc, 'La socia no registra créditos ni convenios.');
    } else {
      tabla(
        doc,
        [
          { titulo: 'Empresa', ancho: 2.2 },
          { titulo: 'Monto', ancho: 1.6, align: 'right' },
          { titulo: 'Cuotas', ancho: 1.1, align: 'center' },
          { titulo: 'Valor cuota', ancho: 1.5, align: 'right' },
          { titulo: 'Saldo', ancho: 1.5, align: 'right' },
          { titulo: 'Estado', ancho: 1.8 }
        ],
        creditos.map((c) => [
          c.tipoNombre,
          clp(c.montoSolicitado),
          `${c.cuotasPagadas}/${c.totalCuotas}`,
          clp(c.valorCuota),
          clp(c.saldoPendiente),
          estadoTexto(c)
        ]),
        { totales: ['Total vigente', '', '', clp(socia.descuentoMensualCreditos || 0), clp(saldo), ''] }
      );
      nota(
        doc,
        'Cuotas = cuotas pagadas / total de cuotas. El saldo considera solo las cuotas pendientes de los créditos vigentes. ' +
          'Las cuotas se descuentan por planilla; los créditos pagados se informan como referencia.'
      );
    }

    return { buffer: await finalizar(doc), nombre: nombreArchivo(socia.rut), socia: { id: socia.id, rut: socia.rut }, creditos: creditos.length };
  }
};
