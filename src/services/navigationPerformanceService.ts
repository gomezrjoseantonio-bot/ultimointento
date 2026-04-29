import { warmCachedStores } from './indexedDbCacheService';

const preloadRouteChunk = async (href: string): Promise<void> => {
  if (href === '/panel') {
    await import('../pages/PanelPage');
    return;
  }
  if (href.startsWith('/inbox')) {
    await import('../pages/InboxPage');
    return;
  }
  if (href.startsWith('/inmuebles/supervision')) {
    await import('../modules/horizon/inmuebles/supervision/Supervision');
    return;
  }
  if (href.startsWith('/inmuebles/analisis')) {
    await import('../modules/horizon/analisis-cartera/AnalisisCartera');
    return;
  }
  if (href.startsWith('/inmuebles/nuevo') || href.match(/^\/inmuebles\/\d+\/editar/)) {
    await import('../modules/horizon/inmuebles/cartera/PropertyForm');
    return;
  }
  if (href.startsWith('/inmuebles/importar-valoraciones')) {
    await import('../modules/inmuebles/import/ImportarValoraciones');
    return;
  }
  if (href.startsWith('/inmuebles/importar-contratos')) {
    await import('../modules/inmuebles/import/ImportarContratos');
    return;
  }
  if (href.startsWith('/inmuebles/importar')) {
    await import('../modules/inmuebles/import/ImportarInmuebles');
    return;
  }
  if (href.startsWith('/inmuebles')) {
    // /inmuebles (listado) y /inmuebles/:id (detalle) · ambos pasan por
    // InmueblesPage Outlet · precargamos también listado/detalle según ruta.
    await Promise.all([
      import('../modules/inmuebles/InmueblesPage'),
      href === '/inmuebles' || href === '/inmuebles/'
        ? import('../modules/inmuebles/pages/ListadoPage')
        : import('../modules/inmuebles/pages/DetallePage'),
    ]);
    return;
  }
  if (href.startsWith('/inversiones/analisis')) {
    await import('../modules/horizon/analisis-cartera/AnalisisCartera');
    return;
  }
  if (href.startsWith('/inversiones')) {
    const subPage = href.startsWith('/inversiones/cartera')
      ? import('../modules/inversiones/pages/CarteraPage')
      : href.startsWith('/inversiones/rendimientos')
        ? import('../modules/inversiones/pages/RendimientosPage')
        : href.startsWith('/inversiones/individual')
          ? import('../modules/inversiones/pages/IndividualPage')
          : import('../modules/inversiones/pages/ResumenPage');
    await Promise.all([import('../modules/inversiones/InversionesPage'), subPage]);
    return;
  }
  if (href.startsWith('/tesoreria')) {
    await import('../modules/tesoreria/TesoreriaPage');
    return;
  }
  if (href === '/fiscal' || href.startsWith('/fiscal/')) {
    const subPage = href.startsWith('/fiscal/ejercicio/')
      ? import('../modules/fiscal/pages/DetalleEjercicioPage')
      : href.startsWith('/fiscal/ejercicios')
        ? import('../modules/fiscal/pages/EjerciciosPage')
        : href.startsWith('/fiscal/deudas')
          ? import('../modules/fiscal/pages/DeudasPage')
          : href.startsWith('/fiscal/configuracion')
            ? import('../modules/fiscal/pages/ConfiguracionPage')
            : href.startsWith('/fiscal/calendario')
              ? import('../modules/fiscal/pages/CalendarioFiscalPage')
              : import('../modules/fiscal/pages/DashboardPage');
    await Promise.all([import('../modules/fiscal/FiscalPage'), subPage]);
    return;
  }
  if (href.startsWith('/financiacion')) {
    const subPage = href.startsWith('/financiacion/listado')
      ? import('../modules/financiacion/pages/ListadoPage')
      : href.startsWith('/financiacion/snowball')
        ? import('../modules/financiacion/pages/SnowballPage')
        : href.startsWith('/financiacion/calendario')
          ? import('../modules/financiacion/pages/CalendarioPage')
          : href.startsWith('/financiacion/nuevo')
            ? import('../modules/financiacion/pages/WizardCreatePage')
            : href.match(/^\/financiacion\/[^/]+\/editar/)
              ? import('../modules/financiacion/pages/WizardEditPage')
              : href.match(/^\/financiacion\/[^/]+$/)
                ? import('../modules/financiacion/pages/DetallePage')
                : import('../modules/financiacion/pages/DashboardPage');
    await Promise.all([import('../modules/financiacion/FinanciacionPage'), subPage]);
    return;
  }
  if (href.startsWith('/contratos/nuevo')) {
    await import('../modules/inmuebles/wizards/NuevoContratoWizard');
    return;
  }
  if (href.startsWith('/contratos')) {
    await import('../modules/inmuebles/pages/ContratosListPage');
    return;
  }
  if (href.startsWith('/mi-plan')) {
    const subPage = href.startsWith('/mi-plan/proyeccion')
      ? import('../modules/mi-plan/pages/ProyeccionPage')
      : href.startsWith('/mi-plan/libertad')
        ? import('../modules/mi-plan/pages/LibertadPage')
        : href.startsWith('/mi-plan/objetivos')
          ? import('../modules/mi-plan/pages/ObjetivosPage')
          : href.startsWith('/mi-plan/fondos')
            ? import('../modules/mi-plan/pages/FondosPage')
            : href.startsWith('/mi-plan/retos')
              ? import('../modules/mi-plan/pages/RetosPage')
              : import('../modules/mi-plan/pages/LandingPage');
    await Promise.all([import('../modules/mi-plan/MiPlanPage'), subPage]);
    return;
  }
  if (href.startsWith('/personal/importar-nominas')) {
    await import('../modules/personal/import/ImportarNominas');
    return;
  }
  if (href.startsWith('/personal')) {
    // /personal (panel) + sub-tabs · todas pasan por PersonalPage Outlet.
    const subPage = href.startsWith('/personal/ingresos')
      ? import('../modules/personal/pages/IngresosPage')
      : href.startsWith('/personal/gastos')
        ? import('../modules/personal/pages/GastosPage')
        : href.startsWith('/personal/vivienda')
          ? import('../modules/personal/pages/ViviendaPage')
          : href.startsWith('/personal/presupuesto')
            ? import('../modules/personal/pages/PresupuestoPage')
            : import('../modules/personal/pages/PanelPage');
    await Promise.all([import('../modules/personal/PersonalPage'), subPage]);
    return;
  }
  if (href.startsWith('/ajustes') || href.startsWith('/cuenta')) {
    await import('../modules/ajustes/AjustesPage');
  }
};

