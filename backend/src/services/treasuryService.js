/**
 * Servicio de Tesorería — Asociación VTF Temuco
 * Reglas de negocio:
 * - Centros de Costo: ASOCIACION, CENA ANUAL, FEDERACION, ISI MUNDO COMISION.
 * - Los ingresos se asignan a ASOCIACION, CENA ANUAL o ISI MUNDO COMISION.
 * - Los egresos se asignan a S.O.S (Cena Anual), CENA (Cena Anual), OTROS (Asociación) o FEDERACION.
 * - FEDERACION registra exclusivamente egresos/pagos.
 * - Comprobante de egreso es estrictamente obligatorio.
 * - Saldo Total Disponible = Saldo Centro Asociación + Saldo Centro Cena Anual.
 */

// Movimientos iniciales históricos de la tesorería de la Asociación
let treasuryMovements = [
  {
    id: 'mov-001',
    correlativo: 'MOV-2026-001',
    fecha: '2026-06-02',
    tipo: 'EGRESO',
    centroCosto: 'FEDERACION',
    categoria: 'PAGO FEDERACION',
    descripcion: 'Aporte gremial nacional mes de Junio 2026',
    metodo: 'Transferencia Bancaria',
    monto: 280000,
    responsable: 'Alejandra Romanett Sias Novoa',
    comprobante: 'comprobante_fed_jun_2026.pdf',
    createdAt: '2026-06-02T10:30:00Z'
  },
  {
    id: 'mov-002',
    correlativo: 'MOV-2026-002',
    fecha: '2026-07-02',
    tipo: 'EGRESO',
    centroCosto: 'FEDERACION',
    categoria: 'PAGO FEDERACION',
    descripcion: 'Aporte gremial nacional mes de Julio 2026',
    metodo: 'Transferencia Bancaria',
    monto: 280000,
    responsable: 'Alejandra Romanett Sias Novoa',
    comprobante: 'comprobante_fed_jul_2026.pdf',
    createdAt: '2026-07-02T11:15:00Z'
  },
  {
    id: 'mov-003',
    correlativo: 'MOV-2026-003',
    fecha: '2026-08-03',
    tipo: 'EGRESO',
    centroCosto: 'FEDERACION',
    categoria: 'PAGO FEDERACION',
    descripcion: 'Aporte gremial nacional mes de Agosto 2026',
    metodo: 'Transferencia Bancaria',
    monto: 280000,
    responsable: 'Alejandra Romanett Sias Novoa',
    comprobante: 'comprobante_fed_ago_2026.pdf',
    createdAt: '2026-08-03T09:45:00Z'
  },
  {
    id: 'mov-004',
    correlativo: 'MOV-2026-004',
    fecha: '2026-09-02',
    tipo: 'EGRESO',
    centroCosto: 'FEDERACION',
    categoria: 'PAGO FEDERACION',
    descripcion: 'Aporte gremial nacional mes de Septiembre 2026',
    metodo: 'Transferencia Bancaria',
    monto: 280000,
    responsable: 'Alejandra Romanett Sias Novoa',
    comprobante: 'comprobante_fed_sep_2026.pdf',
    createdAt: '2026-09-02T10:00:00Z'
  },
  {
    id: 'mov-005',
    correlativo: 'MOV-2026-005',
    fecha: '2026-10-02',
    tipo: 'EGRESO',
    centroCosto: 'FEDERACION',
    categoria: 'PAGO FEDERACION',
    descripcion: 'Aporte gremial nacional mes de Octubre 2026',
    metodo: 'Transferencia Bancaria',
    monto: 280000,
    responsable: 'Alejandra Romanett Sias Novoa',
    comprobante: 'comprobante_fed_oct_2026.pdf',
    createdAt: '2026-10-02T12:00:00Z'
  },
  {
    id: 'mov-006',
    correlativo: 'MOV-2026-006',
    fecha: '2026-10-04',
    tipo: 'INGRESO',
    centroCosto: 'ISI MUNDO COMISION',
    categoria: 'ISI MUNDO COMISION',
    descripcion: 'Comisión 2% liquidación convenio compras Isi Mundo',
    metodo: 'Transferencia Bancaria',
    monto: 54200,
    responsable: 'Alejandra Romanett Sias Novoa',
    comprobante: 'liquidacion_comision_isimundo_oct2026.pdf',
    createdAt: '2026-10-04T15:20:00Z'
  },
  {
    id: 'mov-007',
    correlativo: 'MOV-2026-007',
    fecha: '2026-10-05',
    tipo: 'INGRESO',
    centroCosto: 'CENA ANUAL',
    categoria: 'CENA ANUAL',
    descripcion: 'Recaudación fondo cuota cena anual ($2.000 x 262 socias)',
    metodo: 'Descuento Planilla',
    monto: 524000,
    responsable: 'Alejandra Romanett Sias Novoa',
    comprobante: 'comprobante_recaudacion_cena_oct2026.pdf',
    createdAt: '2026-10-05T09:00:00Z'
  },
  {
    id: 'mov-008',
    correlativo: 'MOV-2026-008',
    fecha: '2026-10-05',
    tipo: 'INGRESO',
    centroCosto: 'ASOCIACION',
    categoria: 'ASOCIACION',
    descripcion: 'Recaudación cuota gremial asociación ($1.000 x 262 socias)',
    metodo: 'Descuento Planilla',
    monto: 262000,
    responsable: 'Alejandra Romanett Sias Novoa',
    comprobante: 'comprobante_recaudacion_asoc_oct2026.pdf',
    createdAt: '2026-10-05T09:05:00Z'
  },
  {
    id: 'mov-009',
    correlativo: 'MOV-2026-009',
    fecha: '2026-10-08',
    tipo: 'EGRESO',
    centroCosto: 'CENA ANUAL',
    categoria: 'S.O.S',
    descripcion: 'Crédito de emergencia S.O.S aprobado para socia de Jardín Campanita',
    metodo: 'Transferencia Bancaria',
    monto: 120000,
    responsable: 'Alejandra Romanett Sias Novoa',
    comprobante: 'comprobante_transferencia_sos_0810.pdf',
    createdAt: '2026-10-08T16:40:00Z'
  },
  {
    id: 'mov-010',
    correlativo: 'MOV-2026-010',
    fecha: '2026-10-12',
    tipo: 'EGRESO',
    centroCosto: 'ASOCIACION',
    categoria: 'OTROS',
    descripcion: 'Adquisición de insumos de papelería e impresiones para asamblea general',
    metodo: 'Efectivo',
    monto: 45000,
    responsable: 'Alejandra Romanett Sias Novoa',
    comprobante: 'boleta_electronica_libreria_1210.pdf',
    createdAt: '2026-10-12T14:10:00Z'
  }
];

