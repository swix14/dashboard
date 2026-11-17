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
import { INITIAL_MOVEMENTS } from './seedData.js';

// Reintentos si dos registros simultáneos calculan el mismo correlativo
const CORRELATIVO_MAX_INTENTOS = 5;

// Error de regla de negocio (400). Cualquier otro error (por ejemplo, de MySQL) es interno (500).
export class TreasuryError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Movimientos en memoria: solo sin base de datos (desarrollo y tests). Los ejemplos viven en seedData.js
const treasuryMovements = INITIAL_MOVEMENTS.map((m) => ({ ...m }));

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

// Columnas del libro de movimientos (listado y detalle usan las mismas)
const COLUMNAS_MOVIMIENTO = `id, correlativo, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, tipo,
                 centro_costo as centroCosto, categoria, descripcion, metodo,
                 monto, responsable, comprobante,
                 comprobante_stored as comprobanteStored,
                 comprobante_mime as comprobanteMime,
                 comprobante_size as comprobanteSize,
                 ${COLUMNAS_CORRECCION},
                 created_at as createdAt`;

/** Fila de MySQL → movimiento, con el archivo del comprobante agrupado cuando existe */
function aMovimiento(row) {
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
}

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
      let sql = `SELECT ${COLUMNAS_MOVIMIENTO} FROM movimientos_tesoreria WHERE 1=1`;
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
      return rows.map(aMovimiento);
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
        `SELECT ${COLUMNAS_MOVIMIENTO} FROM movimientos_tesoreria WHERE id = ? OR correlativo = ?`,
        [id, id]
      );
      return rows.length === 0 ? null : aMovimiento(rows[0]);
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
    const cleanFecha = fecha || hoyChile();
    const movYear = cleanFecha.substring(0, 4);

    // Datos del movimiento (iguales en MySQL y en memoria); falta el id y el correlativo
    const movimiento = {
      fecha: cleanFecha,
      tipo: cleanTipo,
      centroCosto: resolvedCentroCosto,
      categoria: resolvedCategoria || resolvedCentroCosto,
      descripcion: descripcion.trim(),
      metodo: metodo || 'Transferencia Bancaria',
      monto: cleanMonto,
      responsable: responsable || 'Tesorera General VTF',
      comprobante: comprobante ? comprobante.trim() : null,
      comprobanteArchivo: comprobanteArchivo || null,
      createdAt: new Date().toISOString()
    };

    if (isDatabaseReady()) {
      // Correlativo por año. La columna es UNIQUE: si dos movimientos se registran a la vez y
      // calculan el mismo número, el segundo choca (ER_DUP_ENTRY) y se recalcula (auditoría H-013).
      for (let intento = 1; intento <= CORRELATIVO_MAX_INTENTOS; intento++) {
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
        const correlativo = `MOV-${movYear}-${String(nextSeq).padStart(3, '0')}`;

        try {
          const insertRes = await query(
            `INSERT INTO movimientos_tesoreria
             (correlativo, fecha, tipo, centro_costo, categoria, descripcion, metodo, monto, responsable, comprobante, comprobante_stored, comprobante_mime, comprobante_size)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              correlativo,
              movimiento.fecha,
              movimiento.tipo,
              movimiento.centroCosto,
              movimiento.categoria,
              movimiento.descripcion,
              movimiento.metodo,
              movimiento.monto,
              movimiento.responsable,
              movimiento.comprobante,
              comprobanteArchivo ? comprobanteArchivo.storedName : null,
              comprobanteArchivo ? comprobanteArchivo.mimeType : null,
              comprobanteArchivo ? comprobanteArchivo.size : null
            ]
          );
          return { id: insertRes.insertId, correlativo, ...movimiento };
        } catch (err) {
          const choqueDeCorrelativo = err.code === 'ER_DUP_ENTRY' && intento < CORRELATIVO_MAX_INTENTOS;
          if (!choqueDeCorrelativo) throw err;
        }
      }
    }

    // Modo memoria (sin MySQL): siguiente número del año entre los movimientos cargados
    const existingSeqs = treasuryMovements
      .map((m) => {
        const match = m.correlativo && m.correlativo.match(new RegExp(`^MOV-${movYear}-(\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const maxSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) : 0;

    const newMovement = {
      id: `mov-${Date.now()}`,
      correlativo: `MOV-${movYear}-${String(maxSeq + 1).padStart(3, '0')}`,
      ...movimiento
    };
    treasuryMovements.unshift(newMovement);
    return newMovement;
  }
};
