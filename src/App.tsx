import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
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

// T20 Fase 3a · Inmuebles v5 module (sustituye horizon/inmuebles/* + pulse/contratos/*)
const InmueblesPage = lazyWithPreload(() => import('./modules/inmuebles/InmueblesPage'));
const InmueblesListado = lazyWithPreload(() => import('./modules/inmuebles/pages/ListadoPage'));
const InmueblesDetalle = lazyWithPreload(() => import('./modules/inmuebles/pages/DetallePage'));
const InmueblesContratosLista = lazyWithPreload(() => import('./modules/inmuebles/pages/ContratosListPage'));
const InmueblesNuevoContrato = lazyWithPreload(() => import('./modules/inmuebles/wizards/NuevoContratoWizard'));
// T20 Fase 3a · 3 importadores re-ubicados per decisión D3 de Jose.
const ImportarInmueblesPage = lazyWithPreload(() => import('./modules/inmuebles/import/ImportarInmuebles'));
const ImportarValoracionesPage = lazyWithPreload(() => import('./modules/inmuebles/import/ImportarValoraciones'));
const ImportarContratosPage = lazyWithPreload(() => import('./modules/inmuebles/import/ImportarContratos'));
// Inmuebles supervision · ruta separada · usado por Panel y otros.
const Supervision = lazyWithPreload(() => import('./modules/horizon/inmuebles/supervision/Supervision'));

// Inversiones Module · T20 Fase 3d · v5 (Outlet + sub-pages)
const InversionesPage = lazyWithPreload(() => import('./modules/inversiones/InversionesPage'));
const InversionesResumen = lazyWithPreload(() => import('./modules/inversiones/pages/ResumenPage'));
const InversionesCartera = lazyWithPreload(() => import('./modules/inversiones/pages/CarteraPage'));
const InversionesRendimientos = lazyWithPreload(() => import('./modules/inversiones/pages/RendimientosPage'));
const InversionesIndividual = lazyWithPreload(() => import('./modules/inversiones/pages/IndividualPage'));
const AnalisisCartera = lazyWithPreload(() => import('./modules/horizon/analisis-cartera/AnalisisCartera'));

// T20 Fase 3e · Financiación v5 module · Outlet + 4 sub-pages.
//   Mockup · docs/audit-inputs/atlas-financiacion-v2.html
//   Dashboard · Listado · Snowball · Calendario · Detalle (sub-route).
const FinanciacionPage = lazyWithPreload(() => import('./modules/financiacion/FinanciacionPage'));
const FinanciacionDashboard = lazyWithPreload(() => import('./modules/financiacion/pages/DashboardPage'));
const FinanciacionListado = lazyWithPreload(() => import('./modules/financiacion/pages/ListadoPage'));
const FinanciacionSnowball = lazyWithPreload(() => import('./modules/financiacion/pages/SnowballPage'));
const FinanciacionCalendario = lazyWithPreload(() => import('./modules/financiacion/pages/CalendarioPage'));
const FinanciacionDetalle = lazyWithPreload(() => import('./modules/financiacion/pages/DetallePage'));
const FinanciacionWizardCreate = lazyWithPreload(() => import('./modules/financiacion/pages/WizardCreatePage'));
const FinanciacionWizardEdit = lazyWithPreload(() => import('./modules/financiacion/pages/WizardEditPage'));
// T20 Fase 2 · Tesorería v5 module (sustituye Tesoreria.tsx + TesoreriaSupervisionPage.tsx)
const TesoreriaPage = lazyWithPreload(() => import('./modules/tesoreria/TesoreriaPage'));
const TesoreriaVistaGeneral = lazyWithPreload(() => import('./modules/tesoreria/tabs/VistaGeneralTab'));
const TesoreriaMovimientos = lazyWithPreload(() => import('./modules/tesoreria/tabs/MovimientosTab'));
// T17 BankStatementUploadPage · /tesoreria/importar · INTACTO.
const BankStatementUploadPage = lazyWithPreload(() => import('./modules/horizon/tesoreria/import/BankStatementUploadPage'));
// T20 Fase 2 · ImportarCuentas re-ubicado per decisión D3 de Jose.
const ImportarCuentasPage = lazyWithPreload(() => import('./modules/tesoreria/import/ImportarCuentas'));

// T20 Fase 2 · redirect compat para `/tesoreria/cuenta/:id` legacy hacia
// `/tesoreria/movimientos?cuenta=:id` (la ruta nueva sigue el patrón de
// query params para que el filtro re-sincronice al cambiar URL).
const RedirectCuentaToMovimientos: React.FC = () => {
  const { id } = useParams();
  return <Navigate to={`/tesoreria/movimientos?cuenta=${id ?? ''}`} replace />;
};
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
// T20 Fase 3a · PropertyDetail legacy eliminado · sustituido por src/modules/inmuebles/pages/DetallePage.

