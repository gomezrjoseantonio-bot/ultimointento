import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { bankProfilesService } from './services/bankProfilesService';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import InboxPageV2 from './pages/InboxPageV2';
import AccountPage from './pages/account/AccountPage';

// Horizon (Investment) Module Components
import Cartera from './modules/horizon/inmuebles/cartera/Cartera';
import Contratos from './modules/horizon/inmuebles/contratos/Contratos';
import Prestamos from './modules/horizon/inmuebles/prestamos/Prestamos';
import Analisis from './modules/horizon/inmuebles/analisis/Analisis';
import Tesoreria from './modules/horizon/tesoreria/Tesoreria';
import TesRadar from './modules/horizon/tesoreria/radar/Radar';
import TesIngresos from './modules/horizon/tesoreria/ingresos/Ingresos';
import TesGastos from './modules/horizon/tesoreria/gastos/Gastos';
import TesCAPEX from './modules/horizon/tesoreria/capex/CAPEX';
import TesMovimientos from './modules/horizon/tesoreria/movimientos/Movimientos';
import Automatizaciones from './modules/horizon/tesoreria/automatizaciones/Automatizaciones';
import TesAlertas from './modules/horizon/tesoreria/alertas/Alertas';
import FisResumen from './modules/horizon/fiscalidad/resumen/Resumen';
import Detalle from './modules/horizon/fiscalidad/detalle/Detalle';
import Declaraciones from './modules/horizon/fiscalidad/declaraciones/Declaraciones';
import ProyeccionCartera from './modules/horizon/proyeccion/cartera/ProyeccionCartera';
import ProyeccionConsolidado from './modules/horizon/proyeccion/consolidado/ProyeccionConsolidado';
import BancosCuentas from './modules/horizon/configuracion/bancos-cuentas/BancosCuentas';
import UsuariosRoles from './modules/horizon/configuracion/usuarios-roles/UsuariosRoles';
import EmailEntrante from './modules/horizon/configuracion/email-entrante/EmailEntrante';
import PropertyForm from './modules/horizon/inmuebles/cartera/PropertyForm';
import PropertyDetail from './modules/horizon/inmuebles/cartera/PropertyDetail';

// Personal section (within Horizon)
import Personal from './modules/horizon/personal/Personal';

// Pulse (Management) Module Components
import ContratosLista from './modules/pulse/contratos/lista/ContratosLista';
import FirmasPendientes from './modules/pulse/firmas/pendientes/FirmasPendientes';
import CobrosPendientes from './modules/pulse/cobros/pendientes/CobrosPendientes';
import AutomatizacionesReglas from './modules/pulse/automatizaciones/reglas/AutomatizacionesReglas';
import TareasPendientes from './modules/pulse/tareas/pendientes/TareasPendientes';

// Legacy Pulse (Personal) Module Components - Keep for migration
import HorizonPreferenciasDatos from './modules/horizon/configuracion/preferencias-datos/PreferenciasDatos';
import GastosCapex from './modules/horizon/inmuebles/gastos-capex/GastosCapex';

// Development only imports
const ProfileSeederPage = React.lazy(() => 
  (import.meta as any).env?.DEV 
    ? import('./pages/ProfileSeederPage')
    : Promise.resolve({ default: () => null })
);

