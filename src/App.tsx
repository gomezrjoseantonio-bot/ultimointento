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
              <Route index element={<EmptyPage title="Inmuebles" subtitle="En construcción. Próximo hito: funcionalidades." description="Gestión integral de tu cartera inmobiliaria." />} />
              <Route path="cartera" element={<EmptyPage title="Cartera" subtitle="En construcción. Próximo hito: funcionalidades." description="Resumen de todas tus propiedades de inversión." />} />
              <Route path="contratos" element={<EmptyPage title="Contratos" subtitle="En construcción. Próximo hito: funcionalidades." description="Gestión de contratos de alquiler y compraventa." />} />
              <Route path="prestamos" element={<EmptyPage title="Préstamos" subtitle="En construcción. Próximo hito: funcionalidades." description="Seguimiento de financiación inmobiliaria." />} />
              <Route path="analisis" element={<EmptyPage title="Análisis" subtitle="En construcción. Próximo hito: funcionalidades." description="Análisis de rentabilidad y rendimiento." />} />
            </Route>
            
            <Route path="tesoreria">
              <Route index element={<EmptyPage title="Tesorería" subtitle="En construcción. Próximo hito: funcionalidades." description="Control financiero de inversiones inmobiliarias." />} />
              <Route path="radar" element={<EmptyPage title="Radar" subtitle="En construcción. Próximo hito: funcionalidades." description="Vista general del estado financiero." />} />
              <Route path="movimientos" element={<EmptyPage title="Movimientos" subtitle="En construcción. Próximo hito: funcionalidades." description="Historial de transacciones bancarias." />} />
              <Route path="reglas-sweeps" element={<EmptyPage title="Reglas & Sweeps" subtitle="En construcción. Próximo hito: funcionalidades." description="Automatización de movimientos financieros." />} />
              <Route path="alertas" element={<EmptyPage title="Alertas" subtitle="En construcción. Próximo hito: funcionalidades." description="Notificaciones de eventos financieros." />} />
            </Route>
            
            <Route path="fiscalidad">
              <Route index element={<EmptyPage title="Fiscalidad" subtitle="En construcción. Próximo hito: funcionalidades." description="Gestión fiscal de inversiones inmobiliarias." />} />
              <Route path="resumen" element={<EmptyPage title="Resumen" subtitle="En construcción. Próximo hito: funcionalidades." description="Resumen fiscal anual de inversiones." />} />
              <Route path="deducibles" element={<EmptyPage title="Deducibles" subtitle="En construcción. Próximo hito: funcionalidades." description="Gastos deducibles de inversión inmobiliaria." />} />
              <Route path="declaraciones" element={<EmptyPage title="Declaraciones" subtitle="En construcción. Próximo hito: funcionalidades." description="Preparación de declaraciones fiscales." />} />
            </Route>
            
            <Route path="proyeccion">
              <Route index element={<EmptyPage title="Proyección" subtitle="En construcción. Próximo hito: funcionalidades." description="Análisis predictivo de inversiones." />} />
              <Route path="cartera" element={<EmptyPage title="Cartera" subtitle="En construcción. Próximo hito: funcionalidades." description="Proyecciones de la cartera inmobiliaria." />} />
              <Route path="consolidado" element={<EmptyPage title="Consolidado" subtitle="En construcción. Próximo hito: funcionalidades." description="Vista consolidada de todas las proyecciones." />} />
            </Route>
            
            {/* Pulse (Personal) Routes */}
            <Route path="ingresos">
              <Route index element={<EmptyPage title="Ingresos" subtitle="En construcción. Próximo hito: funcionalidades." description="Gestión de ingresos personales." />} />
              <Route path="lista" element={<EmptyPage title="Lista" subtitle="En construcción. Próximo hito: funcionalidades." description="Listado completo de todos los ingresos." />} />
              <Route path="nuevo" element={<EmptyPage title="Nuevo" subtitle="En construcción. Próximo hito: funcionalidades." description="Registro de nuevo ingreso." />} />
              <Route path="importar" element={<EmptyPage title="Importar" subtitle="En construcción. Próximo hito: funcionalidades." description="Importación de ingresos desde archivos." />} />
            </Route>
            
            <Route path="gastos">
              <Route index element={<EmptyPage title="Gastos" subtitle="En construcción. Próximo hito: funcionalidades." description="Control de gastos personales." />} />
              <Route path="lista" element={<EmptyPage title="Lista" subtitle="En construcción. Próximo hito: funcionalidades." description="Listado completo de todos los gastos." />} />
              <Route path="nuevo" element={<EmptyPage title="Nuevo" subtitle="En construcción. Próximo hito: funcionalidades." description="Registro de nuevo gasto." />} />
              <Route path="reglas" element={<EmptyPage title="Reglas" subtitle="En construcción. Próximo hito: funcionalidades." description="Reglas de categorización automática." />} />
            </Route>
            
            <Route path="tesoreria-personal">
              <Route index element={<EmptyPage title="Tesorería Personal" subtitle="En construcción. Próximo hito: funcionalidades." description="Gestión de finanzas personales." />} />
              <Route path="radar" element={<EmptyPage title="Radar" subtitle="En construcción. Próximo hito: funcionalidades." description="Vista general de finanzas personales." />} />
              <Route path="movimientos" element={<EmptyPage title="Movimientos" subtitle="En construcción. Próximo hito: funcionalidades." description="Historial de transacciones personales." />} />
              <Route path="alertas" element={<EmptyPage title="Alertas" subtitle="En construcción. Próximo hito: funcionalidades." description="Notificaciones financieras personales." />} />
            </Route>
            
            <Route path="proyeccion-personal">
              <Route index element={<EmptyPage title="Proyección Personal" subtitle="En construcción. Próximo hito: funcionalidades." description="Planificación financiera personal." />} />
              <Route path="presupuesto" element={<EmptyPage title="Presupuesto" subtitle="En construcción. Próximo hito: funcionalidades." description="Gestión y seguimiento de presupuestos." />} />
              <Route path="escenarios" element={<EmptyPage title="Escenarios" subtitle="En construcción. Próximo hito: funcionalidades." description="Simulaciones de escenarios financieros." />} />
            </Route>
            
            {/* Shared Configuration Routes */}
            <Route path="configuracion">
              <Route index element={<EmptyPage title="Configuración" subtitle="En construcción. Próximo hito: funcionalidades." description="Configuración del sistema." />} />
              {/* Horizon configuration */}
              <Route path="bancos-cuentas" element={<EmptyPage title="Bancos & Cuentas" subtitle="En construcción. Próximo hito: funcionalidades." description="Gestión de cuentas bancarias." />} />
              <Route path="plan-facturacion" element={<EmptyPage title="Plan & Facturación" subtitle="En construcción. Próximo hito: funcionalidades." description="Gestión de suscripción y facturación." />} />
              <Route path="usuarios-roles" element={<EmptyPage title="Usuarios & Roles" subtitle="En construcción. Próximo hito: funcionalidades." description="Gestión de usuarios y permisos." />} />
              <Route path="preferencias-datos" element={<EmptyPage title="Preferencias & Datos" subtitle="En construcción. Próximo hito: funcionalidades." description="Configuración de preferencias y datos." />} />
              {/* Pulse configuration (same route as Horizon for Pulse module) */}
            </Route>
            
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;