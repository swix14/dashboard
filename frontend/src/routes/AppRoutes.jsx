import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { MainLayout } from '../components/layout/MainLayout.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { UnauthorizedPage } from '../pages/UnauthorizedPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { ModulePlaceholderPage } from '../pages/ModulePlaceholderPage.jsx';
import { TreasuryPage } from '../pages/TreasuryPage.jsx';
import { SociasPage } from '../pages/SociasPage.jsx';

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
        {/* V1 — Inicio Institucional */}
        <Route path="dashboard" element={<DashboardPage />} />

        {/* V2 — Módulo Completo de Tesorería */}
        <Route path="tesoreria" element={<TreasuryPage />} />
        <Route path="finanzas" element={<Navigate to="/tesoreria" replace />} />

        {/* V3 — Padrón de Socias y Gestión de Créditos */}
        <Route
          path="socias"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA', 'DIRECTORA']}>
              <SociasPage />
            </ProtectedRoute>
          }
        />
        <Route path="jardines" element={<Navigate to="/socias" replace />} />
        <Route path="creditos" element={<Navigate to="/socias" replace />} />

        {/* V4 — Gestión Documental y Convenios */}
        <Route
          path="documentos"
          element={
            <ModulePlaceholderPage
              title="Gestión Documental y Subida Móvil"
              version="Fase V4"
              description="Subsecciones de documentos maestros descargables, carpetas por empresa (Isimundo, Óptica, Dental, Gimnasio) organizadas año/mes/día y subida ágil de comprobantes desde el celular."
              features={[
                'Subsección Maestros con 4 contratos tipo descargables',
                'Carpetas cronológicas por empresa con correlativo de día y hora',
                'Flujo de impresión, firma física y digitalización de pagarés',
                'Conexión ligera PWA para captura de comprobantes desde el teléfono'
              ]}
            />
          }
        />
        <Route path="comprobantes" element={<Navigate to="/documentos" replace />} />

        {/* V5 — Reportes Ejecutivos y Portal Delegadas */}
        <Route
          path="reportes"
          element={
            <ModulePlaceholderPage
              title="Reportes Ejecutivos y Portal Delegadas"
              version="Fase V5"
              description="Portal exclusivo para las 23 Delegadas con cifras consolidadas de aportes a federación, fondos de bienestar y generación de la Rendición Anual en PDF."
              features={[
                'Perfil de visualización protegido exclusivo para Delegadas',
                'Estadísticas de socias activas por jardín infantil',
                'Resguardo estricto de privacidad (sin acceso a deudas individuales)',
                'Exportación de Rendición Anual de Cuentas oficial en PDF e informes Excel'
              ]}
            />
          }
        />

        {/* V6 — Bitácora de Auditoría */}
        <Route
          path="auditoria"
          element={
            <ModulePlaceholderPage
              title="Bitácora de Auditoría y Seguridad"
              version="Fase V6"
              description="Registro inmutable de cada acción en el sistema (autenticaciones, creación de movimientos de tesorería, modificaciones de socias y exportaciones) para respaldo legal."
              features={[
                'Registro cronológico inmutable con IP, usuario y timestamp',
                'Filtros por acción, fecha y módulo afectado',
                'Supervisión exclusiva para Directiva y Super Admin',
                'Garantía de integridad y trazabilidad legal de la Asociación'
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