// T20 Fase 3b · Personal v5 module (sustituye horizon/personal/* + supervision)
const PersonalPage = lazyWithPreload(() => import('./modules/personal/PersonalPage'));
const PersonalPanel = lazyWithPreload(() => import('./modules/personal/pages/PanelPage'));
const PersonalIngresos = lazyWithPreload(() => import('./modules/personal/pages/IngresosPage'));
const PersonalGastos = lazyWithPreload(() => import('./modules/personal/pages/GastosPage'));
const PersonalVivienda = lazyWithPreload(() => import('./modules/personal/pages/ViviendaPage'));
const PersonalPresupuesto = lazyWithPreload(() => import('./modules/personal/pages/PresupuestoPage'));
// T20 Fase 3b · ImportarNominas re-ubicado per decisión D3 de Jose.
const ImportarNominasPage = lazyWithPreload(() => import('./modules/personal/import/ImportarNominas'));

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
// T20 Fase 3a · ContratosLista + ContratosNuevoPage legacy eliminados ·
// sustituidos por src/modules/inmuebles/pages/ContratosListPage + wizards/NuevoContratoWizard.
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
// T20 Fase 3c · Mi Plan v5 module (sustituye horizon/mi-plan/{objetivos,libertad})
const MiPlanPage = lazyWithPreload(() => import('./modules/mi-plan/MiPlanPage'));
const MiPlanLanding = lazyWithPreload(() => import('./modules/mi-plan/pages/LandingPage'));
const MiPlanProyeccion = lazyWithPreload(() => import('./modules/mi-plan/pages/ProyeccionPage'));
const MiPlanLibertad = lazyWithPreload(() => import('./modules/mi-plan/pages/LibertadPage'));
const MiPlanObjetivos = lazyWithPreload(() => import('./modules/mi-plan/pages/ObjetivosPage'));
const MiPlanFondos = lazyWithPreload(() => import('./modules/mi-plan/pages/FondosPage'));
const MiPlanRetos = lazyWithPreload(() => import('./modules/mi-plan/pages/RetosPage'));
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
            
            {/* T20 Fase 3a · Inmuebles v5 (sustituye horizon/inmuebles/cartera + contratos legacy)
                Mockups · atlas-inmuebles-v3 (listado) · atlas-inmueble-fa32-v2 (ficha 6 tabs). */}
            <Route path="inmuebles" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InmueblesPage />
              </React.Suspense>
            }>
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InmueblesListado />
                </React.Suspense>
              } />
              <Route path=":id" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InmueblesDetalle />
                </React.Suspense>
              } />
            </Route>

            {/* Inmuebles · sub-rutas fuera del Outlet · forms y supervision legacy */}
            <Route path="inmuebles/nuevo" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <PropertyForm mode="create" />
              </React.Suspense>
            } />
            <Route path="inmuebles/:id/editar" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <PropertyForm mode="edit" />
              </React.Suspense>
            } />
            <Route path="inmuebles/supervision" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <Supervision />
              </React.Suspense>
            } />
            <Route path="inmuebles/analisis" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <AnalisisCartera scope="inmuebles" />
              </React.Suspense>
            } />
            <Route path="inmuebles/importar" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <ImportarInmueblesPage
                  onComplete={() => undefined}
                  onBack={() => window.history.back()}
                />
              </React.Suspense>
            } />
            <Route path="inmuebles/importar-valoraciones" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <ImportarValoracionesPage
                  onComplete={() => undefined}
                  onBack={() => window.history.back()}
                />
              </React.Suspense>
            } />
            <Route path="inmuebles/importar-contratos" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <ImportarContratosPage
                  onComplete={() => undefined}
                  onBack={() => window.history.back()}
                />
              </React.Suspense>
            } />

            {/* Inmuebles · redirects compat para rutas legacy */}
            <Route path="inmuebles-legacy">
              <Route path="cartera" element={<Navigate to="/inmuebles" replace />} />
              <Route path="cartera/:id" element={<Navigate to="/inmuebles" replace />} />
              <Route path="contratos" element={<Navigate to="/contratos" replace />} />
              <Route path="evolucion" element={<Navigate to="/inmuebles/analisis" replace />} />
              <Route path="ingresos" element={<Navigate to="/inmuebles" replace />} />
              <Route path="gastos" element={<Navigate to="/inmuebles" replace />} />
            </Route>

            {/* Wildcard inmuebles · cualquier ruta legacy redirige a listado */}
            <Route path="inmuebles/cartera" element={<Navigate to="/inmuebles" replace />} />
            <Route path="inmuebles/cartera/:id" element={<Navigate to="/inmuebles" replace />} />
            <Route path="inmuebles/contratos" element={<Navigate to="/contratos" replace />} />
            <Route path="inmuebles/evolucion" element={<Navigate to="/inmuebles/analisis" replace />} />
            <Route path="inmuebles/ingresos" element={<Navigate to="/inmuebles" replace />} />
            <Route path="inmuebles/gastos" element={<Navigate to="/inmuebles" replace />} />
            <Route path="inmuebles/analisis-cartera" element={<Navigate to="/inmuebles/analisis" replace />} />
            <Route path="inmuebles/resumen" element={<Navigate to="/inmuebles/supervision" replace />} />
            <Route path="inmuebles/individual" element={<Navigate to="/inmuebles/supervision" replace />} />


            {/* T20 Fase 3d · Inversiones v5 (Outlet + 4 sub-páginas)
                · /inversiones (resumen) · /inversiones/cartera
                · /inversiones/rendimientos · /inversiones/individual
                · /inversiones/analisis (legacy AnalisisCartera intacto) */}
            <Route path="inversiones" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InversionesPage />
              </React.Suspense>
            }>
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InversionesResumen />
                </React.Suspense>
              } />
              <Route path="cartera" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InversionesCartera />
                </React.Suspense>
              } />
              <Route path="rendimientos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InversionesRendimientos />
                </React.Suspense>
              } />
              <Route path="individual" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InversionesIndividual />
                </React.Suspense>
              } />
            </Route>
            <Route path="inversiones/analisis" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <AnalisisCartera scope="inversiones" />
              </React.Suspense>
            } />
            
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
              <Route path="cuenta/:id" element={<RedirectCuentaToMovimientos />} />
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
            
            {/* T20 Fase 3e · Financiación v5 (sustituye horizon/financiacion/Financiacion.tsx)
                Mockup · atlas-financiacion-v2.html · 4 tabs (Dashboard · Listado · Snowball ·
                Calendario) + Detalle (`/financiacion/:id`) + wizard alta (`/financiacion/nuevo`)
                + alta vía FEIN (`/financiacion/nuevo-fein`) + edición (`/financiacion/:id/editar`).
                El wizard reutiliza `PrestamosWizard` legacy hasta Phase 4 cleanup. */}
            <Route path="financiacion" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <FinanciacionPage />
              </React.Suspense>
            }>
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FinanciacionDashboard />
                </React.Suspense>
              } />
              <Route path="listado" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FinanciacionListado />
                </React.Suspense>
              } />
              <Route path="snowball" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FinanciacionSnowball />
                </React.Suspense>
              } />
              <Route path="calendario" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FinanciacionCalendario />
                </React.Suspense>
              } />
              <Route path="nuevo" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FinanciacionWizardCreate />
                </React.Suspense>
              } />
              <Route path="nuevo-fein" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FinanciacionWizardCreate withFEIN />
                </React.Suspense>
              } />
              <Route path=":id/editar" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FinanciacionWizardEdit />
                </React.Suspense>
              } />
              <Route path=":id" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FinanciacionDetalle />
                </React.Suspense>
              } />
            </Route>
            
            {/* T20 Fase 3c · Mi Plan v5 (sustituye horizon/mi-plan legacy)
                Mockups · atlas-mi-plan-{landing,proyeccion,libertad,objetivos,fondos,retos}-v3
                + atlas-mi-plan-v2. 6 sub-páginas · cierra TODO-T20-01 conectando
                cashflow Tesorería al helper computeBudgetProjection12mAsync. */}
            <Route path="mi-plan" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <MiPlanPage />
              </React.Suspense>
            }>
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <MiPlanLanding />
                </React.Suspense>
              } />
              <Route path="proyeccion" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <MiPlanProyeccion />
                </React.Suspense>
              } />
              <Route path="libertad" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <MiPlanLibertad />
                </React.Suspense>
              } />
              <Route path="objetivos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <MiPlanObjetivos />
                </React.Suspense>
              } />
              <Route path="fondos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <MiPlanFondos />
                </React.Suspense>
              } />
              <Route path="retos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <MiPlanRetos />
                </React.Suspense>
              } />
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
            {/* T20 Fase 3b · Personal v5 (sustituye horizon/personal legacy)
                Mockup atlas-personal-v3.html · 5 tabs (Panel · Ingresos · Gastos ·
                Mi vivienda · Presupuesto). El hub Gestión Personal sigue intacto
                en /gestion/personal. */}
            <Route path="personal" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <PersonalPage />
              </React.Suspense>
            }>
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PersonalPanel />
                </React.Suspense>
              } />
              <Route path="ingresos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PersonalIngresos />
                </React.Suspense>
              } />
              <Route path="gastos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PersonalGastos />
                </React.Suspense>
              } />
              <Route path="vivienda" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PersonalVivienda />
                </React.Suspense>
              } />
              <Route path="presupuesto" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PersonalPresupuesto />
                </React.Suspense>
              } />
              {/* Compat · /personal/supervision legacy redirige a panel */}
              <Route path="supervision" element={<Navigate to="/personal" replace />} />
            </Route>
            <Route path="personal/importar-nominas" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <ImportarNominasPage
                  onComplete={() => undefined}
                  onBack={() => window.history.back()}
                />
              </React.Suspense>
            } />
            
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

            {/* T20 Fase 3a · Contratos v5 (sustituye pulse/contratos legacy)
                Mockups · atlas-contratos-v4 (listado 4 tabs) · atlas-wizard-nuevo-contrato (wizard 5 pasos) */}
            <Route path="contratos" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InmueblesPage />
              </React.Suspense>
            }>
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InmueblesContratosLista />
                </React.Suspense>
              } />
              <Route path="lista" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InmueblesContratosLista />
                </React.Suspense>
              } />
              <Route path="nuevo" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InmueblesNuevoContrato />
                </React.Suspense>
              } />
              <Route path="gestion" element={<Navigate to="/contratos" replace />} />
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
