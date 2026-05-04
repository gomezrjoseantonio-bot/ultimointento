import React, { useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  DateLabel,
  MoneyValue,
  Pill,
  Icons,
  showToastV5,
} from '../../../design-system/v5';
import type { TesoreriaContext } from '../TesoreriaPage';
import type { Movement, ReconciliationStatus, TreasuryEvent } from '../../../services/db';
import {
  confirmTreasuryEvent,
  updateTreasuryEventFields,
} from '../../../services/treasuryConfirmationService';
import { invalidateCachedStores } from '../../../services/indexedDbCacheService';
import MovimientoDrawer, {
  type MovimientoDrawerData,
  type MovimientoDrawerPatch,
} from '../../../components/treasury/MovimientoDrawer';
import styles from './MovimientosTab.module.css';

type StatusFilter = 'todos' | 'pendientes' | 'conciliados';

const isReconciled = (m: Movement): boolean =>
  m.estado_conciliacion === 'conciliado' ||
  m.unifiedStatus === 'conciliado' ||
  m.status === 'conciliado';

const matchesSearch = (m: Movement, search: string): boolean => {
  if (!search) return true;
  const s = search.toLowerCase();
  return (
    (m.description ?? '').toLowerCase().includes(s) ||
    (m.counterparty ?? '').toLowerCase().includes(s) ||
    (m.providerName ?? '').toLowerCase().includes(s) ||
    String(m.amount).includes(s)
  );
};

const matchesSearchEvent = (e: TreasuryEvent, search: string): boolean => {
  if (!search) return true;
  const s = search.toLowerCase();
  return (
    (e.description ?? '').toLowerCase().includes(s) ||
    (e.counterparty ?? '').toLowerCase().includes(s) ||
    (e.providerName ?? '').toLowerCase().includes(s) ||
    String(Math.abs(e.amount)).includes(s)
  );
};

const matchesAccount = (accountId: number | undefined, filter: number | null): boolean =>
  filter == null || accountId === filter;

/** Returns signed amount for a treasury event (positive = income, negative = expense/financing). */
const eventSignedAmount = (e: TreasuryEvent): number => {
  const mag = Math.abs(e.actualAmount ?? e.amount);
  return e.type === 'income' ? mag : -mag;
};

/** Returns the "YYYY-MM" key for a date string (ISO or YYYY-MM-DD). */
const toYearMonth = (iso: string | undefined): string => {
  if (!iso) return '';
  return iso.slice(0, 7);
};

/** Returns the date label for the group header row (e.g. "12 may. 2025"). */
const toDateKey = (iso: string | undefined): string => {
  if (!iso) return '';
  return iso.slice(0, 10);
};

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const formatDateGroupLabel = (dateKey: string): string => {
  if (!dateKey) return '—';
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = d.toLocaleDateString('es-ES', { month: 'short' });
  const yyyy = d.getFullYear();
  return `${dd} ${mmm} ${yyyy}`;
};

// ── Unified row types ────────────────────────────────────────────────────────

type MovRow = { kind: 'movement'; data: Movement & { id: number }; sortKey: number };
type EvtRow = { kind: 'treasury'; data: TreasuryEvent & { id: number }; sortKey: number };
type UnifiedRow = MovRow | EvtRow;

// ── Date group header row ────────────────────────────────────────────────────
type DateHeaderRow = { kind: 'header'; dateKey: string; label: string };
type TableRow = DateHeaderRow | UnifiedRow;

