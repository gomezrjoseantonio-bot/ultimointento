/**
 * ATLAS · DESIGN SYSTEM v5 · TopbarV5
 *
 * Topbar global genérico · render persistente en TODAS las pantallas.
 * Ref: TAREA-22-dashboard-sidebar-topbar.md §2.2 · § Z.5
 *
 * Tokens · todos via --atlas-v5-* · cero hex hardcoded.
 * Iconos · §AA.2 (Search · Bell · HelpCircle) · 16×16.
 */

import React, { useState } from 'react';
import { Icons } from './icons';

export interface TopbarV5Props {
  /** Ancho del sidebar (usado para sincronizar padding si fuera necesario en layout) */
  className?: string;
}

const TopbarV5: React.FC<TopbarV5Props> = ({ className }) => {
  // TODO: implementar dropdown de búsqueda real (conectar con CommandPalette o servicio de búsqueda)
  const [searchOpen, setSearchOpen] = useState(false);
  // TODO: implementar panel de notificaciones real (conectar con servicio de notificaciones)
  const [bellOpen, setBellOpen] = useState(false);
  // TODO: implementar centro de ayuda real (conectar con documentación / intercom / etc.)
  const [helpOpen, setHelpOpen] = useState(false);

  const handleSearchClick = () => {
    // TODO: abrir búsqueda real · por ahora stub "Buscar próximamente"
    setSearchOpen((v) => !v);
    setBellOpen(false);
    setHelpOpen(false);
  };

  const handleBellClick = () => {
    // TODO: abrir panel notificaciones real · badge count dinámico desde store
    setBellOpen((v) => !v);
    setSearchOpen(false);
    setHelpOpen(false);
  };

  const handleHelpClick = () => {
    // TODO: abrir centro de ayuda real · "Centro de ayuda · próximamente"
    setHelpOpen((v) => !v);
    setSearchOpen(false);
    setBellOpen(false);
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    right: 0,
    background: 'var(--atlas-v5-card)',
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 'var(--atlas-v5-radius-md)',
    padding: '10px 14px',
    fontSize: 'var(--atlas-v5-fs-sub)',
    color: 'var(--atlas-v5-ink-3)',
    boxShadow: 'var(--atlas-v5-shadow-modal)',
    zIndex: 'var(--atlas-v5-z-dropdown)' as unknown as number,
    whiteSpace: 'nowrap',
  };

  const bellHelpDropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    background: 'var(--atlas-v5-card)',
    border: '1px solid var(--atlas-v5-line)',
    borderRadius: 'var(--atlas-v5-radius-md)',
    padding: '10px 14px',
    fontSize: 'var(--atlas-v5-fs-sub)',
    color: 'var(--atlas-v5-ink-3)',
    boxShadow: 'var(--atlas-v5-shadow-modal)',
    zIndex: 'var(--atlas-v5-z-dropdown)' as unknown as number,
    whiteSpace: 'nowrap',
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: '22px 32px',
        background: 'var(--atlas-v5-bg)',
      }}
    >
      {/* Search box · §Z.5 */}
      <div style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
        <button
          type="button"
          onClick={handleSearchClick}
          aria-label="Buscar"
          aria-expanded={searchOpen}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--atlas-v5-card)',
            border: '1px solid var(--atlas-v5-line)',
            borderRadius: 'var(--atlas-v5-radius-md)',
            padding: '8px 12px',
            cursor: 'text',
            textAlign: 'left',
          }}
        >
          <Icons.Search
            size={16}
            aria-hidden="true"
            style={{ color: 'var(--atlas-v5-ink-4)', flexShrink: 0 }}
          />
          <span
            style={{
              flex: 1,
              fontSize: 13,
              color: 'var(--atlas-v5-ink-4)',
              background: 'transparent',
            }}
          >
            Buscar inmueble, contrato, movimiento...
          </span>
          <kbd
            style={{
              fontFamily: 'var(--atlas-v5-font-mono-num)',
              fontSize: 10,
              padding: '2px 6px',
              border: '1px solid var(--atlas-v5-line)',
              borderRadius: 4,
              color: 'var(--atlas-v5-ink-4)',
              background: 'var(--atlas-v5-bg)',
              flexShrink: 0,
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* TODO: stub "Buscar próximamente" · reemplazar con dropdown real */}
        {searchOpen && (
          <div style={dropdownStyle}>
            Buscar próximamente
          </div>
        )}
      </div>

      {/* Actions · Bell + Help · §Z.5 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Bell · badge hardcoded 12 · TODO dinámico */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={handleBellClick}
            aria-label="Notificaciones"
            aria-expanded={bellOpen}
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--atlas-v5-radius-icon)',
              background: 'var(--atlas-v5-card)',
              border: '1px solid var(--atlas-v5-line)',
              color: 'var(--atlas-v5-ink-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <Icons.Bell size={16} aria-hidden="true" />
            {/* TODO: badge count dinámico desde store de notificaciones */}
            <span
              aria-label="12 notificaciones"
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: 'var(--atlas-v5-gold)',
                color: 'var(--atlas-v5-white)',
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 8,
                lineHeight: 1.4,
                pointerEvents: 'none',
              }}
            >
              12
            </span>
          </button>

          {/* TODO: stub "Sin notificaciones" · reemplazar con panel real */}
          {bellOpen && (
            <div style={bellHelpDropdownStyle}>
              Sin notificaciones
            </div>
          )}
        </div>

        {/* Help */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={handleHelpClick}
            aria-label="Ayuda"
            aria-expanded={helpOpen}
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--atlas-v5-radius-icon)',
              background: 'var(--atlas-v5-card)',
              border: '1px solid var(--atlas-v5-line)',
              color: 'var(--atlas-v5-ink-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Icons.Help size={16} aria-hidden="true" />
          </button>

          {/* TODO: stub "Centro de ayuda · próximamente" · reemplazar con modal/link real */}
          {helpOpen && (
            <div style={bellHelpDropdownStyle}>
              Centro de ayuda · próximamente
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopbarV5;
