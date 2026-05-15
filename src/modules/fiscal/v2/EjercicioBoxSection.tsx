/**
 * EjercicioBoxSection · sección colapsable A-H del Modelo 100.
 *
 * Header · letra (chip navy) · título · total · chevron.
 * Body · slot (filas BoxRowCasilla o componentes custom · ej. inmuebles
 * en sección B).
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3 §5.2.
 */

import React, { useState } from 'react';
import type { BoxSection } from './helpers/ejercicioCasillasService';
import BoxRowCasilla from './BoxRowCasilla';
import styles from './FiscalEjercicioPage.module.css';

export interface EjercicioBoxSectionProps {
  section: BoxSection;
  defaultCollapsed?: boolean;
  /** Slot opcional · si se pasa, se renderiza ANTES de las rows del helper
   *  (caso · cards de inmuebles en sección B). */
  children?: React.ReactNode;
}

function fmtTotalEuros(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  return `${sign}${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)} €`;
}

const EjercicioBoxSection: React.FC<EjercicioBoxSectionProps> = ({
  section,
  defaultCollapsed = false,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const totalClass = (() => {
    if (section.total === null) return styles.boxSectionTotalEmpty;
    if (section.total < 0) return styles.negResult;
    return '';
  })();

  return (
    <section
      className={`${styles.boxSection} ${collapsed ? styles.collapsed : ''}`}
      aria-labelledby={`section-${section.letter}-title`}
    >
      <button
        type="button"
        className={styles.boxSectionHd}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-controls={`section-${section.letter}-body`}
      >
        <div className={styles.boxSectionLetter}>{section.letter}</div>
        <div className={styles.boxSectionTitle} id={`section-${section.letter}-title`}>
          {section.title}
        </div>
        <div className={`${styles.boxSectionTotal} ${totalClass}`}>
          {section.empty && section.total === null
            ? (section.emptyText ?? 'sin datos')
            : fmtTotalEuros(section.total)}
        </div>
        <span className={styles.boxSectionChevron}>▼</span>
      </button>
      <div className={styles.boxSectionBd} id={`section-${section.letter}-body`}>
        {section.empty && section.rows.length === 0 ? (
          <div className={styles.boxRow}>
            <div className={styles.boxRowNum}>—</div>
            <div className={styles.boxRowConcept} style={{ color: 'var(--atlas-v5-ink-3)' }}>
              {section.emptyText ?? 'Sin datos en esta sección'}
            </div>
            <div className={`${styles.boxRowAmount} ${styles.muted}`}>0,00 €</div>
          </div>
        ) : (
          <>
            {children}
            {section.rows.map((row) => (
              <BoxRowCasilla key={`${section.letter}-${row.num}`} row={row} />
            ))}
          </>
        )}
      </div>
    </section>
  );
};

export default EjercicioBoxSection;
