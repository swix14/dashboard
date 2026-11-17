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

// Error de regla de negocio (400). Cualquier otro error (por ejemplo, de MySQL) es interno (500).
// Reintentos si dos registros simultáneos calculan el mismo correlativo
const CORRELATIVO_MAX_INTENTOS = 5;

export class TreasuryError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

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

/**
 * Totales y saldos de una lista de movimientos (misma regla contable para el resumen
 * de Tesorería y el informe mensual). Federación solo registra pagos: no descuenta saldo.
 */
export function resumirMovimientos(list) {
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
}

// Datos de anulación y edición que se muestran en el libro de movimientos
// (fechas como texto AAAA-MM-DD en hora del servidor, para no correr el día al pasar a UTC)
const COLUMNAS_CORRECCION = `anulado, motivo_anulacion as motivoAnulacion, anulado_por as anuladoPor,
                 DATE_FORMAT(anulado_at, '%Y-%m-%d') as anuladoAt, editado_por as editadoPor,
                 DATE_FORMAT(editado_at, '%Y-%m-%d') as editadoAt`;

/**
 * Centro de costo y categoría según las reglas de la Asociación (alta y edición usan la misma regla):
 * egresos S.O.S/CENA → Cena Anual, Federación → FEDERACION, resto → Asociación;
 * ingresos solo a Asociación, Cena Anual o Isi Mundo Comisión.
 */
function resolverCentroCosto(tipo, centroCosto, categoria) {
  if (tipo === 'EGRESO') {
    if (categoria === 'PAGO FEDERACION' || centroCosto === 'FEDERACION') return { centroCosto: 'FEDERACION', categoria: 'PAGO FEDERACION' };
    if (categoria === 'S.O.S' || categoria === 'CENA') return { centroCosto: 'CENA ANUAL', categoria };
    return { centroCosto: 'ASOCIACION', categoria };
  }
  const cc = ['ASOCIACION', 'CENA ANUAL', 'ISI MUNDO COMISION'].includes(centroCosto) ? centroCosto : 'ASOCIACION';
  return { centroCosto: cc, categoria };
}

/** Movimiento corregible: existe, no es asiento de apertura y no está anulado */
async function movimientoCorregible(id) {
  if (!isDatabaseReady()) throw new TreasuryError('La corrección de movimientos requiere la base de datos.', 503);
  const [row] = await query(
    `SELECT id, correlativo, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, tipo, centro_costo as centroCosto, categoria,
            descripcion, metodo, monto, comprobante, comprobante_stored as comprobanteStored, anulado
     FROM movimientos_tesoreria WHERE id = ?`,
    [id]
  );
  if (!row) throw new TreasuryError('Movimiento no encontrado.', 404);
  if (row.tipo === 'SALDO_APERTURA') throw new TreasuryError('Los saldos de apertura no se modifican desde el sistema.', 409);
  if (row.anulado) throw new TreasuryError(`El movimiento ${row.correlativo} está anulado: no se puede modificar.`, 409);
  return row;
}

