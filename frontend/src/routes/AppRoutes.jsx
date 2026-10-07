import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { MainLayout } from '../components/layout/MainLayout.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { UnauthorizedPage } from '../pages/UnauthorizedPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { ModulePlaceholderPage } from '../pages/ModulePlaceholderPage.jsx';

export function AppRoutes() {
  return (
    <Routes>
      {/* Rutas Públicas */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rutas Protegidas en Layout Principal */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* V2 — Socias y Jardines */}
        <Route
          path="socias"
          element={
            <ModulePlaceholderPage
              title="Gestión de Socias (280 Socias)"
              version="Fase V2"
              description="Administración de padrón de socias, RUT, jardín asignado, cargos (Directora, Educadora, Técnico), estados (Activa, Suspendida) e historial de modificaciones."
              features={[
                'Registro y edición con validación de RUT chileno',
                'Estados: Activa / Suspendida (con control de no cobro indebido)',
                'Historial completo de cambios',
                'Exportación de padrón institucional'
              ]}
            />
          }
        />
        <Route
          path="jardines"
          element={
            <ModulePlaceholderPage
              title="23 Jardines VTF"
              version="Fase V2"
              description="Directorio de los 23 jardines infantiles de la asociación, asignación de delegadas, socias pertenecientes y registro de traslados con historial inmutable."
              features={[
                'Catálogo de 23 jardines asociados',
                'Asignación de una delegada por cada jardín',
                'Trazabilidad inmutable de traslados entre jardines',
                'Estadísticas de dotación por establecimiento'
              ]}
            />
          }
        />

        {/* V3 — Finanzas y Cuotas */}
        <Route
          path="finanzas"
          element={
            <ModulePlaceholderPage
              title="Finanzas y Cuotas Sociales"
              version="Fase V3"
              description="Control de la cuota mensual de $4.000 CLP con desglose tripartito ($1.000 Federación, $1.000 Asociación, $2.000 Fondo Cena Anual), registro de ingresos y egresos."
              features={[
                'Generación y seguimiento de períodos de cuotas mensuales',
                'Control de pagos: Quién pagó, pendientes y en revisión',
                'Registro de ingresos y egresos categorizados',
                'Consolidación del saldo del Fondo Común'
              ]}
            />
          }
        />

        {/* V4 — Créditos */}
        <Route
          path="creditos"
          element={
            <ModulePlaceholderPage
              title="Gestión de Créditos y Convenios"
              version="Fase V4"
              description="Manejo de créditos SOS, EasyMundo (con comisión 2%), Dental y Óptica. Cálculo automático estricto de cuotas (impidiendo cuotas posteriores a la última configurada)."
              features={[
                'Líneas de crédito: SOS, EasyMundo, Dental y Óptica',
                'Regla crítica: Cancelación automática al llegar a cuota final (sin cuota 13/12)',
                'Cálculo e ingreso del 2% de comisión EasyMundo al fondo común',
                'Perfil financiero confidencial por socia'
              ]}
            />
          }
        />

        {/* V5 — Comprobantes */}
        <Route
          path="comprobantes"
          element={
            <ModulePlaceholderPage
              title="Carga y Verificación de Comprobantes"
              version="Fase V5"
              description="Carga y validación de boletas, facturas y transferencias bancarias asociadas a cuotas, pagos y gastos con workflow de aprobación por Tesorería."
              features={[
                'Subida segura de comprobantes (PDF, JPG, PNG)',
                'Workflow de estados: Pendiente, En revisión, Verificado, Rechazado',
                'Asociación directa a movimientos y cuotas',
                'Control de permisos exclusivo para Tesorera'
              ]}
            />
          }
        />

        {/* V6 — Reportes y Rendición */}
        <Route
          path="reportes"
          element={
            <ModulePlaceholderPage
              title="Reportes y Rendición Anual"
              version="Fase V6"
              description="Generación y exportación de reportes mensuales, anuales, por jardín y rendición de cuentas anual en formatos PDF y Excel."
              features={[
                'Exportación de informes ejecutivos en Excel (ExcelJS)',
                'Generación de Rendición Anual oficial en PDF',
                'Reportes de recaudación por jardín y convenio',
                'Auditoría visual de balance de cierre'
              ]}
            />
          }
        />

        {/* V7 — Auditoría */}
        <Route
          path="auditoria"
          element={
            <ModulePlaceholderPage
              title="Bitácora de Auditoría del Sistema"
              version="Fase V7"
              description="Registro y trazabilidad exhaustiva de todas las acciones del sistema: autenticaciones, modificaciones de socias, operaciones financieras y verificaciones."
              features={[
                'Registro cronológico inmutable con IP, usuario y timestamp',
                'Filtros por acción, fecha y módulo afectado',
                'Supervisión exclusiva para Directiva',
                'Garantía de integridad y trazabilidad legal'
              ]}
            />
          }
        />

        <Route path="unauthorized" element={<UnauthorizedPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
