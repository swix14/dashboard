/**
 * PDF "Balance Anual" para la asamblea (V7): resumen del año, fondos, mes a mes y categorías.
 * Solo cifras consolidadas de Tesorería: no incluye socias ni deudas individuales.
 */
import { crearDocumento, datos, seccion, tabla, nota, finalizar, clp } from '../utils/pdf.js';

// Nombres legibles de las categorías guardadas en mayúsculas
const CATEGORIAS = {
  'PAGO FEDERACION': 'Pago Federación',
  'ISI MUNDO COMISION': 'Comisión Isi Mundo',
  ASOCIACION: 'Asociación',
  'CENA ANUAL': 'Cena Anual',
  CENA: 'Cena Anual',
  'S.O.S': 'S.O.S',
  OTROS: 'Otros'
};

const categoriaTexto = (c) => CATEGORIAS[c] || (c ? c.charAt(0) + c.slice(1).toLowerCase() : 'Sin categoría');
const fechaTexto = (iso) => iso.split('-').reverse().join('-');
const porcentaje = (p) => `${String(p).replace('.', ',')}%`;

function tablaCategorias(doc, titulo, filas, total) {
  seccion(doc, titulo);
  if (filas.length === 0) {
    nota(doc, 'Sin movimientos en el período.');
    doc.moveDown(1);
    return;
  }
  tabla(
    doc,
    [
      { titulo: 'Categoría', ancho: 3 },
      { titulo: 'Movimientos', ancho: 1.3, align: 'center' },
      { titulo: 'Monto', ancho: 1.8, align: 'right' },
      { titulo: '% del total', ancho: 1.3, align: 'right' }
    ],
    filas.map((f) => [categoriaTexto(f.categoria), f.cantidad, clp(f.monto), porcentaje(f.porcentaje)]),
    { totales: ['Total', filas.reduce((s, f) => s + f.cantidad, 0), clp(total), '100%'] }
  );
}

export const BalancePdfService = {
  /** @returns {Promise<{buffer: Buffer, nombre: string}>} */
  async generar(balance, emitidoPor) {
    const corte = balance.enCurso ? `al ${fechaTexto(balance.hasta)} (año en curso)` : `al 31-12-${balance.anio}`;
    const doc = crearDocumento({
      titulo: `Balance Anual ${balance.anio}`,
      subtitulo: `Rendición de cuentas de Tesorería · del 01-01-${balance.anio} ${corte}`,
      emitidoPor
    });

    seccion(doc, 'Resumen del año');
    datos(doc, [
      ['Saldo inicial', clp(balance.saldoInicial)],
      ['Saldo final', clp(balance.saldoFinal)],
      ['Total de ingresos', clp(balance.totalIngresos)],
      ['Total de egresos', clp(balance.totalEgresos)],
      ['Pago a Federación', clp(balance.pagoFederacion)],
      ['Comisión Isi Mundo', clp(balance.comisionIsiMundo)]
    ]);

    seccion(doc, 'Fondos de la Asociación');
    const { asociacion, cenaAnual } = balance.fondos;
    tabla(
      doc,
      [
        { titulo: 'Fondo', ancho: 2.2 },
        { titulo: 'Saldo inicial', ancho: 1.6, align: 'right' },
        { titulo: 'Ingresos', ancho: 1.6, align: 'right' },
        { titulo: 'Egresos', ancho: 1.6, align: 'right' },
        { titulo: 'Saldo final', ancho: 1.6, align: 'right' }
      ],
      [
        ['Asociación', clp(asociacion.saldoInicial), clp(asociacion.ingresos), clp(asociacion.egresos), clp(asociacion.saldoFinal)],
        ['Cena Anual', clp(cenaAnual.saldoInicial), clp(cenaAnual.ingresos), clp(cenaAnual.egresos), clp(cenaAnual.saldoFinal)]
      ],
      {
        totales: [
          'Total disponible',
          clp(asociacion.saldoInicial + cenaAnual.saldoInicial),
          clp(asociacion.ingresos + cenaAnual.ingresos),
          clp(asociacion.egresos + cenaAnual.egresos),
          clp(balance.saldoFinal)
        ]
      }
    );
    nota(
      doc,
      'La comisión Isi Mundo ingresa al fondo Asociación. El pago a la Federación es el aporte gremial que se recauda ' +
        'y se traspasa: figura en los egresos del año, pero no descuenta los fondos de la Asociación.'
    );
    doc.moveDown(1);

    seccion(doc, 'Movimiento mes a mes');
    tabla(
      doc,
      [
        { titulo: 'Mes', ancho: 1.8 },
        { titulo: 'Ingresos', ancho: 1.6, align: 'right' },
        { titulo: 'Egresos', ancho: 1.6, align: 'right' },
        { titulo: 'Pago Federación', ancho: 1.7, align: 'right' },
        { titulo: 'Saldo acumulado', ancho: 1.8, align: 'right' }
      ],
      balance.meses.map((m) => [m.nombreMes, clp(m.ingresos), clp(m.egresos), clp(m.pagoFederacion), clp(m.saldoAcumulado)]),
      { totales: ['Total', clp(balance.totalIngresos), clp(balance.totalEgresos), clp(balance.pagoFederacion), clp(balance.saldoFinal)] }
    );

    tablaCategorias(doc, 'Ingresos por categoría', balance.ingresosPorCategoria, balance.totalIngresos);
    tablaCategorias(doc, 'Egresos por categoría', balance.egresosPorCategoria, balance.totalEgresos);

    nota(
      doc,
      `Este balance considera ${balance.cantidadMovimientos} movimientos registrados en Tesorería entre el 01-01-${balance.anio} ` +
        `y el ${fechaTexto(balance.hasta)}. Los movimientos anulados no se consideran. El saldo inicial corresponde a los ` +
        'saldos de apertura y a los movimientos de años anteriores.'
    );

    return { buffer: await finalizar(doc), nombre: `balance-anual-${balance.anio}.pdf` };
  }
};
