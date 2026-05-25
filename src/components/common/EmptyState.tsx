/**
 * TAREA-CC-FIX-EMPTY-STATES-UNIFICADOS · patrón P1 canónico.
 *
 * Componente reutilizable `<EmptyState />` para los 8 módulos del menú lateral
 * (Panel · Inmuebles · Inversiones · Tesorería · Financiación · Personal ·
 * Contratos · Archivo).
 *
 * Reglas ·
 *   - Icono Lucide (componente, NO string) en círculo con borde dorado.
 *   - Título 14px bold sentence case ("Sin X aún").
 *   - Subtítulo 12px gris descripción + acción esperada.
 *   - Botón ghost dorado opcional con icono Plus por defecto.
 *   - Cero emojis · cero hex hardcoded · centrado vertical+horizontal.
 *   - `role="status"` y `aria-live="polite"` para accesibilidad.
 *
 * Cuándo usar ·
 *   - Empty state global de un módulo entero (no hay NINGÚN dato del recurso).
 *
 * Cuándo NO usar ·
 *   - Empty state interno de pestañas (cada tab tiene su propio empty state).
 *   - Empty state de drawers / popovers / modales internos.
 *   - Panel funcional con valores a cero pero estructura presente (Mi Plan ·
 *     Fiscal · Ajustes NO son empty states).
 *   - Empty state "sin resultados" tras aplicar filtros (variante futura).
 */

import React from 'react';
import { Plus, type LucideIcon } from 'lucide-react';
import './EmptyState.css';

export interface EmptyStateCta {
  label: string;
  onClick: () => void;
  /** Icono del botón · por defecto Plus. */
  icon?: LucideIcon;
}

export interface EmptyStateProps {
  /** Icono Lucide (componente, no string) · render dentro del círculo dorado. */
  icon: LucideIcon;

  /** Título principal · sentence case · sin punto final · ej. "Sin inmuebles aún". */
  title: string;

  /** Subtítulo · descripción + qué hacer · ej. "Añade tu primer inmueble...". */
  subtitle: string;

  /** CTA opcional · si se omite, no se renderiza botón. */
  cta?: EmptyStateCta;

  /** Tamaño del componente · default 'normal'. */
  size?: 'small' | 'normal' | 'large';

  /** Override className raíz para encajar en layouts particulares. */
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<EmptyStateProps['size']>, string> = {
  small: 'atlas-empty--small',
  normal: 'atlas-empty--normal',
  large: 'atlas-empty--large',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  subtitle,
  cta,
  size = 'normal',
  className,
}) => {
  const CtaIcon = cta?.icon ?? Plus;
  const rootClass = ['atlas-empty', SIZE_CLASS[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <div className="atlas-empty__icon-wrap" aria-hidden="true">
        <Icon className="atlas-empty__icon" />
      </div>
      <h3 className="atlas-empty__title">{title}</h3>
      <p className="atlas-empty__subtitle">{subtitle}</p>
      {cta && (
        <button
          type="button"
          className="atlas-empty__cta"
          onClick={cta.onClick}
        >
          <CtaIcon className="atlas-empty__cta-icon" aria-hidden="true" />
          {cta.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
