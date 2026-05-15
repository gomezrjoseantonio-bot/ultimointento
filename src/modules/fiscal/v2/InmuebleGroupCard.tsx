/**
 * InmuebleGroupCard · card de inmueble dentro de la sección B.
 *
 * Click → navega a F3 `/fiscal/ejercicio/{año}/inmueble/{id}` (sub-tarea 4).
 *
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3 §5.2 / §5.6.
 */

import React from 'react';
import type { InmuebleSeccionB } from './helpers/ejercicioCasillasService';
import styles from './FiscalEjercicioPage.module.css';

export interface InmuebleGroupCardProps {
  inmueble: InmuebleSeccionB;
  onSelect: (inmuebleId: number) => void;
}

function fmtEuros(n: number): string {
  if (n === 0) return '0,00 €';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  return `${sign}${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)} €`;
}

const InmuebleGroupCard: React.FC<InmuebleGroupCardProps> = ({ inmueble, onSelect }) => {
  const rendimientoNeg = inmueble.rendimientoNetoReducido < 0;
  return (
    <div className={styles.inmuebleGroup}>
      <button
        type="button"
        className={styles.inmuebleGroupHd}
        onClick={() => onSelect(inmueble.inmuebleId)}
        aria-label={`Abrir detalle fiscal del inmueble ${inmueble.alias}`}
      >
        <div>
          <div className={styles.inmuebleGroupName}>
            {inmueble.alias}
            {inmueble.modoLabel && (
              <span className={`${styles.pill} ${styles.pillCurso} ${styles.pillInline}`}>
                {inmueble.modoLabel}
              </span>
            )}
          </div>
          {inmueble.metaText && (
            <div className={styles.inmuebleGroupMeta}>{inmueble.metaText}</div>
          )}
        </div>
        <div>
          <div className={`${styles.inmuebleGroupAmt} ${rendimientoNeg ? styles.neg : ''}`}>
            {fmtEuros(inmueble.rendimientoNetoReducido)}
          </div>
          <div className={styles.inmuebleGroupAmtSub}>rendimiento neto reducido</div>
        </div>
        <div className={styles.inmuebleGroupLink}>Ver →</div>
      </button>
    </div>
  );
};

export default InmuebleGroupCard;
