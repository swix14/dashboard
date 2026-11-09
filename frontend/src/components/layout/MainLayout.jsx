import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { Navbar } from './Navbar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ChangePasswordModal } from '../auth/ChangePasswordModal.jsx';

export function MainLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mustChangePassword = Boolean(user?.mustChangePassword);

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main className="content-body">
          {/* Hasta cambiar la clave inicial el servidor rechaza los datos; no se cargan las vistas */}
          {!mustChangePassword && <Outlet />}
        </main>
      </div>
      {mustChangePassword && <ChangePasswordModal mandatory />}
    </div>
  );
}
