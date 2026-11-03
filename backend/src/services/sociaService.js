/**
 * Servicio del Padrón de Socias y Créditos — Asociación VTF Temuco (V3)
 * Reglas de negocio:
 * - Estados: ACTIVA / SUSPENDIDA. A una socia suspendida NO se le cobra la cuota social.
 * - Cuota social fija de $4.000 CLP mensuales para socias activas.
 * - Cada jardín tiene una delegada electa.
 * - Un traslado de jardín queda registrado en el historial de la socia.
 * - Columna CRÉDITO: SI cuando la socia mantiene al menos un crédito ACTIVO.
 *
 * Nota: opera en memoria (igual que Tesorería) hasta que se conecte la base de datos.
 */
import { isDatabaseReady, query } from '../config/db.js';
import { INITIAL_JARDINES } from './seedData.js';
import { INITIAL_SOCIAS, CUOTA_SOCIAL_MENSUAL } from './sociasSeedData.js';
import { formatRutWithDots } from '../utils/rutValidator.js';

// Copia profunda para que los cambios en memoria no alteren los datos semilla
let socias = INITIAL_SOCIAS.map((s) => ({
  ...s,
  creditos: s.creditos.map((c) => ({ ...c })),
  historialJardin: [...s.historialJardin]
}));

class SociaError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const normalizeRut = (rut) => String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();

const normalizeText = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function findJardin(jardinId) {
  return INITIAL_JARDINES.find((j) => j.id === jardinId) || null;
}

function creditosActivos(socia) {
  return socia.creditos.filter((c) => c.estado === 'ACTIVO');
}

/**
 * Vista de la socia para el listado (resumen de créditos, sin detalle)
 */
function toListItem(socia) {
  const jardin = findJardin(socia.jardinId);
  const activos = creditosActivos(socia);

  return {
    id: socia.id,
    rut: socia.rut,
    firstName: socia.firstName,
    lastName: socia.lastName,
    cargo: socia.cargo,
    estado: socia.estado,
    cargoDirectiva: socia.cargoDirectiva,
    esDelegada: socia.esDelegada,
    fechaIncorporacion: socia.fechaIncorporacion,
    jardin: jardin ? { id: jardin.id, code: jardin.code, name: jardin.name } : null,
    cuotaMensual: socia.estado === 'ACTIVA' ? CUOTA_SOCIAL_MENSUAL : 0,
    tieneCredito: activos.length > 0,
    creditosActivos: activos.map((c) => ({
      tipo: c.tipo,
      cuotasPagadas: c.cuotasPagadas,
      totalCuotas: c.totalCuotas
    }))
  };
}

function toDetail(socia) {
  const activos = creditosActivos(socia);
  return {
    ...toListItem(socia),
    creditos: socia.creditos.map((c) => ({
      ...c,
      saldoPendiente: Math.max(c.totalCuotas - c.cuotasPagadas, 0) * c.valorCuota
    })),
    descuentoMensualCreditos: activos.reduce((sum, c) => sum + c.valorCuota, 0),
    historialJardin: socia.historialJardin.map((h) => ({
      ...h,
      jardinAnterior: findJardin(h.jardinAnteriorId)?.name || h.jardinAnteriorId,
      jardinNuevo: findJardin(h.jardinNuevoId)?.name || h.jardinNuevoId
    }))
  };
}

