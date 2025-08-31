import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import InboxPage from './pages/InboxPage';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/panel" replace />} />
            <Route path="panel" element={<Dashboard />} />
            <Route path="inbox" element={<InboxPage />} />
            {/* Placeholder routes for now - will be implemented in next steps */}
            <Route path="inmuebles/*" element={<div className="p-6">Inmuebles - Coming Soon</div>} />
            <Route path="tesoreria/*" element={<div className="p-6">Tesorería - Coming Soon</div>} />
            <Route path="fiscalidad/*" element={<div className="p-6">Fiscalidad - Coming Soon</div>} />
            <Route path="proyeccion/*" element={<div className="p-6">Proyección - Coming Soon</div>} />
            <Route path="ingresos/*" element={<div className="p-6">Ingresos - Coming Soon</div>} />
            <Route path="gastos/*" element={<div className="p-6">Gastos - Coming Soon</div>} />
            <Route path="tesoreria-personal/*" element={<div className="p-6">Tesorería Personal - Coming Soon</div>} />
            <Route path="proyeccion-personal/*" element={<div className="p-6">Proyección Personal - Coming Soon</div>} />
            <Route path="configuracion/*" element={<div className="p-6">Configuración - Coming Soon</div>} />
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;