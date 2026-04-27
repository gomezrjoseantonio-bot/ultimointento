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
import { limpiarEjerciciosCoordBasura } from './services/ejercicioResolverService';
import { ejecutarMigracion as ejecutarMigracionGastos } from './services/migracionGastosService';
import { runMigrationIfNeeded as fixReparacionesDuplicadas } from './services/migrations/fixReparacionesDuplicadas';
import { runMigrationIfNeeded as limpiarGastosReparacion0106 } from './services/migrations/limpiarGastosReparacionCasilla0106';
import { runMigrationIfNeeded as backfillImporteBruto0106 } from './services/migrations/backfillImporteBruto0106';
import { runMigrationIfNeeded as cleanStaleCPAndInferITP } from './services/migrations/cleanStaleCPAndInferITP';
import { migrateOrphanedInmuebleIds } from './services/migrations/migrateOrphanedInmuebleIds';
import { migrateFinanciacionV2 } from './services/migrations/migrateFinanciacionV2';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';

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

// Financing Module - New standalone financing module
const Financiacion = lazyWithPreload(() => import('./modules/horizon/financiacion/Financiacion'));
// T20 Fase 2 · Tesorería v5 module (sustituye Tesoreria.tsx + TesoreriaSupervisionPage.tsx)
const TesoreriaPage = lazyWithPreload(() => import('./modules/tesoreria/TesoreriaPage'));
const TesoreriaVistaGeneral = lazyWithPreload(() => import('./modules/tesoreria/tabs/VistaGeneralTab'));
const TesoreriaMovimientos = lazyWithPreload(() => import('./modules/tesoreria/tabs/MovimientosTab'));
// T17 BankStatementUploadPage · /tesoreria/importar · INTACTO.
const BankStatementUploadPage = lazyWithPreload(() => import('./modules/horizon/tesoreria/import/BankStatementUploadPage'));
// T20 Fase 2 · ImportarCuentas re-ubicado per decisión D3 de Jose.
const ImportarCuentasPage = lazyWithPreload(() => import('./modules/tesoreria/import/ImportarCuentas'));
const ConciliacionPage = lazyWithPreload(() => import('./modules/horizon/conciliacion/ConciliacionPage'));
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
const PropertyForm = lazyWithPreload(() => import('./modules/horizon/inmuebles/cartera/PropertyForm'));
const PropertyDetail = lazyWithPreload(() => import('./modules/horizon/inmuebles/cartera/PropertyDetail'));

// Personal section (within Horizon)
const PersonalSupervision = lazyWithPreload(() => import('./modules/horizon/personal/supervision/PersonalSupervisionPage'));

// Gestión Personal hub
const GestionPersonalPage = lazyWithPreload(() => import('./pages/GestionPersonal/GestionPersonalPage'));
const GestionInversionesPage = lazyWithPreload(() => import('./pages/GestionInversiones/GestionInversionesPage'));

// Gestión Inmuebles hub
const GestionInmueblesList = lazyWithPreload(() => import('./pages/GestionInmuebles/GestionInmueblesList'));
const GestionInmuebleDetail = lazyWithPreload(() => import('./pages/GestionInmuebles/GestionInmuebleDetail'));
const VentaWizard = lazyWithPreload(() => import('./pages/GestionInmuebles/VentaWizard'));
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
// Development only imports
const ProfileSeederPage = lazyWithPreload(() =>
  (import.meta as any).env?.DEV 
    ? import('./pages/ProfileSeederPage')
    : Promise.resolve({ default: () => null })
);

// Image Description page - New feature
const ImageDescriptionPage = lazyWithPreload(() => import('./pages/ImageDescriptionPage'));

// Dev-only · Design System v5 showcase. T20 · Fase 0.
const ComponentsShowcase = lazyWithPreload(() =>
  (import.meta as any).env?.DEV
    ? import('./pages/dev/ComponentsShowcase')
    : Promise.resolve({ default: () => null })
);


// Design Bible page - ATLAS Design System reference
const DesignBiblePage = lazyWithPreload(() => import('./pages/DesignBiblePage'));

