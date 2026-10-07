import { INITIAL_JARDINES } from './seedData.js';

export const DashboardService = {
  /**
   * Genera métricas adaptadas de acuerdo al rol del usuario autenticado
   */
  async getMetricsByRole(user) {
    const roleCode = user.role?.code || user.role;

    // Métricas globales de la asociación
    const baseSummary = {
      asociacion: 'Asociación de Jardines VTF',
      totalJardines: INITIAL_JARDINES.length,
      totalSocias: 280,
      totalDelegadas: 23,
      fondoComunSaldo: 14580000, // $14.580.000 CLP
      totalIngresosPeriodo: 4850000,
      totalEgresosPeriodo: 2120000,
      valorCuotaMensual: 4000,
      distribucionCuota: {
        federacion: 1000,
        asociacion: 1000,
        cenaAnual: 2000
      }
    };

    // 1. Roles Administrativos / Directiva con acceso financiero y operativo
    // (Tesorera, Presidenta, Secretaria, Primera Directora, Segunda Directora)
    const isDirectiva = [
      'PRESIDENTA',
      'TESORERA',
      'SECRETARIA',
      'PRIMERA_DIRECTORA',
      'SEGUNDA_DIRECTORA'
    ].includes(roleCode);

    if (isDirectiva) {
      return {
        ...baseSummary,
        nivelAcceso: 'DIRECTIVA_ADMINISTRATIVA',
        puedeGestionarFinanzas: roleCode === 'TESORERA',
        puedeGestionarSocias: roleCode === 'SECRETARIA' || roleCode === 'PRESIDENTA',
        kpis: [
          {
            id: 'saldo-fondo',
            label: 'Saldo Fondo Común',
            value: '$14.580.000',
            change: '+12.4% vs mes anterior',
            type: 'positive'
          },
          {
            id: 'socias-activas',
            label: 'Total Socias Activas',
            value: '276 / 280',
            sublabel: '4 suspendidas temporalmente',
            type: 'neutral'
          },
          {
            id: 'cuotas-periodo',
            label: 'Recaudación Cuotas Mes',
            value: '$1.048.000',
            sublabel: '262 cuotas pagadas (94%)',
            type: 'positive'
          },
          {
            id: 'pagos-pendientes',
            label: 'Pagos por Verificar',
            value: '8 pendientes',
            sublabel: 'Comprobantes en cola de revisión',
            type: 'warning'
          },
          {
            id: 'creditos-activos',
            label: 'Créditos en Curso',
            value: '34 activos',
            sublabel: 'Convenios SOS, EasyMundo, Salud',
            type: 'neutral'
          }
        ],
        movimientosRecientes: [
          {
            id: 'mov-1',
            fecha: '2026-10-06',
            tipo: 'INGRESO',
            categoria: 'Cuotas Mensuales',
            monto: 1048000,
            descripcion: 'Recaudación masiva cuotas Octubre 2026',
            comprobante: true
          },
          {
            id: 'mov-2',
            fecha: '2026-10-04',
            tipo: 'INGRESO',
            categoria: 'Comisión EasyMundo',
            monto: 54200,
            descripcion: 'Comisión 2% convenio EasyMundo',
            comprobante: true
          },
          {
            id: 'mov-3',
            fecha: '2026-10-02',
            tipo: 'EGRESO',
            categoria: 'Aporte Federación',
            monto: 280000,
            descripcion: 'Transferencia aporte nacional federación',
            comprobante: true
          },
          {
            id: 'mov-4',
            fecha: '2026-09-28',
            tipo: 'EGRESO',
            categoria: 'Gastos Operacionales',
            monto: 85000,
            descripcion: 'Insumos de oficina y hosting anual',
            comprobante: true
          }
        ],
        distribucionFondo: [
          { name: 'Fondo Cena Anual ($2.000/socia)', porcentaje: 50, monto: 7290000 },
          { name: 'Fondo Asociación ($1.000/socia)', porcentaje: 25, monto: 3645000 },
          { name: 'Fondo Reserva / Federación', porcentaje: 25, monto: 3645000 }
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
            value: '$14.580.000',
            sublabel: 'Auditoría pública al día',
            type: 'positive'
          },
          {
            id: 'jardines-activos',
            label: 'Jardines en la Asociación',
            value: '23 jardines',
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
            'Recordatorio: La comisión EasyMundo 2% se integra al fondo de bienestar común.',
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
