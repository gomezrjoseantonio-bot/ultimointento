import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { bankProfilesService } from './services/bankProfilesService';
import { performanceMonitor } from './services/performanceMonitoringService';
import { initializeAccountMigration } from './services/accountMigrationService';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Core pages - keep minimal imports for critical path  
import AccountPage from './pages/account/AccountPage';

// Auth pages
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage'));

// Loading component for better UX - ATLAS compliant
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-atlas-blue border-t-transparent"></div>
    <span className="ml-2" style={{ color: 'var(--text-gray)' }}>Cargando...</span>
  </div>
);

// Lazy-loaded components for route-based code splitting
// Core dashboard with charts - lazy load to reduce main bundle
const PanelPage = React.lazy(() => import('./pages/PanelPage'));

// Inbox page - lazy load to reduce main bundle
const InboxPage = React.lazy(() => import('./pages/InboxPage'));

// Horizon (Investment) Module Components
const Cartera = React.lazy(() => import('./modules/horizon/inmuebles/cartera/Cartera'));
const Contratos = React.lazy(() => import('./modules/horizon/inmuebles/contratos/Contratos'));
const Analisis = React.lazy(() => import('./modules/horizon/inmuebles/analisis/Analisis'));
const InmuebleWizard = React.lazy(() => import('./components/inmuebles/InmuebleWizard'));

// Operaciones económicas vinculadas a inmuebles
const Ingresos = React.lazy(() => import('./modules/horizon/tesoreria/ingresos/Ingresos'));
const Gastos = React.lazy(() => import('./modules/horizon/tesoreria/gastos/Gastos'));
const Capex = React.lazy(() => import('./modules/horizon/tesoreria/capex/CAPEX'));

// Inversiones Module
const InversionesPage = React.lazy(() => import('./modules/horizon/inversiones/InversionesPage'));

// Financing Module - New standalone financing module
const Financiacion = React.lazy(() => import('./modules/horizon/financiacion/Financiacion'));

// Tesoreria Module (Puramente cuentas bancarias y conciliación)
const Tesoreria = React.lazy(() => import('./modules/horizon/tesoreria/Tesoreria'));

// Fiscalidad Module
const FisResumen = React.lazy(() => import('./modules/horizon/fiscalidad/resumen/Resumen'));
const Detalle = React.lazy(() => import('./modules/horizon/fiscalidad/detalle/Detalle'));
const Declaraciones = React.lazy(() => import('./modules/horizon/fiscalidad/declaraciones/Declaraciones'));

// Proyecciones
const PresupuestoScopeView = React.lazy(() => import('./modules/horizon/proyeccion/presupuesto/PresupuestoScopeView'));
const ProyeccionComparativa = React.lazy(() => import('./modules/horizon/proyeccion/comparativa/ProyeccionComparativa'));
const ProyeccionEscenarios = React.lazy(() => import('./modules/horizon/proyeccion/escenarios/ProyeccionEscenarios'));
const ProyeccionValoraciones = React.lazy(() => import('./modules/horizon/proyeccion/valoraciones/Valoraciones'));
const ProyeccionMensual = React.lazy(() => import('./modules/horizon/proyeccion/mensual/ProyeccionMensual'));

// Configuracion
const UsuariosRoles = React.lazy(() => import('./modules/horizon/configuracion/usuarios-roles/UsuariosRoles'));
const Cuentas = React.lazy(() => import('./modules/horizon/configuracion/cuentas/Cuentas'));

// Documentación
const Documentacion = React.lazy(() => import('./pages/Documentacion'));

