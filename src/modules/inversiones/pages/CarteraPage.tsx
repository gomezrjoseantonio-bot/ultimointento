import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CardV5, Icons, MoneyValue } from '../../../design-system/v5';
import type { InversionesOutletContext } from '../InversionesContext';
import type { PositionRow } from '../types';
import { formatPercent, labelTipo } from '../helpers';
import styles from './CarteraPage.module.css';

const GRUPOS: { tipos: string[]; label: string }[] = [
  { tipos: ['cuenta_remunerada'], label: 'Cuentas remuneradas' },
  { tipos: ['prestamo_p2p', 'deposito_plazo', 'deposito'], label: 'Préstamos y depósitos' },
  { tipos: ['fondo_inversion', 'etf', 'reit', 'accion', 'crypto', 'otro'], label: 'Fondos · acciones · crypto' },
  { tipos: ['plan_pensiones', 'plan_empleo'], label: 'Planes de pensiones' },
];

type SortKey = keyof Pick<PositionRow, 'alias' | 'aportado' | 'valor' | 'rentPct' | 'rentAnual' | 'peso'>;

const CarteraPage: React.FC = () => {
  const navigate = useNavigate();
  const { positions, closedPositions, setSelectedPositionId, onOpenPosicionDetail } =
    useOutletContext<InversionesOutletContext>();

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('alias');
  const [sortAsc, setSortAsc] = useState(true);

  const normalizedQuery = query.trim().toLowerCase();
  const hasActiveFilter = normalizedQuery.length > 0;

  const filtered = useMemo(() => {
    return positions
      .filter(
        (p) =>
          p.alias.toLowerCase().includes(normalizedQuery) ||
          p.broker.toLowerCase().includes(normalizedQuery) ||
          p.tipo.toLowerCase().includes(normalizedQuery),
      )
      .sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === bv) return 0;
        const cmp = av > bv ? 1 : -1;
        return sortAsc ? cmp : -cmp;
      });
  }, [positions, normalizedQuery, sortKey, sortAsc]);

  const groupedSections = useMemo(() => {
    if (hasActiveFilter) return [];
    const coveredTipos = new Set(GRUPOS.flatMap((g) => g.tipos));
    const sections = GRUPOS.map((g) => ({
      label: g.label,
      items: filtered.filter((p) => g.tipos.includes(p.tipo)),
    })).filter((g) => g.items.length > 0);
    const unmatched = filtered.filter((p) => !coveredTipos.has(p.tipo));
    if (unmatched.length > 0) sections.push({ label: 'Otros', items: unmatched });
    return sections;
  }, [filtered, hasActiveFilter]);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else {
      setSortKey(k);
      setSortAsc(true);
    }
  };

  const goToIndividual = (id: string) => {
    setSelectedPositionId(id);
    navigate('/inversiones/individual');
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null;
    return sortAsc ? (
      <Icons.ChevronUp size={12} strokeWidth={1.8} />
    ) : (
      <Icons.ChevronDown size={12} strokeWidth={1.8} />
    );
  };

  const renderCard = (p: PositionRow) => (
    <div
      key={p.id}
      role="button"
      tabIndex={0}
      onClick={() => goToIndividual(p.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') goToIndividual(p.id);
      }}
      className={styles.posCard}
    >
      <span className={styles.colorBar} style={{ background: p.color }} />
      <div className={styles.posCardHd}>
        <div>
          <div className={styles.alias}>{p.alias}</div>
          <div className={styles.meta}>
            {p.broker} · {labelTipo(p.tipo)}
          </div>
        </div>
        {p.tag && (
          <span className={styles.tagPill}>
            <Icons.Retos size={10} strokeWidth={1.8} />
            {p.tag}
          </span>
        )}
      </div>
      <div className={styles.posCardGrid}>
        <div className={styles.posCol}>
          <div className={styles.label}>Valor actual</div>
          <div className={styles.value}>
            <MoneyValue value={p.valor} decimals={0} tone="ink" />
          </div>
          <div className={styles.meta}>
            Aportado · <MoneyValue value={p.aportado} decimals={0} tone="muted" />
          </div>
        </div>
        <div className={`${styles.posCol} ${styles.right}`}>
          <div className={styles.label}>Rentabilidad</div>
          <div
            className={`${styles.value} ${
              p.rentPct > 0 ? styles.valuePos : p.rentPct < 0 ? styles.valueNeg : ''
            }`}
          >
            {formatPercent(p.rentPct)}
          </div>
          <div className={styles.meta}>{p.rentAnual.toFixed(2)}% / año</div>
        </div>
      </div>
      <div className={styles.weightBlock}>
        <div className={styles.weightHeader}>
          <span>Peso portfolio</span>
          <span className={styles.pct}>{p.peso}%</span>
        </div>
        <div className={styles.weightTrack}>
          <div
            className={styles.weightFill}
            style={{ width: `${p.peso}%`, background: p.color }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <CardV5 style={{ padding: 0, overflow: 'hidden' }}>
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Icons.Search size={14} strokeWidth={1.8} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, broker o tipo…"
              aria-label="Buscar posiciones"
            />
          </div>
        </div>

        <div className={styles.count}>{filtered.length} posiciones</div>

        {filtered.length === 0 && (
          <div className={styles.empty}>
            {hasActiveFilter
              ? 'No hay posiciones que coincidan con la búsqueda.'
              : 'Aún no hay posiciones registradas.'}
          </div>
        )}

        {filtered.length > 0 && hasActiveFilter && (
          <div className={styles.cardsGrid}>{filtered.map(renderCard)}</div>
        )}

        {filtered.length > 0 && !hasActiveFilter && (
          <div style={{ padding: '18px 18px 6px' }}>
            {groupedSections.map((g) => (
              <div key={g.label} className={styles.groupSection}>
                <p className={styles.groupLabel}>{g.label}</p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 14,
                  }}
                >
                  {g.items.map(renderCard)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.tableWrap}>
          <div className={styles.tableHd}>Vista tabla</div>
          <table className={styles.table}>
            <thead>
              <tr>
                {(
                  [
                    { key: 'alias', label: 'Posición / Broker', align: 'left' },
                    { key: 'aportado', label: 'Aportado', align: 'right' },
                    { key: 'valor', label: 'Valor actual', align: 'right' },
                    { key: 'rentPct', label: '% Rent. total', align: 'right' },
                    { key: 'rentAnual', label: '% Rent. anual', align: 'right' },
                    { key: 'peso', label: 'Peso %', align: 'right' },
                  ] as { key: SortKey; label: string; align: 'left' | 'right' }[]
                ).map((col) => (
                  <th
                    key={col.key}
                    className={col.align === 'right' ? styles.right : ''}
                    onClick={() => handleSort(col.key)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.label}
                      <SortIcon k={col.key} />
                    </span>
                  </th>
                ))}
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => goToIndividual(p.id)}>
                  <td>
                    <div className={styles.posCellInner}>
                      <span className={styles.posDot} style={{ background: p.color }} />
                      <div>
                        <div className="alias">{p.alias}</div>
                        <div className="meta" style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)' }}>
                          {p.broker} · {labelTipo(p.tipo)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.right}>
                    <MoneyValue value={p.aportado} decimals={0} tone="muted" />
                  </td>
                  <td className={styles.right}>
                    <MoneyValue value={p.valor} decimals={0} tone="ink" />
                  </td>
                  <td className={styles.right}>
                    <span
                      className={`${styles.chip} ${
                        p.rentPct > 5 ? styles.chipPos : p.rentPct > 0 ? styles.chipNeutral : styles.chipNeg
                      }`}
                    >
                      {formatPercent(p.rentPct)}
                    </span>
                  </td>
                  <td
                    className={styles.right}
                    style={{ color: 'var(--atlas-v5-pos)', fontWeight: 600 }}
                  >
                    {p.rentAnual.toFixed(2)}%
                  </td>
                  <td className={styles.right}>{p.peso}%</td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      {p.tipo !== 'plan_pensiones' && (
                        <button
                          type="button"
                          className={styles.iconBtn}
                          aria-label={`Ver historial de ${p.alias}`}
                          title="Ver historial aportaciones"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPosicionDetail(p.id);
                          }}
                        >
                          <Icons.Eye size={14} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardV5>

      {closedPositions.length > 0 && (
        <CardV5 className={styles.closedSection}>
          <div className={styles.closedHeader}>
            <span className={styles.title}>Operaciones declaradas</span>
            <span className={styles.count}>{closedPositions.length}</span>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Operación</th>
                <th>Año</th>
                <th>Tipo</th>
                <th className={styles.right}>Valor transmisión</th>
                <th className={styles.right}>Ganancia / Pérdida</th>
              </tr>
            </thead>
            <tbody>
              {closedPositions.map((p) => {
                const año =
                  p.fecha_valoracion?.slice(0, 4) ?? p.fecha_compra?.slice(0, 4) ?? '—';
                const gp = p.valor_actual - p.total_aportado;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="alias">{p.nombre}</div>
                      {p.entidad && (
                        <div style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)' }}>
                          {p.entidad}
                        </div>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--atlas-v5-font-mono-num)' }}>{año}</td>
                    <td>
                      <span className={styles.tipoPill}>{labelTipo(p.tipo)}</span>
                    </td>
                    <td className={styles.right}>
                      <MoneyValue value={p.valor_actual} decimals={0} tone="ink" />
                    </td>
                    <td
                      className={styles.right}
                      style={{ color: gp >= 0 ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)', fontWeight: 600 }}
                    >
                      <MoneyValue
                        value={gp}
                        decimals={0}
                        showSign
                        tone={gp >= 0 ? 'pos' : 'neg'}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardV5>
      )}
    </>
  );
};

export default CarteraPage;
