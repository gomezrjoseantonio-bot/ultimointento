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
            inversiones la reemplaza como topbar · mockup atlas-inversiones-v2). */}
        {!isInversionesRoute && <TopbarV5 />}
        {isInversionesRoute && <CintaResumenInversiones />}

        <main
          id="main-content"
          className={`flex-1 overflow-x-hidden overflow-y-auto min-h-0 ${
            isPanelRoute
              ? 'px-8 pb-12'
              : isInversionesRoute
                ? ''
                : 'p-3 sm:p-4 lg:p-6'
          }`}
          tabIndex={-1}
        >
          {isPanelRoute || isInversionesRoute ? (
            <Outlet />
          ) : (
            <div className="container mx-auto h-full max-w-7xl">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