// Glossary page - Sprint 3: Accessible technical terms reference
const GlossaryPage = lazyWithPreload(() => import('./pages/GlossaryPage'));
const HerramientasPage = lazyWithPreload(() => import('./pages/HerramientasPage'));
const MiPlanObjetivos = lazyWithPreload(() => import('./modules/horizon/mi-plan/objetivos/ObjetivosPage'));
const MiPlanLibertad = lazyWithPreload(() => import('./modules/horizon/mi-plan/libertad/LibertadFinancieraPage'));
// T20 Fase 1 · Ajustes v5 module
const AjustesPage = lazyWithPreload(() => import('./modules/ajustes/AjustesPage'));
const AjustesPerfil = lazyWithPreload(() => import('./modules/ajustes/pages/PerfilPage'));
const AjustesPlan = lazyWithPreload(() => import('./modules/ajustes/pages/PlanPage'));
const AjustesIntegraciones = lazyWithPreload(() => import('./modules/ajustes/pages/IntegracionesPage'));
const AjustesNotificaciones = lazyWithPreload(() => import('./modules/ajustes/pages/NotificacionesPage'));
const AjustesPlantillas = lazyWithPreload(() => import('./modules/ajustes/pages/PlantillasPage'));
const AjustesPerfilFiscal = lazyWithPreload(() => import('./modules/ajustes/pages/PerfilFiscalPage'));
const AjustesSeguridad = lazyWithPreload(() => import('./modules/ajustes/pages/SeguridadPage'));

// CopilotWidget es un botón flotante rara vez usado. Cargarlo eager arrastra
// dashboardService → proyeccionMensualService y toda la cadena de servicios
// (≈ +15 servicios) al bundle principal, inflando Script Evaluation/TBT.
// Lo diferimos a idle para que no bloquee FCP/TTI.
const CopilotWidget = React.lazy(() => import('./components/common/CopilotWidget'));

