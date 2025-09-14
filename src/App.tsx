import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { bankProfilesService } from './services/bankProfilesService';
import { performanceMonitor } from './services/performanceMonitoringService';
import MainLayout from './layouts/MainLayout';

// Core pages - keep minimal imports for critical path  
import AccountPage from './pages/account/AccountPage';

// Loading component for better UX - ATLAS compliant
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-atlas-blue border-t-transparent"></div>
    <span className="ml-2" style={{ color: 'var(--text-gray)' }}>Cargando...</span>
  </div>
);

// Lazy-loaded components for route-based code splitting
// Core dashboard with charts - lazy load to reduce main bundle
const Dashboard = React.lazy(() => import('./pages/Dashboard'));

// Inbox pages - lazy load to reduce main bundle
const InboxAtlasHorizon = React.lazy(() => import('./pages/InboxAtlasHorizon'));
const UnicornioInboxPrompt = React.lazy(() => import('./pages/UnicornioInboxPrompt'));
const UnifiedInboxPage = React.lazy(() => import('./pages/UnifiedInboxPage'));

// Horizon (Investment) Module Components
const Cartera = React.lazy(() => import('./modules/horizon/inmuebles/cartera/Cartera'));
const Contratos = React.lazy(() => import('./modules/horizon/inmuebles/contratos/Contratos'));
const Analisis = React.lazy(() => import('./modules/horizon/inmuebles/analisis/Analisis'));

// Financing Module - New standalone financing module
const Financiacion = React.lazy(() => import('./modules/horizon/financiacion/Financiacion'));
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

const PresupuestoScopeView = React.lazy(() => import('./modules/horizon/proyeccion/presupuesto/PresupuestoScopeView'));
const ProyeccionComparativa = React.lazy(() => import('./modules/horizon/proyeccion/comparativa/ProyeccionComparativa'));
const ProyeccionEscenarios = React.lazy(() => import('./modules/horizon/proyeccion/escenarios/ProyeccionEscenarios'));
const UsuariosRoles = React.lazy(() => import('./modules/horizon/configuracion/usuarios-roles/UsuariosRoles'));
const EmailEntrante = React.lazy(() => import('./modules/horizon/configuracion/email-entrante/EmailEntrante'));
const Cuentas = React.lazy(() => import('./modules/horizon/configuracion/cuentas/CuentasContainer'));
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

// Image Description page - New feature
const ImageDescriptionPage = React.lazy(() => import('./pages/ImageDescriptionPage'));

// Demo page for color-coded movement display requirements
const ColorCodedMovementDemo = React.lazy(() => import('./pages/ColorCodedMovementDemo'));

// Design Bible page - ATLAS Design System reference
const DesignBiblePage = React.lazy(() => import('./pages/DesignBiblePage'));

function App() {
  // Initialize bank profiles and performance monitoring on app start
  useEffect(() => {
    bankProfilesService.loadProfiles().catch(console.error);
    
    // Performance monitoring setup
    const performanceObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          performanceMonitor.recordMetric({
            operation: 'app_load',
            duration: navEntry.loadEventEnd - navEntry.fetchStart,
            timestamp: Date.now()
          });
        } else if (entry.entryType === 'measure') {
          performanceMonitor.recordMetric({
            operation: entry.name,
            duration: entry.duration,
            timestamp: Date.now()
          });
        }
      });
    });
    
    // Start observing performance
    try {
      performanceObserver.observe({ entryTypes: ['navigation', 'measure'] });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }
    
    // Log performance status periodically in development
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        if (performanceMonitor.needsOptimization()) {
          console.warn('⚠️ Performance optimization needed');
          performanceMonitor.logPerformanceStatus();
        }
      }, 30000); // Check every 30 seconds
      
      return () => {
        clearInterval(interval);
        performanceObserver.disconnect();
      };
    }
    
    return () => performanceObserver.disconnect();
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              color: 'var(--atlas-navy-1)',
              background: 'white',
              border: '1px solid var(--hz-neutral-300)',
              borderRadius: '10px',
              boxShadow: '0 4px 6px rgba(156, 163, 175, 0.1)',
            },
            success: {
              iconTheme: {
                primary: 'var(--ok)',
                secondary: 'white',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--error)',
                secondary: 'white',
              },
            },
          }}
        />
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/panel" replace />} />
            <Route path="panel" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <Dashboard />
              </React.Suspense>
            } />
            <Route path="inbox" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <UnicornioInboxPrompt />
              </React.Suspense>
            } />
            <Route path="inbox-unified" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <UnifiedInboxPage />
              </React.Suspense>
            } />
            <Route path="inbox-legacy" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InboxAtlasHorizon />
              </React.Suspense>
            } />
            
            {/* Image Description Feature */}
            <Route path="describe-image" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <ImageDescriptionPage />
              </React.Suspense>
            } />
            
            {/* Design Bible - ATLAS Design System */}
            <Route path="design-bible" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <DesignBiblePage />
              </React.Suspense>
            } />
            
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
            
            {/* Financing Module - Standalone loan management */}
            <Route path="financiacion" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <Financiacion />
              </React.Suspense>
            } />
            
            <Route path="proyeccion">
              <Route index element={<Navigate to="/proyeccion/presupuesto" replace />} />
              <Route path="cartera" element={<Navigate to="/inmuebles/cartera" replace />} />
              <Route path="consolidado" element={<Navigate to="/proyeccion/comparativa" replace />} />
              
              {/* Main proyeccion tabs */}
              <Route path="presupuesto" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PresupuestoScopeView />
                </React.Suspense>
              } />
              <Route path="comparativa" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ProyeccionComparativa />
                </React.Suspense>
              } />
              <Route path="escenarios" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ProyeccionEscenarios />
                </React.Suspense>
              } />
              
              {/* Legacy routes for backward compatibility */}
              <Route path="base" element={<Navigate to="/proyeccion/escenarios" replace />} />
              <Route path="simulaciones" element={<Navigate to="/proyeccion/escenarios" replace />} />
              <Route path="comparativas" element={<Navigate to="/proyeccion/escenarios" replace />} />
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
              <Route index element={<Navigate to="/configuracion/usuarios-roles" replace />} />
              {/* ATLAS: Redirect old tesoreria cuentas to new location */}
              <Route path="bancos-cuentas" element={<Navigate to="/configuracion/cuentas" replace />} />
              {/* Horizon configuration - available only for Horizon */}
              <Route path="usuarios-roles" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <UsuariosRoles />
                </React.Suspense>
              } />
              {/* ATLAS: New Cuentas section with Bancos and Reglas subtabs */}
              <Route path="cuentas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Cuentas />
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
              <>
                <Route 
                  path="__profiles" 
                  element={
                    <React.Suspense fallback={<div>Cargando...</div>}>
                      <ProfileSeederPage />
                    </React.Suspense>
                  } 
                />
                <Route 
                  path="__demo-colors" 
                  element={
                    <React.Suspense fallback={<div>Cargando...</div>}>
                      <ColorCodedMovementDemo />
                    </React.Suspense>
                  } 
                />
              </>
            )}
            
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;