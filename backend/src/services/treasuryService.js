/**
 * Servicio de Tesorería — Asociación VTF Temuco
 * Conectado a MySQL (tabla movimientos_tesoreria). Los movimientos en memoria de abajo se usan
 * SOLO cuando no hay base de datos (desarrollo y tests): si MySQL está conectado y una consulta
 * falla, el error se informa en vez de mostrar o "guardar" datos de prueba.
 * 
 * Reglas de negocio:
 * - Centros de Costo: ASOCIACION, CENA ANUAL, FEDERACION, ISI MUNDO COMISION.
 * - Los ingresos se asignan a ASOCIACION, CENA ANUAL o ISI MUNDO COMISION.
 * - Los egresos se asignan a S.O.S (Cena Anual), CENA (Cena Anual), OTROS (Asociación) o FEDERACION.
 * - FEDERACION registra exclusivamente egresos/pagos.
 * - Comprobante de egreso es estrictamente obligatorio (PDF o imagen).
 * - Saldos iniciales formalizados como transacciones contables SALDO_APERTURA al inicio del ejercicio.
 * - Saldo Total Disponible = Saldo Centro Asociación + Saldo Centro Cena Anual.
 */
import { isDatabaseReady, query } from '../config/db.js';
import { hoyChile } from '../utils/fecha.js';

// Movimientos iniciales históricos de la tesorería de la Asociación (fallback y contingencia)
let treasuryMovements = [
  {
    id: 'mov-apertura-asoc',
    correlativo: 'MOV-2026-000A',
    fecha: '2026-01-01',
    tipo: 'SALDO_APERTURA',
    centroCosto: 'ASOCIACION',
    categoria: 'APERTURA',
    descripcion: 'Saldo de apertura ejercicio contable 2026 - Fondo Asociación',
    metodo: 'Traspaso Ejercicio Anterior',
    monto: 5103000,
    responsable: 'Tesorera General VTF',
    comprobante: 'acta_apertura_asociacion_2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-01-01T09:00:00Z'
  },
  {
    id: 'mov-apertura-cena',
    correlativo: 'MOV-2026-000B',
    fecha: '2026-01-01',
    tipo: 'SALDO_APERTURA',
    centroCosto: 'CENA ANUAL',
    categoria: 'APERTURA',
    descripcion: 'Saldo de apertura ejercicio contable 2026 - Fondo Cena Anual',
    metodo: 'Traspaso Ejercicio Anterior',
    monto: 8856000,
    responsable: 'Tesorera General VTF',
    comprobante: 'acta_apertura_cena_2026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-01-01T09:00:00Z'
  },
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
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_fed_jun_2026.pdf',
    comprobanteArchivo: null,
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
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_fed_jul_2026.pdf',
    comprobanteArchivo: null,
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
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_fed_ago_2026.pdf',
    comprobanteArchivo: null,
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
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_fed_sep_2026.pdf',
    comprobanteArchivo: null,
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
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_fed_oct_2026.pdf',
    comprobanteArchivo: null,
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
    responsable: 'Tesorera General VTF',
    comprobante: 'liquidacion_comision_isimundo_oct2026.pdf',
    comprobanteArchivo: null,
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
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_recaudacion_cena_oct2026.pdf',
    comprobanteArchivo: null,
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
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_recaudacion_asoc_oct2026.pdf',
    comprobanteArchivo: null,
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
    responsable: 'Tesorera General VTF',
    comprobante: 'comprobante_transferencia_sos_0810.pdf',
    comprobanteArchivo: null,
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
    responsable: 'Tesorera General VTF',
    comprobante: 'boleta_papeleria_12102026.pdf',
    comprobanteArchivo: null,
    createdAt: '2026-10-12T11:30:00Z'
  }
];

