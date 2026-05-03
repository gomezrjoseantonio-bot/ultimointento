// src/components/shared/PageHeader.tsx
// ═══════════════════════════════════════════════════════════════
// ATLAS v4 — Cabecera estándar de página
// TODAS las páginas de la app DEBEN usar este componente.
// NO se permite crear cabeceras custom en ninguna página.
// ═══════════════════════════════════════════════════════════════

import React, { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderTab {
  id: string;
  label: string;
}

interface PageHeaderProps {
  /** Icono Lucide de la sección — se renderiza a 20px, color grey-500, SIN fondo */
  icon: LucideIcon;
  /** Título H1 de la página */
  title: string;
  /** Subtítulo opcional (una línea máx) */
  subtitle?: string;
  /** Tabs de navegación (underline, sin iconos) */
  tabs?: PageHeaderTab[];
  /** ID del tab activo */
  activeTab?: string;
  /** Callback cuando se cambia de tab */
  onTabChange?: (tabId: string) => void;
  /** Acciones en la esquina derecha (máx 2 botones) */
  actions?: ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  icon: Icon,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  actions,
}) => {
  return (
    <div style={{ marginBottom: 24 }}>
      {/* Row: icon + title + actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: tabs ? 16 : 0,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: subtitle ? 2 : 0 }}>
            {/* Icono: 20px, gris, SIN fondo, SIN círculo, SIN cuadrado */}
            <Icon size={20} color="var(--grey-500, #6C757D)" strokeWidth={1.5} />
            <h1
              style={{
                fontSize: 'var(--t-xl, 1.375rem)',
                fontWeight: 700,
                color: 'var(--grey-900, #1A2332)',
                margin: 0,
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                lineHeight: 1.2,
              }}
            >
              {title}
            </h1>
          </div>
          {subtitle && (
            <p
              style={{
                fontSize: 'var(--t-sm, 0.8125rem)',
                color: 'var(--grey-500, #6C757D)',
                margin: 0,
                paddingLeft: 30,
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>

      {/* Tabs: underline, sin iconos, NUNCA pills para navegación */}
      {tabs && tabs.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 32,
            borderBottom: '1px solid var(--grey-200, #DDE3EC)',
            paddingLeft: 30,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              style={{
                padding: '10px 0',
                fontSize: 'var(--t-base, 0.875rem)',
                fontWeight: activeTab === tab.id ? 500 : 400,
                color: activeTab === tab.id ? 'var(--grey-900, #1A2332)' : 'var(--grey-500, #6C757D)',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id
                  ? '2px solid var(--navy-900, #042C5E)'
                  : '2px solid transparent',
                marginBottom: -1,
                cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                transition: 'all 150ms ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PageHeader;


// ═══════════════════════════════════════════════════════════════
// Botones estándar para usar en `actions` prop
// ═══════════════════════════════════════════════════════════════

/** Botón primario (navy relleno) — para CREAR / AÑADIR */
export const HeaderPrimaryButton: React.FC<{
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
}> = ({ icon: BtnIcon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '10px 16px',
      borderRadius: 'var(--r-md, 8px)',
      border: 'none',
      background: 'var(--navy-900, #042C5E)',
      color: 'var(--white, #FFFFFF)',
      fontSize: 'var(--t-base, 0.875rem)',
      fontWeight: 500,
      cursor: 'pointer',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      transition: 'all 150ms ease',
    }}
  >
    {BtnIcon && <BtnIcon size={16} />}
    {label}
  </button>
);

/** Botón de cabecera (borde gris) — para IMPORTAR / EXPORTAR / CONFIGURAR */
export const HeaderSecondaryButton: React.FC<{
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ icon: BtnIcon, label, onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 16px',
      borderRadius: 'var(--r-md, 8px)',
      border: '1.5px solid var(--grey-300, #C8D0DC)',
      background: 'var(--white, #FFFFFF)',
      color: 'var(--grey-700, #303A4C)',
      fontSize: 'var(--t-base, 0.875rem)',
      fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      transition: 'all 150ms ease',
    }}
  >
    {BtnIcon && <BtnIcon size={16} />}
    {label}
  </button>
);
