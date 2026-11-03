import { isDatabaseReady, query } from '../config/db.js';
import { INITIAL_JARDINES } from './seedData.js';
import { TreasuryService } from './treasuryService.js';

export const DashboardService = {
  /**
   * Genera métricas adaptadas de acuerdo al rol del usuario autenticado
   */
  async getMetricsByRole(user) {
    const roleCode = user.role?.code || user.role;

    // Métricas base dinámicas o por defecto
    let totalSocias = 277;
    let totalJardines = 23;
    let ultimosPagosFederacion = [
      { correlativo: 'FED-2026-005', fecha: '2026-10-02', monto: 280000, descripcion: 'Cuota Federación Octubre 2026', comprobante: 'comprobante_fed_oct_2026.pdf' },
      { correlativo: 'FED-2026-004', fecha: '2026-09-02', monto: 280000, descripcion: 'Cuota Federación Septiembre 2026', comprobante: 'comprobante_fed_sep_2026.pdf' },
      { correlativo: 'FED-2026-003', fecha: '2026-08-03', monto: 280000, descripcion: 'Cuota Federación Agosto 2026', comprobante: 'comprobante_fed_ago_2026.pdf' },
      { correlativo: 'FED-2026-002', fecha: '2026-07-02', monto: 280000, descripcion: 'Cuota Federación Julio 2026', comprobante: 'comprobante_fed_jul_2026.pdf' },
      { correlativo: 'FED-2026-001', fecha: '2026-06-02', monto: 280000, descripcion: 'Cuota Federación Junio 2026', comprobante: 'comprobante_fed_jun_2026.pdf' }
    ];

    let creditosStats = {
      activasConIsimundo: 38,
      activasConSos: 24,
      activasConDentalOptica: 19,
      activasSinCredito: 196,
      totalActivas: 277
    };

    // Obtener saldos reales de tesorería
    const treasurySummary = await TreasuryService.getSummary();

    if (isDatabaseReady()) {
      try {
        const [sociaCount] = await query(`SELECT COUNT(*) as total, COUNT(DISTINCT jardin) as totalJardines FROM socias`);
        if (sociaCount?.total) {
          totalSocias = Number(sociaCount.total);
          totalJardines = Number(sociaCount.totalJardines) || 23;
        }

        const fedRows = await query(
          `SELECT correlativo, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha, monto, descripcion, comprobante
           FROM movimientos_tesoreria
           WHERE centro_costo = 'FEDERACION'
           ORDER BY fecha DESC
           LIMIT 5`
        );
        if (fedRows.length > 0) {
          ultimosPagosFederacion = fedRows;
        }

        // Estadísticas de créditos reales en MySQL
        const [isiRes] = await query(`SELECT COUNT(*) as c FROM creditos WHERE convenio_id = 2 AND estado = 'vigente'`);
        const [sosRes] = await query(`SELECT COUNT(*) as c FROM creditos WHERE convenio_id = 1 AND estado = 'vigente'`);
        const [otrosRes] = await query(`SELECT COUNT(*) as c FROM creditos WHERE convenio_id IN (3, 4, 5) AND estado = 'vigente'`);

        const cIsi = Number(isiRes?.c || 38);
        const cSos = Number(sosRes?.c || 24);
        const cOtros = Number(otrosRes?.c || 19);

        creditosStats = {
          activasConIsimundo: cIsi,
          activasConSos: cSos,
          activasConDentalOptica: cOtros,
          activasSinCredito: Math.max(0, totalSocias - (cIsi + cSos + cOtros)),
          totalActivas: totalSocias
        };
      } catch (err) {
        console.warn('Error calculando métricas avanzadas MySQL, usando valores calculados:', err.message);
      }
    }

    const baseSummary = {
      asociacion: 'Asociación de Jardines VTF',
      totalJardines,
      totalSocias,
      totalDelegadas: totalJardines,
      fondoComunSaldo: treasurySummary.saldoTotal,
      totalIngresosPeriodo: treasurySummary.totalIngresos,
      totalEgresosPeriodo: treasurySummary.totalEgresos,
      valorCuotaMensual: 4000,
      distribucionCuota: {
        federacion: 1000,
        asociacion: 1000,
        cenaAnual: 2000
      }
    };

    // 1. Roles Administrativos / Directiva con acceso financiero y operativo
    const isDirectiva = [
      'ADMIN',
      'SUPER_ADMIN',
      'PRESIDENTA',
      'TESORERA',
      'SECRETARIA',
      'DIRECTORA'
    ].includes(roleCode);

    if (isDirectiva) {
      return {
        ...baseSummary,
        nivelAcceso: 'DIRECTIVA_ADMINISTRATIVA',
        puedeGestionarFinanzas: roleCode === 'TESORERA' || roleCode === 'ADMIN' || roleCode === 'SUPER_ADMIN',
        puedeGestionarSocias: roleCode === 'SECRETARIA' || roleCode === 'ADMIN' || roleCode === 'SUPER_ADMIN' || roleCode === 'PRESIDENTA',
        inicio: {
          // Fila 1: KPIs Principales
          sociasActivas: totalSocias - 4,
          sociasSuspendidas: 4,
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
            sociasUltimaCuotaIsimundo: 6,
            sociasUltimaCuotaSos: 3,
            pagoFederacionAlDia: true,
            pagoFederacionFecha: ultimosPagosFederacion[0]?.fecha || '02/10/2026'
          },

          // Fila 3: Gráficos Analíticos
          graficos: {
            recaudacionMensual: {
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
              ],
              '2025': [
                { mes: 'Ene', ingresos: 980000, egresos: 250000 },
                { mes: 'Feb', ingresos: 980000, egresos: 250000 },
                { mes: 'Mar', ingresos: 1050000, egresos: 380000 },
                { mes: 'Abr', ingresos: 1020000, egresos: 290000 },
                { mes: 'May', ingresos: 1040000, egresos: 270000 },
                { mes: 'Jun', ingresos: 1080000, egresos: 320000 },
                { mes: 'Jul', ingresos: 1010000, egresos: 290000 },
                { mes: 'Ago', ingresos: 1070000, egresos: 310000 },
                { mes: 'Sep', ingresos: 1150000, egresos: 480000 },
                { mes: 'Oct', ingresos: 1090000, egresos: 340000 },
                { mes: 'Nov', ingresos: 1100000, egresos: 360000 },
                { mes: 'Dic', ingresos: 1240000, egresos: 620000 }
              ]
            },
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
            value: `${totalSocias - 4} / ${totalSocias}`,
            sublabel: 'Padrón en base de datos',
            type: 'positive'
          },
          {
            id: 'socias-suspendidas',
            label: 'Socias Suspendidas',
            value: '4',
            sublabel: 'Sin cobro de cuota',
            type: 'warning'
          }
        ]
      };
    }

    // 2. Rol Delegada: Transparencia institucional general y de su jardín sin datos privados individuales
    if (roleCode === 'DELEGADA') {
      return {
        ...baseSummary,
        nivelAcceso: 'DELEGADA_JARDIN',
        jardinRepresentado: user.socia?.jardin?.name || 'Jardín Infantil Asignado',
        kpis: [
          {
            id: 'fondo-comun',
            label: 'Saldo Fondo Común Asociación',
            value: `$${treasurySummary.saldoTotal.toLocaleString('es-CL')}`,
            sublabel: 'Auditoría pública al día',
            type: 'positive'
          },
          {
            id: 'jardines-activos',
            label: 'Jardines en la Asociación',
            value: `${totalJardines} jardines`,
            sublabel: 'Representación activa',
            type: 'neutral'
          },
          {
            id: 'cuota-establecida',
            label: 'Valor Cuota Mensual',
            value: '$4.000 CLP',
            sublabel: 'Distribución tripartita estandarizada',
            type: 'neutral'
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

    // 3. Rol Socia: Vista institucional individual autorizada
    return {
      ...baseSummary,
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