export const SociaService = {
  /**
   * Resumen del padrón para los recuadros KPI
   */
  async getSummary() {
    const activas = socias.filter((s) => s.estado === 'ACTIVA');
    const conCredito = socias.filter((s) => creditosActivos(s).length > 0);
    const creditosVigentes = socias.flatMap(creditosActivos);

    const porTipoCredito = {};
    for (const c of creditosVigentes) {
      porTipoCredito[c.tipo] = (porTipoCredito[c.tipo] || 0) + 1;
    }

    return {
      totalSocias: socias.length,
      sociasActivas: activas.length,
      sociasSuspendidas: socias.length - activas.length,
      sociasConCredito: conCredito.length,
      creditosVigentes: creditosVigentes.length,
      saldoCreditosPendiente: creditosVigentes.reduce(
        (sum, c) => sum + Math.max(c.totalCuotas - c.cuotasPagadas, 0) * c.valorCuota,
        0
      ),
      porTipoCredito,
      totalJardines: INITIAL_JARDINES.length,
      recaudacionMensualEsperada: activas.length * CUOTA_SOCIAL_MENSUAL,
      porCargo: {
        DIRECTORA: socias.filter((s) => s.cargo === 'DIRECTORA').length,
        EDUCADORA: socias.filter((s) => s.cargo === 'EDUCADORA').length,
        TECNICO: socias.filter((s) => s.cargo === 'TECNICO').length
      }
    };
  },

  /**
   * Lista el padrón con filtros combinables
   */
  async getSocias(filters = {}) {
    let list = [...socias];

    if (filters.search) {
      const term = normalizeText(filters.search.trim());
      const termRut = normalizeRut(filters.search);
      list = list.filter(
        (s) =>
          normalizeText(`${s.firstName} ${s.lastName}`).includes(term) ||
          (termRut.length >= 3 && normalizeRut(s.rut).includes(termRut))
      );
    }

    if (filters.jardinId && filters.jardinId !== 'TODOS') {
      list = list.filter((s) => s.jardinId === filters.jardinId);
    }

    if (filters.estado && filters.estado !== 'TODOS') {
      list = list.filter((s) => s.estado === filters.estado.toUpperCase());
    }

    if (filters.cargo && filters.cargo !== 'TODOS') {
      list = list.filter((s) => s.cargo === filters.cargo.toUpperCase());
    }

    if (filters.credito === 'SI') {
      list = list.filter((s) => creditosActivos(s).length > 0);
    } else if (filters.credito === 'NO') {
      list = list.filter((s) => creditosActivos(s).length === 0);
    }

    list.sort((a, b) => a.lastName.localeCompare(b.lastName, 'es') || a.firstName.localeCompare(b.firstName, 'es'));

    return list.map(toListItem);
  },

  /**
   * Ficha completa de una socia con créditos e historial de traslados
   */
  async getSociaById(id) {
    const socia = socias.find((s) => s.id === id);
    if (!socia) {
      throw new SociaError('Socia no encontrada en el padrón.', 404);
    }
    return toDetail(socia);
  },

  /**
   * Incorpora una nueva socia al padrón
   */
  async createSocia({ rut, firstName, lastName, cargo, estado, jardinId }) {
    if (socias.some((s) => normalizeRut(s.rut) === normalizeRut(rut))) {
      throw new SociaError('Ya existe una socia registrada con ese RUT.', 409);
    }

    if (!findJardin(jardinId)) {
      throw new SociaError('El jardín seleccionado no existe.');
    }

    const socia = {
      id: `socia-${Date.now()}`,
      rut: formatRutWithDots(rut),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      cargo,
      estado: estado || 'ACTIVA',
      jardinId,
      cargoDirectiva: null,
      esDelegada: false,
      fechaIncorporacion: new Date().toISOString().slice(0, 10),
      creditos: [],
      historialJardin: []
    };

    socias.push(socia);

    // Sincronización persistente en MySQL si la base de datos está disponible
    if (isDatabaseReady()) {
      try {
        const jardinObj = findJardin(jardinId);
        await query(
          `INSERT INTO socias (rut, apellido_paterno, apellido_materno, nombres, cargo, jardin)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [socia.rut, socia.lastName, '', socia.firstName, socia.cargo, jardinObj?.name || '']
        );
      } catch (dbErr) {
        console.warn('Advertencia: no se pudo sincronizar inserción en MySQL (socias):', dbErr.message);
      }
    }

    return toDetail(socia);
  },

  /**
   * Actualiza datos, estado o jardín de una socia.
   * Devuelve la ficha actualizada y la lista de campos modificados (para auditoría).
   */
  async updateSocia(id, changes, changedBy) {
    const socia = socias.find((s) => s.id === id);
    if (!socia) {
      throw new SociaError('Socia no encontrada en el padrón.', 404);
    }

    const cambios = {};

    for (const field of ['firstName', 'lastName', 'cargo', 'estado']) {
      if (changes[field] !== undefined) {
        const value = typeof changes[field] === 'string' ? changes[field].trim() : changes[field];
        if (value !== socia[field]) {
          cambios[field] = { anterior: socia[field], nuevo: value };
          socia[field] = value;
        }
      }
    }

    if (changes.jardinId && changes.jardinId !== socia.jardinId) {
      if (!findJardin(changes.jardinId)) {
        throw new SociaError('El jardín de destino no existe.');
      }
      if (!changes.motivoTraslado || changes.motivoTraslado.trim().length < 3) {
        throw new SociaError('Debe indicar el motivo del traslado de jardín.');
      }

      socia.historialJardin.unshift({
        id: `tras-${Date.now()}`,
        jardinAnteriorId: socia.jardinId,
        jardinNuevoId: changes.jardinId,
        motivo: changes.motivoTraslado.trim(),
        changedBy,
        fecha: new Date().toISOString()
      });

      cambios.jardinId = { anterior: socia.jardinId, nuevo: changes.jardinId };
      socia.jardinId = changes.jardinId;

      // La delegada trasladada deja de representar a su jardín anterior
      if (socia.esDelegada) {
        socia.esDelegada = false;
        cambios.esDelegada = { anterior: true, nuevo: false };
      }
    }

    // Sincronización persistente en MySQL si la base de datos está disponible
    if (isDatabaseReady()) {
      try {
        const jardinObj = findJardin(socia.jardinId);
        await query(
          `UPDATE socias SET apellido_paterno = ?, nombres = ?, cargo = ?, jardin = ? WHERE rut = ?`,
          [socia.lastName, socia.firstName, socia.cargo, jardinObj?.name || '', socia.rut]
        );
      } catch (dbErr) {
        console.warn('Advertencia: no se pudo sincronizar actualización en MySQL (socias):', dbErr.message);
      }
    }

    return { socia: toDetail(socia), cambios };
  },

  /**
   * Catálogo de jardines con conteo de socias y delegada asignada
   */
  async getJardines() {
    return INITIAL_JARDINES.map((jardin) => {
      const sociasJardin = socias.filter((s) => s.jardinId === jardin.id);
      const delegada = sociasJardin.find((s) => s.esDelegada);

      return {
        ...jardin,
        totalSocias: sociasJardin.length,
        sociasActivas: sociasJardin.filter((s) => s.estado === 'ACTIVA').length,
        delegada: delegada
          ? { id: delegada.id, nombre: `${delegada.firstName} ${delegada.lastName}` }
          : null
      };
    });
  }
};