function App() {
  // Initialize bank profiles on app start
  React.useEffect(() => {
    bankProfilesService.loadProfiles().catch(console.error);
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/panel" replace />} />
            <Route path="panel" element={<Dashboard />} />
            <Route path="inbox" element={<InboxPageV2 />} />
            
            {/* Horizon (Investment) Routes */}
            <Route path="inmuebles">
              <Route index element={<Navigate to="/inmuebles/cartera" replace />} />
              <Route path="cartera" element={<Cartera />} />
              <Route path="cartera/nuevo" element={<PropertyForm mode="create" />} />
              <Route path="cartera/:id" element={<PropertyDetail />} />
              <Route path="cartera/:id/editar" element={<PropertyForm mode="edit" />} />
              <Route path="contratos" element={<Contratos />} />
              <Route path="prestamos" element={<Prestamos />} />
              <Route path="gastos-capex" element={<GastosCapex />} />
              <Route path="analisis" element={<Analisis />} />
            </Route>
            
            <Route path="tesoreria">
              <Route index element={<Tesoreria />} />
              <Route path="radar" element={<TesRadar />} />
              <Route path="ingresos" element={<TesIngresos />} />
              <Route path="gastos" element={<TesGastos />} />
              <Route path="capex" element={<TesCAPEX />} />
              <Route path="movimientos" element={<TesMovimientos />} />
              <Route path="automatizaciones" element={<Automatizaciones />} />
              <Route path="alertas" element={<TesAlertas />} />
            </Route>
            
            <Route path="fiscalidad">
              <Route index element={<Navigate to="/fiscalidad/resumen" replace />} />
              <Route path="resumen" element={<FisResumen />} />
              <Route path="detalle" element={<Detalle />} />
              <Route path="declaraciones" element={<Declaraciones />} />
            </Route>
            
            <Route path="proyeccion">
              <Route index element={<Navigate to="/proyeccion/cartera" replace />} />
              <Route path="cartera" element={<ProyeccionCartera />} />
              <Route path="consolidado" element={<ProyeccionConsolidado />} />
            </Route>
            
            {/* Personal section (within Horizon) */}
            <Route path="personal">
              <Route index element={<Navigate to="/personal/resumen" replace />} />
              <Route path="resumen" element={<Personal />} />
              <Route path="cuentas" element={<Personal />} />
              <Route path="movimientos" element={<Personal />} />
              <Route path="presupuesto" element={<Personal />} />
              <Route path="reglas" element={<Personal />} />
            </Route>
            
            {/* Pulse (Management) Routes */}
            <Route path="contratos">
              <Route index element={<Navigate to="/contratos/lista" replace />} />
              <Route path="lista" element={<ContratosLista />} />
              <Route path="nuevo" element={<ContratosLista />} />
              <Route path="gestion" element={<ContratosLista />} />
            </Route>
            
            <Route path="firmas">
              <Route index element={<Navigate to="/firmas/pendientes" replace />} />
              <Route path="pendientes" element={<FirmasPendientes />} />
              <Route path="completadas" element={<FirmasPendientes />} />
              <Route path="plantillas" element={<FirmasPendientes />} />
            </Route>
            
            <Route path="cobros">
              <Route index element={<Navigate to="/cobros/pendientes" replace />} />
              <Route path="pendientes" element={<CobrosPendientes />} />
              <Route path="conciliacion" element={<CobrosPendientes />} />
              <Route path="historico" element={<CobrosPendientes />} />
            </Route>
            
            <Route path="automatizaciones">
              <Route index element={<Navigate to="/automatizaciones/reglas" replace />} />
              <Route path="reglas" element={<AutomatizacionesReglas />} />
              <Route path="flujos" element={<AutomatizacionesReglas />} />
              <Route path="historial" element={<AutomatizacionesReglas />} />
            </Route>
            
            <Route path="tareas">
              <Route index element={<Navigate to="/tareas/pendientes" replace />} />
              <Route path="pendientes" element={<TareasPendientes />} />
              <Route path="completadas" element={<TareasPendientes />} />
              <Route path="programadas" element={<TareasPendientes />} />
            </Route>

            {/* Legacy Personal Routes - Keep for backward compatibility */}
            <Route path="ingresos">
              <Route index element={<Navigate to="/personal/resumen" replace />} />
              <Route path="lista" element={<Navigate to="/personal/resumen" replace />} />
              <Route path="nuevo" element={<Navigate to="/personal/resumen" replace />} />
              <Route path="importar" element={<Navigate to="/personal/resumen" replace />} />
            </Route>
            
            <Route path="gastos">
              <Route index element={<Navigate to="/personal/resumen" replace />} />
              <Route path="lista" element={<Navigate to="/personal/resumen" replace />} />
              <Route path="nuevo" element={<Navigate to="/personal/resumen" replace />} />
              <Route path="reglas" element={<Navigate to="/personal/reglas" replace />} />
            </Route>
            
            <Route path="tesoreria-personal">
              <Route index element={<Navigate to="/personal/resumen" replace />} />
              <Route path="radar" element={<Navigate to="/personal/resumen" replace />} />
              <Route path="movimientos" element={<Navigate to="/personal/movimientos" replace />} />
              <Route path="alertas" element={<Navigate to="/personal/reglas" replace />} />
            </Route>
            
            <Route path="proyeccion-personal">
              <Route index element={<Navigate to="/personal/presupuesto" replace />} />
              <Route path="presupuesto" element={<Navigate to="/personal/presupuesto" replace />} />
              <Route path="escenarios" element={<Navigate to="/personal/presupuesto" replace />} />
            </Route>
            
            {/* Shared Configuration Routes */}
            <Route path="configuracion">
              <Route index element={<Navigate to="/configuracion/bancos-cuentas" replace />} />
              {/* Horizon configuration - available only for Horizon */}
              <Route path="bancos-cuentas" element={<BancosCuentas />} />
              <Route path="usuarios-roles" element={<UsuariosRoles />} />
              {/* Shared configuration - available for both modules */}
              <Route path="preferencias-datos" element={<HorizonPreferenciasDatos />} />
              <Route path="email-entrante" element={<EmailEntrante />} />
              {/* H6: Redirect old plan-facturacion route to new cuenta location */}
              <Route path="plan-facturacion" element={<Navigate to="/cuenta/plan" replace />} />
            </Route>

            {/* H6: Account (Cuenta) Routes */}
            <Route path="cuenta">
              <Route index element={<Navigate to="/cuenta/perfil" replace />} />
              <Route path="perfil" element={<AccountPage />} />
              <Route path="seguridad" element={<AccountPage />} />
              <Route path="plan" element={<AccountPage />} />
              <Route path="privacidad" element={<AccountPage />} />
            </Route>
            
            {/* Development only routes */}
            {(import.meta as any).env?.DEV && (
              <Route 
                path="__profiles" 
                element={
                  <React.Suspense fallback={<div>Cargando...</div>}>
                    <ProfileSeederPage />
                  </React.Suspense>
                } 
              />
            )}
            
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;