const routeStoreMap: Array<{ match: (href: string) => boolean; stores: string[] }> = [
  { match: (href) => href === '/panel', stores: ['accounts', 'treasuryEvents', 'movements', 'properties', 'contracts', 'valoraciones_historicas'] },
  { match: (href) => href.startsWith('/inbox'), stores: ['documents'] },
  { match: (href) => href.startsWith('/tesoreria'), stores: ['accounts', 'treasuryEvents', 'movements', 'contracts', 'properties'] },
  { match: (href) => href.startsWith('/inmuebles/cartera'), stores: ['properties', 'contracts', 'valoraciones_historicas'] },
  { match: (href) => href.startsWith('/inmuebles/supervision'), stores: ['properties', 'contracts', 'valoraciones_historicas', 'prestamos', 'mejorasInmueble', 'mueblesInmueble', 'gastosInmueble'] },
  { match: (href) => href === '/inmuebles' || href.startsWith('/inmuebles/analisis'), stores: ['properties', 'contracts', 'valoraciones_historicas', 'prestamos', 'expenses', 'compromisosRecurrentes'] },
  { match: (href) => href.startsWith('/contratos'), stores: ['contracts', 'properties'] },
  { match: (href) => href.startsWith('/inversiones'), stores: ['inversiones', 'accounts', 'movements'] },
  { match: (href) => href.startsWith('/financiacion'), stores: ['prestamos', 'properties', 'accounts'] },
  { match: (href) => href === '/fiscal' || href.startsWith('/fiscal/'), stores: ['ejerciciosFiscalesCoord', 'documents', 'arrastresIRPF'] },
  { match: (href) => href.startsWith('/personal'), stores: ['nominas', 'autonomos', 'otrosIngresos', 'compromisosRecurrentes', 'personalData'] },
  { match: (href) => href.startsWith('/mi-plan'), stores: ['escenarios', 'objetivos', 'fondos_ahorro', 'retos', 'nominas', 'autonomos', 'compromisosRecurrentes', 'contracts'] },
];

const getStoresForRoute = (href: string): string[] => {
  const stores = routeStoreMap
    .filter((entry) => entry.match(href))
    .flatMap((entry) => entry.stores);

  return Array.from(new Set(stores));
};

const inFlightPreloads = new Map<string, Promise<void>>();

interface PreloadRouteOptions {
  includeStores?: boolean;
}

export const preloadRouteResources = async (
  href: string,
  options?: PreloadRouteOptions,
): Promise<void> => {
  if (!href || inFlightPreloads.has(href)) {
    return inFlightPreloads.get(href) ?? Promise.resolve();
  }

  const tasks: Array<Promise<unknown>> = [preloadRouteChunk(href)];

  if (options?.includeStores) {
    tasks.push(warmCachedStores(getStoresForRoute(href)));
  }

  const preloadPromise = Promise.allSettled(tasks).then(() => undefined)
    .finally(() => {
      inFlightPreloads.delete(href);
    });

  inFlightPreloads.set(href, preloadPromise);
  return preloadPromise;
};
