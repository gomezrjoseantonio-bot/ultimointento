import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/navigation/Sidebar';
import TopbarV5 from '../design-system/v5/TopbarV5';
import CintaResumenInversiones from '../modules/inversiones/components/CintaResumenInversiones';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { preloadRouteResources } from '../services/navigationPerformanceService';

// Ambos overlays sólo aparecen bajo demanda (Cmd+K / ?). Los mantenemos fuera
// del bundle principal para no sumar lucide-react + handlers al arranque.
const CommandPalette = lazy(() => import('../components/common/CommandPalette'));
const KeyboardShortcutsModal = lazy(() => import('../components/common/KeyboardShortcutsModal'));

/**
 * Fallback mínimo mientras se descarga el chunk del overlay. Muestra un
 * backdrop semitransparente y permite cancelar con Escape o clic fuera, de
 * modo que el usuario nunca queda "atrapado" si el chunk tarda en llegar.
 */
const OverlayFallback: React.FC<{ onClose: () => void; label: string }> = ({
  onClose,
  label,
}) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-busy="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
      }}
    />
  );
};

const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const location = useLocation();
  const isPanelRoute = location.pathname === '/panel';
  const isInversionesRoute = location.pathname === '/inversiones' || location.pathname.startsWith('/inversiones/');
  // INVERSIONES V1 · Fase 2 · la galería principal (/inversiones exacto) integra
  // sus KPIs en el hero navy, así que NO monta la cinta-resumen (evita duplicar
  // valor total/rentabilidad y libera altura para la pantalla sin scroll). Las
  // sub-rutas (detalle · cerradas · importar) sí la conservan como topbar.
  const isGaleriaInversionesRoute = location.pathname === '/inversiones';
  // S-TESORERIA-FASE-B · sin topbar global en las páginas de Tesorería que
  // renderizan su propio banner navy (vista general · vista cuenta · tab
  // movimientos). NO aplica a `/tesoreria/importar` ni `/tesoreria/importar-cuentas`,
  // que son flujos de import sin banner y sí necesitan TopbarV5 + el contenedor
  // estándar con padding/max-width.
  const tesoreriaPath = location.pathname;
  const isTesoreriaRoute =
    tesoreriaPath === '/tesoreria' ||
    tesoreriaPath === '/tesoreria/movimientos' ||
    tesoreriaPath.startsWith('/tesoreria/cuenta/');
  // FIX Contratos § 1.1 · la lista de Contratos renderiza su propia banda navy
  // (persistent-bar) que sustituye al TopbarV5 · igual que Tesorería/Inversiones.
  // NO aplica al wizard /contratos/nuevo (flujo con padding estándar).
  const isContratosRoute =
    location.pathname === '/contratos' || location.pathname === '/contratos/lista';
  // Financiación · la vista principal y el detalle NUNCA hacen scroll (guía
  // v5): sus bloques se reparten el viewport y scrollean por dentro las listas
  // largas —la cartera en una, las bonificaciones en el otro—. Los wizards y la
  // importación siguen con scroll normal: un formulario sí puede ser más largo
  // que la ventana. Se cuenta también `/financiacion/` con barra final
  // —`FinanciacionPage` la redirige, pero este layout decide antes y si no se
  // vería un parpadeo de scroll en el primer render.
  const rutaFinanciacionSinScroll =
    /^\/financiacion\/?$/.test(location.pathname) ||
    (/^\/financiacion\/[^/]+$/.test(location.pathname) &&
      !['/financiacion/nuevo', '/financiacion/nuevo-fein', '/financiacion/importar'].includes(
        location.pathname,
      ));
  const isFinanciacionVistaRoute = rutaFinanciacionSinScroll;

  /**
   * Las pantallas que van a sangre · sin el contenedor centrado del layout.
   *
   * Financiación entra aquí con Tesorería, y el motivo importa porque no basta
   * con igualar el ancho de la página: la otra rama envuelve el Outlet en
   * `container mx-auto max-w-7xl`, que **centra y recorta a 1280 px**. Con eso
   * puesto, poner `max-width: 1560px` en la página no hace nada —manda el
   * envoltorio— y la pantalla se veía más estrecha y despegada de la barra
   * lateral que Tesorería aunque las dos dijeran los mismos números *(Jose ·
   * 8 ago 2026)*. El padding también sale de aquí: la página ya trae el suyo.
   *
   * Y con ello Financiación pierde el `TopbarV5`, como Tesorería: su banda
   * navy con el título dentro **lo sustituye**, y tener las dos era decir el
   * nombre de la pantalla dos veces en una vista que no puede crecer.
   */
  const isFullBleedRoute =
    isInversionesRoute || isTesoreriaRoute || isContratosRoute || rutaFinanciacionSinScroll;
  
  // Sprint 5: Command Palette (Cmd+K)
  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette();
  
  // Sprint 5: Global keyboard shortcuts
  useKeyboardShortcuts({
    onShowShortcuts: () => setShowShortcuts(true),
  });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void preloadRouteResources(location.pathname, { includeStores: true });
    }, 1500);

    return () => window.clearTimeout(handle);
  }, [location.pathname]);
  
  
  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Sprint 5: Command Palette (Cmd+K) — montaje perezoso sólo al abrir */}
      {isCommandPaletteOpen && (
        <Suspense
          fallback={
            <OverlayFallback onClose={closeCommandPalette} label="Cargando paleta de comandos" />
          }
        >
          <CommandPalette isOpen={isCommandPaletteOpen} onClose={closeCommandPalette} />
        </Suspense>
      )}

      {/* Sprint 5: Keyboard Shortcuts Help Modal — montaje perezoso sólo al abrir */}
      {showShortcuts && (
        <Suspense
          fallback={
            <OverlayFallback
              onClose={() => setShowShortcuts(false)}
              label="Cargando atajos de teclado"
            />
          }
        >
          <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </Suspense>
      )}
      
      {/* Skip Link - Sprint 3: Accessibility improvement */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:font-medium focus:shadow-lg"
        style={{
          backgroundColor: 'var(--hz-primary)',
          color: 'white',
        }}
      >
        Saltar a contenido principal
      </a>
      
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        {/* TopbarV5 · persistente · oculto en /inversiones/* (la cinta de
            inversiones la reemplaza como topbar · mockup atlas-inversiones-v2).
            Oculto también en /panel: sin buscador (decisión Jose) el topbar solo
            ocupaba espacio · el Panel sube y debe caber sin scroll. */}
        {!isFullBleedRoute && !isPanelRoute && <TopbarV5 />}
        {isInversionesRoute && !isGaleriaInversionesRoute && <CintaResumenInversiones />}

        {/* /panel · overflow-y-hidden obligatorio: el Panel NUNCA hace scroll ·
            PanelPage se auto-ajusta a la altura disponible. */}
        <main
          id="main-content"
          /* `min-w-0` va con `flex-1`: sin él un hijo flex no puede encogerse
             por debajo de su contenido, así que una tabla o una tira ancha
             empuja el ancho y `overflow-x-hidden` se limita a TAPAR el
             desbordamiento en vez de evitarlo (§4.2). */
          className={`flex-1 overflow-x-hidden min-h-0 min-w-0 ${
            isPanelRoute
              ? 'overflow-y-hidden px-8'
              : isFinanciacionVistaRoute
                ? 'overflow-y-hidden'
                : isFullBleedRoute
                  ? 'overflow-y-auto'
                  : 'overflow-y-auto p-3 sm:p-4 lg:p-6'
          }`}
          tabIndex={-1}
        >
          {isPanelRoute || isFullBleedRoute ? (
            <Outlet />
          ) : (
            <div className="container mx-auto h-full max-w-7xl min-w-0">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
