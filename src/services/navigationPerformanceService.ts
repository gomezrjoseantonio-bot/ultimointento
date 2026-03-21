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
  if (href.startsWith('/inmuebles/cartera')) {
    await import('../modules/horizon/inmuebles/cartera/Cartera');
    return;
  }
  if (href.startsWith('/inmuebles/analisis') || href === '/inmuebles') {
    await import('../pages/inmuebles/InmueblesAnalisis');
    return;
  }
  if (href.startsWith('/inversiones')) {
    await import('../modules/horizon/inversiones/InversionesPage');
    return;
  }
  if (href.startsWith('/tesoreria')) {
    await import('../modules/horizon/tesoreria/Tesoreria');
    return;
  }
  if (href.startsWith('/contratos')) {
    await import('../modules/pulse/contratos/lista/ContratosLista');
    return;
  }
  if (href.startsWith('/cuenta')) {
    await import('../pages/account/AccountPage');
  }
};

const routeStoreMap: Array<{ match: (href: string) => boolean; stores: string[] }> = [
  { match: (href) => href === '/panel', stores: ['accounts', 'treasuryEvents', 'movements', 'properties', 'contracts', 'valoraciones_historicas'] },
  { match: (href) => href.startsWith('/inbox'), stores: ['documents'] },
  { match: (href) => href.startsWith('/tesoreria'), stores: ['accounts', 'treasuryEvents', 'movements', 'contracts', 'properties'] },
  { match: (href) => href.startsWith('/inmuebles/cartera'), stores: ['properties', 'contracts', 'valoraciones_historicas'] },
  { match: (href) => href === '/inmuebles' || href.startsWith('/inmuebles/analisis'), stores: ['properties', 'contracts', 'valoraciones_historicas', 'prestamos', 'expenses', 'opexRules'] },
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

export const preloadRouteResources = async (href: string): Promise<void> => {
  if (!href || inFlightPreloads.has(href)) {
    return inFlightPreloads.get(href) ?? Promise.resolve();
  }

  const preloadPromise = Promise.allSettled([
    preloadRouteChunk(href),
    warmCachedStores(getStoresForRoute(href)),
  ]).then(() => undefined)
    .finally(() => {
      inFlightPreloads.delete(href);
    });

  inFlightPreloads.set(href, preloadPromise);
  return preloadPromise;
};
