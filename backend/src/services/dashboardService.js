import { isDatabaseReady, query } from '../config/db.js';
import { TreasuryService } from './treasuryService.js';
import { hoyChile } from '../utils/fecha.js';

/** El aporte a Federación está al día si se pagó este mes o el mes anterior */
export function pagoFederacionAlDia(fechaUltimoPago, hoy = hoyChile()) {
  if (!fechaUltimoPago) return false;
  const [anio, mes] = hoy.split('-').map(Number);
  const anterior = mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, '0')}`;
  const periodo = String(fechaUltimoPago).slice(0, 7);
  return periodo === hoy.slice(0, 7) || periodo === anterior;
}

export const DashboardService = {
  /**
   * Genera métricas adaptadas estrictamente al principio de mínimo privilegio (PoLP)
   */
  async getMetricsByRole(user) {
    const roleCode = user.role?.code || user.role;

    // Métricas base institucionales (no financieras privadas)
    let totalSocias = 277;
    let totalJardines = 23;
    let sociasActivasCount = 273;
    let sociasSuspendidasCount = 4;
    let totalDelegadas = 23;

    let ultimosPagosFederacion = [
      { correlativo: 'FED-2026-005', fecha: '2026-10-02', monto: 280000, descripcion: 'Cuota Federación Octubre 2026', comprobante: 'comprobante_fed_oct_2026.pdf' },
      { correlativo: 'FED-2026-004', fecha: '2026-09-02', monto: 280000, descripcion: 'Cuota Federación Septiembre 2026', comprobante: 'comprobante_fed_sep_2026.pdf' },
      { correlativo: 'FED-2026-003', fecha: '2026-08-03', monto: 280000, descripcion: 'Cuota Federación Agosto 2026', comprobante: 'comprobante_fed_ago_2026.pdf' },
      { correlativo: 'FED-2026-002', fecha: '2026-07-02', monto: 280000, descripcion: 'Cuota Federación Julio 2026', comprobante: 'comprobante_fed_jul_2026.pdf' },
      { correlativo: 'FED-2026-001', fecha: '2026-06-02', monto: 280000, descripcion: 'Cuota Federación Junio 2026', comprobante: 'comprobante_fed_jun_2026.pdf' }
    ];

    // Ejemplo solo para el modo memoria (desarrollo sin MySQL)
    let alertasCuotas = { isi: 6, sos: 3 };
    let recaudacionMensual = {
      '2026': [
        { mes: 'Ene', ingresos: 1120000, egresos: 350000 },
        { mes: 'Feb', ingresos: 1120000, egresos: 280000 },
        { mes: 'Mar', ingresos: 1250000, egresos: 420000 },
        { mes: 'Abr', ingresos: 1190000, egresos: 310000 },
        { mes: 'May', ingresos: 1180000, egresos: 290000 },
        { mes: 'Jun', ingresos: 1210000, egresos: 380000 },
        { mes: 'Jul', ingresos: 1150000, egresos: 330000 },
        { mes: 'Ago', ingresos: 1200000, egresos: 360000 },
        { mes: 'Sep', ingresos: 1280000, egresos: 540000 },
        { mes: 'Oct', ingresos: 1048000, egresos: 280000 }
      ]
    };

    let creditosStats = {
      activasConIsimundo: 38,
      activasConSos: 24,
      activasConDentalOptica: 19,
      activasSinCredito: 196,
      totalActivas: 277
    };

    if (isDatabaseReady()) {
      try {
        // Conteos reales del padrón (V3); las RETIRADAS no forman parte del padrón vigente
        const [sociaCount] = await query(
          `SELECT SUM(estado <> 'RETIRADA') AS total,
                  SUM(estado = 'ACTIVA') AS activas,
                  SUM(estado = 'SUSPENDIDA') AS suspendidas,
                  SUM(es_delegada = 1 AND estado <> 'RETIRADA') AS delegadas,
                  (SELECT COUNT(*) FROM jardines WHERE activo = 1) AS jardines
           FROM socias`
        );
        totalDelegadas = Number(sociaCount?.delegadas || 0);
        totalSocias = Number(sociaCount?.total || 0);
        sociasActivasCount = Number(sociaCount?.activas || 0);
        sociasSuspendidasCount = Number(sociaCount?.suspendidas || 0);
        totalJardines = Number(sociaCount?.jardines || 0);

        const fedRows = await query(
          `SELECT correlativo, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, monto, descripcion, comprobante
           FROM movimientos_tesoreria
           WHERE centro_costo = 'FEDERACION' AND anulado = 0
           ORDER BY fecha DESC
           LIMIT 5`
        );
        // Con base de datos se muestran solo los pagos reales (aunque no haya ninguno todavía)
        ultimosPagosFederacion = fedRows;

        // Socias distintas (no créditos) del padrón vigente. Antes un 0 real se reemplazaba por
        // números fijos (38/24/19) y una socia con dos créditos se restaba dos veces.
        const [cred] = await query(
          `SELECT
             COUNT(DISTINCT CASE WHEN c.convenio_id = 2 THEN c.socia_id END) AS isi,
             COUNT(DISTINCT CASE WHEN c.convenio_id = 1 THEN c.socia_id END) AS sos,
             COUNT(DISTINCT CASE WHEN c.convenio_id IN (3, 4, 5) THEN c.socia_id END) AS otros,
             COUNT(DISTINCT c.socia_id) AS con_credito
           FROM creditos c JOIN socias s ON s.id = c.socia_id
           WHERE c.estado = 'vigente' AND s.estado <> 'RETIRADA'`
        );

        creditosStats = {
          activasConIsimundo: Number(cred?.isi || 0),
          activasConSos: Number(cred?.sos || 0),
          activasConDentalOptica: Number(cred?.otros || 0),
          activasSinCredito: Math.max(0, totalSocias - Number(cred?.con_credito || 0)),
          totalActivas: totalSocias
        };

        // Socias a las que les queda una sola cuota (alerta del Inicio)
        const [ultima] = await query(
          `SELECT
             COUNT(DISTINCT CASE WHEN c.convenio_id = 2 THEN c.socia_id END) AS isi,
             COUNT(DISTINCT CASE WHEN c.convenio_id = 1 THEN c.socia_id END) AS sos
           FROM creditos c JOIN socias s ON s.id = c.socia_id
           WHERE c.estado = 'vigente' AND s.estado <> 'RETIRADA' AND c.total_cuotas - c.cuotas_pagadas = 1`
        );
        alertasCuotas = { isi: Number(ultima?.isi || 0), sos: Number(ultima?.sos || 0) };

        // Ingresos y egresos reales por mes (los saldos de apertura no son recaudación)
        const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const porMes = await query(
          `SELECT YEAR(fecha) AS anio, MONTH(fecha) AS mes,
                  SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE 0 END) AS ingresos,
                  SUM(CASE WHEN tipo = 'EGRESO' THEN monto ELSE 0 END) AS egresos
           FROM movimientos_tesoreria
           WHERE tipo IN ('INGRESO', 'EGRESO') AND anulado = 0
           GROUP BY YEAR(fecha), MONTH(fecha)
           ORDER BY anio, mes`
        );
        recaudacionMensual = {};
        for (const r of porMes) {
          const anio = String(r.anio);
          if (!recaudacionMensual[anio]) {
            // Del año en curso se muestran los meses hasta el último con movimientos
            recaudacionMensual[anio] = MESES.map((mes) => ({ mes, ingresos: 0, egresos: 0 }));
          }
          recaudacionMensual[anio][r.mes - 1] = {
            mes: MESES[r.mes - 1],
            ingresos: Number(r.ingresos || 0),
            egresos: Number(r.egresos || 0)
          };
        }
        for (const anio of Object.keys(recaudacionMensual)) {
          const meses = recaudacionMensual[anio];
          let ultimo = meses.length - 1;
          while (ultimo > 0 && meses[ultimo].ingresos === 0 && meses[ultimo].egresos === 0) ultimo--;
          recaudacionMensual[anio] = meses.slice(0, ultimo + 1);
        }
      } catch (err) {
        // Con MySQL conectado, un error se informa: mostrar los números de ejemplo engañaría a la directiva
        console.error('Error calculando métricas del Inicio en MySQL:', err.message);
        throw err;
      }
    }

    // Base institucional común (sin exponer saldos de fondos)
    const institutionalBase = {
      asociacion: 'Asociación de Jardines VTF',
      totalJardines,
      totalSocias,
      totalDelegadas,
      valorCuotaMensual: 4000,
      distribucionCuota: {
        federacion: 1000,
        asociacion: 1000,
        cenaAnual: 2000
      }
    };

    // 1. Roles con acceso a información contable y financiera (ADMIN, PRESIDENTA, TESORERA).
    // La Secretaria dejó de verla el 16-11-2026 (pedido de la directiva).
    const hasFinancialAccess = ['ADMIN', 'PRESIDENTA', 'TESORERA'].includes(roleCode);

    if (hasFinancialAccess) {
      const treasurySummary = await TreasuryService.getSummary();

      return {
        ...institutionalBase,
        fondoComunSaldo: treasurySummary.saldoTotal,
        totalIngresosPeriodo: treasurySummary.totalIngresos,
        totalEgresosPeriodo: treasurySummary.totalEgresos,
        nivelAcceso: 'DIRECTIVA_ADMINISTRATIVA',
        secciones: { finanzas: true },
        puedeGestionarFinanzas: roleCode === 'TESORERA' || roleCode === 'ADMIN',
        puedeGestionarSocias: roleCode === 'ADMIN' || roleCode === 'PRESIDENTA',
        inicio: {
          // Fila 1: KPIs Principales
          sociasActivas: sociasActivasCount,
          sociasSuspendidas: sociasSuspendidasCount,
          saldoTotal: treasurySummary.saldoTotal,
          saldoCenaAnual: treasurySummary.saldoCenaAnual,
          saldoAsociacion: treasurySummary.saldoAsociacion,

          // Fila 2: Recuadros Medianos
          ultimosPagosFederacion,
          proximasTareas: [
            { id: 'task-1', titulo: 'Cierre Tesorería Mensual', fechaLimite: '31/10/2026', estado: 'Pendiente', urgencia: 'alta', descripcion: 'Consolidación de ingresos y egresos mes de Octubre' },
            { id: 'task-2', titulo: 'Exportar Informe Mensual', fechaLimite: '02/11/2026', estado: 'Programada', urgencia: 'media', descripcion: 'Generación de informe contable mensual en Excel' },
            { id: 'task-3', titulo: 'Deudas Morosas / No Realizados', fechaLimite: 'Vencida', estado: 'Atención', urgencia: 'alerta', descripcion: '3 socias con cuotas de convenio atrasadas' }
          ],
          alertas: {
            sociasUltimaCuotaIsimundo: alertasCuotas.isi,
            sociasUltimaCuotaSos: alertasCuotas.sos,
            // Al día si el último pago a Federación es de este mes o del anterior (hora de Chile)
            pagoFederacionAlDia: pagoFederacionAlDia(ultimosPagosFederacion[0]?.fecha),
            pagoFederacionFecha: ultimosPagosFederacion[0]?.fecha || null
          },

          // Fila 3: Gráficos Analíticos
          graficos: {
            recaudacionMensual,
            estadoSociasCreditos: creditosStats
          }
        },
        kpis: [
          {
            id: 'saldo-fondo',
            label: 'Saldo Total',
            value: `$${treasurySummary.saldoTotal.toLocaleString('es-CL')}`,
            sublabel: 'Cena Anual + Asociación',
            type: 'positive'
          },
          {
            id: 'socias-activas',
            label: 'Socias Registradas',
            value: `${sociasActivasCount} / ${totalSocias}`,
            sublabel: 'Padrón en base de datos',
            type: 'positive'
          },
          {
            id: 'socias-suspendidas',
            label: 'Socias Suspendidas',
            value: String(sociasSuspendidasCount),
            sublabel: 'Sin cobro de cuota',
            type: 'warning'
          }
        ]
      };
    }

    // 2. Secretaria y Directora (la Directora tiene los mismos permisos que la Secretaria):
    // padrón e indicadores de socias, SIN saldos, pagos a Federación, tareas, alertas ni recaudación
    if (roleCode === 'SECRETARIA' || roleCode === 'DIRECTORA') {
      return {
        ...institutionalBase,
        nivelAcceso: 'DIRECTIVA_PADRON',
        secciones: { finanzas: false },
        puedeGestionarFinanzas: false,
        puedeGestionarSocias: true,
        inicio: {
          sociasActivas: sociasActivasCount,
          sociasSuspendidas: sociasSuspendidasCount,
          graficos: {
            estadoSociasCreditos: creditosStats
          }
        },
        kpis: [
          {
            id: 'socias-activas',
            label: 'Socias Registradas',
            value: `${sociasActivasCount} / ${totalSocias}`,
            sublabel: 'Padrón en base de datos',
            type: 'positive'
          },
          {
            id: 'socias-suspendidas',
            label: 'Socias Suspendidas',
            value: String(sociasSuspendidasCount),
            sublabel: 'Sin cobro de cuota',
            type: 'warning'
          },
          {
            id: 'jardines-activos',
            label: 'Jardines en la Asociación',
            value: `${totalJardines} jardines`,
            sublabel: 'Comuna de Temuco',
            type: 'neutral'
          }
        ]
      };
    }

    // 3. Rol Delegada: Transparencia institucional de su jardín (SIN cifras contables privadas de la Asociación)
    if (roleCode === 'DELEGADA') {
      return {
        ...institutionalBase,
        nivelAcceso: 'DELEGADA_JARDIN',
        jardinRepresentado: user.socia?.jardin?.name || 'Jardín Infantil Asignado',
        kpis: [
          {
            id: 'jardines-activos',
            label: 'Jardines en la Asociación',
            value: `${totalJardines} jardines`,
            sublabel: 'Representación gremial activa',
            type: 'neutral'
          },
          {
            id: 'cuota-establecida',
            label: 'Valor Cuota Mensual',
            value: '$4.000 CLP',
            sublabel: 'Distribución tripartita estatutaria',
            type: 'neutral'
          },
          {
            id: 'socias-totales',
            label: 'Padrón General',
            value: `${totalSocias} socias`,
            sublabel: 'Educadoras y Técnicos',
            type: 'positive'
          }
        ],
        resumenTransparencia: {
          comunicados: [
            'Proceso de rendición semestral aprobado por el comité de directiva.',
            'Recordatorio: La comisión Isi Mundo 2% se integra al fondo de bienestar común.',
            'Próxima asamblea de delegadas programada para fin de mes.'
          ]
        }
      };
    }

    // 4. Rol Socia: Vista individual autorizada
    return {
      ...institutionalBase,
      nivelAcceso: 'SOCIA',
      kpis: [
        {
          id: 'socia-estado',
          label: 'Mi Estado de Socia',
          value: user.socia?.estado || 'ACTIVA',
          sublabel: `Cargo: ${user.socia?.cargo || 'Educadora'}`,
          type: 'positive'
        },
        {
          id: 'jardin-socia',
          label: 'Mi Jardín Asignado',
          value: user.socia?.jardin?.name || 'Jardín VTF',
          sublabel: 'Asociación de Jardines VTF',
          type: 'neutral'
        },
        {
          id: 'cuota-socia',
          label: 'Cuota Social',
          value: '$4.000 CLP',
          sublabel: 'Al día',
          type: 'positive'
        }
      ],
      comunicados: [
        'Bienvenida al portal de gestión institucional de la Asociación de Jardines VTF.',
        'La rendición anual se encuentra en preparación para la asamblea general.'
      ]
    };
  }
};
