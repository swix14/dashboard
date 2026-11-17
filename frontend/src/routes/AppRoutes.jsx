import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { MainLayout } from '../components/layout/MainLayout.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { SociaLoginPage } from '../pages/SociaLoginPage.jsx';
import { SociaPortalPage } from '../pages/SociaPortalPage.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { UnauthorizedPage } from '../pages/UnauthorizedPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { ModulePlaceholderPage } from '../pages/ModulePlaceholderPage.jsx';
import { TreasuryPage } from '../pages/TreasuryPage.jsx';
import { SociasPage } from '../pages/SociasPage.jsx';
import { ComunicacionesPage } from '../pages/ComunicacionesPage.jsx';
import { ReportesPage } from '../pages/ReportesPage.jsx';
import { CreditosPage } from '../pages/CreditosPage.jsx';
import { ROLES_ACCESO } from '../utils/permissions.js';

export function AppRoutes() {
  const { isSocia } = useAuth();

  return (
    <Routes>
      {/* Rutas Públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/socia/login" element={<SociaLoginPage />} />
      <Route path="/socia" element={<Navigate to="/socia/portal" replace />} />

      {/* Portal Exclusivo de Socias (Protegido para Socias y Directiva) */}
      <Route
        path="/socia/portal"
        element={
          <ProtectedRoute allowedRoles={['SOCIA', 'ADMIN', 'PRESIDENTA', 'TESORERA', 'SECRETARIA']}>
            <SociaPortalPage />
          </ProtectedRoute>
        }
      />

      {/* Rutas Protegidas en Layout Principal (Directiva / Administradores) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {isSocia ? <Navigate to="/socia/portal" replace /> : <MainLayout />}
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={isSocia ? '/socia/portal' : '/dashboard'} replace />} />
        {/* V1 — Inicio Institucional */}
        <Route path="dashboard" element={<DashboardPage />} />

        {/* V2 — Módulo Completo de Tesorería */}
        <Route
          path="tesoreria"
          element={
            <ProtectedRoute allowedRoles={ROLES_ACCESO.TESORERIA}>
              <TreasuryPage />
            </ProtectedRoute>
          }
        />
        <Route path="finanzas" element={<Navigate to="/tesoreria" replace />} />

        {/* V3 — Padrón de Socias y Gestión de Créditos */}
        <Route
          path="socias"
          element={
            <ProtectedRoute allowedRoles={ROLES_ACCESO.SOCIAS}>
              <SociasPage />
            </ProtectedRoute>
          }
        />

        {/* Noticias para socias y lectura del buzón (Admin, Presidenta, Secretaria y Directora) */}
        <Route
          path="comunicaciones"
          element={
            <ProtectedRoute allowedRoles={ROLES_ACCESO.COMUNICACIONES}>
              <ComunicacionesPage />
            </ProtectedRoute>
          }
        />
        <Route path="jardines" element={<Navigate to="/socias" replace />} />
        {/* V4 — Créditos y Convenios (Admin, Presidenta y Tesorera) */}
        <Route
          path="creditos"
          element={
            <ProtectedRoute allowedRoles={ROLES_ACCESO.CREDITOS}>
              <CreditosPage />
            </ProtectedRoute>
          }
        />

        {/* V4 — Gestión Documental y Convenios */}
        <Route
          path="documentos"
          element={
            <ProtectedRoute allowedRoles={ROLES_ACCESO.DOCUMENTOS}>
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
            </ProtectedRoute>
          }
        />
        <Route path="comprobantes" element={<Navigate to="/documentos" replace />} />

        {/* Reportes: informe mensual de cuentas (directiva y delegadas, estas solo vista) */}
        <Route
          path="reportes"
          element={
            <ProtectedRoute allowedRoles={ROLES_ACCESO.REPORTES}>
              <ReportesPage />
            </ProtectedRoute>
          }
        />

        {/* V6 — Bitácora de Auditoría */}
        <Route
          path="auditoria"
          element={
            <ProtectedRoute allowedRoles={ROLES_ACCESO.AUDITORIA}>
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
            </ProtectedRoute>
          }
        />

        <Route path="unauthorized" element={<UnauthorizedPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
