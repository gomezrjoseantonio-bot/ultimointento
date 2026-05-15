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

  const variantClass = (() => {
    switch (section.letterVariant) {
      case 'gold': return styles.boxSectionLetterGold;
      case 'warn': return styles.boxSectionLetterWarn;
      case 'neg': return styles.boxSectionLetterNeg;
      case 'pos': return styles.boxSectionLetterPos;
      case 'navy':
      default:
        return '';
    }
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
        <div className={`${styles.boxSectionLetter} ${variantClass}`}>{section.letter}</div>
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
        {/* children siempre se renderizan · permite slots custom (cards de
            inmuebles · cards de venta · placeholder ilustración custom) sin
            depender de que la sección tenga rows del helper. */}
        {children}
        {section.rows.map((row) => (
          <BoxRowCasilla key={`${section.letter}-${row.num}`} row={row} />
        ))}
        {section.empty && section.rows.length === 0 && !children && (
          <div className={styles.boxRow}>
            <div className={styles.boxRowNum}>—</div>
            <div className={`${styles.boxRowConcept} ${styles.boxRowConceptMuted}`}>
              {section.emptyText ?? 'Sin datos en esta sección'}
            </div>
            <div className={`${styles.boxRowAmount} ${styles.muted}`}>0,00 €</div>
          </div>
        )}
      </div>
    </section>
  );
};

export default EjercicioBoxSection;
