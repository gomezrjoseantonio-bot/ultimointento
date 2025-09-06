import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { bankProfilesService } from './services/bankProfilesService';
import MainLayout from './layouts/MainLayout';

// Core pages - keep as direct imports for critical path
import Dashboard from './pages/Dashboard';
import InboxPageV2 from './pages/InboxPageV2';
import AccountPage from './pages/account/AccountPage';

// Loading component for better UX
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
    <span className="ml-2 text-gray-600">Cargando...</span>
  </div>
);

// Lazy-loaded components for route-based code splitting
// Horizon (Investment) Module Components
const Cartera = React.lazy(() => import('./modules/horizon/inmuebles/cartera/Cartera'));
const Contratos = React.lazy(() => import('./modules/horizon/inmuebles/contratos/Contratos'));
const Prestamos = React.lazy(() => import('./modules/horizon/inmuebles/prestamos/Prestamos'));
const Analisis = React.lazy(() => import('./modules/horizon/inmuebles/analisis/Analisis'));
const Tesoreria = React.lazy(() => import('./modules/horizon/tesoreria/Tesoreria'));
const TesRadar = React.lazy(() => import('./modules/horizon/tesoreria/radar/Radar'));
const TesIngresos = React.lazy(() => import('./modules/horizon/tesoreria/ingresos/Ingresos'));
const TesGastos = React.lazy(() => import('./modules/horizon/tesoreria/gastos/Gastos'));
const TesCAPEX = React.lazy(() => import('./modules/horizon/tesoreria/capex/CAPEX'));
const TesMovimientos = React.lazy(() => import('./modules/horizon/tesoreria/movimientos/Movimientos'));
const Automatizaciones = React.lazy(() => import('./modules/horizon/tesoreria/automatizaciones/Automatizaciones'));
const TesAlertas = React.lazy(() => import('./modules/horizon/tesoreria/alertas/Alertas'));
const FisResumen = React.lazy(() => import('./modules/horizon/fiscalidad/resumen/Resumen'));
const Detalle = React.lazy(() => import('./modules/horizon/fiscalidad/detalle/Detalle'));
const Declaraciones = React.lazy(() => import('./modules/horizon/fiscalidad/declaraciones/Declaraciones'));
const ProyeccionComparativas = React.lazy(() => import('./modules/horizon/proyeccion/comparativas/ProyeccionComparativas'));
const ProyeccionSimulaciones = React.lazy(() => import('./modules/horizon/proyeccion/simulaciones/ProyeccionSimulaciones'));
const ProyeccionBase = React.lazy(() => import('./modules/horizon/proyeccion/base/ProyeccionBase'));
const BancosCuentas = React.lazy(() => import('./modules/horizon/configuracion/bancos-cuentas/BancosCuentas'));
const UsuariosRoles = React.lazy(() => import('./modules/horizon/configuracion/usuarios-roles/UsuariosRoles'));
const EmailEntrante = React.lazy(() => import('./modules/horizon/configuracion/email-entrante/EmailEntrante'));
const PropertyForm = React.lazy(() => import('./modules/horizon/inmuebles/cartera/PropertyForm'));
const PropertyDetail = React.lazy(() => import('./modules/horizon/inmuebles/cartera/PropertyDetail'));

// Personal section (within Horizon)
const Personal = React.lazy(() => import('./modules/horizon/personal/Personal'));

// Pulse (Management) Module Components
const ContratosLista = React.lazy(() => import('./modules/pulse/contratos/lista/ContratosLista'));
const FirmasPendientes = React.lazy(() => import('./modules/pulse/firmas/pendientes/FirmasPendientes'));
const CobrosPendientes = React.lazy(() => import('./modules/pulse/cobros/pendientes/CobrosPendientes'));
const AutomatizacionesReglas = React.lazy(() => import('./modules/pulse/automatizaciones/reglas/AutomatizacionesReglas'));
const TareasPendientes = React.lazy(() => import('./modules/pulse/tareas/pendientes/TareasPendientes'));

