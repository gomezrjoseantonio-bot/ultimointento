import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { resolveAlquileresRedirect } from './components/routing/resolveAlquileresRedirect';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { bankProfilesService } from './services/bankProfilesService';
import { performanceMonitor } from './services/performanceMonitoringService';
import { initializeAccountMigration } from './services/accountMigrationService';
import { initDB } from './services/db';
import { ejecutarMigracionFiscal } from './services/ejercicioFiscalMigration';
import { limpiarEjerciciosCoordBasura } from './services/ejercicioResolverService';
import { runMigrationIfNeeded as fixReparacionesDuplicadas } from './services/migrations/fixReparacionesDuplicadas';
import { runMigrationIfNeeded as limpiarGastosReparacion0106 } from './services/migrations/limpiarGastosReparacionCasilla0106';
import { runMigrationIfNeeded as backfillImporteBruto0106 } from './services/migrations/backfillImporteBruto0106';
import { runMigrationIfNeeded as cleanStaleCPAndInferITP } from './services/migrations/cleanStaleCPAndInferITP';
import { runMigrationIfNeeded as fixFechasImposiblesGastos } from './services/migrations/fixFechasImposiblesGastos';
import { runMigrationIfNeeded as migrarConceptoUnificado } from './services/migrations/migrarConceptoUnificado';
import { cargarConceptosUsuario } from './services/conceptos/conceptosUsuarioService';
import { migrateOrphanedInmuebleIds } from './services/migrations/migrateOrphanedInmuebleIds';
import { runKeyvalCleanup } from './services/keyvalCleanupService';
import { migrateKeyvalPlanpagosToPrestamos } from './services/migrations/migrateKeyvalPlanpagosToPrestamos';
import { cleanupConfigFiscalKeyval } from './services/migrations/cleanupConfigFiscalKeyval';
import { migrateFinanciacionV2 } from './services/migrations/migrateFinanciacionV2';
import { runV68TipoFamiliaMigration } from './services/migrations/v68-tipoFamilia';
import { runV70NominaHistorialMigration } from './services/migrations/v70-nomina-historial';
import { runSeedV74PR4 } from './services/migrations/seedV74_PR4';
import { runSeedV74PR5 } from './services/migrations/seedV74_PR5';
import { runAuditV74PR6 } from './services/migrations/auditV74_PR6';
import { cleanupCategoriasT34T35Fix2 } from './services/migrations/cleanupCategoriasT34T35fix2';
import { fixAportacionesPlanCruceB6 } from './services/migrations/fixAportacionesPlanCruceB6';
import { fixDeclaracionCompletaCruceB6 } from './services/migrations/fixDeclaracionCompletaCruceB6';
import { fixCasillaAEATOficial } from './services/migrations/fixCasillaAEATOficial';
import { fixFechaContratacionRetroactiva } from './services/migrations/fixFechaContratacionRetroactiva';
import { backfillAportacionesNotas } from './services/migrations/backfillAportacionesNotas';
import { normalizarNombresEmpresas } from './services/migrations/normalizarNombresEmpresas';
import MainLayout from './layouts/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
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
// T20 Fase 3g · Archivo v5 (mockup atlas-archivo.html) · vista de
// documentos por inmueble · ejercicio · tipo. Coexiste con `/inbox`
// legacy hasta Phase 4 cleanup.
const ArchivoPage = lazyWithPreload(() => import('./modules/archivo/ArchivoPage'));
// T20 Fase 3g · Onboarding wizard (mockup atlas-onboarding.html) ·
// welcome + hub.
const OnboardingPage = lazyWithPreload(() => import('./modules/onboarding/OnboardingPage'));

// Onboarding día 0 · `/empezar` · alta guiada de la foto actual (hueco 5.1).
// Flujo a pantalla completa · coexiste con el `/onboarding` legacy (decisión Jose D2).
const EmpezarApp = lazyWithPreload(() => import('./modules/onboarding/empezar/EmpezarApp'));
const FirstRunRedirect = lazyWithPreload(() => import('./modules/onboarding/empezar/FirstRunRedirect'));

// T20 Fase 3a · Inmuebles v5 module (sustituye horizon/inmuebles/* + pulse/contratos/*)
const InmueblesPage = lazyWithPreload(() => import('./modules/inmuebles/InmueblesPage'));
const InmueblesListado = lazyWithPreload(() => import('./modules/inmuebles/pages/ListadoPage'));
const InmueblesDetalle = lazyWithPreload(() => import('./modules/inmuebles/pages/DetallePage'));
const InmueblesContratosLista = lazyWithPreload(() => import('./modules/inmuebles/pages/ContratosListPage'));
const InmueblesNuevoContrato = lazyWithPreload(() => import('./modules/inmuebles/wizards/NuevoContrato'));
// T20 Fase 3a · 3 importadores re-ubicados per decisión D3 de Jose.
const ImportarInmueblesPage = lazyWithPreload(() => import('./modules/inmuebles/import/ImportarInmuebles'));
const ImportarValoracionesPage = lazyWithPreload(() => import('./modules/inmuebles/import/ImportarValoraciones'));
const ImportarContratosPage = lazyWithPreload(() => import('./modules/inmuebles/import/ImportarContratosWizard'));

// Inversiones Module · T23.1 · galería v2 (sustituye los 4 tabs T20 Fase 3d)
const InversionesGaleria = lazyWithPreload(() => import('./modules/inversiones/InversionesGaleria'));
const InversionesPosicionesCerradas = lazyWithPreload(() => import('./modules/inversiones/pages/PosicionesCerradasPage'));
const InversionesFichaPosicion = lazyWithPreload(() => import('./modules/inversiones/pages/FichaPosicionPage'));
const AnalisisCartera = lazyWithPreload(() => import('./modules/horizon/analisis-cartera/AnalisisCartera'));