function App() {
  const [showCopilot, setShowCopilot] = React.useState(false);
  // Initialize bank profiles and performance monitoring on app start
  useEffect(() => {
    void initDB()
      .then(() => ejecutarMigracionGastos())
      .then(() => fixReparacionesDuplicadas())
      .then(() => limpiarGastosReparacion0106())
      .then(() => backfillImporteBruto0106())
      .then(() => cleanStaleCPAndInferITP())
      .then(() => migrateOrphanedInmuebleIds())
      .then((migrationReport) => {
        if (migrationReport && !migrationReport.skipped && Object.keys(migrationReport.storeUpdates).length > 0) {
          console.log('[ATLAS] Migración IDs huérfanos completada:', migrationReport);
        }
      })
      .then(() => migrateFinanciacionV2())
      // Limpieza de ejercicios fiscales basura — eager para evitar que la UI
      // muestre años futuros residuales durante los primeros 2.5s.
      .then(() => limpiarEjerciciosCoordBasura())
      .catch((error) => {
        console.error('[ATLAS] Error inicializando IndexedDB o ejecutando migraciones iniciales:', error);
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
      // CopilotWidget: garantizamos un mínimo real de 3 s tras el primer paint
      // antes de montarlo (runWhenIdle capea el fallback a ~800 ms, no sirve).
      // Una vez pasado el umbral, si el navegador soporta requestIdleCallback,
      // esperamos al siguiente hueco idle para no competir con el hilo.
      (() => {
        let idleHandle: number | null = null;
        const timeoutHandle = window.setTimeout(() => {
          const idle = (window as Window & {
            requestIdleCallback?: (cb: IdleRequestCallback) => number;
          }).requestIdleCallback;
          if (idle) {
            idleHandle = idle(() => setShowCopilot(true));
          } else {
            setShowCopilot(true);
          }
        }, 3000);
        return () => {
          window.clearTimeout(timeoutHandle);
          const cancelIdle = (window as Window & {
            cancelIdleCallback?: (handle: number) => void;
          }).cancelIdleCallback;
          if (idleHandle !== null) cancelIdle?.(idleHandle);
        };
      })(),
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
          {showCopilot && (
            <React.Suspense fallback={null}>
              <CopilotWidget />
            </React.Suspense>
          )}
          <Routes>
            {/* Auth por email desactivada temporalmente */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Navigate to="/" replace />} />

            {/* T20 Fase 0 · Design System v5 showcase · DEV only · sin layout ni auth */}
            {(import.meta as any).env?.DEV && (
              <Route
                path="/dev/components"
                element={
                  <React.Suspense fallback={<LoadingSpinner />}>
                    <ComponentsShowcase />
                  </React.Suspense>
                }
              />
            )}

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
            
            {/* Inversiones Module - unified with 4 tabs */}
            <Route path="inversiones">
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InversionesPage />
                </React.Suspense>
              } />
              <Route path="analisis" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AnalisisCartera scope="inversiones" />
                </React.Suspense>
              } />
            </Route>
            
            {/* T20 Fase 2 · Tesorería v5 (sustituye Tesoreria.tsx legacy)
                Mockup atlas-tesoreria-v8.html · 2 tabs (Vista general + Conciliación bancaria)
                + ruta /tesoreria/importar (T17 BankStatementUploadPage intacta)
                + ruta /tesoreria/importar-cuentas (re-ubicado de account/migracion). */}
            <Route path="tesoreria" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <TesoreriaPage />
              </React.Suspense>
            }>
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TesoreriaVistaGeneral />
                </React.Suspense>
              } />
              <Route path="movimientos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TesoreriaMovimientos />
                </React.Suspense>
              } />
              <Route path="cuenta/:id" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <TesoreriaMovimientos />
                </React.Suspense>
              } />
            </Route>
            <Route path="tesoreria/importar" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <BankStatementUploadPage />
              </React.Suspense>
            } />
            <Route path="tesoreria/importar-cuentas" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <ImportarCuentasPage
                  onComplete={() => undefined}
                  onBack={() => window.history.back()}
                />
              </React.Suspense>
            } />

            {/* §3.5 spec · opción (b) · ConciliacionPageV2 mantenida intacta.
                Tesorería v5 tab "Movimientos" hace punteo simple por checkbox;
                ConciliacionPageV2 tiene timeline + drag&drop documentos
                · son flujos distintos · sub-tarea futura decide consolidar. */}
            <Route path="conciliacion">
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ConciliacionPage />
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
              <Route path="declaracion/:anio" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <DeclaracionCompletaPage />
                </React.Suspense>
              } />
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
            </Route>
            
            {/* Gestión Personal + Gestión Inversiones + Gestión Inmuebles */}
            <Route path="gestion">
              <Route path="inmuebles" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <GestionInmueblesList />
                </React.Suspense>
              } />
              <Route path="inmuebles/nuevo" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PropertyForm mode="create" />
                </React.Suspense>
              } />
              <Route path="inmuebles/:id" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <GestionInmuebleDetail />
                </React.Suspense>
              } />
              <Route path="inmuebles/:id/editar" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PropertyForm mode="edit" />
                </React.Suspense>
              } />
              <Route path="inmuebles/:id/vender" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <VentaWizard />
                </React.Suspense>
              } />
              <Route path="inversiones" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <GestionInversionesPage />
                </React.Suspense>
              } />
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
              {/* Redirect old tesoreria cuentas routes to Tesorería */}
              <Route path="bancos-cuentas" element={<Navigate to="/tesoreria" replace />} />
              <Route path="cuentas" element={<Navigate to="/tesoreria" replace />} />
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
              {/* T20 Fase 1 · plan-facturacion legacy redirect a /ajustes/plan */}
              <Route path="plan-facturacion" element={<Navigate to="/ajustes/plan" replace />} />
            </Route>

            {/* T20 Fase 1 · Ajustes v5 (sustituye AccountPage v4)
                Mockup atlas-ajustes-v2.html · 7 sub-páginas con sidebar interno. */}
            <Route path="ajustes" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <AjustesPage />
              </React.Suspense>
            }>
              <Route index element={<Navigate to="/ajustes/perfil" replace />} />
              <Route path="perfil" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesPerfil />
                </React.Suspense>
              } />
              <Route path="plan" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesPlan />
                </React.Suspense>
              } />
              <Route path="integraciones" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesIntegraciones />
                </React.Suspense>
              } />
              <Route path="notificaciones" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesNotificaciones />
                </React.Suspense>
              } />
              <Route path="plantillas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesPlantillas />
                </React.Suspense>
              } />
              <Route path="fiscal" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesPerfilFiscal />
                </React.Suspense>
              } />
              <Route path="seguridad" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesSeguridad />
                </React.Suspense>
              } />
            </Route>

            {/* T20 Fase 1 · redirects legacy /cuenta/* a /ajustes/* equivalentes
                Mantenemos compatibilidad con bookmarks/links antiguos hasta que
                Fase 4 (cleanup) decida si purgarlos. Tabs viejas:
                  perfil  → perfil
                  plan    → plan
                  configuracion (PandaDoc) → plantillas (renovado)
                  datos   → seguridad (sub-card "Tus datos · exportar")
                  migracion → seguridad (sub-card "Exportar"); el importador de
                             extractos bancarios T17 se mantiene en /tesoreria/importar
                  privacidad / cuentas → /ajustes/seguridad */}
            <Route path="cuenta">
              <Route index element={<Navigate to="/ajustes/perfil" replace />} />
              <Route path="perfil" element={<Navigate to="/ajustes/perfil" replace />} />
              <Route path="plan" element={<Navigate to="/ajustes/plan" replace />} />
              <Route path="configuracion" element={<Navigate to="/ajustes/plantillas" replace />} />
              <Route path="seguridad" element={<Navigate to="/ajustes/seguridad" replace />} />
              <Route path="datos" element={<Navigate to="/ajustes/seguridad" replace />} />
              <Route path="migracion" element={<Navigate to="/ajustes/seguridad" replace />} />
              <Route path="privacidad" element={<Navigate to="/ajustes/seguridad" replace />} />
              <Route path="cuentas" element={<Navigate to="/tesoreria" replace />} />
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
