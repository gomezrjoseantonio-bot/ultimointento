// Sección "Posiciones cerradas" al pie de la galería
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html líneas 1191-1217
// Spec · TAREA-CC-T-INVERSIONES-V5 §5.4
//
// Sustituye al bloque "Histórico fiscal" de la galería v4. Mantiene la
// misma estructura visual (card con icono · título · contador · sub ·
// total + arrow) pero con el copy nuevo · «activos que ya has vendido o
// liquidado». Click navega a /inversiones/cerradas.

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { KpisCerradas } from '../../adapters/posicionesCerradas';
import { formatCurrency, formatDelta, signClass } from '../../helpers';
import styles from '../../InversionesGaleria.module.css';

export interface PosicionesCerradasSectionProps {
  kpis: KpisCerradas;
  onClick: () => void;
}

const PosicionesCerradasSection: React.FC<PosicionesCerradasSectionProps> = ({
  kpis,
  onClick,
}) => {
  if (kpis.count === 0) return null;

  const neto = kpis.resultadoNeto;
  const importeStr =
    Math.abs(neto) < 0.005 ? formatCurrency(0) : formatDelta(neto);
  const labelTotal =
    neto >= 0 ? 'ganancia neta declarada' : 'pérdida neta declarada';

  return (
    <>
      <div className={styles.galleryHd} style={{ marginTop: 18 }}>
        <div className={styles.galleryTitle}>Posiciones cerradas</div>
        <div className={styles.galleryCount}>
          activos que ya has vendido o liquidado
        </div>
      </div>

      <button
        type="button"
        className={styles.cerradasSec}
        onClick={onClick}
        aria-label="Ver posiciones cerradas"
      >
        <div className={styles.cerradasSecLeft}>
          <div className={styles.cerradasIcon}>
            <Icons.Fondos size={18} strokeWidth={1.7} />
          </div>
          <div className={styles.cerradasTextos}>
            <div className={styles.cerradasTitleRow}>
              <span className={styles.cerradasTitle}>Posiciones cerradas</span>
              <span className={styles.cerradasCount}>
                {kpis.count}{' '}
                {kpis.count === 1 ? 'operación' : 'operaciones'}
              </span>
            </div>
            <div className={styles.cerradasSub}>
              importadas desde declaraciones IRPF · ganancia/pérdida patrimonial
              declarada
              {kpis.rangoAnios ? ` · ${kpis.rangoAnios}` : ''}
            </div>
          </div>
        </div>
        <div className={styles.cerradasRight}>
          <div className={styles.cerradasTotal}>
            <span
              className={`${styles.cerradasTotalVal} ${styles[signClass(neto)] ?? ''}`}
            >
              {importeStr}
            </span>
            <span className={styles.cerradasTotalLab}>{labelTotal}</span>
          </div>
          <span className={styles.cerradasArrow} aria-hidden>
            <Icons.ChevronRight size={16} strokeWidth={2} />
          </span>
        </div>
      </button>
    </>
  );
};

export default PosicionesCerradasSection;