// Financiación · UI nueva (TAREA-CC-UI-financiacion-v1 · Entregable A).
//   Mockup · atlas-financiacion-v10.html · UNA sola vista sin scroll que
//   sustituye a las 4 pestañas (Dashboard · Listado · Snowball · Calendario) y
//   a sus tablas de 12 y 18 columnas. El Detalle sigue en `/financiacion/:id`.
const FinanciacionPage = lazyWithPreload(() => import('./modules/financiacion/FinanciacionPage'));
const FinanciacionVista = lazyWithPreload(() => import('./modules/financiacion/vista/VistaFinanciacionPage'));
const FinanciacionDetalle = lazyWithPreload(() => import('./modules/financiacion/vista/DetallePrestamoPage'));
const FinanciacionWizardCreate = lazyWithPreload(() => import('./modules/financiacion/pages/WizardCreatePage'));
const FinanciacionWizardEdit = lazyWithPreload(() => import('./modules/financiacion/pages/WizardEditPage'));
// T20 Fase 2 · Tesorería v5 module (sustituye Tesoreria.tsx + TesoreriaSupervisionPage.tsx)
// Tesorería V6 · pantalla ÚNICA (§4). Absorbe la vista general, los
// movimientos, la vista de cuenta, la importación de extractos y la
// conciliación: todo eso vive ahora en drawers sobre esta misma pantalla.
const TesoreriaV6Page = lazyWithPreload(() => import('./modules/tesoreria/v6/TesoreriaV6Page'));
// T20 Fase 2 · ImportarCuentas re-ubicado per decisión D3 de Jose.
const ImportarCuentasPage = lazyWithPreload(() => import('./modules/tesoreria/import/ImportarCuentas'));

const RedirectFiscalDeclaracion: React.FC = () => {
  const { anio } = useParams();
  return <Navigate to={`/fiscal/ejercicio/${anio ?? ''}`} replace />;
};

// Consolidación Contratos → Alquileres · Fase B · alias `/alquileres/*` →
// `/contratos/*` (canónica), preservando sufijo y query. Lógica pura y testeada
// en `resolveAlquileresRedirect`.
const RedirectAlquileresAContratos: React.FC = () => {
  const { pathname, search } = useLocation();
  return <Navigate to={resolveAlquileresRedirect(pathname, search)} replace />;
};
// T20 Fase 3f-A · Fiscal v5 module · Outlet + sub-páginas.
//   Mockup · docs/audit-inputs/atlas-fiscal.html
//   Tabs: Calendario (Dashboard) · Ejercicios · Deudas · Configuración.
//   Sub-rutas · /fiscal/ejercicio/:anio (DetalleEjercicioPage).
//   Wizard de Corrección/paralela AEAT llega en 3f-B (próximo PR).
const FiscalPage = lazyWithPreload(() => import('./modules/fiscal/FiscalPage'));
// SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 2 · F1 dashboard reemplaza
// `pages/DashboardPage` (calendario placeholder) por la página v2 standalone.
const FiscalDashboard = lazyWithPreload(() => import('./modules/fiscal/v2/FiscalDashboardPage'));
const FiscalEjercicios = lazyWithPreload(() => import('./modules/fiscal/pages/EjerciciosPage'));
// SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3 · F2 ejercicio detalle reemplaza
// `pages/DetalleEjercicioPage` (dependiente del FiscalOutletContext)
// por la página v2 standalone.
const FiscalDetalleEjercicio = lazyWithPreload(() => import('./modules/fiscal/v2/FiscalEjercicioPage'));
// SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 4 · F3 inmueble fiscal del año
// página nueva · ruta /fiscal/ejercicio/:anio/inmueble/:id
const FiscalInmuebleDetalle = lazyWithPreload(() => import('./modules/fiscal/v2/FiscalInmueblePage'));
// SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 5 · F4 venta · vista de solo
// lectura del PropertySale ya confirmado · 5 calc-steps + 4 KPIs
const FiscalVentaDetalle = lazyWithPreload(() => import('./modules/fiscal/v2/FiscalVentaPage'));
// SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 · F6 Acciones fiscales · ÚNICO
// sitio operativo · 7 acordeones · ruta /fiscal/acciones
const FiscalAcciones = lazyWithPreload(() => import('./modules/fiscal/v2/FiscalAccionesPage'));
const FiscalDeudas = lazyWithPreload(() => import('./modules/fiscal/pages/DeudasPage'));
// SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 · FiscalConfiguracion eliminado ·
// reemplazado por FiscalAcciones (ver más abajo). /fiscal/configuracion
// queda como redirect retrocompatible.
const FiscalCalendarioCompleto = lazyWithPreload(() => import('./modules/fiscal/pages/CalendarioFiscalPage'));
const FiscalBorradorIRPF = lazyWithPreload(() => import('./modules/fiscal/pages/BorradorIRPFPage'));
const FiscalImportar = lazyWithPreload(() => import('./modules/fiscal/import/ImportarFiscalPage'));
// T20 Fase 3g.5 · Importadores legacy reubicados (wrappers v5).
const InversionesImportarAportaciones = lazyWithPreload(() => import('./modules/inversiones/import/ImportarAportacionesPage'));
const InversionesImportarIndexa = lazyWithPreload(() => import('./modules/inversiones/import/ImportarIndexaCapitalPage'));
const FinanciacionImportarPrestamos = lazyWithPreload(() => import('./modules/financiacion/import/ImportarPrestamosPage'));
const FiscalCorreccionWizard = lazyWithPreload(() => import('./modules/fiscal/pages/CorreccionWizard'));
const FiscalLayout = lazyWithPreload(() => import('./modules/horizon/fiscalidad/FiscalLayout'));
const ImpuestosSupervisionPage = lazyWithPreload(() => import('./modules/horizon/fiscalidad/supervision/ImpuestosSupervisionPage'));
const DeclaracionCompletaPage = lazyWithPreload(() => import('./modules/horizon/fiscalidad/declaracion/DeclaracionCompletaPage'));

