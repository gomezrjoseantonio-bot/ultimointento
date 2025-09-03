import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { bankProfilesService } from './services/bankProfilesService';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import InboxPage from './pages/InboxPage';
import AccountPage from './pages/account/AccountPage';

// Horizon (Investment) Module Components
import Cartera from './modules/horizon/inmuebles/cartera/Cartera';
import Contratos from './modules/horizon/inmuebles/contratos/Contratos';
import Prestamos from './modules/horizon/inmuebles/prestamos/Prestamos';
import Analisis from './modules/horizon/inmuebles/analisis/Analisis';
import TesRadar from './modules/horizon/tesoreria/radar/Radar';
import TesIngresos from './modules/horizon/tesoreria/ingresos/Ingresos';
import TesGastos from './modules/horizon/tesoreria/gastos/Gastos';
import TesCAPEX from './modules/horizon/tesoreria/capex/CAPEX';
import TesMovimientos from './modules/horizon/tesoreria/movimientos/Movimientos';
import Automatizaciones from './modules/horizon/tesoreria/automatizaciones/Automatizaciones';
import TesAlertas from './modules/horizon/tesoreria/alertas/Alertas';
import FisResumen from './modules/horizon/fiscalidad/resumen/Resumen';
import Deducibles from './modules/horizon/fiscalidad/deducibles/Deducibles';
import Declaraciones from './modules/horizon/fiscalidad/declaraciones/Declaraciones';
import ProyeccionCartera from './modules/horizon/proyeccion/cartera/ProyeccionCartera';
import ProyeccionConsolidado from './modules/horizon/proyeccion/consolidado/ProyeccionConsolidado';
import BancosCuentas from './modules/horizon/configuracion/bancos-cuentas/BancosCuentas';
import UsuariosRoles from './modules/horizon/configuracion/usuarios-roles/UsuariosRoles';
import EmailEntrante from './modules/horizon/configuracion/email-entrante/EmailEntrante';
import PropertyForm from './modules/horizon/inmuebles/cartera/PropertyForm';
import PropertyDetail from './modules/horizon/inmuebles/cartera/PropertyDetail';

// Pulse (Personal) Module Components
import IngresosLista from './modules/pulse/ingresos/lista/IngresosLista';
import IngresosNuevo from './modules/pulse/ingresos/nuevo/IngresosNuevo';
import IngresosImportar from './modules/pulse/ingresos/importar/IngresosImportar';
import GastosLista from './modules/pulse/gastos/lista/GastosLista';
import GastosNuevo from './modules/pulse/gastos/nuevo/GastosNuevo';
import GastosReglas from './modules/pulse/gastos/reglas/GastosReglas';
import TPRadar from './modules/pulse/tesoreria-personal/radar/TPRadar';
import TPMovimientos from './modules/pulse/tesoreria-personal/movimientos/TPMovimientos';
import TPAlertas from './modules/pulse/tesoreria-personal/alertas/TPAlertas';
import PPPresupuesto from './modules/pulse/proyeccion-personal/presupuesto/PPPresupuesto';
import PPEscenarios from './modules/pulse/proyeccion-personal/escenarios/PPEscenarios';
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
            <Route path="inbox" element={<InboxPage />} />
            
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
              <Route index element={<Navigate to="/tesoreria/radar" replace />} />
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
              <Route path="deducibles" element={<Deducibles />} />
              <Route path="declaraciones" element={<Declaraciones />} />
            </Route>
            
            <Route path="proyeccion">
              <Route index element={<Navigate to="/proyeccion/cartera" replace />} />
              <Route path="cartera" element={<ProyeccionCartera />} />
              <Route path="consolidado" element={<ProyeccionConsolidado />} />
            </Route>
            
            {/* Pulse (Personal) Routes */}
            <Route path="ingresos">
              <Route index element={<Navigate to="/ingresos/lista" replace />} />
              <Route path="lista" element={<IngresosLista />} />
              <Route path="nuevo" element={<IngresosNuevo />} />
              <Route path="importar" element={<IngresosImportar />} />
            </Route>
            
            <Route path="gastos">
              <Route index element={<Navigate to="/gastos/lista" replace />} />
              <Route path="lista" element={<GastosLista />} />
              <Route path="nuevo" element={<GastosNuevo />} />
              <Route path="reglas" element={<GastosReglas />} />
            </Route>
            
            <Route path="tesoreria-personal">
              <Route index element={<Navigate to="/tesoreria-personal/radar" replace />} />
              <Route path="radar" element={<TPRadar />} />
              <Route path="movimientos" element={<TPMovimientos />} />
              <Route path="alertas" element={<TPAlertas />} />
            </Route>
            
            <Route path="proyeccion-personal">
              <Route index element={<Navigate to="/proyeccion-personal/presupuesto" replace />} />
              <Route path="presupuesto" element={<PPPresupuesto />} />
              <Route path="escenarios" element={<PPEscenarios />} />
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