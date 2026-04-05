import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { bankProfilesService } from './services/bankProfilesService';
import { performanceMonitor } from './services/performanceMonitoringService';
import { initializeAccountMigration } from './services/accountMigrationService';
import { initDB } from './services/db';
import { ejecutarMigracionFiscal } from './services/ejercicioFiscalMigration';
import { ejecutarMigracion as ejecutarMigracionGastos } from './services/migracionGastosService';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import CopilotWidget from './components/common/CopilotWidget';

// Loading component for better UX - ATLAS compliant
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-atlas-blue border-t-transparent"></div>
    <span className="ml-2" style={{ color: 'var(--text-gray)' }}>Cargando...</span>
  </div>
);

type PreloadableComponent<T extends React.ComponentType<any>> = React.LazyExoticComponent<T> & {
  preload: () => Promise<{ default: T }>;
};

const lazyWithPreload = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): PreloadableComponent<T> => {
  const Component = React.lazy(factory) as PreloadableComponent<T>;
  Component.preload = factory;
  return Component;
};

const runWhenIdle = (task: () => void, timeout = 1500) => {
  if (typeof window === 'undefined') return () => undefined;

  const idleCallback = (window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  }).requestIdleCallback;

  if (idleCallback) {
    const handle = idleCallback(() => task(), { timeout });
    return () => {
      const cancelIdle = (window as Window & { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback;
      cancelIdle?.(handle);
    };
  }

  const handle = window.setTimeout(task, Math.min(timeout, 800));
  return () => window.clearTimeout(handle);
};

// Lazy-loaded components for route-based code splitting
// Core dashboard with charts - lazy load to reduce main bundle
const PanelPage = lazyWithPreload(() => import('./pages/PanelPage'));

// Inbox page - lazy load to reduce main bundle
const InboxPage = lazyWithPreload(() => import('./pages/InboxPage'));

// Horizon (Investment) Module Components
const Cartera = lazyWithPreload(() => import('./modules/horizon/inmuebles/cartera/Cartera'));
const Contratos = lazyWithPreload(() => import('./modules/horizon/inmuebles/contratos/Contratos'));
const Analisis = lazyWithPreload(() => import('./modules/horizon/inmuebles/analisis/Analisis'));
const Ingresos = lazyWithPreload(() => import('./modules/horizon/inmuebles/ingresos/Ingresos'));
const Gastos = lazyWithPreload(() => import('./modules/horizon/inmuebles/gastos/Gastos'));
const Supervision = lazyWithPreload(() => import('./modules/horizon/inmuebles/supervision/Supervision'));

// Inversiones Module
const InversionesPage = lazyWithPreload(() => import('./modules/horizon/inversiones/InversionesPage'));
const AnalisisCartera = lazyWithPreload(() => import('./modules/horizon/analisis-cartera/AnalisisCartera'));

const InversionesAnalisis = lazyWithPreload(() => import('./pages/inversiones/InversionesAnalisis'));

// Financing Module - New standalone financing module
const Financiacion = lazyWithPreload(() => import('./modules/horizon/financiacion/Financiacion'));
const Tesoreria = lazyWithPreload(() => import('./modules/horizon/tesoreria/Tesoreria'));
const FiscalLayout = lazyWithPreload(() => import('./modules/horizon/fiscalidad/FiscalLayout'));
const ImpuestosSupervisionPage = lazyWithPreload(() => import('./modules/horizon/fiscalidad/supervision/ImpuestosSupervisionPage'));
const DeclaracionCompletaPage = lazyWithPreload(() => import('./modules/horizon/fiscalidad/declaracion/DeclaracionCompletaPage'));

const ProyeccionComparativa = lazyWithPreload(() => import('./modules/horizon/proyeccion/comparativa/ProyeccionComparativa'));
const ProyeccionEscenarios = lazyWithPreload(() => import('./modules/horizon/proyeccion/escenarios/ProyeccionEscenarios'));
const ProyeccionValoraciones = lazyWithPreload(() => import('./modules/horizon/proyeccion/valoraciones/Valoraciones'));
const ProyeccionMensual = lazyWithPreload(() => import('./modules/horizon/proyeccion/mensual/ProyeccionMensual'));
const InformesPage = lazyWithPreload(() => import('./modules/horizon/informes/InformesPage'));
const PresupuestosView = lazyWithPreload(() => import('./modules/horizon/proyeccion/presupuesto/PresupuestosView'));
const UsuariosRoles = lazyWithPreload(() => import('./modules/horizon/configuracion/usuarios-roles/UsuariosRoles'));
const EmailEntrante = lazyWithPreload(() => import('./modules/horizon/configuracion/email-entrante/EmailEntrante'));
const Cuentas = lazyWithPreload(() => import('./modules/horizon/configuracion/cuentas/CuentasContainer'));
const PropertyForm = lazyWithPreload(() => import('./modules/horizon/inmuebles/cartera/PropertyForm'));
const PropertyDetail = lazyWithPreload(() => import('./modules/horizon/inmuebles/cartera/PropertyDetail'));

// Personal section (within Horizon)
const PersonalSupervision = lazyWithPreload(() => import('./modules/horizon/personal/supervision/PersonalSupervisionPage'));

// Gestión Personal hub
const GestionPersonalPage = lazyWithPreload(() => import('./pages/GestionPersonal/GestionPersonalPage'));
const NominaWizardPage = lazyWithPreload(() => import('./pages/GestionPersonal/wizards/NominaWizard'));
const AutonomoWizardPage = lazyWithPreload(() => import('./pages/GestionPersonal/wizards/AutonomoWizard'));
const OtrosIngresosWizardPage = lazyWithPreload(() => import('./pages/GestionPersonal/wizards/OtrosIngresosWizard'));

// Pulse (Management) Module Components
const ContratosLista = lazyWithPreload(() => import('./modules/pulse/contratos/lista/ContratosLista'));
const ContratosNuevoPage = lazyWithPreload(() => import('./modules/pulse/contratos/nuevo/ContratosNuevo'));
const FirmasPendientes = lazyWithPreload(() => import('./modules/pulse/firmas/pendientes/FirmasPendientes'));
const AutomatizacionesReglas = lazyWithPreload(() => import('./modules/pulse/automatizaciones/reglas/AutomatizacionesReglas'));
const TareasPendientes = lazyWithPreload(() => import('./modules/pulse/tareas/pendientes/TareasPendientes'));

// Legacy Pulse (Personal) Module Components - Keep for migration
const HorizonPreferenciasDatos = lazyWithPreload(() => import('./modules/horizon/configuracion/preferencias-datos/PreferenciasDatos'));
const GastosCapex = lazyWithPreload(() => import('./modules/horizon/inmuebles/gastos-capex/GastosCapex'));

// Development only imports
const ProfileSeederPage = lazyWithPreload(() =>
  (import.meta as any).env?.DEV 
    ? import('./pages/ProfileSeederPage')
    : Promise.resolve({ default: () => null })
);

// Image Description page - New feature
const ImageDescriptionPage = lazyWithPreload(() => import('./pages/ImageDescriptionPage'));


// Design Bible page - ATLAS Design System reference
const DesignBiblePage = lazyWithPreload(() => import('./pages/DesignBiblePage'));

// Glossary page - Sprint 3: Accessible technical terms reference
const GlossaryPage = lazyWithPreload(() => import('./pages/GlossaryPage'));
const HerramientasPage = lazyWithPreload(() => import('./pages/HerramientasPage'));
const MiPlanObjetivos = lazyWithPreload(() => import('./modules/horizon/mi-plan/objetivos/ObjetivosPage'));
const MiPlanLibertad = lazyWithPreload(() => import('./modules/horizon/mi-plan/libertad/LibertadFinancieraPage'));
const AccountPage = lazyWithPreload(() => import('./pages/account/AccountPage'));

function App() {
  // Initialize bank profiles and performance monitoring on app start
  useEffect(() => {
    void initDB()
      .then(() => ejecutarMigracionGastos())
      .catch((error) => {
        console.error('[ATLAS] Error inicializando IndexedDB o migración gastos:', error);
      });

    const cleanupTasks = [
      runWhenIdle(() => {
        ejecutarMigracionFiscal()
          .then((migration) => {
            if (migration.migrado) {
              console.log(`[ATLAS] Migración fiscal: ${migration.ejerciciosMigrados.length} ejercicios migrados`);
            }
            if (migration.ejerciciosCerrados.length > 0) {
              console.log(`[ATLAS] Ejercicios cerrados automáticamente: ${migration.ejerciciosCerrados.join(', ')}`);
            }
          })
          .catch((error) => {
            console.error('[ATLAS] Error inicializando migración fiscal:', error);
          });
      }, 2500),
      runWhenIdle(() => {
        initializeAccountMigration().catch(console.error);
      }, 1200),
      runWhenIdle(() => {
        bankProfilesService.loadProfiles().catch(console.error);
      }, 1800),
    ];

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
        cleanupTasks.forEach((cleanup) => cleanup());
        clearInterval(interval);
        performanceObserver.disconnect();
      };
    }
    
    return () => {
      cleanupTasks.forEach((cleanup) => cleanup());
      performanceObserver.disconnect();
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
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
                boxShadow: '0 2px 4px rgba(156, 163, 175, 0.1)',
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
          <CopilotWidget />
          <Routes>
            {/* Auth por email desactivada temporalmente */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Navigate to="/" replace />} />

            {/* Protected App Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
            <Route index element={<Navigate to="/panel" replace />} />
            <Route path="panel" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <PanelPage />
              </React.Suspense>
            } />
            <Route path="inbox" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InboxPage />
              </React.Suspense>
            } />
            <Route path="inbox-unified" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InboxPage />
              </React.Suspense>
            } />
            <Route path="inbox-legacy" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InboxPage />
              </React.Suspense>
            } />
            <Route path="documentacion" element={<Navigate to="/inbox" replace />} />
            <Route path="documentacion/filtros" element={<Navigate to="/inbox" replace />} />
            <Route path="documentacion/fiscal" element={<Navigate to="/inbox" replace />} />
            <Route path="documentacion/inspecciones" element={<Navigate to="/inbox" replace />} />
            <Route path="informes" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InformesPage />
              </React.Suspense>
            } />
            <Route path="herramientas" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <HerramientasPage />
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
            
            {/* Glossary - Sprint 3: Accessible technical terms */}
            <Route path="glosario" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <GlossaryPage />
              </React.Suspense>
            } />
            
            {/* Horizon (Investment) Routes */}
            <Route path="inmuebles">
              <Route index element={<Navigate to="/inmuebles/supervision" replace />} />
              <Route path="resumen" element={<Navigate to="/inmuebles/supervision" replace />} />
              <Route path="individual" element={<Navigate to="/inmuebles/supervision" replace />} />
              <Route path="resumen" element={<Navigate to="/inmuebles/supervision" replace />} />
              <Route path="individual" element={<Navigate to="/inmuebles/supervision" replace />} />
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
              <Route path="evolucion" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Analisis />
                </React.Suspense>
              } />
              <Route path="analisis" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AnalisisCartera scope="inmuebles" />
                </React.Suspense>
              } />
              <Route path="analisis-cartera" element={<Navigate to="/inmuebles/analisis" replace />} />
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
              {/* mejora route removed — store deleted */}
              <Route path="supervision" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Supervision />
                </React.Suspense>
              } />
            </Route>
            
            {/* Inversiones Module */}
            <Route path="inversiones">
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InversionesAnalisis />
                </React.Suspense>
              } />
              <Route path="cartera" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InversionesPage initialTab="cartera" />
                </React.Suspense>
              } />
              <Route path="rendimientos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InversionesPage initialTab="rendimientos" />
                </React.Suspense>
              } />
              <Route path="analisis" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AnalisisCartera scope="inversiones" />
                </React.Suspense>
              } />
            </Route>
            
            <Route path="tesoreria">
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Tesoreria />
                </React.Suspense>
              } />
              <Route path="cuenta/:id" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Tesoreria />
                </React.Suspense>
              } />
            </Route>
            
            <Route path="fiscalidad" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <FiscalLayout />
              </React.Suspense>
            }>
              {/* New Supervision page is the main view (no tabs) */}
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ImpuestosSupervisionPage />
                </React.Suspense>
              } />
              {/* Full declaration view for a specific year */}
              <Route path="declaracion/:año" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <DeclaracionCompletaPage />
                </React.Suspense>
              } />
              {/* Legacy routes — redirect to new supervision view */}
              <Route path="mi-irpf" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="historial" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="estado" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="resumen" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="dashboard" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="simulador" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="declaracion" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="pre-declaracion" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="pagos" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="historico" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="entidades" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="detalle" element={<Navigate to="/fiscalidad" replace />} />
              <Route path="declaraciones" element={<Navigate to="/fiscalidad" replace />} />
            </Route>
            
            {/* Financing Module - Standalone loan management */}
            <Route path="financiacion" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <Financiacion />
              </React.Suspense>
            } />
            
            <Route path="mi-plan">
              <Route path="objetivos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <MiPlanObjetivos />
                </React.Suspense>
              } />
              <Route path="libertad" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <MiPlanLibertad />
                </React.Suspense>
              } />
              <Route index element={<Navigate to="/mi-plan/objetivos" replace />} />
            </Route>

            <Route path="proyeccion">
              <Route index element={<Navigate to="/proyeccion/presupuesto" replace />} />
              <Route path="cartera" element={<Navigate to="/inmuebles/cartera" replace />} />
              <Route path="consolidado" element={<Navigate to="/proyeccion/comparativa" replace />} />
              
              {/* Main proyeccion tabs */}
              <Route path="presupuesto" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PresupuestosView />
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
              <Route path="valoraciones" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ProyeccionValoraciones />
                </React.Suspense>
              } />
              
              {/* Legacy routes for backward compatibility */}
              <Route path="base" element={<Navigate to="/proyeccion/escenarios" replace />} />
              <Route path="simulaciones" element={<Navigate to="/proyeccion/escenarios" replace />} />
              <Route path="comparativas" element={<Navigate to="/proyeccion/escenarios" replace />} />
              <Route path="mensual" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ProyeccionMensual />
                </React.Suspense>
              } />
            </Route>
            
            {/* Personal section (within Horizon) */}
            <Route path="personal">
              <Route index element={<Navigate to="/personal/supervision" replace />} />
              <Route path="supervision" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PersonalSupervision />
                </React.Suspense>
              } />
              {/* Legacy routes — redirect to supervision */}
              <Route path="resumen" element={<Navigate to="/personal/supervision" replace />} />
              <Route path="estado" element={<Navigate to="/personal/supervision" replace />} />
              <Route path="ingresos" element={<Navigate to="/personal/supervision" replace />} />
              <Route path="gastos" element={<Navigate to="/personal/supervision" replace />} />
              <Route path="nomina" element={<Navigate to="/personal/supervision" replace />} />
              <Route path="autonomo" element={<Navigate to="/personal/supervision" replace />} />
              <Route path="pension" element={<Navigate to="/personal/supervision" replace />} />
              <Route path="pensiones-inversiones" element={<Navigate to="/personal/supervision" replace />} />
              <Route path="otros-ingresos" element={<Navigate to="/personal/supervision" replace />} />
            </Route>
            
            {/* Gestión Personal */}
            <Route path="gestion">
              <Route path="personal" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <GestionPersonalPage />
                </React.Suspense>
              } />
              <Route path="personal/nueva-nomina" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <NominaWizardPage />
                </React.Suspense>
              } />
              <Route path="personal/nuevo-autonomo" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AutonomoWizardPage />
                </React.Suspense>
              } />
              <Route path="personal/otros-ingresos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <OtrosIngresosWizardPage />
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
                  <ContratosNuevoPage />
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
              <Route path="plantillas" element={<Navigate to="/cuenta/configuracion" replace />} />
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

            {/* Shared Configuration Routes */}
            <Route path="configuracion">
              <Route index element={<Navigate to="/configuracion/usuarios-roles" replace />} />
              {/* ATLAS: Redirect old tesoreria cuentas to new location */}
              <Route path="bancos-cuentas" element={<Navigate to="/cuenta/cuentas" replace />} />
              <Route path="cuentas" element={<Navigate to="/cuenta/cuentas" replace />} />
              {/* Horizon configuration - available only for Horizon */}
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
              <Route path="perfil" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AccountPage />
                </React.Suspense>
              } />
              <Route path="seguridad" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AccountPage />
                </React.Suspense>
              } />
              <Route path="plan" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AccountPage />
                </React.Suspense>
              } />
              <Route path="privacidad" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AccountPage />
                </React.Suspense>
              } />
              <Route path="configuracion" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AccountPage />
                </React.Suspense>
              } />
              {/* ATLAS: New Cuentas section under Cuenta ▸ Configuración ▸ Cuentas Bancarias */}
              <Route path="cuentas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <Cuentas />
                </React.Suspense>
              } />
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
              </>
            )}
            
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Route>
        </Routes>
      </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