// PANTALLA-PRESUPUESTO · ProyeccionComparativa y PresupuestosView retirados · el
// presupuesto vive ahora en una sola pantalla en /mi-plan/proyeccion. Se conserva
// `comparativaService.getActualData`, que la pantalla nueva sigue usando.
const ProyeccionEscenarios = lazyWithPreload(() => import('./modules/horizon/proyeccion/escenarios/ProyeccionEscenarios'));
const ProyeccionValoraciones = lazyWithPreload(() => import('./modules/horizon/proyeccion/valoraciones/Valoraciones'));
const ProyeccionMensual = lazyWithPreload(() => import('./modules/horizon/proyeccion/mensual/ProyeccionMensual'));
const InformesPage = lazyWithPreload(() => import('./modules/horizon/informes/InformesPage'));
const UsuariosRoles = lazyWithPreload(() => import('./modules/horizon/configuracion/usuarios-roles/UsuariosRoles'));
const EmailEntrante = lazyWithPreload(() => import('./modules/horizon/configuracion/email-entrante/EmailEntrante'));
// S-WIZARD-INMUEBLE-V4 · pantalla única estilo ATLAS v8 · reemplaza PropertyForm legacy.
const InmueblePage = lazyWithPreload(() => import('./pages/inmuebles/InmueblePage'));
// T20 Fase 3a · PropertyDetail legacy eliminado · sustituido por src/modules/inmuebles/pages/DetallePage.

// T20 Fase 3b · Personal v5 module (sustituye horizon/personal/* + supervision)
const PersonalPage = lazyWithPreload(() => import('./modules/personal/PersonalPage'));
const PersonalPanel = lazyWithPreload(() => import('./modules/personal/pages/PanelPage'));
const PersonalIngresos = lazyWithPreload(() => import('./modules/personal/pages/IngresosPage'));
const PersonalGastos = lazyWithPreload(() => import('./modules/personal/pages/GastosPage'));
const PersonalDetectarCompromisos = lazyWithPreload(
  () => import('./modules/personal/pages/DetectarCompromisosPage'),
);
const PersonalPresupuesto = lazyWithPreload(() => import('./modules/personal/pages/PresupuestoPage'));


// Gestión Inmuebles hub
const GestionInmueblesList = lazyWithPreload(() => import('./pages/GestionInmuebles/GestionInmueblesList'));
const GestionInmuebleDetail = lazyWithPreload(() => import('./pages/GestionInmuebles/GestionInmuebleDetail'));
const VentaWizard = lazyWithPreload(() => import('./pages/GestionInmuebles/VentaWizard'));
const NominaWizardPage = lazyWithPreload(() => import('./pages/GestionPersonal/wizards/NominaPage'));
const AutonomoWizardPage = lazyWithPreload(() => import('./pages/GestionPersonal/wizards/AutonomoWizard'));
const OtrosIngresosWizardPage = lazyWithPreload(() => import('./pages/GestionPersonal/wizards/OtrosIngresosWizard'));

// Pulse (Management) Module Components
// T20 Fase 3a · ContratosLista + ContratosNuevoPage legacy eliminados ·
// sustituidos por src/modules/inmuebles/pages/ContratosListPage + wizards/NuevoContratoWizard.
const FirmasPendientes = lazyWithPreload(() => import('./modules/pulse/firmas/pendientes/FirmasPendientes'));
const AutomatizacionesReglas = lazyWithPreload(() => import('./modules/pulse/automatizaciones/reglas/AutomatizacionesReglas'));
const TareasPendientes = lazyWithPreload(() => import('./modules/pulse/tareas/pendientes/TareasPendientes'));

// Legacy Pulse (Personal) Module Components - Keep for migration
// D-CRUD-ALTA sub-tarea 9 · Catálogo proveedores
const ConfigProveedores = lazyWithPreload(() => import('./modules/horizon/configuracion/proveedores/ProveedoresPage'));
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

// Dev-only · keyval audit page. T15 · sub-tarea 15.1.
// CRA no expone `import.meta.env.DEV`. Para que la página funcione en
// `npm start` (NODE_ENV=development) y opcionalmente en deploy preview de
// Netlify (NODE_ENV=production · activable con REACT_APP_ENABLE_DEV_PAGES=1)
// usamos los flags que sí soporta react-scripts.
const isDevPagesEnabled =
  process.env.NODE_ENV === 'development' ||
  process.env.REACT_APP_ENABLE_DEV_PAGES === '1';

const KeyvalAudit = lazyWithPreload(() =>
  isDevPagesEnabled
    ? import('./pages/dev/KeyvalAudit')
    : Promise.resolve({ default: () => null })
);

// T14 · sub-tarea 14.1 · fiscal context audit · DEV only
const FiscalContextAudit = lazyWithPreload(() =>
  isDevPagesEnabled
    ? import('./pages/dev/FiscalContextAudit')
    : Promise.resolve({ default: () => null })
);

// T9 · sub-tarea 9.1 · compromiso detection showcase · DEV only
const CompromisoDetection = lazyWithPreload(() =>
  isDevPagesEnabled
    ? import('./pages/dev/CompromisoDetection')
    : Promise.resolve({ default: () => null })
);

