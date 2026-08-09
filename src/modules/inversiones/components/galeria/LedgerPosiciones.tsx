// INVERSIONES V1 · Fase 2 · GALERÍA · tabla de posiciones (ledger).
//
// Filas compactas · cabeceras ordenables (Posición · Desde · Peso · Valor) ·
// filtros por familia (Todas / Planes / Renta fija / Equity). "Cómo va" muestra
// SOLO el dato (rentabilidad % para planes/equity · renta €/año|mes para renta
// fija) · sin texto de opinión (spec §2.3). La tabla NO hace scroll: se PAGINA
// (tamaño de página = altura disponible ÷ altura de fila) · la página tampoco.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icons } from '../../../../design-system/v5';
import type { CartaItem } from '../../types/cartaItem';
import {
  formatCurrency,
  formatRentPctOrDash,
  getCategoriaGaleria,
  getTipoTagLabel,
  type CategoriaGaleria,
} from '../../helpers';
import styles from './galeriaV5.module.css';

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

  // ── Paginación (Jose ODIA el scroll): la tabla NUNCA scrollea · se pagina.
  // El tamaño de página se calcula desde la altura disponible del cuerpo del
  // ledger (÷ altura de fila) para que quepa exacto. El footer se renderiza
  // SIEMPRE (altura constante) para no crear un bucle de re-medición al
  // aparecer/desaparecer el pager. ─────────────────────────────────────────
  const ROW_H = 46; // .lrow height (galeriaV5.module.css)
  const rowsRef = useRef<HTMLDivElement>(null);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [page, setPage] = useState(0);

  useLayoutEffect(() => {
    const el = rowsRef.current;
    if (!el) return;
    const recompute = () => {
      // clientHeight de `.ledgerRows` es flex:1 · depende del layout (lcard −
      // head − footer), NO del nº de filas renderizadas → medición estable.
      const h = el.clientHeight;
      if (h <= 0) return;
      const n = Math.max(1, Math.floor(h / ROW_H));
      setRowsPerPage((prev) => (prev !== n ? n : prev));
    };
    recompute();
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    };
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(el);
    } else {
      window.addEventListener('resize', onResize);
    }
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
    };
  }, []);

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

  // Al cambiar de filtro se vuelve a la primera página.
  useEffect(() => {
    setPage(0);
  }, [filtro]);

  const totalPages = Math.max(1, Math.ceil(visibles.length / rowsPerPage));
  const safePage = Math.min(page, totalPages - 1);
  // Si la página actual quedó fuera de rango (cambió el filtro / el tamaño), se
  // corrige el estado (safePage ya se usa para pintar, esto solo sincroniza).
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);
  const pageItems = visibles.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage);

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

        <div className={styles.ledgerRows} ref={rowsRef}>
          {visibles.length === 0 && (
            <div className={styles.ledgerEmpty} role="status">
              Sin posiciones en esta categoría
            </div>
          )}
          {pageItems.map((item) => {
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

        {/* Footer SIEMPRE presente (altura constante · sin bucle de medición):
            recuento a la izquierda · pager a la derecha solo si hay >1 página. */}
        <div className={styles.ledgerFoot}>
          <span className={styles.ledgerFootInfo}>
            {visibles.length} {visibles.length === 1 ? 'posición' : 'posiciones'}
          </span>
          {totalPages > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.pagerBtn}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Página anterior"
              >
                <Icons.ChevronLeft size={15} strokeWidth={2} />
              </button>
              <span className={styles.pagerInfo}>
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                className={styles.pagerBtn}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                aria-label="Página siguiente"
              >
                <Icons.ChevronRight size={15} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LedgerPosiciones;
