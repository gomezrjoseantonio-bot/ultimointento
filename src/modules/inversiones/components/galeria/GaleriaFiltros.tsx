// Filtros galería · pills horizontales por categoría + ordenación
// Mockup vinculante · docs/specs/atlas-inversiones-v3 (2).html líneas 921-933
// Spec · TAREA-CC-T-INVERSIONES-V5 §5.1
//
// 5 pills · Todas · Planes pensiones · Equity/fondos · Renta fija · Otros
// Cada pill muestra el conteo de items de su categoría.
// Pill activo · navy + texto blanco. Resto · card + ink-3.
// Botón "Ordenar · valor ↓" al pie derecho (placeholder para PR3+).

import React from 'react';
import { Icons } from '../../../../design-system/v5';
import type { CategoriaGaleria } from '../../helpers';
import styles from '../../InversionesGaleria.module.css';

export type FiltroCategoria = 'todas' | CategoriaGaleria;

export interface GaleriaFiltrosProps {
  /** Filtro activo. */
  selected: FiltroCategoria;
  /** Llamado al pulsar una pill. */
  onSelect: (f: FiltroCategoria) => void;
  /** Conteo por categoría · alimenta el `<span class="num">`. */
  counts: Record<CategoriaGaleria, number>;
  /**
   * Modo de orden actual · solo para mostrar el label del botón.
   * El cambio de orden cae fuera del alcance del PR 2 (placeholder).
   */
  ordenLabel?: string;
  /** Llamado al pulsar el botón de orden · toast por ahora. */
  onSortClick?: () => void;
}

interface Pill {
  key: FiltroCategoria;
  label: string;
  /** Función que extrae el conteo desde `counts` · `todas` suma todo. */
  getCount: (counts: Record<CategoriaGaleria, number>) => number;
}

const PILLS: Pill[] = [
  {
    key: 'todas',
    label: 'Todas',
    getCount: (c) => c.planes + c.equity + c.rentaFija + c.otros,
  },
  { key: 'planes', label: 'Planes pensiones', getCount: (c) => c.planes },
  { key: 'equity', label: 'Equity / fondos', getCount: (c) => c.equity },
  { key: 'rentaFija', label: 'Renta fija', getCount: (c) => c.rentaFija },
  { key: 'otros', label: 'Otros', getCount: (c) => c.otros },
];

const GaleriaFiltros: React.FC<GaleriaFiltrosProps> = ({
  selected,
  onSelect,
  counts,
  ordenLabel = 'valor ↓',
  onSortClick,
}) => (
  <div className={styles.filtersBar} role="toolbar" aria-label="Filtros de galería">
    {PILLS.map((p) => {
      const isActive = selected === p.key;
      const count = p.getCount(counts);
      const cls = `${styles.filterPill}${isActive ? ' ' + styles.active : ''}`;
      return (
        <button
          key={p.key}
          type="button"
          className={cls}
          onClick={() => onSelect(p.key)}
          aria-pressed={isActive}
          data-filter-key={p.key}
        >
          {p.label}{' '}
          <span className={styles.filterPillNum}>{count}</span>
        </button>
      );
    })}
    <div className={styles.filtersBarSpacer} />
    <button
      type="button"
      className={styles.filterPill}
      onClick={onSortClick}
      data-filter-action="sort"
    >
      <Icons.Filter size={12} strokeWidth={2} />
      Ordenar · {ordenLabel}
    </button>
  </div>
);

export default GaleriaFiltros;