const MovimientosTab: React.FC = () => {
  const { accounts, movements, treasuryEvents, reload } = useOutletContext<TesoreriaContext>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>(''); // 'YYYY-MM' or ''
  const [drawerEventId, setDrawerEventId] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const accountFilter: number | null = (() => {
    const raw = searchParams.get('cuenta');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  })();

  const setAccountFilter = (next: number | null) => {
    const params = new URLSearchParams(searchParams);
    if (next == null) params.delete('cuenta');
    else params.set('cuenta', String(next));
    setSearchParams(params, { replace: true });
  };

  const [selected, setSelected] = useState<Set<number>>(new Set());

  // ── Build unified list ─────────────────────────────────────────────────────

  /** Pending treasury events: not yet executed, no linked movement. */
  const pendingEvents = useMemo(
    () =>
      (treasuryEvents as TreasuryEvent[]).filter(
        (e): e is TreasuryEvent & { id: number } =>
          e.id != null && e.status !== 'executed' && !e.executedMovementId,
      ),
    [treasuryEvents],
  );

  const allRows = useMemo((): UnifiedRow[] => {
    const movRows: MovRow[] = (movements as Movement[])
      .filter((m): m is Movement & { id: number } => m.id != null)
      .map((m) => ({
        kind: 'movement',
        data: m,
        sortKey: m.date ? new Date(m.date).getTime() : 0,
      }));

    const evtRows: EvtRow[] = pendingEvents.map((e) => ({
      kind: 'treasury',
      data: e,
      sortKey: e.predictedDate ? new Date(e.predictedDate).getTime() : 0,
    }));

    return [...movRows, ...evtRows].sort((a, b) => b.sortKey - a.sortKey);
  }, [movements, pendingEvents]);

  const filtered = useMemo((): UnifiedRow[] => {
    return allRows
      .filter((row) => {
        if (statusFilter === 'conciliados') return row.kind === 'movement' && isReconciled(row.data);
        if (statusFilter === 'pendientes') {
          if (row.kind === 'treasury') return true;
          return !isReconciled(row.data);
        }
        return true; // 'todos'
      })
      .filter((row) => matchesAccount(row.data.accountId, accountFilter))
      .filter((row) => {
        if (!monthFilter) return true;
        const dateStr =
          row.kind === 'movement'
            ? (row.data as Movement).date
            : (row.data as TreasuryEvent).predictedDate;
        return toYearMonth(dateStr) === monthFilter;
      })
      .filter((row) => {
        if (row.kind === 'movement') return matchesSearch(row.data, search);
        return matchesSearchEvent(row.data, search);
      });
  }, [allRows, statusFilter, accountFilter, monthFilter, search]);

  /** Rows with date-group headers injected (for treasury events only). */
  const tableRows = useMemo((): TableRow[] => {
    const result: TableRow[] = [];
    let lastDateKey = '';
    for (const row of filtered) {
      const dateStr =
        row.kind === 'treasury'
          ? (row.data as TreasuryEvent).predictedDate
          : (row.data as Movement).date;
      const dk = toDateKey(dateStr);
      if (dk && dk !== lastDateKey) {
        result.push({ kind: 'header', dateKey: dk, label: formatDateGroupLabel(dk) });
        lastDateKey = dk;
      }
      result.push(row);
    }
    return result;
  }, [filtered]);

  const totalCount = allRows.length;
  const pendingCount =
    movements.filter((m) => !isReconciled(m as Movement)).length + pendingEvents.length;

  /** Available months derived from allRows, for the month filter selector. */
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    allRows.forEach((row) => {
      const dateStr =
        row.kind === 'movement'
          ? (row.data as Movement).date
          : (row.data as TreasuryEvent).predictedDate;
      const ym = toYearMonth(dateStr);
      if (ym) monthSet.add(ym);
    });
    return Array.from(monthSet).sort().reverse();
  }, [allRows]);

  // ── Account helpers ────────────────────────────────────────────────────────

  const accountById = useMemo(() => {
    const map = new Map<number, string>();
    accounts.forEach((a) => {
      if (a.id != null) {
        map.set(a.id, a.alias ?? a.banco?.name ?? a.bank ?? `#${a.id}`);
      }
    });
    return map;
  }, [accounts]);

  const accountColorById = useMemo(() => {
    const map = new Map<number, string>();
    accounts.forEach((a) => {
      if (a.id == null) return;
      const brand = a.banco?.brand?.color;
      map.set(a.id, brand && brand.startsWith('#') ? brand : 'var(--atlas-v5-brand)');
    });
    return map;
  }, [accounts]);

  // ── Drawer data for editing a treasury event ───────────────────────────────

  const drawerData = useMemo((): MovimientoDrawerData | null => {
    if (drawerEventId == null) return null;
    const ev = (treasuryEvents as TreasuryEvent[]).find((e) => e.id === drawerEventId);
    if (!ev) return null;
    const acc = accounts.find((a) => a.id === ev.accountId);
    const accountAlias = acc?.alias ?? acc?.banco?.name ?? acc?.name;
    return {
      id: ev.id!,
      description: ev.description,
      predictedDate: ev.predictedDate,
      type: ev.type,
      amount: ev.amount,
      status: ev.status,
      accountAlias,
      inmuebleAlias: (ev as any).inmuebleAlias,
      contratoAlias: (ev as any).contratoAlias,
      categoryLabel: ev.categoryLabel,
    };
  }, [drawerEventId, treasuryEvents, accounts]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const bulkConfirm = () => {
    showToastV5(`${selected.size} movimientos marcados como conciliados`, 'success');
    clearSelection();
  };

  const handleConfirmEvent = async (e: React.MouseEvent, eventId: number) => {
    e.stopPropagation();
    setConfirmingId(eventId);
    try {
      await confirmTreasuryEvent(eventId);
      showToastV5('Evento confirmado y movimiento creado', 'success');
      invalidateCachedStores(['treasuryEvents', 'movements']);
      reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo confirmar el evento';
      showToastV5(msg, 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleSaveEvent = async (id: number | string, patch: MovimientoDrawerPatch) => {
    const dbId = typeof id === 'number' ? id : Number(id);
    if (!Number.isFinite(dbId)) return;
    try {
      await updateTreasuryEventFields(dbId, patch);
      invalidateCachedStores(['treasuryEvents']);
      reload();
      setDrawerEventId(null);
      showToastV5('Cambios guardados', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar';
      showToastV5(msg, 'error');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className={styles.filtersBar}>
        <button
          type="button"
          className={`${styles.filtChip} ${statusFilter === 'todos' ? styles.active : ''}`}
          onClick={() => setStatusFilter('todos')}
        >
          Todos · {totalCount}
        </button>
        <button
          type="button"
          className={`${styles.filtChip} ${statusFilter === 'pendientes' ? styles.active : ''}`}
          onClick={() => setStatusFilter('pendientes')}
        >
          Pendientes · {pendingCount}
        </button>
        <button
          type="button"
          className={`${styles.filtChip} ${statusFilter === 'conciliados' ? styles.active : ''}`}
          onClick={() => setStatusFilter('conciliados')}
        >
          Conciliados
        </button>
        <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--atlas-v5-line)', margin: '0 4px' }} />
        <button
          type="button"
          className={`${styles.filtChip} ${accountFilter == null ? styles.active : ''}`}
          onClick={() => setAccountFilter(null)}
        >
          Todas las cuentas
        </button>
        {accounts.slice(0, 6).map((a) => (
          <button
            key={a.id}
            type="button"
            className={`${styles.filtChip} ${accountFilter === a.id ? styles.active : ''}`}
            onClick={() => setAccountFilter(a.id ?? null)}
          >
            {a.alias ?? a.banco?.name ?? a.bank ?? `#${a.id}`}
          </button>
        ))}
        <span className={styles.filtSearch}>
          <Icons.Search size={14} strokeWidth={1.8} />
          <input
            type="search"
            placeholder="Buscar por concepto · contraparte · importe…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar movimientos"
          />
        </span>
      </div>

      {/* ── Month filter bar ───────────────────────────────────────────────── */}
      {availableMonths.length > 0 && (
        <div className={styles.monthFilterBar} role="group" aria-label="Filtrar por mes">
          <span className={styles.monthFilterLabel}>Mes:</span>
          <button
            type="button"
            className={`${styles.filtChip} ${monthFilter === '' ? styles.active : ''}`}
            onClick={() => setMonthFilter('')}
          >
            Todos
          </button>
          {availableMonths.map((ym) => {
            const [year, month] = ym.split('-');
            const label = `${MONTH_NAMES_ES[Number(month) - 1]} ${year}`;
            return (
              <button
                key={ym}
                type="button"
                className={`${styles.filtChip} ${monthFilter === ym ? styles.active : ''}`}
                onClick={() => setMonthFilter(monthFilter === ym ? '' : ym)}
              >
                {label}
              </button>
            );
          })}
          {monthFilter && (
            <button
              type="button"
              className={styles.filtChipClear}
              onClick={() => setMonthFilter('')}
              aria-label="Limpiar filtro de mes"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className={styles.bulkBar} role="status" aria-live="polite">
          <div className={styles.bulkCount}>
            <span className={styles.num}>{selected.size}</span>
            seleccionados
          </div>
          <div className={styles.bulkActions}>
            <button type="button" onClick={clearSelection}>
              Limpiar
            </button>
            <button type="button" className={styles.primary} onClick={bulkConfirm}>
              Marcar como conciliados
            </button>
          </div>
        </div>
      )}

      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            No hay movimientos que coincidan con los filtros aplicados.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkCell} aria-label="Seleccionar"></th>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Cuenta</th>
                <th className="r">Importe</th>
                <th className="c">Estado</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(0, 250).map((row) => {
                // ── Date group header ─────────────────────────────────────
                if (row.kind === 'header') {
                  return (
                    <tr key={`h:${row.dateKey}`} className={styles.dateGroupRow}>
                      <td colSpan={6} className={styles.dateGroupCell}>
                        {row.label}
                      </td>
                    </tr>
                  );
                }

                if (row.kind === 'movement') {
                  const m = row.data;
                  const id = m.id;
                  const isSelected = selected.has(id);
                  const reconciled = isReconciled(m);
                  const accountName = accountById.get(m.accountId) ?? `#${m.accountId}`;
                  const dotColor = accountColorById.get(m.accountId) ?? 'var(--atlas-v5-brand)';
                  const reconciliationStatus: ReconciliationStatus =
                    m.estado_conciliacion ?? (reconciled ? 'conciliado' : 'sin_conciliar');
                  const inmuebleAlias = (m as any).inmuebleAlias as string | undefined;
                  return (
                    <tr
                      key={`m:${id}`}
                      className={isSelected ? styles.selected : undefined}
                      onClick={() =>
                        showToastV5(
                          `Detalle · ${m.description ?? 'Movimiento'} · ${m.amount.toFixed(2)} €`,
                        )
                      }
                    >
                      <td className={styles.checkCell} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`${styles.chk} ${reconciled ? styles.done : isSelected ? styles.pending : ''}`}
                          aria-label={reconciled ? 'Movimiento conciliado' : 'Seleccionar movimiento'}
                          aria-pressed={isSelected || reconciled}
                          onClick={() => !reconciled && toggleOne(id)}
                        >
                          {reconciled && <Icons.Check size={14} strokeWidth={2.5} />}
                        </button>
                      </td>
                      <td className={styles.dateCell}>
                        {m.date ? <DateLabel value={m.date} format="short" /> : '—'}
                      </td>
                      <td>
                        <div className={styles.tStrong}>
                          {m.description || m.counterparty || m.providerName || 'Sin concepto'}
                        </div>
                        {(m.counterparty || m.providerName) && (
                          <div className={styles.tMuted} style={{ fontSize: 11, marginTop: 2 }}>
                            {m.counterparty ?? m.providerName}
                          </div>
                        )}
                        {inmuebleAlias ? (
                          <div className={styles.tInmueble}>
                            {inmuebleAlias}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span className={styles.chipAcc}>
                          <span className={styles.chipDot} style={{ background: dotColor }} />
                          {accountName}
                        </span>
                      </td>
                      <td className={`r ${styles.amountCell} ${m.amount >= 0 ? styles.posCol : styles.negCol}`}>
                        <MoneyValue value={m.amount} decimals={2} showSign tone="auto" />
                      </td>
                      <td className="c">
                        <Pill
                          variant={reconciliationStatus === 'conciliado' ? 'pos' : 'gold'}
                          asTag
                        >
                          {reconciliationStatus === 'conciliado' ? 'Conciliado' : 'Pendiente'}
                        </Pill>
                      </td>
                    </tr>
                  );
                }

                // ── Treasury event row ──────────────────────────────────────
                const e = row.data;
                const signedAmt = eventSignedAmount(e);
                const accountName = e.accountId != null
                  ? (accountById.get(e.accountId) ?? `#${e.accountId}`)
                  : '—';
                const dotColor = e.accountId != null
                  ? (accountColorById.get(e.accountId) ?? 'var(--atlas-v5-brand)')
                  : 'var(--atlas-v5-ink-5)';
                const isConfirming = confirmingId === e.id;
                const evInmuebleAlias = (e as any).inmuebleAlias as string | undefined;
                return (
                  <tr
                    key={`t:${e.id}`}
                    className={styles.previstoRow}
                    onClick={() => setDrawerEventId(e.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className={styles.checkCell} onClick={(ev) => ev.stopPropagation()}>
                      <button
                        type="button"
                        className={`${styles.chk} ${styles.previstoChk}`}
                        aria-label={isConfirming ? 'Confirmando…' : e.accountId == null ? 'Sin cuenta asignada — edita el evento para asignar una cuenta' : 'Confirmar evento previsto'}
                        title={e.accountId == null ? 'Asigna una cuenta al evento para poder confirmarlo' : 'Confirmar y crear movimiento bancario'}
                        disabled={isConfirming || e.accountId == null}
                        onClick={(ev) => handleConfirmEvent(ev, e.id)}
                      >
                        {isConfirming
                          ? <Icons.Refresh size={12} strokeWidth={2} className={styles.spinning} />
                          : <Icons.Check size={12} strokeWidth={2} />
                        }
                      </button>
                    </td>
                    <td className={styles.dateCell}>
                      {e.predictedDate
                        ? <DateLabel value={e.predictedDate} format="short" />
                        : '—'}
                    </td>
                    <td>
                      <div className={styles.tStrong}>{e.description || 'Sin concepto'}</div>
                      {(e.counterparty || e.providerName) && (
                        <div className={styles.tMuted} style={{ fontSize: 11, marginTop: 2 }}>
                          {e.counterparty ?? e.providerName}
                        </div>
                      )}
                      {evInmuebleAlias ? (
                        <div className={styles.tInmueble}>
                          {evInmuebleAlias}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className={styles.chipAcc}>
                        <span className={styles.chipDot} style={{ background: dotColor }} />
                        {accountName}
                      </span>
                    </td>
                    <td className={`r ${styles.amountCell} ${signedAmt >= 0 ? styles.posCol : styles.negCol}`}>
                      <MoneyValue value={signedAmt} decimals={2} showSign tone="auto" />
                    </td>
                    <td className="c">
                      <span className={styles.pillPrevisto}>PREVISTO</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {filtered.length > 250 && (
        <div style={{
          padding: '12px 16px',
          fontSize: 12,
          color: 'var(--atlas-v5-ink-4)',
          fontFamily: 'var(--atlas-v5-font-ui)',
        }}>
          Mostrando los 250 movimientos más recientes de {filtered.length} totales.
          Usa los filtros para acotar.
        </div>
      )}

      {/* ── Editing drawer ──────────────────────────────────────────────────── */}
      <MovimientoDrawer
        open={drawerEventId !== null}
        data={drawerData}
        onClose={() => setDrawerEventId(null)}
        accounts={accounts}
        onSave={handleSaveEvent}
        onConfirmar={async (id) => {
          const dbId = typeof id === 'number' ? id : Number(id);
          if (!Number.isFinite(dbId)) return;
          setConfirmingId(dbId);
          try {
            await confirmTreasuryEvent(dbId);
            invalidateCachedStores(['treasuryEvents', 'movements']);
            reload();
            setDrawerEventId(null);
            showToastV5('Evento confirmado y movimiento creado', 'success');
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'No se pudo confirmar';
            showToastV5(msg, 'error');
          } finally {
            setConfirmingId(null);
          }
        }}
      />
    </>
  );
};

export default MovimientosTab;
