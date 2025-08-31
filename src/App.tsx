import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import InboxPage from './pages/InboxPage';
import EmptyPage from './components/common/EmptyPage';

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
            
            {/* Horizon (Investment) Routes */}
            <Route path="inmuebles">
              <Route index element={<EmptyPage title="Inmuebles" subtitle="Gestión de propiedades" />} />
              <Route path="cartera" element={<EmptyPage title="Cartera" subtitle="Resumen de propiedades" />} />
              <Route path="contratos" element={<EmptyPage title="Contratos" subtitle="Gestión de contratos" />} />
              <Route path="prestamos" element={<EmptyPage title="Préstamos" subtitle="Financiación inmobiliaria" />} />
              <Route path="analisis" element={<EmptyPage title="Análisis" subtitle="Análisis de inversión" />} />
            </Route>
            
            <Route path="tesoreria">
              <Route index element={<EmptyPage title="Tesorería" subtitle="Gestión financiera" />} />
              <Route path="radar" element={<EmptyPage title="Radar" subtitle="Vista general financiera" />} />
              <Route path="movimientos" element={<EmptyPage title="Movimientos" subtitle="Transacciones bancarias" />} />
              <Route path="reglas-sweeps" element={<EmptyPage title="Reglas & Sweeps" subtitle="Automatización financiera" />} />
              <Route path="alertas" element={<EmptyPage title="Alertas" subtitle="Notificaciones financieras" />} />
            </Route>
            
            <Route path="fiscalidad">
              <Route index element={<EmptyPage title="Fiscalidad" subtitle="Gestión fiscal" />} />
              <Route path="resumen" element={<EmptyPage title="Resumen" subtitle="Resumen fiscal anual" />} />
              <Route path="deducibles" element={<EmptyPage title="Deducibles" subtitle="Gastos deducibles" />} />
              <Route path="declaraciones" element={<EmptyPage title="Declaraciones" subtitle="Declaraciones fiscales" />} />
            </Route>
            
            <Route path="proyeccion">
              <Route index element={<EmptyPage title="Proyección" subtitle="Análisis predictivo" />} />
              <Route path="inmuebles" element={<EmptyPage title="Proyección de Inmuebles" subtitle="Predicciones de inversión" />} />
              <Route path="consolidado" element={<EmptyPage title="Consolidado" subtitle="Vista consolidada de proyecciones" />} />
            </Route>
            
            {/* Pulse (Personal) Routes */}
            <Route path="ingresos">
              <Route index element={<EmptyPage title="Ingresos" subtitle="Gestión de ingresos" />} />
              <Route path="lista" element={<EmptyPage title="Lista de Ingresos" subtitle="Todos los ingresos" />} />
              <Route path="nuevo" element={<EmptyPage title="Nuevo Ingreso" subtitle="Registrar nuevo ingreso" />} />
              <Route path="importar" element={<EmptyPage title="Importar Ingresos" subtitle="Importar desde archivos" />} />
            </Route>
            
            <Route path="gastos">
              <Route index element={<EmptyPage title="Gastos" subtitle="Control de gastos" />} />
              <Route path="lista" element={<EmptyPage title="Lista de Gastos" subtitle="Todos los gastos" />} />
              <Route path="nuevo" element={<EmptyPage title="Nuevo Gasto" subtitle="Registrar nuevo gasto" />} />
              <Route path="reglas" element={<EmptyPage title="Reglas de Gastos" subtitle="Automatización de categorización" />} />
            </Route>
            
            <Route path="tesoreria-personal">
              <Route index element={<EmptyPage title="Tesorería Personal" subtitle="Finanzas personales" />} />
              <Route path="radar" element={<EmptyPage title="Radar Personal" subtitle="Vista general personal" />} />
              <Route path="movimientos" element={<EmptyPage title="Movimientos Personales" subtitle="Transacciones personales" />} />
              <Route path="alertas" element={<EmptyPage title="Alertas Personales" subtitle="Notificaciones personales" />} />
            </Route>
            
            <Route path="proyeccion-personal">
              <Route index element={<EmptyPage title="Proyección Personal" subtitle="Planificación financiera" />} />
              <Route path="presupuesto" element={<EmptyPage title="Presupuesto" subtitle="Gestión de presupuestos" />} />
              <Route path="escenarios" element={<EmptyPage title="Escenarios" subtitle="Simulaciones financieras" />} />
            </Route>
            
            {/* Shared Configuration Routes */}
            <Route path="configuracion">
              <Route index element={<EmptyPage title="Configuración" subtitle="Configuración del sistema" />} />
              {/* Horizon configuration */}
              <Route path="bancos-cuentas" element={<EmptyPage title="Bancos & Cuentas" subtitle="Gestión de cuentas bancarias" />} />
              <Route path="plan-facturacion" element={<EmptyPage title="Plan & Facturación" subtitle="Gestión de suscripción" />} />
              <Route path="usuarios-roles" element={<EmptyPage title="Usuarios & Roles" subtitle="Gestión de usuarios" />} />
              <Route path="preferencias-datos" element={<EmptyPage title="Preferencias & Datos" subtitle="Configuración de datos" />} />
              {/* Pulse configuration */}
              <Route path="preferencias" element={<EmptyPage title="Preferencias" subtitle="Configuración personal" />} />
              <Route path="datos" element={<EmptyPage title="Datos" subtitle="Gestión de datos personales" />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;