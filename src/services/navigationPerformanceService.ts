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
  if (href.startsWith('/inversiones')) {
    await import('../modules/horizon/inversiones/InversionesPage');
    return;
  }
  if (href.startsWith('/tesoreria')) {
    await import('../modules/tesoreria/TesoreriaPage');
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