// P0 · recuento de previsiones duplicadas · DEV only
const PrevisionesDuplicadas = lazyWithPreload(() =>
  isDevPagesEnabled
    ? import('./pages/dev/PrevisionesDuplicadas')
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
const MiPlanHitosVitales = lazyWithPreload(() => import('./modules/mi-plan/pages/HitosVitalesPage'));
const MiPlanFondos = lazyWithPreload(() => import('./modules/mi-plan/pages/FondosPage'));
// T27.2-skip · lazy import de MiPlanRetos comentada · la ruta redirige a
// Objetivos. Para revivir · descomentar y restaurar el binding del Route.
// const MiPlanRetos = lazyWithPreload(() => import('./modules/mi-plan/pages/RetosPage'));
// T20 Fase 1 · Ajustes v5 module
const AjustesPage = lazyWithPreload(() => import('./modules/ajustes/AjustesPage'));
const AjustesPerfil = lazyWithPreload(() => import('./modules/ajustes/pages/PerfilPage'));
const AjustesPlan = lazyWithPreload(() => import('./modules/ajustes/pages/PlanPage'));
const AjustesIntegraciones = lazyWithPreload(() => import('./modules/ajustes/pages/IntegracionesPage'));
const AjustesNotificaciones = lazyWithPreload(() => import('./modules/ajustes/pages/NotificacionesPage'));
const AjustesPlantillas = lazyWithPreload(() => import('./modules/ajustes/pages/PlantillasPage'));
const AjustesPerfilFiscal = lazyWithPreload(() => import('./modules/ajustes/pages/PerfilFiscalPage'));
const AjustesConceptos = lazyWithPreload(() => import('./modules/ajustes/pages/ConceptosPage'));
const AjustesSeguridad = lazyWithPreload(() => import('./modules/ajustes/pages/SeguridadPage'));
const AjustesDatosMercado = lazyWithPreload(() => import('./modules/ajustes/pages/DatosMercadoPage'));
const AjustesAvisos = lazyWithPreload(() => import('./modules/ajustes/pages/AvisosPage'));
const AjustesDatos = lazyWithPreload(() => import('./modules/ajustes/pages/DatosPage'));

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
      .then(() => fixReparacionesDuplicadas())
      .then(() => limpiarGastosReparacion0106())
      .then(() => backfillImporteBruto0106())
      .then(() => cleanStaleCPAndInferITP())
      // Va ANTES de cualquier cosa que lea fechas de `gastosInmueble`: una fecha
      // imposible no falla al parsearse, rueda al mes siguiente, así que quien
      // la lea antes de arreglarla imputa el gasto a otro mes.
      .then(() => fixFechasImposiblesGastos())
      // Los conceptos propios del usuario se aplican al catálogo en memoria
      // ANTES de que nadie lo consulte · si no, un gasto que use uno suyo se
      // leería como «sin clasificar» durante el primer render.
      .then(() => cargarConceptosUsuario())
      // Va DESPUÉS de las limpiezas de `gastosInmueble` y ANTES de que nadie
      // lea la clasificación: escribe `concepto` en cada gasto y realinea
      // `categoria`, `bolsaPresupuesto` y `tipo` con el ámbito del registro.
      .then(() => migrarConceptoUnificado())
      .then(() => migrateOrphanedInmuebleIds())
      .then((migrationReport) => {
        if (migrationReport && !migrationReport.skipped && Object.keys(migrationReport.storeUpdates).length > 0) {
          console.log('[ATLAS] Migración IDs huérfanos completada:', migrationReport);
        }
      })
      .then(() => migrateFinanciacionV2())
      // T15 sub-tarea 15.2 · limpieza one-shot de claves muertas en keyval
      // (cache + flags consumidas + residuales kpiConfig_*).
      .then(() => runKeyvalCleanup())
      .then((cleanupReport) => {
        if (!cleanupReport.skipped && cleanupReport.deletedCount > 0) {
          console.log('[ATLAS] Limpieza T15 keyval:', cleanupReport);
        }
        if (cleanupReport.errors.length > 0) {
          console.warn('[ATLAS] Limpieza T15 keyval · errores parciales:', cleanupReport.errors);
        }
      })
      // T15 sub-tarea 15.3 · migra planpagos_* de keyval a prestamos.planPagos.
      .then(() => migrateKeyvalPlanpagosToPrestamos())
      .then((planpagosReport) => {
        if (!planpagosReport.skipped &&
            (planpagosReport.movedCount > 0 ||
             planpagosReport.conflictCount > 0 ||
             planpagosReport.orphanCount > 0)) {
          console.log('[ATLAS] Migración planpagos_* T15.3:', planpagosReport);
        }
        if (planpagosReport.errors.length > 0) {
          console.warn('[ATLAS] Migración planpagos_* · errores parciales:', planpagosReport.errors);
        }
      })
      // T14 sub-tarea 14.5 · borra keyval['configFiscal'] huérfana · idempotente.
      .then(() => cleanupConfigFiscalKeyval())
      .then((configFiscalReport) => {
        if (!configFiscalReport.skipped && configFiscalReport.deleted) {
          console.log('[ATLAS] Limpieza T14.5 configFiscal: borrada keyval residual');
        }
        if (configFiscalReport.errors.length > 0) {
          console.warn('[ATLAS] Limpieza T14.5 configFiscal · errores parciales:', configFiscalReport.errors);
        }
      })
      // Limpieza de ejercicios fiscales basura — eager para evitar que la UI
      // muestre años futuros residuales durante los primeros 2.5s.
      .then(() => limpiarEjerciciosCoordBasura())
      // T38: migración v68 · inferir tipoFamilia en compromisosRecurrentes existentes
      .then(() => runV68TipoFamiliaMigration())
      // PR-C4 (V70): backfill `historial` inicial en nóminas existentes
      .then(() => runV70NominaHistorialMigration())
      .then((v70Report) => {
        if (!v70Report.skipped && v70Report.migrados > 0) {
          console.log('[ATLAS] Migración V70 nómina historial:', v70Report);
        }
      })
      // T-VALORACIONES PR4 · seed migración de planes pensiones (store
      // `planesPensiones`) + posiciones del store `inversiones` (que
      // incluye los 11 TipoPosicion: acciones, ETFs, fondos, crypto,
      // depósitos, plan_pensiones legacy, otro, etc.) al store nuevo
      // `valoracionesActivos` desde campos legacy (`valorActual`,
      // `valor_actual`). Idempotente vía keyval. Inmuebles (store
      // `properties`) se seedean en PR5. PR6 verificará invariantes y
      // cubrirá tipos sin store dedicado (deposito como activo standalone).
      .then(() => runSeedV74PR4())
      .then((seedReport) => {
        if (!seedReport.skipped && (seedReport.planesSeeded > 0 || seedReport.inversionesSeeded > 0)) {
          console.log('[ATLAS] Seed v74-PR4 valoraciones planes/inversiones:', seedReport);
        }
      })
      // T-VALORACIONES PR5 · seed migración inmuebles activos (store
      // `properties`) desde campos legacy de valoración al store nuevo
      // `valoracionesActivos`. Idempotente vía keyval. Jerarquía de
      // fallbacks · valor_actual > currentValue > marketValue > ... >
      // tasacion (esAnchorFiscal=true) > acquisitionCosts.price (revisar).
      .then(() => runSeedV74PR5())
      .then((seedReport) => {
        if (!seedReport.skipped && seedReport.inmueblesSeeded > 0) {
          console.log('[ATLAS] Seed v74-PR5 valoraciones inmuebles:', seedReport);
        }
      })
      // T-VALORACIONES PR6 · auditoría de cobertura post-seeds. NO modifica
      // datos · solo loguea cobertura % y activos sin valoración. Útil como
      // health check vivo · si Jose añade un activo manualmente sin
      // valoración inicial, el siguiente arranque lo flagueará con warning.
      // El `.catch` está acotado al audit · NO captura errores previos de
      // la cadena de migraciones para no ocultar fallos reales.
      .then(() => runAuditV74PR6().catch((err) => {
        console.warn('[ATLAS] Audit v74-PR6 falló (no bloqueante)', err);
      }))
      // T34/T35-fix-2 · cleanup one-shot · categoría aplastada a 'otros.*'
      // en los 2 patrones documentados (dia_a_dia.otros + seguros_cuotas.seguro_otros).
      .then(() => cleanupCategoriasT34T35Fix2())
      .then((t34Fix2Report) => {
        if (!t34Fix2Report.skipped &&
            (t34Fix2Report.caso1Corregidos > 0 || t34Fix2Report.caso2Corregidos > 0)) {
          console.log('[ATLAS] Limpieza T34/T35-fix-2 categorías:', t34Fix2Report);
        }
        if (t34Fix2Report.errors.length > 0) {
          console.warn('[ATLAS] Limpieza T34/T35-fix-2 · errores parciales:', t34Fix2Report.errors);
        }
      })
      // FIX-B6 · one-shot · voltea importeTitular ↔ importeEmpresa en
      // aportacionesPlan con origen='xml_aeat' escritas por el parser AEAT
      // antes del fix de irpfXmlParserService.extraerPlanPensiones. Idempotente.
      .then(() => fixAportacionesPlanCruceB6())
      .then((b6Report) => {
        if (!b6Report.skipped && b6Report.swapped > 0) {
          console.log('[ATLAS] FIX-B6 aportacionesPlan · invertidos:', b6Report);
        }
        if (b6Report.errors.length > 0) {
          console.warn('[ATLAS] FIX-B6 aportacionesPlan · errores parciales:', b6Report.errors);
        }
      })
      // FIX-B6-bis · one-shot · voltea aportacionesTrabajador ↔ contribucionesEmpresa
      // en ejerciciosFiscalesCoord[año].aeat.declaracionCompleta.planPensiones
      // para declaraciones con fuenteImportacion='xml' importadas con el parser
      // viejo. Cierra el scope incompleto de B6 (que solo tocó aportacionesPlan).
      .then(() => fixDeclaracionCompletaCruceB6())
      .then((b6bisReport) => {
        if (!b6bisReport.skipped && b6bisReport.swapped > 0) {
          console.log('[ATLAS] FIX-B6-bis declaracionCompleta · invertidos:', b6bisReport);
        }
        if (b6bisReport.errors.length > 0) {
          console.warn('[ATLAS] FIX-B6-bis declaracionCompleta · errores parciales:', b6bisReport.errors);
        }
      })
      // TAREA 13 v4 · Acción 1 (D6) · one-shot · reescribe
      // casillaAEAT='RSUMAD' → '0426'/'0427' en aportacionesPlan con
      // origen='xml_aeat' escritas por el bloque viejo de
      // declaracionDistributorService.persistirPlanPensiones. Para registros
      // combinados (titular>0 && empresa>0) divide en 2 rows (uno por casilla)
      // dejando el shape canónico que aeatPlanesPensionesImportService espera.
      // Idempotente.
      .then(() => fixCasillaAEATOficial())
      .then((casillaReport) => {
        if (!casillaReport.skipped && (casillaReport.updated > 0 || casillaReport.split > 0)) {
          console.log('[ATLAS] FIX-casillaAEAT oficial · resultado:', casillaReport);
        }
        if (casillaReport.errors.length > 0) {
          console.warn('[ATLAS] FIX-casillaAEAT oficial · errores parciales:', casillaReport.errors);
        }
      })
      // Pulido T13 v4 final · issue 2 · retrocede `fechaContratacion` de planes
      // XML AEAT a min(aportacionesPlan.fecha). Soluciona el caso de Jose
      // (plan PPE Orange con fechaContratacion=2024 y aportaciones desde 2020).
      .then(() => fixFechaContratacionRetroactiva())
      .then((fechaReport) => {
        if (!fechaReport.skipped && fechaReport.updated > 0) {
          console.log('[ATLAS] FIX-fechaContratacion-retro · resultado:', fechaReport);
        }
        if (fechaReport.errors.length > 0) {
          console.warn('[ATLAS] FIX-fechaContratacion-retro · errores parciales:', fechaReport.errors);
        }
      })
      // Pulido T13 v4 final · issue 5 · genera `notas` descriptivas para
      // aportaciones xml_aeat legacy donde quedaron en blanco tras la
      // reescritura de `casillaAEAT`.
      .then(() => backfillAportacionesNotas())
      .then((notasReport) => {
        if (!notasReport.skipped && notasReport.updated > 0) {
          console.log('[ATLAS] BACKFILL-aportacionesPlan-notas · resultado:', notasReport);
        }
        if (notasReport.errors.length > 0) {
          console.warn('[ATLAS] BACKFILL-aportacionesPlan-notas · errores parciales:', notasReport.errors);
        }
      })
      // T-INVERSIONES-V5 §7.7 · normaliza nombres comerciales de empresas
      // pagadoras (Orange España S.A.U. vs "ORANGE ESPAGNE SA") por CIF
      // canónico. Tabla en NOMBRES_NORMALIZADOS · ampliable.
      .then(() => normalizarNombresEmpresas())
      .then((nombresReport) => {
        if (!nombresReport.skipped && nombresReport.updated > 0) {
          console.log('[ATLAS] NORMALIZAR-nombres-empresas · resultado:', nombresReport);
        }
        if (nombresReport.errors.length > 0) {
          console.warn('[ATLAS] NORMALIZAR-nombres-empresas · errores parciales:', nombresReport.errors);
        }
      })
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
                boxShadow: 'var(--atlas-v5-shadow-card)',
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
          <ErrorBoundary>
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

            {/* T15 · sub-tarea 15.1 · keyval audit · DEV only · sin layout ni auth */}
            {isDevPagesEnabled && (
              <Route
                path="/dev/keyval-audit"
                element={
                  <React.Suspense fallback={<LoadingSpinner />}>
                    <KeyvalAudit />
                  </React.Suspense>
                }
              />
            )}

            {/* T14 · sub-tarea 14.1 · fiscal context audit · DEV only · sin layout ni auth */}
            {isDevPagesEnabled && (
              <Route
                path="/dev/fiscal-context-audit"
                element={
                  <React.Suspense fallback={<LoadingSpinner />}>
                    <FiscalContextAudit />
                  </React.Suspense>
                }
              />
            )}

            {/* T9 · sub-tarea 9.1 · compromiso detection showcase · DEV only · sin layout ni auth */}
            {isDevPagesEnabled && (
              <Route
                path="/dev/compromiso-detection"
                element={
                  <React.Suspense fallback={<LoadingSpinner />}>
                    <CompromisoDetection />
                  </React.Suspense>
                }
              />
            )}

            {/* P0 · previsiones duplicadas · DEV only · sin layout ni auth */}
            {isDevPagesEnabled && (
              <Route
                path="/dev/previsiones-duplicadas"
                element={
                  <React.Suspense fallback={<LoadingSpinner />}>
                    <PrevisionesDuplicadas />
                  </React.Suspense>
                }
              />
            )}

            {/* Onboarding día 0 · `/empezar` · pantalla completa SIN MainLayout
                (el flujo trae su propia topbar · mockup atlas-onboarding-dia0-v4). */}
            <Route path="/empezar/*" element={
              <ProtectedRoute>
                <React.Suspense fallback={<LoadingSpinner />}>
                  <EmpezarApp />
                </React.Suspense>
              </ProtectedRoute>
            } />

            {/* Protected App Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
            <Route index element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <FirstRunRedirect />
              </React.Suspense>
            } />
            <Route path="panel" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <PanelPage />
              </React.Suspense>
            } />
            <Route path="archivo" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <ArchivoPage />
              </React.Suspense>
            } />
            <Route path="onboarding" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <OnboardingPage />
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
              {/* Alta/edición de gasto recurrente · en la propia tabla (§3.2) · sin wizard */}
            </Route>

            {/* Inmuebles · sub-rutas fuera del Outlet · forms y supervision legacy */}
            <Route path="inmuebles/nuevo" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InmueblePage mode="create" />
              </React.Suspense>
            } />
            <Route path="inmuebles/:id/editar" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InmueblePage mode="edit" />
              </React.Suspense>
            } />
            {/* T20 Phase 4 · /inmuebles/supervision purgado · redirige a /inmuebles. */}
            <Route path="inmuebles/supervision" element={<Navigate to="/inmuebles" replace />} />
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
            <Route path="inmuebles/resumen" element={<Navigate to="/inmuebles" replace />} />
            <Route path="inmuebles/individual" element={<Navigate to="/inmuebles" replace />} />


            {/* T23.1 · Inversiones · galería v2 (sustituye 4 tabs T20)
                · /inversiones (galería principal · cartas heterogéneas)
                · /inversiones/cerradas (placeholder · vista expandida en T23.4)
                · /inversiones/:posicionId (placeholder · ficha detalle en T23.3)
                · /inversiones/importar-* (importadores intactos)
                · /inversiones/analisis (AnalisisCartera intacto)
                · redirects de las URLs viejas (cartera · resumen · rendimientos · individual) */}
            <Route path="inversiones" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InversionesGaleria />
              </React.Suspense>
            } />
            <Route path="inversiones/cerradas" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InversionesPosicionesCerradas />
              </React.Suspense>
            } />
            <Route path="inversiones/importar-aportaciones" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InversionesImportarAportaciones />
              </React.Suspense>
            } />
            <Route path="inversiones/importar-indexa" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InversionesImportarIndexa />
              </React.Suspense>
            } />
            <Route path="inversiones/analisis" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <AnalisisCartera scope="inversiones" />
              </React.Suspense>
            } />
            {/* Redirects de URLs viejas · evita romper bookmarks externos */}
            <Route path="inversiones/resumen" element={<Navigate to="/inversiones" replace />} />
            <Route path="inversiones/cartera" element={<Navigate to="/inversiones" replace />} />
            <Route path="inversiones/rendimientos" element={<Navigate to="/inversiones" replace />} />
            <Route path="inversiones/individual" element={<Navigate to="/inversiones" replace />} />
            <Route path="inversiones/:posicionId" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <InversionesFichaPosicion />
              </React.Suspense>
            } />
            
            {/* Tesorería V6 · UNA pantalla (§4). Las rutas que existían para
                cada trozo siguen vivas para no romper enlaces guardados, pero
                todas sirven la misma pantalla abriendo el drawer que toca. */}
            <Route path="tesoreria" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <TesoreriaV6Page />
              </React.Suspense>
            } />
            {/* La lista de movimientos ya no es una pestaña: vive en el drawer
                de cada cuenta (§4.4). */}
            <Route path="tesoreria/movimientos" element={<Navigate to="/tesoreria" replace />} />
            {/* Enlace directo a una cuenta · abre su drawer sobre la pantalla. */}
            <Route path="tesoreria/cuenta/:accountId" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <TesoreriaV6Page />
              </React.Suspense>
            } />
            {/* Subir extracto · el drawer de §4.7 en su puerta global. */}
            <Route path="tesoreria/importar" element={<Navigate to="/tesoreria?extracto=1" replace />} />
            <Route path="tesoreria/importar-cuentas" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <ImportarCuentasPage
                  onComplete={() => undefined}
                  onBack={() => window.history.back()}
                />
              </React.Suspense>
            } />

            {/* V6 · D6 · /conciliacion SE RETIRA. La Tesorería absorbe su
                función: conciliar es subir extracto por cuenta (§4.7) y
                confirmar es la pestaña Pendientes del drawer de cuenta (§4.4).
                Mantener dos pantallas que hacen lo mismo con distinto lenguaje
                era la deuda que esta tarea viene a cerrar. La ruta sobrevive
                como redirección para no romper enlaces guardados. */}
            <Route path="conciliacion" element={<Navigate to="/tesoreria?extracto=1" replace />} />
            
            {/* T20 Fase 3f-A · Fiscal v5 (sustituye horizon/fiscalidad/FiscalLayout)
                Mockup · atlas-fiscal.html · 4 tabs (Calendario · Ejercicios · Deudas ·
                Configuración) + Detalle ejercicio (`/fiscal/ejercicio/:anio`).
                Wizard de Corrección/paralelas llega en 3f-B. */}
            <Route path="fiscal" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <FiscalPage />
              </React.Suspense>
            }>
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FiscalDashboard />
                </React.Suspense>
              } />
              <Route path="ejercicios" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FiscalEjercicios />
                </React.Suspense>
              } />
              <Route path="ejercicio/:anio" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FiscalDetalleEjercicio />
                </React.Suspense>
              } />
              <Route path="ejercicio/:anio/inmueble/:id" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FiscalInmuebleDetalle />
                </React.Suspense>
              } />
              <Route path="ejercicio/:anio/venta/:ventaId" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FiscalVentaDetalle />
                </React.Suspense>
              } />
              <Route path="deudas" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FiscalDeudas />
                </React.Suspense>
              } />
              {/* SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 6 · F6 Acciones
                  fiscales sustituye la antigua /fiscal/configuracion ·
                  mantenemos la ruta legacy como redirect retrocompatible. */}
              <Route path="acciones" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FiscalAcciones />
                </React.Suspense>
              } />
              <Route path="configuracion" element={<Navigate to="/fiscal/acciones" replace />} />
              <Route path="calendario" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FiscalCalendarioCompleto />
                </React.Suspense>
              } />
              <Route path="borrador/:anio" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FiscalBorradorIRPF />
                </React.Suspense>
              } />
              <Route path="correccion/:anio" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FiscalCorreccionWizard />
                </React.Suspense>
              } />
              <Route path="importar/:anio" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FiscalImportar />
                </React.Suspense>
              } />
            </Route>
            {/* Redirect ruta legacy `/fiscalidad` · sustituida por `/fiscal` en 3f-A. */}
            <Route path="fiscalidad" element={<Navigate to="/fiscal" replace />} />
            <Route path="fiscalidad/declaracion/:anio" element={<RedirectFiscalDeclaracion />} />

            <Route path="fiscalidad-legacy" element={
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
            
            {/* Financiación · vista única (`/financiacion`) + Detalle
                (`/financiacion/:id`) + wizard alta (`/financiacion/nuevo`) + alta
                vía FEIN (`/financiacion/nuevo-fein`) + edición
                (`/financiacion/:id/editar`) + importación CSV.
                El wizard reutiliza `PrestamosWizard` legacy hasta Phase 4 cleanup.
                Snowball/Acelerar sale de aquí · su sitio es Mi Plan. */}
            <Route path="financiacion" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <FinanciacionPage />
              </React.Suspense>
            }>
              <Route index element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FinanciacionVista />
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
              <Route path="importar" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FinanciacionImportarPrestamos />
                </React.Suspense>
              } />
              <Route path=":id" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <FinanciacionDetalle />
                </React.Suspense>
              } />
            </Route>

            {/* T20 Fase 3c · Mi Plan v5 (sustituye horizon/mi-plan legacy)
                Mockups · atlas-mi-plan-{landing,proyeccion,libertad,objetivos,fondos}-v3
                + atlas-mi-plan-v2. 5 sub-páginas accesibles · Retos
                postpuesto en T27.2-skip (ver `src/modules/mi-plan/featureFlags`)
                · su mockup atlas-mi-plan-retos-v3 sigue en docs/audit-inputs
                como referencia para revivir. Cierra TODO-T20-01 conectando
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
              <Route path="hitos-vitales" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <MiPlanHitosVitales />
                </React.Suspense>
              } />
              <Route path="fondos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <MiPlanFondos />
                </React.Suspense>
              } />
              {/* T27.2-skip · módulo Retos postpuesto · ruta condicionada a
                  `SHOW_RETOS` (ver `src/modules/mi-plan/featureFlags`).
                  Cuando esté `false` · redirige a Objetivos (path actual).
                  Cuando esté `true` · descomentar la lazy import arriba y
                  sustituir el <Navigate> por <MiPlanRetos />. */}
              <Route path="retos" element={
                <Navigate to="/mi-plan/objetivos" replace />
              } />
            </Route>

            <Route path="proyeccion">
              <Route index element={<Navigate to="/proyeccion/escenarios" replace />} />
              <Route path="cartera" element={<Navigate to="/inmuebles/cartera" replace />} />
              {/* PANTALLA-PRESUPUESTO · el presupuesto se unificó en /mi-plan/proyeccion.
                  Enlaces antiguos redirigen ahí; no hay pantalla de presupuesto aquí. */}
              <Route path="consolidado" element={<Navigate to="/mi-plan/proyeccion" replace />} />
              <Route path="presupuesto" element={<Navigate to="/mi-plan/proyeccion" replace />} />
              <Route path="comparativa" element={<Navigate to="/mi-plan/proyeccion" replace />} />
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
              <Route path="gastos/detectar-compromisos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PersonalDetectarCompromisos />
                </React.Suspense>
              } />
              {/* Fase 4 VH · «Mi vivienda» retirada: los gastos del hogar viven en
                  Gastos · la hipoteca en Financiación · el rol fiscal en el
                  inmueble (usoTipo). Redirect de compat. */}
              <Route path="vivienda" element={<Navigate to="/personal/gastos" replace />} />
              <Route path="presupuesto" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <PersonalPresupuesto />
                </React.Suspense>
              } />
              {/* Compat · /personal/supervision legacy redirige a panel */}
              <Route path="supervision" element={<Navigate to="/personal" replace />} />
              {/* Compat · /personal/importar-nominas legacy (T-NOMINAS-CLEANUP · entrada Excel eliminada) redirige a panel */}
              <Route path="importar-nominas" element={<Navigate to="/personal" replace />} />
            </Route>

            {/* FIX consolidar módulo Personal · wizards bajo /personal/* (sustituyen
                a /gestion/personal/*). Full-screen · fuera del layout de tabs.
                Redirect post-save → /personal/ingresos. */}
            <Route path="personal/nomina/nueva" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <NominaWizardPage />
              </React.Suspense>
            } />
            <Route path="personal/nomina/:id/editar" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <NominaWizardPage />
              </React.Suspense>
            } />
            <Route path="personal/autonomo/nuevo" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <AutonomoWizardPage />
              </React.Suspense>
            } />
            <Route path="personal/autonomo/:id/editar" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <AutonomoWizardPage />
              </React.Suspense>
            } />
            <Route path="personal/otros-ingresos/nuevo" element={
              <React.Suspense fallback={<LoadingSpinner />}>
                <OtrosIngresosWizardPage />
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
                  <InmueblePage mode="create" />
                </React.Suspense>
              } />
              <Route path="inmuebles/:id" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <GestionInmuebleDetail />
                </React.Suspense>
              } />
              <Route path="inmuebles/:id/editar" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <InmueblePage mode="edit" />
                </React.Suspense>
              } />
              <Route path="inmuebles/:id/vender" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <VentaWizard />
                </React.Suspense>
              } />
              {/* TAREA 13 v4 · Acción 2 (D4) · /gestion/inversiones era una UI
                  paralela (GestionInversionesPage) duplicada con la galería v5
                  canónica /inversiones. Eliminada · redirect permanente. */}
              <Route path="inversiones" element={<Navigate to="/inversiones" replace />} />
              {/* FIX consolidar módulo Personal · /gestion/personal DEPRECADA.
                  El hub duplicaba /personal/ingresos y servía como redirect
                  post-save con data stale. Toda la gestión vive en /personal/*.
                  Mantener redirects de compat para enlaces/bookmarks antiguos. */}
              <Route path="personal" element={<Navigate to="/personal/ingresos" replace />} />
              <Route path="personal/nueva-nomina" element={<Navigate to="/personal/nomina/nueva" replace />} />
              <Route path="personal/nuevo-autonomo" element={<Navigate to="/personal/autonomo/nuevo" replace />} />
              <Route path="personal/otros-ingresos" element={<Navigate to="/personal/otros-ingresos/nuevo" replace />} />
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

            {/* Consolidación Contratos → Alquileres · Fase B · alias de marca
                visual. `/alquileres[/...]` → `/contratos[/...]` (canónica),
                preservando sufijo y query. `/contratos` se mantiene intacta. */}
            <Route path="alquileres/*" element={<RedirectAlquileresAContratos />} />

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
              {/* Preferencias & datos migrado a Ajustes v5 (/ajustes/datos).
                  Redirect por compatibilidad con bookmarks/deep-links antiguos. */}
              <Route path="preferencias-datos" element={<Navigate to="/ajustes/datos" replace />} />
              <Route path="email-entrante" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <EmailEntrante />
                </React.Suspense>
              } />
              {/* D-CRUD-ALTA sub-tarea 9 · Catálogo proveedores */}
              <Route path="proveedores" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <ConfigProveedores />
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
              <Route path="conceptos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesConceptos />
                </React.Suspense>
              } />
              <Route path="seguridad" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesSeguridad />
                </React.Suspense>
              } />
              <Route path="datos-mercado" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesDatosMercado />
                </React.Suspense>
              } />
              <Route path="avisos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesAvisos />
                </React.Suspense>
              } />
              <Route path="datos" element={
                <React.Suspense fallback={<LoadingSpinner />}>
                  <AjustesDatos />
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
          </ErrorBoundary>
      </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