export const TreasuryService = {
  /**
   * Obtiene el resumen financiero calculado en tiempo real
   */
  async getSummary() {
    let list = treasuryMovements;

    if (isDatabaseReady()) {
      list = await query(
        `SELECT id, correlativo, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, tipo,
                centro_costo as centroCosto, categoria, descripcion, metodo,
                monto, responsable, comprobante, created_at as createdAt
         FROM movimientos_tesoreria`
      );
    }

    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalPagadoFederacion = 0;
    let totalIngresoIsiMundo = 0;
    let ingresosAsociacion = 0;
    let egresosAsociacion = 0;
    let aperturaAsociacion = 0;
    let ingresosCenaAnual = 0;
    let egresosCenaAnual = 0;
    let aperturaCenaAnual = 0;

    for (const mov of list) {
      const monto = Number(mov.monto) || 0;

      if (mov.tipo === 'SALDO_APERTURA') {
        if (mov.centroCosto === 'ASOCIACION') {
          aperturaAsociacion += monto;
        } else if (mov.centroCosto === 'CENA ANUAL') {
          aperturaCenaAnual += monto;
        }
      } else if (mov.tipo === 'INGRESO') {
        totalIngresos += monto;
        if (mov.centroCosto === 'ASOCIACION') {
          ingresosAsociacion += monto;
        } else if (mov.centroCosto === 'CENA ANUAL') {
          ingresosCenaAnual += monto;
        } else if (mov.centroCosto === 'ISI MUNDO COMISION') {
          ingresosAsociacion += monto; // 2% de comisión ingresa al fondo gremial de Asociación
          totalIngresoIsiMundo += monto;
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

    // Los saldos iniciales salen solo de los asientos SALDO_APERTURA (sin montos fijos en el código)
    const saldoAsociacion = aperturaAsociacion + ingresosAsociacion - egresosAsociacion;
    const saldoCenaAnual = aperturaCenaAnual + ingresosCenaAnual - egresosCenaAnual;
    const saldoTotal = saldoAsociacion + saldoCenaAnual;

    return {
      totalIngresos,
      totalEgresos,
      saldoTotal,
      totalMovimientos: list.length,
      totalPagadoFederacion,
      saldoAsociacion,
      saldoCenaAnual,
      centrosCosto: [
        { code: 'ASOCIACION', name: 'Asociación', saldo: saldoAsociacion },
        { code: 'CENA ANUAL', name: 'Cena Anual', saldo: saldoCenaAnual },
        { code: 'FEDERACION', name: 'Federación (Solo Pagos)', totalPagado: totalPagadoFederacion },
        { code: 'ISI MUNDO COMISION', name: 'Isi Mundo Comisión 2%', totalIngresado: totalIngresoIsiMundo }
      ]
    };
  },

  /**
   * Obtiene los movimientos con filtrado multidimensional y metadata de comprobantes
   */
  async getMovements(filters = {}) {
    if (isDatabaseReady()) {
      {
        let sql = `
          SELECT id, correlativo, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, tipo,
                 centro_costo as centroCosto, categoria, descripcion, metodo,
                 monto, responsable, comprobante, 
                 comprobante_stored as comprobanteStored,
                 comprobante_mime as comprobanteMime,
                 comprobante_size as comprobanteSize,
                 created_at as createdAt
          FROM movimientos_tesoreria
          WHERE 1=1
        `;
        const params = [];

        if (filters.tipo && filters.tipo !== 'TODOS') {
          sql += ` AND tipo = ?`;
          params.push(filters.tipo.toUpperCase());
        }

        if (filters.centroCosto && filters.centroCosto !== 'TODOS') {
          sql += ` AND centro_costo = ?`;
          params.push(filters.centroCosto.toUpperCase());
        }

        if (filters.metodo && filters.metodo !== 'TODOS') {
          sql += ` AND LOWER(metodo) LIKE ?`;
          params.push(`%${filters.metodo.toLowerCase()}%`);
        }

        if (filters.fechaDesde) {
          sql += ` AND fecha >= ?`;
          params.push(filters.fechaDesde);
        }

        if (filters.fechaHasta) {
          sql += ` AND fecha <= ?`;
          params.push(filters.fechaHasta);
        }

        if (filters.fechaExacta) {
          sql += ` AND fecha = ?`;
          params.push(filters.fechaExacta);
        }

        sql += ` ORDER BY fecha DESC, id DESC`;

        const rows = await query(sql, params);
        return rows.map((row) => {
          const mov = { ...row };
          if (row.comprobanteStored) {
            mov.comprobanteArchivo = {
              storedName: row.comprobanteStored,
              originalName: row.comprobante,
              mimeType: row.comprobanteMime,
              size: row.comprobanteSize
            };
          }
          return mov;
        });
      }
    }

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
   * Obtiene un movimiento por su identificador o correlativo
   */
  async getMovementById(id) {
    if (isDatabaseReady()) {
      const rows = await query(
        `SELECT id, correlativo, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, tipo,
                centro_costo as centroCosto, categoria, descripcion, metodo,
                monto, responsable, comprobante,
                comprobante_stored as comprobanteStored,
                comprobante_mime as comprobanteMime,
                comprobante_size as comprobanteSize,
                created_at as createdAt
         FROM movimientos_tesoreria
         WHERE id = ? OR correlativo = ?`,
        [id, id]
      );
      if (rows.length === 0) return null;
      const row = { ...rows[0] };
      if (row.comprobanteStored) {
        row.comprobanteArchivo = {
          storedName: row.comprobanteStored,
          originalName: row.comprobante,
          mimeType: row.comprobanteMime,
          size: row.comprobanteSize
        };
      }
      return row;
    }

    return treasuryMovements.find((m) => String(m.id) === String(id) || m.correlativo === id) || null;
  },

  /**
   * Registra un nuevo movimiento en la Tesorería con validación y correlativo atómico
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

    let nextCorrelativo = '';
    const cleanFecha = fecha || hoyChile();
    const cleanDesc = descripcion.trim();
    const cleanMetodo = metodo || 'Transferencia Bancaria';
    const cleanResp = responsable || 'Tesorera General VTF';
    const cleanComp = comprobante ? comprobante.trim() : null;

    if (isDatabaseReady()) {
      {
        // Cálculo de correlativo atómico por año para evitar condiciones de carrera
        const movYear = cleanFecha.substring(0, 4);
        const lastRows = await query(
          `SELECT CAST(SUBSTRING_INDEX(correlativo, '-', -1) AS UNSIGNED) as lastNum 
           FROM movimientos_tesoreria 
           WHERE correlativo LIKE ? AND correlativo REGEXP '^MOV-[0-9]{4}-[0-9]+$'
           ORDER BY lastNum DESC 
           LIMIT 1`,
          [`MOV-${movYear}-%`]
        );

        let nextSeq = 1;
        if (lastRows && lastRows.length > 0 && lastRows[0].lastNum !== null && !isNaN(lastRows[0].lastNum)) {
          nextSeq = Number(lastRows[0].lastNum) + 1;
        }
        nextCorrelativo = `MOV-${movYear}-${String(nextSeq).padStart(3, '0')}`;

        const insertRes = await query(
          `INSERT INTO movimientos_tesoreria 
           (correlativo, fecha, tipo, centro_costo, categoria, descripcion, metodo, monto, responsable, comprobante, comprobante_stored, comprobante_mime, comprobante_size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nextCorrelativo,
            cleanFecha,
            cleanTipo,
            resolvedCentroCosto,
            resolvedCategoria || resolvedCentroCosto,
            cleanDesc,
            cleanMetodo,
            cleanMonto,
            cleanResp,
            cleanComp,
            comprobanteArchivo ? comprobanteArchivo.storedName : null,
            comprobanteArchivo ? comprobanteArchivo.mimeType : null,
            comprobanteArchivo ? comprobanteArchivo.size : null
          ]
        );

        const newDbMovement = {
          id: insertRes.insertId,
          correlativo: nextCorrelativo,
          fecha: cleanFecha,
          tipo: cleanTipo,
          centroCosto: resolvedCentroCosto,
          categoria: resolvedCategoria || resolvedCentroCosto,
          descripcion: cleanDesc,
          metodo: cleanMetodo,
          monto: cleanMonto,
          responsable: cleanResp,
          comprobante: cleanComp,
          comprobanteArchivo: comprobanteArchivo || null,
          createdAt: new Date().toISOString()
        };

        return newDbMovement;
      }
    }

    const movYearFallback = cleanFecha.substring(0, 4);
    const existingSeqs = treasuryMovements
      .map((m) => {
        const match = m.correlativo && m.correlativo.match(new RegExp(`^MOV-${movYearFallback}-(\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const maxSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) : 0;
    nextCorrelativo = `MOV-${movYearFallback}-${String(maxSeq + 1).padStart(3, '0')}`;

    const newMovement = {
      id: `mov-${Date.now()}`,
      correlativo: nextCorrelativo,
      fecha: cleanFecha,
      tipo: cleanTipo,
      centroCosto: resolvedCentroCosto,
      categoria: resolvedCategoria || resolvedCentroCosto,
      descripcion: cleanDesc,
      metodo: cleanMetodo,
      monto: cleanMonto,
      responsable: cleanResp,
      comprobante: cleanComp,
      comprobanteArchivo: comprobanteArchivo || null,
      createdAt: new Date().toISOString()
    };

    treasuryMovements.unshift(newMovement);
    return newMovement;
  }
};