// Saldo base histórico consolidado acumulado en años anteriores
const SALDO_BASE_ASOCIACION = 5103000;
const SALDO_BASE_CENA_ANUAL = 8856000;

export const TreasuryService = {
  /**
   * Obtiene el resumen financiero calculado en tiempo real
   */
  async getSummary() {
    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalPagadoFederacion = 0;

    let ingresosAsociacion = 0;
    let egresosAsociacion = 0;

    let ingresosCenaAnual = 0;
    let egresosCenaAnual = 0;

    for (const mov of treasuryMovements) {
      const monto = Number(mov.monto) || 0;

      if (mov.tipo === 'INGRESO') {
        totalIngresos += monto;
        if (mov.centroCosto === 'ASOCIACION' || mov.centroCosto === 'ISI MUNDO COMISION') {
          ingresosAsociacion += monto;
        } else if (mov.centroCosto === 'CENA ANUAL') {
          ingresosCenaAnual += monto;
        }
      } else if (mov.tipo === 'EGRESO') {
        totalEgresos += monto;
        if (mov.centroCosto === 'FEDERACION') {
          totalPagadoFederacion += monto;
        } else if (mov.centroCosto === 'ASOCIACION') {
          egresosAsociacion += monto;
        } else if (mov.centroCosto === 'CENA ANUAL') {
          egresosCenaAnual += monto;
        }
      }
    }

    const saldoAsociacion = SALDO_BASE_ASOCIACION + ingresosAsociacion - egresosAsociacion;
    const saldoCenaAnual = SALDO_BASE_CENA_ANUAL + ingresosCenaAnual - egresosCenaAnual;
    const saldoTotal = saldoAsociacion + saldoCenaAnual;

    return {
      totalIngresos,
      totalEgresos,
      saldoTotal,
      totalMovimientos: treasuryMovements.length,
      totalPagadoFederacion,
      saldoAsociacion,
      saldoCenaAnual,
      centrosCosto: [
        { code: 'ASOCIACION', name: 'Asociación', saldo: saldoAsociacion },
        { code: 'CENA ANUAL', name: 'Cena Anual', saldo: saldoCenaAnual },
        { code: 'FEDERACION', name: 'Federación (Solo Pagos)', totalPagado: totalPagadoFederacion },
        { code: 'ISI MUNDO COMISION', name: 'Isi Mundo Comisión 2%', totalIngresado: 54200 }
      ]
    };
  },

  /**
   * Obtiene los movimientos con filtrado multidimensional
   */
  async getMovements(filters = {}) {
    let list = [...treasuryMovements];

    if (filters.tipo && filters.tipo !== 'TODOS') {
      list = list.filter((m) => m.tipo.toUpperCase() === filters.tipo.toUpperCase());
    }

    if (filters.centroCosto && filters.centroCosto !== 'TODOS') {
      list = list.filter((m) => m.centroCosto.toUpperCase() === filters.centroCosto.toUpperCase());
    }

    if (filters.metodo && filters.metodo !== 'TODOS') {
      list = list.filter((m) => m.metodo.toLowerCase().includes(filters.metodo.toLowerCase()));
    }

    if (filters.fechaDesde) {
      list = list.filter((m) => m.fecha >= filters.fechaDesde);
    }

    if (filters.fechaHasta) {
      list = list.filter((m) => m.fecha <= filters.fechaHasta);
    }

    if (filters.fechaExacta) {
      list = list.filter((m) => m.fecha === filters.fechaExacta);
    }

    // Orden cronológico descendente (los más recientes primero)
    list.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return list;
  },

  /**
   * Obtiene un movimiento por su identificador
   */
  async getMovementById(id) {
    return treasuryMovements.find((m) => m.id === id) || null;
  },

  /**
   * Registra un nuevo movimiento en la Tesorería con validación estricta
   */
  async createMovement({
    tipo,
    fecha,
    descripcion,
    centroCosto,
    categoria,
    monto,
    metodo,
    responsable,
    comprobante,
    comprobanteArchivo
  }) {
    const cleanTipo = tipo.toUpperCase();
    const cleanMonto = Math.round(Number(monto));

    if (!cleanMonto || cleanMonto <= 0) {
      throw new Error('El monto del movimiento debe ser un valor numérico mayor a cero.');
    }

    // Regla de Negocio: En caso de EGRESO, el comprobante es estrictamente OBLIGATORIO
    if (cleanTipo === 'EGRESO' && (!comprobante || comprobante.trim() === '')) {
      throw new Error('No es posible registrar un egreso sin comprobante de respaldo obligatorio.');
    }

    // Determinación del centro de costo y categoría según especificaciones de la Asociación
    let resolvedCentroCosto = centroCosto;
    let resolvedCategoria = categoria;

    if (cleanTipo === 'EGRESO') {
      if (categoria === 'PAGO FEDERACION' || centroCosto === 'FEDERACION') {
        resolvedCentroCosto = 'FEDERACION';
        resolvedCategoria = 'PAGO FEDERACION';
      } else if (categoria === 'S.O.S' || categoria === 'CENA') {
        resolvedCentroCosto = 'CENA ANUAL';
      } else {
        resolvedCentroCosto = 'ASOCIACION';
      }
    } else if (cleanTipo === 'INGRESO') {
      if (!['ASOCIACION', 'CENA ANUAL', 'ISI MUNDO COMISION'].includes(resolvedCentroCosto)) {
        resolvedCentroCosto = 'ASOCIACION';
      }
    }

    const nextIndex = treasuryMovements.length + 1;
    const nextCorrelativo = `MOV-2026-${String(nextIndex).padStart(3, '0')}`;

    const newMovement = {
      id: `mov-${Date.now()}`,
      correlativo: nextCorrelativo,
      fecha: fecha || new Date().toISOString().split('T')[0],
      tipo: cleanTipo,
      centroCosto: resolvedCentroCosto,
      categoria: resolvedCategoria || resolvedCentroCosto,
      descripcion: descripcion.trim(),
      metodo: metodo || 'Transferencia Bancaria',
      monto: cleanMonto,
      responsable: responsable || 'Alejandra Romanett Sias Novoa',
      comprobante: comprobante ? comprobante.trim() : null,
      // Metadatos del archivo físico guardado en backend/uploads (null en registros históricos)
      comprobanteArchivo: comprobanteArchivo || null,
      createdAt: new Date().toISOString()
    };

    treasuryMovements.unshift(newMovement);
    return newMovement;
  }
};