// Legacy Pulse (Personal) Module Components - Keep for migration
const HorizonPreferenciasDatos = React.lazy(() => import('./modules/horizon/configuracion/preferencias-datos/PreferenciasDatos'));
const GastosCapex = React.lazy(() => import('./modules/horizon/inmuebles/gastos-capex/GastosCapex'));

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
              <Route path="cartera" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Cartera />
                </React.Suspense>
              } />
              <Route path="cartera/nuevo" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PropertyForm mode="create" />
                </React.Suspense>
              } />
              <Route path="cartera/:id" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PropertyDetail />
                </React.Suspense>
              } />
              <Route path="cartera/:id/editar" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PropertyForm mode="edit" />
                </React.Suspense>
              } />
              <Route path="contratos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Contratos />
                </React.Suspense>
              } />
              <Route path="prestamos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Prestamos />
                </React.Suspense>
              } />
              <Route path="gastos-capex" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <GastosCapex />
                </React.Suspense>
              } />
              <Route path="analisis" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Analisis />
                </React.Suspense>
              } />
            </Route>
            
            <Route path="tesoreria">
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Tesoreria />
                </React.Suspense>
              } />
              <Route path="radar" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TesRadar />
                </React.Suspense>
              } />
              <Route path="ingresos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TesIngresos />
                </React.Suspense>
              } />
              <Route path="gastos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TesGastos />
                </React.Suspense>
              } />
              <Route path="capex" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TesCAPEX />
                </React.Suspense>
              } />
              <Route path="movimientos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TesMovimientos />
                </React.Suspense>
              } />
              <Route path="automatizaciones" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Automatizaciones />
                </React.Suspense>
              } />
              <Route path="alertas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TesAlertas />
                </React.Suspense>
              } />
            </Route>
            
            <Route path="fiscalidad">
              <Route index element={<Navigate to="/fiscalidad/resumen" replace />} />
              <Route path="resumen" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FisResumen />
                </React.Suspense>
              } />
              <Route path="detalle" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Detalle />
                </React.Suspense>
              } />
              <Route path="declaraciones" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Declaraciones />
                </React.Suspense>
              } />
            </Route>
            
            <Route path="proyeccion">
              <Route index element={<Navigate to="/proyeccion/base" replace />} />
              <Route path="cartera" element={<Navigate to="/inmuebles/cartera" replace />} />
              <Route path="consolidado" element={<Navigate to="/proyeccion/comparativas" replace />} />
              {/* Legacy routes for backward compatibility */}
              <Route path="presupuesto" element={<Navigate to="/proyeccion/base" replace />} />
              <Route path="escenarios" element={<Navigate to="/proyeccion/simulaciones" replace />} />
              {/* New structure */}
              <Route path="base" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ProyeccionBase />
                </React.Suspense>
              } />
              <Route path="simulaciones" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ProyeccionSimulaciones />
                </React.Suspense>
              } />
              <Route path="comparativas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ProyeccionComparativas />
                </React.Suspense>
              } />
            </Route>
            
            {/* Personal section (within Horizon) */}
            <Route path="personal">
              <Route index element={<Navigate to="/personal/resumen" replace />} />
              <Route path="resumen" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Personal />
                </React.Suspense>
              } />
              <Route path="cuentas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Personal />
                </React.Suspense>
              } />
              <Route path="movimientos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Personal />
                </React.Suspense>
              } />
              <Route path="presupuesto" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Personal />
                </React.Suspense>
              } />
              <Route path="reglas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Personal />
                </React.Suspense>
              } />
            </Route>
            
            {/* Pulse (Management) Routes */}
            <Route path="contratos">
              <Route index element={<Navigate to="/contratos/lista" replace />} />
              <Route path="lista" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ContratosLista />
                </React.Suspense>
              } />
              <Route path="nuevo" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ContratosLista />
                </React.Suspense>
              } />
              <Route path="gestion" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ContratosLista />
                </React.Suspense>
              } />
            </Route>
            
            <Route path="firmas">
              <Route index element={<Navigate to="/firmas/pendientes" replace />} />
              <Route path="pendientes" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FirmasPendientes />
                </React.Suspense>
              } />
              <Route path="completadas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FirmasPendientes />
                </React.Suspense>
              } />
              <Route path="plantillas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FirmasPendientes />
                </React.Suspense>
              } />
            </Route>
            
            <Route path="cobros">
              <Route index element={<Navigate to="/cobros/pendientes" replace />} />
              <Route path="pendientes" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <CobrosPendientes />
                </React.Suspense>
              } />
              <Route path="conciliacion" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <CobrosPendientes />
                </React.Suspense>
              } />
              <Route path="historico" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <CobrosPendientes />
                </React.Suspense>
              } />
            </Route>
            
            <Route path="automatizaciones">
              <Route index element={<Navigate to="/automatizaciones/reglas" replace />} />
              <Route path="reglas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AutomatizacionesReglas />
                </React.Suspense>
              } />
              <Route path="flujos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AutomatizacionesReglas />
                </React.Suspense>
              } />
              <Route path="historial" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AutomatizacionesReglas />
                </React.Suspense>
              } />
            </Route>
            
            <Route path="tareas">
              <Route index element={<Navigate to="/tareas/pendientes" replace />} />
              <Route path="pendientes" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TareasPendientes />
                </React.Suspense>
              } />
              <Route path="completadas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TareasPendientes />
                </React.Suspense>
              } />
              <Route path="programadas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TareasPendientes />
                </React.Suspense>
              } />
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
              <Route path="bancos-cuentas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <BancosCuentas />
                </React.Suspense>
              } />
              <Route path="usuarios-roles" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <UsuariosRoles />
                </React.Suspense>
              } />
              {/* Shared configuration - available for both modules */}
              <Route path="preferencias-datos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <HorizonPreferenciasDatos />
                </React.Suspense>
              } />
              <Route path="email-entrante" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <EmailEntrante />
                </React.Suspense>
              } />
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