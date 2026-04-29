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
import type { Movement, ReconciliationStatus } from '../../../services/db';
import styles from './MovimientosTab.module.css';

type StatusFilter = 'todos' | 'pendientes' | 'conciliados';

const isReconciled = (m: Movement): boolean =>
  m.estado_conciliacion === 'conciliado' ||
  m.unifiedStatus === 'conciliado' ||
  m.status === 'conciliado';

const matchesStatus = (m: Movement, filter: StatusFilter): boolean => {
  if (filter === 'todos') return true;
  if (filter === 'conciliados') return isReconciled(m);
  return !isReconciled(m);
};

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

const matchesAccount = (m: Movement, accountId: number | null): boolean =>
  accountId == null || m.accountId === accountId;

const MovimientosTab: React.FC = () => {
  const { accounts, movements } = useOutletContext<TesoreriaContext>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
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

  const filtered = useMemo(() => {
    return movements
      .filter((m) => matchesStatus(m, statusFilter))
      .filter((m) => matchesAccount(m, accountFilter))
      .filter((m) => matchesSearch(m, search))
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });
  }, [movements, statusFilter, accountFilter, search]);

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

  return (
    <>
      <div className={styles.filtersBar}>
        <button
          type="button"
          className={`${styles.filtChip} ${statusFilter === 'todos' ? styles.active : ''}`}
          onClick={() => setStatusFilter('todos')}
        >
          Todos · {movements.length}
        </button>
        <button
          type="button"
          className={`${styles.filtChip} ${statusFilter === 'pendientes' ? styles.active : ''}`}
          onClick={() => setStatusFilter('pendientes')}
        >
          Pendientes
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
              {filtered
                .slice(0, 200)
                .filter((m): m is Movement & { id: number } => m.id != null)
                .map((m) => {
                const id = m.id;
                const isSelected = selected.has(id);
                const reconciled = isReconciled(m);
                const accountName = accountById.get(m.accountId) ?? `#${m.accountId}`;
                const dotColor = accountColorById.get(m.accountId) ?? 'var(--atlas-v5-brand)';
                const reconciliationStatus: ReconciliationStatus =
                  m.estado_conciliacion ?? (reconciled ? 'conciliado' : 'sin_conciliar');
                return (
                  <tr
                    key={id}
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
              })}
            </tbody>
          </table>
        )}
      </div>
      {filtered.length > 200 && (
        <div style={{
          padding: '12px 16px',
          fontSize: 12,
          color: 'var(--atlas-v5-ink-4)',
          fontFamily: 'var(--atlas-v5-font-ui)',
        }}>
          Mostrando los 200 movimientos más recientes de {filtered.length} totales.
          Usa los filtros para acotar.
        </div>
      )}
    </>
  );
};

export default MovimientosTab;
