// INVERSIONES V1 · Fase 2 · GALERÍA · tabla de posiciones (ledger).
//
// Filas compactas · cabeceras ordenables (Posición · Desde · Peso · Valor) ·
// filtros por familia (Todas / Planes / Renta fija / Equity). "Cómo va" muestra
// SOLO el dato (rentabilidad % para planes/equity · renta €/año|mes para renta
// fija) · sin texto de opinión (spec §2.3). El cuerpo hace scroll interno · la
// página no.

import React, { useMemo, useState } from 'react';
import { Icons } from '../../../../design-system/v5';
import type { CartaItem } from '../../types/cartaItem';
import {
  formatCurrency,
  formatRentPctOrDash,
  getCategoriaGaleria,
  getTipoTagLabel,
  type CategoriaGaleria,
} from '../../helpers';
import styles from '../../InversionesGaleria.module.css';

type FiltroLedger = 'todas' | 'planes' | 'rentaFija' | 'equity';
type SortKey = 'nom' | 'year' | 'peso' | 'valor';
type SortDir = 'asc' | 'desc';

interface Props {
  items: CartaItem[];
  valorTotal: number;
  onRowClick: (item: CartaItem) => void;
  /** Nº de posiciones cerradas · muestra un acceso compacto si > 0. */
  cerradasCount?: number;
  onVerCerradas?: () => void;
}

const FILTROS: Array<{ key: FiltroLedger; label: string }> = [
  { key: 'todas', label: 'Todas' },
  { key: 'planes', label: 'Planes' },
  { key: 'rentaFija', label: 'Renta fija' },
  { key: 'equity', label: 'Equity' },
];

const CAT_LABEL: Record<CategoriaGaleria, string> = {
  planes: 'Planes',
  rentaFija: 'Renta fija',
  equity: 'Equity',
  otros: 'Otros',
};

const CAT_FILL: Record<CategoriaGaleria, string> = {
  planes: styles.pesoFillPlanes,
  rentaFija: styles.pesoFillRf,
  equity: styles.pesoFillEq,
  otros: styles.pesoFillOtros,
};

const yearOf = (iso?: string | null): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
};

/** "Cómo va": renta €/mes|año para renta fija · % para el resto. Solo el dato. */
function comoVa(item: CartaItem): { text: string; renta: boolean } {
  if (getCategoriaGaleria(item.tipo) === 'rentaFija') {
    if (item.cuota_mensual != null && item.cuota_mensual > 0) {
      return { text: `${formatCurrency(item.cuota_mensual)}/mes`, renta: true };
    }
    const anual =
      item.interes_anual ??
      (item.tin != null ? ((item.valor_actual || 0) * item.tin) / 100 : 0);
    if (anual > 0) return { text: `${formatCurrency(anual)}/año`, renta: true };
    return { text: '—', renta: false };
  }
  return { text: formatRentPctOrDash(item.rentabilidad_porcentaje), renta: false };
}

