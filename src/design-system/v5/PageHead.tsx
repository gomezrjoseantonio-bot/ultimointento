import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './PageHead.module.css';

export interface BreadcrumbItem {
  label: React.ReactNode;
  /** Si null · es el item activo · no se renderiza como link. */
  onClick?: () => void;
}

export interface PageHeadButton {
  label: React.ReactNode;
  /** Variante visual · §4.4 guía v5 (gold = primario · ghost = secundario). */
  variant?: 'gold' | 'ghost';
  /** Icono Lucide a la izquierda. */
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** id/aria-label opcional para accesibilidad. */
  ariaLabel?: string;
}

export interface PageHeadProps {
  /** Título principal del page head · sin icono al H1. */
  title: React.ReactNode;
  /** Subtítulo · datos al cierre · contexto. Acepta strings con `<strong>`. */
  sub?: React.ReactNode;
  /** Breadcrumb opcional · si se pasa · renderiza variante con migas + Volver. */
  breadcrumb?: BreadcrumbItem[];
  /** Texto del botón Volver · default "Volver". */
  backLabel?: string;
  /** Click en el botón Volver · si se omite · no se muestra. */
  onBack?: () => void;
  /** Botones de acción · máximo 2 · principal a la derecha. */
  actions?: PageHeadButton[];
  /** Slot adicional debajo del head · típicamente un `<TabsUnderline>`. */
  tabsSlot?: React.ReactNode;
  /** className para el wrapper externo. */
  className?: string;
}

/**
 * Page head canónico · §4 guía v5.
 * Variantes · sin breadcrumb (landing · pantallas raíz) · con breadcrumb (sub-páginas).
 *
 * Reglas obligatorias respetadas · H1 sin icono · sub con datos contextuales
 * · principal `gold` a la derecha · secundaria `ghost` · máx 2 botones.
 */
const PageHead: React.FC<PageHeadProps> = ({
  title,
  sub,
  breadcrumb,
  backLabel = 'Volver',
  onBack,
  actions,
  tabsSlot,
  className,
}) => {
  const hasBreadcrumb = breadcrumb && breadcrumb.length > 0;

  return (
    <div className={className}>
      <div className={styles.head}>
        <div className={styles.left}>
          {(hasBreadcrumb || onBack) && (
            <nav className={styles.breadcrumb} aria-label="breadcrumb">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className={styles.backBtn}
                  aria-label={backLabel}
                >
                  <ChevronLeft size={12} strokeWidth={2} />
                  {backLabel}
                </button>
              )}
              {hasBreadcrumb &&
                breadcrumb!.map((item, idx) => {
                  const isLast = idx === breadcrumb!.length - 1;
                  const sep =
                    idx > 0 ? (
                      <ChevronRight
                        key={`sep-${idx}`}
                        size={11}
                        strokeWidth={2}
                        aria-hidden
                      />
                    ) : null;
                  if (isLast || !item.onClick) {
                    return (
                      <React.Fragment key={`bc-${idx}`}>
                        {sep}
                        <span className={isLast ? styles.current : undefined}>
                          {item.label}
                        </span>
                      </React.Fragment>
                    );
                  }
                  return (
                    <React.Fragment key={`bc-${idx}`}>
                      {sep}
                      <button type="button" onClick={item.onClick}>
                        {item.label}
                      </button>
                    </React.Fragment>
                  );
                })}
            </nav>
          )}
          <h1 className={styles.title}>{title}</h1>
          {sub != null && <div className={styles.sub}>{sub}</div>}
        </div>
        {actions && actions.length > 0 && (
          <div className={styles.actions}>
            {actions.slice(0, 2).map((btn, idx) => {
              const variant = btn.variant ?? (idx === actions.length - 1 ? 'gold' : 'ghost');
              const classes = [styles.btn, styles[variant]].join(' ');
              return (
                <button
                  key={`act-${idx}`}
                  type="button"
                  className={classes}
                  onClick={btn.onClick}
                  disabled={btn.disabled}
                  aria-label={btn.ariaLabel}
                >
                  {btn.icon}
                  {btn.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {tabsSlot}
    </div>
  );
};

export default PageHead;
export { PageHead };