function App() {
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('[APP] Initializing core services...');
        const t0 = performance.now();
        
        // Initialize bank profiles
        await bankProfilesService.initialize();
        
        // Execute account migration
        await initializeAccountMigration();
        
        const t1 = performance.now();
        performanceMonitor.recordMetric('app_init', t1 - t0);
        console.log(`[APP] Core services initialized in ${Math.round(t1 - t0)}ms`);
      } catch (error) {
        console.error('[APP] Failed to initialize core services:', error);
      }
    };
    
    initApp();
  }, []);

  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50 flex flex-col">
            <Toaster 
              position="top-right"
              toastOptions={{
                className: 'font-inter text-sm shadow-lg',
                duration: 4000,
                success: {
                  iconTheme: { primary: '#10B981', secondary: 'white' },
                  style: { borderLeft: '4px solid #10B981' }
                },
                error: {
                  iconTheme: { primary: '#EF4444', secondary: 'white' },
                  style: { borderLeft: '4px solid #EF4444' }
                }
              }} 
            />
            
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={
                <React.Suspense fallback={<LoadingSpinner />}>  
                  <LoginPage />
                </React.Suspense>
              } />
              
              <Route path="/register" element={
                <React.Suspense fallback={<LoadingSpinner />}>  
                  <RegisterPage />
                </React.Suspense>
              } />

              {/* Protected Routes inside MainLayout */}
              <Route path="/" element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }>
                {/* Default redirect to dashboard */}
                <Route index element={<Navigate to="/dashboard" replace />} />
                
                {/* Root Dashboard */}
                <Route path="dashboard" element={
                  <React.Suspense fallback={<LoadingSpinner />}>  
                    <PanelPage />
                  </React.Suspense>
                } />
                
                {/* Inbox - Facturas Inteligentes */}
                <Route path="inbox" element={
                  <React.Suspense fallback={<LoadingSpinner />}>  
                    <InboxPage />
                  </React.Suspense>
                } />
                
                {/* ATLAS HORIZON MODULES */}
                
                {/* Inmuebles & Operaciones */}
                <Route path="inmuebles">  
                  <Route index element={<Navigate to="cartera" replace />} />
                  <Route path="cartera" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <Cartera />
                    </React.Suspense>
                  } />
                  <Route path="contratos" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <Contratos />
                    </React.Suspense>
                  } />
                  {/* Nuevas rutas de operaciones en Inmuebles */}
                  <Route path="ingresos" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <Ingresos />
                    </React.Suspense>
                  } />
                  <Route path="gastos" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <Gastos />
                    </React.Suspense>
                  } />
                  <Route path="capex" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <Capex />
                    </React.Suspense>
                  } />
                  <Route path="analisis" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <Analisis />
                    </React.Suspense>
                  } />
                  
                  {/* Wizard Routes */}
                  <Route path="nuevo" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <InmuebleWizard mode="create" />
                    </React.Suspense>
                  } />
                  <Route path=":id/editar" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <InmuebleWizard mode="edit" />
                    </React.Suspense>
                  } />
                </Route>

                {/* Inversiones (Cartera Financiera) */}
                <Route path="inversiones/*" element={
                  <React.Suspense fallback={<LoadingSpinner />}>  
                    <InversionesPage />
                  </React.Suspense>
                } />

                {/* Financiación */}
                <Route path="financiacion/*" element={
                  <React.Suspense fallback={<LoadingSpinner />}>  
                    <Financiacion />
                  </React.Suspense>
                } />

                {/* Tesorería (Gestión Bancaria) */}
                <Route path="tesoreria/*" element={
                  <React.Suspense fallback={<LoadingSpinner />}>  
                    <Tesoreria />
                  </React.Suspense>
                } />

                {/* Fiscalidad */}
                <Route path="fiscalidad">  
                  <Route index element={<Navigate to="resumen" replace />} />
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

                {/* Proyección */}
                <Route path="proyeccion">  
                  <Route index element={<Navigate to="presupuesto" replace />} />
                  <Route path="presupuesto" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <PresupuestoScopeView />
                    </React.Suspense>
                  } />
                  <Route path="mensual" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <ProyeccionMensual />
                    </React.Suspense>
                  } />
                  <Route path="comparativa" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <ProyeccionComparativa />
                    </React.Suspense>
                  } />
                  <Route path="valoraciones" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <ProyeccionValoraciones />
                    </React.Suspense>
                  } />
                  <Route path="escenarios" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <ProyeccionEscenarios />
                    </React.Suspense>
                  } />
                </Route>

                {/* Account Settings */}
                <Route path="cuenta/*" element={<AccountPage />} />

                {/* Configuración */}
                <Route path="configuracion">  
                  <Route index element={<Navigate to="usuarios-roles" replace />} />
                  <Route path="usuarios-roles" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <UsuariosRoles />
                    </React.Suspense>
                  } />
                  <Route path="cuentas" element={
                    <React.Suspense fallback={<LoadingSpinner />}>  
                      <Cuentas />
                    </React.Suspense>
                  } />
                </Route>

                {/* Documentación */}
                <Route path="docs" element={
                  <React.Suspense fallback={<LoadingSpinner />}>  
                    <Documentacion />
                  </React.Suspense>
                } />

              </Route>

              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;