export const TreasuryService = {
  /**
   * Corrige un movimiento (fecha, monto, descripción, método, categoría y, si se adjunta, el comprobante).
   * El tipo no cambia: un ingreso mal ingresado como egreso se anula y se registra de nuevo.
   * El comprobante anterior se conserva en el servidor; la auditoría guarda el antes y el después.
   * @returns {{ antes: object, despues: object }}
   */
  async updateMovement(id, datos, comprobanteArchivo, editadoPor) {
    const antes = await movimientoCorregible(id);
    const { centroCosto, categoria } = resolverCentroCosto(antes.tipo, datos.centroCosto, datos.categoria);
    if (antes.tipo === 'EGRESO' && !comprobanteArchivo && !antes.comprobante) {
      throw new TreasuryError('Un egreso debe quedar con su comprobante: adjunte el archivo.');
    }
    const despues = {
      fecha: datos.fecha,
      centroCosto,
      categoria: categoria || centroCosto,
      descripcion: datos.descripcion.trim(),
      metodo: datos.metodo,
      monto: datos.monto,
      comprobante: comprobanteArchivo ? comprobanteArchivo.originalName : antes.comprobante
    };
    await query(
      `UPDATE movimientos_tesoreria
       SET fecha = ?, centro_costo = ?, categoria = ?, descripcion = ?, metodo = ?, monto = ?, comprobante = ?,
           comprobante_stored = COALESCE(?, comprobante_stored), comprobante_mime = COALESCE(?, comprobante_mime),
           comprobante_size = COALESCE(?, comprobante_size), editado_por = ?, editado_at = NOW()
       WHERE id = ? AND anulado = 0`,
      [
        despues.fecha, despues.centroCosto, despues.categoria, despues.descripcion, despues.metodo, despues.monto, despues.comprobante,
        comprobanteArchivo?.storedName ?? null, comprobanteArchivo?.mimeType ?? null, comprobanteArchivo?.size ?? null,
        editadoPor, id
      ]
    );
    const { anulado, comprobanteStored, ...antesVisible } = antes;
    return { correlativo: antes.correlativo, antes: antesVisible, despues: { ...despues, comprobanteReemplazado: Boolean(comprobanteArchivo) } };
  },

  /** Anula un movimiento: queda en el libro, marcado y con su motivo, pero no suma en ningún saldo */
  async annulMovement(id, motivo, anuladoPor) {
    const mov = await movimientoCorregible(id);
    await query(
      `UPDATE movimientos_tesoreria SET anulado = 1, motivo_anulacion = ?, anulado_por = ?, anulado_at = NOW() WHERE id = ? AND anulado = 0`,
      [motivo, anuladoPor, id]
    );
    return { correlativo: mov.correlativo, tipo: mov.tipo, monto: mov.monto, centroCosto: mov.centroCosto };
  },

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
         FROM movimientos_tesoreria
         WHERE anulado = 0`
      );
    }

    return resumirMovimientos(list);
  },

  /**
   * Movimientos con fecha hasta fechaFin inclusive (YYYY-MM-DD), para el informe mensual
   */
  async listarHasta(fechaFin) {
    if (isDatabaseReady()) {
      return query(
        `SELECT id, correlativo, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, tipo,
                centro_costo as centroCosto, categoria, descripcion, monto
         FROM movimientos_tesoreria
         WHERE fecha <= ? AND anulado = 0
         ORDER BY fecha ASC, id ASC`,
        [fechaFin]
      );
    }
    return treasuryMovements.filter((m) => m.fecha <= fechaFin);
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
                 ${COLUMNAS_CORRECCION},
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
          const mov = { ...row, anulado: Boolean(row.anulado) };
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
                ${COLUMNAS_CORRECCION},
                created_at as createdAt
         FROM movimientos_tesoreria
         WHERE id = ? OR correlativo = ?`,
        [id, id]
      );
      if (rows.length === 0) return null;
      const row = { ...rows[0], anulado: Boolean(rows[0].anulado) };
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

    if (cleanTipo !== 'INGRESO' && cleanTipo !== 'EGRESO') {
      throw new TreasuryError('Solo se pueden registrar movimientos de tipo INGRESO o EGRESO.');
    }

    if (!cleanMonto || cleanMonto <= 0) {
      throw new TreasuryError('El monto del movimiento debe ser un valor numérico mayor a cero.');
    }

    // Regla de Negocio: En caso de EGRESO, el comprobante es estrictamente OBLIGATORIO
    if (cleanTipo === 'EGRESO' && (!comprobante || comprobante.trim() === '')) {
      throw new TreasuryError('No es posible registrar un egreso sin comprobante de respaldo obligatorio.');
    }

    const { centroCosto: resolvedCentroCosto, categoria: resolvedCategoria } = resolverCentroCosto(cleanTipo, centroCosto, categoria);

    let nextCorrelativo = '';
    const cleanFecha = fecha || hoyChile();
    const cleanDesc = descripcion.trim();
    const cleanMetodo = metodo || 'Transferencia Bancaria';
    const cleanResp = responsable || 'Tesorera General VTF';
    const cleanComp = comprobante ? comprobante.trim() : null;

    if (isDatabaseReady()) {
      {
        // Correlativo por año. La columna es UNIQUE: si dos movimientos se registran a la vez y
        // calculan el mismo número, el segundo choca (ER_DUP_ENTRY) y se recalcula (auditoría H-013).
        const movYear = cleanFecha.substring(0, 4);
        let insertRes = null;
        for (let intento = 1; intento <= CORRELATIVO_MAX_INTENTOS && !insertRes; intento++) {
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

          try {
            insertRes = await query(
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
          } catch (err) {
            const choqueDeCorrelativo = err.code === 'ER_DUP_ENTRY' && intento < CORRELATIVO_MAX_INTENTOS;
            if (!choqueDeCorrelativo) throw err;
          }
        }

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