const LedgerPosiciones: React.FC<Props> = ({
  items,
  valorTotal,
  onRowClick,
  cerradasCount = 0,
  onVerCerradas,
}) => {
  const [filtro, setFiltro] = useState<FiltroLedger>('todas');
  const [sortKey, setSortKey] = useState<SortKey>('valor');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const counts = useMemo(() => {
    const c: Record<FiltroLedger, number> = { todas: items.length, planes: 0, rentaFija: 0, equity: 0 };
    for (const it of items) {
      const cat = getCategoriaGaleria(it.tipo);
      if (cat === 'planes') c.planes += 1;
      else if (cat === 'rentaFija') c.rentaFija += 1;
      else if (cat === 'equity') c.equity += 1;
    }
    return c;
  }, [items]);

  const visibles = useMemo(() => {
    const filtrados =
      filtro === 'todas' ? items : items.filter((it) => getCategoriaGaleria(it.tipo) === filtro);
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      switch (sortKey) {
        case 'nom':
          return dir * a.nombre.localeCompare(b.nombre, 'es');
        case 'year':
          return dir * ((yearOf(a.fecha_apertura) ?? 0) - (yearOf(b.fecha_apertura) ?? 0));
        case 'peso':
        case 'valor':
          return dir * ((a.valor_actual || 0) - (b.valor_actual || 0));
        default:
          return 0;
      }
    });
  }, [items, filtro, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'nom' || key === 'year' ? 'asc' : 'desc');
    }
  };

  const sortCls = (key: SortKey): string =>
    sortKey === key ? (sortDir === 'asc' ? styles.sortAsc : styles.sortDesc) : '';

  const currentYear = new Date().getFullYear();

  return (
    <div className={styles.ledger}>
      <div className={styles.ledgerTop}>
        <div className={styles.ledgerTitle}>Posiciones</div>
        <div className={styles.ledgerFilters}>
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`${styles.lf} ${filtro === f.key ? styles.lfActive : ''}`}
              onClick={() => setFiltro(f.key)}
            >
              {f.label} <span className={styles.lfN}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
        {cerradasCount > 0 && onVerCerradas && (
          <button type="button" className={styles.ledgerCerradas} onClick={onVerCerradas}>
            Cerradas <span className={styles.lfN}>{cerradasCount}</span>
            <Icons.ChevronRight size={13} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className={styles.lcard}>
        <div className={`${styles.ledgerHead} ${styles.gridCols}`}>
          <button type="button" className={`${styles.colBtn} ${sortCls('nom')}`} onClick={() => toggleSort('nom')}>
            Posición
          </button>
          <button type="button" className={`${styles.colBtn} ${sortCls('year')}`} onClick={() => toggleSort('year')}>
            Desde
          </button>
          <button type="button" className={`${styles.colBtn} ${sortCls('peso')}`} onClick={() => toggleSort('peso')}>
            Peso en cartera
          </button>
          <button type="button" className={`${styles.colBtn} ${styles.colRight} ${sortCls('valor')}`} onClick={() => toggleSort('valor')}>
            Valor
          </button>
          <span>Cómo va</span>
          <span />
        </div>

        <div className={styles.ledgerRows}>
          {visibles.length === 0 && (
            <div className={styles.ledgerEmpty} role="status">
              Sin posiciones en esta categoría
            </div>
          )}
          {visibles.map((item) => {
            const cat = getCategoriaGaleria(item.tipo);
            const year = yearOf(item.fecha_apertura);
            const años = year != null ? currentYear - year : null;
            const peso = valorTotal > 0 ? ((item.valor_actual || 0) / valorTotal) * 100 : 0;
            const cv = comoVa(item);
            return (
              <button
                type="button"
                key={String(item._idOriginal)}
                className={`${styles.lrow} ${styles.gridCols}`}
                onClick={() => onRowClick(item)}
              >
                <div className={styles.lrowNomCell}>
                  <div className={styles.lrowNom}>{item.nombre}</div>
                  <div className={styles.lrowMeta}>
                    {item.entidad}{' '}
                    <span className={styles.lrowTt}>· {getTipoTagLabel(item.tipo, item.tipoAdministrativo)}</span>
                  </div>
                </div>
                <div className={styles.lrowDesde}>
                  <div className={styles.lrowDesdeY}>{year ?? '—'}</div>
                  {años != null && <div className={styles.lrowDesdeL}>{años} {años === 1 ? 'año' : 'años'}</div>}
                </div>
                <div>
                  <div className={styles.lrowPesoTop}>
                    <span className={styles.lrowPesoFam}>{CAT_LABEL[cat]}</span>
                    <span className={styles.lrowPesoPct}>{peso.toFixed(1)}%</span>
                  </div>
                  <div className={styles.lrowPesoBar}>
                    <div
                      className={`${styles.lrowPesoFill} ${CAT_FILL[cat]}`}
                      style={{ width: `${Math.min(100, peso)}%` }}
                    />
                  </div>
                </div>
                <div className={styles.lrowVal}>{formatCurrency(item.valor_actual || 0)}</div>
                <div className={styles.lrowRend}>
                  <span className={`${styles.lrowRendMain} ${cv.renta ? styles.lrowRendRenta : ''}`}>
                    {cv.text}
                  </span>
                </div>
                <div className={styles.lrowCta}>
                  <Icons.ChevronRight size={16} strokeWidth={2} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LedgerPosiciones;
