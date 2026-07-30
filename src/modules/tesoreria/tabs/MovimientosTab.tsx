// ============================================================================
// MovimientosTab · pantalla D del punteo unificado (Bloque 3 · P2)
// ============================================================================
//
// La SUPERFICIE MADRE del punteo (mockup Registro v2 validado): previsiones y
// movimientos reales en una sola lista canónica (PunteoList) con los estados
// Previsto · Confirmado · Conciliado. Las demás vistas (cuenta · conciliación ·
// drawer del día) son esta misma lista con contexto fijado (fases P3/P4).
//
// Contexto por URL (se conserva el patrón previo):
//   ?status=previstos|confirmados|conciliados|discrepancias   (legacy
//     'pendientes' → previstos)
//   ?cuenta=<accountId> · ?day=YYYY-MM-DD (desde el calendario)
//
// Retirado en P2 (documentado en el PR):
//   · pill «PREVISTO» + chips propios → chips canónicos de PunteoList
//   · columna de selección + barra bulk («conciliar» era un toast sin efecto)
//   · MovimientoDrawer en este tab → el punteo con cambios lo cubre el editor
//     inline · la edición completa de una previsión vive en su origen
// ============================================================================

import React, { useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../design-system/v5';
import type { TesoreriaContext } from '../TesoreriaPage';
import type { Movement, TreasuryEvent } from '../../../services/db';
import {
  confirmTreasuryEvent,
  deleteTreasuryEventCompletely,
} from '../../../services/treasuryConfirmationService';
import { invalidateCachedStores } from '../../../services/indexedDbCacheService';
import AddMovementModal from '../../horizon/conciliacion/v2/components/AddMovementModal';
import PunteoList, {
  type CambiosPunteo,
} from '../../shared/components/Punteo/PunteoList';
import {
  eventoAItem,
  movimientoAItem,
} from '../../../services/punteo/punteoAdapter';
import type { ChipEstado, ItemPunteo } from '../../../services/punteo/punteoModel';
import {
  matchesAmountQuery,
  normalizeSearchText,
} from '../../../utils/tesoreriaSearch';
import styles from './MovimientosTab.module.css';

const MAX_FILAS = 250;

const toYearMonth = (iso: string | undefined): string => (iso ? iso.slice(0, 7) : '');

const CHIPS_VALIDOS: ChipEstado[] = ['todos', 'previstos', 'confirmados', 'conciliados', 'discrepancias'];

const matchesSearchItem = (it: ItemPunteo, search: string): boolean => {
  if (!search) return true;
  const q = normalizeSearchText(search);
  const hay = normalizeSearchText(
    `${it.concepto} ${it.origen} ${it.activo?.alias ?? ''}`,
  );
  return hay.includes(q) || matchesAmountQuery(it.importe, search);
};

const MovimientosTab: React.FC = () => {
  const { accounts, movements, treasuryEvents, properties, reload } =
    useOutletContext<TesoreriaContext>();
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(false);
  const [busy, setBusy] = useState(false);

  // ── Contexto por URL ───────────────────────────────────────────────────────

  const chip: ChipEstado = (() => {
    const raw = searchParams.get('status');
    if (raw === 'pendientes') return 'previstos'; // compat con enlaces previos
    return CHIPS_VALIDOS.includes(raw as ChipEstado) ? (raw as ChipEstado) : 'todos';
  })();
  const setChip = (next: ChipEstado) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'todos') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  };

  const dayFilter: string | null = (() => {
    const raw = searchParams.get('day');
    if (!raw) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  })();
  const clearDayFilter = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('day');
    setSearchParams(params, { replace: true });
  };

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

  // Scope temporal por defecto · mes actual (sin él, cargaba ~2000 filas).
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // ── Datos → items canónicos ────────────────────────────────────────────────

  const aliasInmueble = useMemo(() => {
    const m = new Map<string, string>();
    properties.forEach((p) => {
      if (p.id != null) m.set(String(p.id), p.alias);
    });
    return (id: number | string) => m.get(String(id));
  }, [properties]);

  const itemsTodos = useMemo(() => {
    const evItems = (treasuryEvents as TreasuryEvent[])
      .filter(
        (e): e is TreasuryEvent & { id: number } =>
          e.id != null && e.status !== 'executed' && !e.executedMovementId,
      )
      .map((e) => eventoAItem(e, aliasInmueble));
    const movItems = (movements as Movement[])
      .filter((m): m is Movement & { id: number } => m.id != null)
      .map((m) => movimientoAItem(m, aliasInmueble));
    return [...evItems, ...movItems];
  }, [treasuryEvents, movements, aliasInmueble]);

  const itemsFiltrados = useMemo(() => {
    let out = itemsTodos;
    if (monthFilter) out = out.filter((i) => toYearMonth(i.fecha) === monthFilter);
    if (dayFilter) out = out.filter((i) => i.fecha === dayFilter);
    if (accountFilter != null) out = out.filter((i) => i.cuentaId === accountFilter);
    if (search) out = out.filter((i) => matchesSearchItem(i, search));
    return out;
  }, [itemsTodos, monthFilter, dayFilter, accountFilter, search]);

  const items = useMemo(() => {
    if (itemsFiltrados.length <= MAX_FILAS) return itemsFiltrados;
    return itemsFiltrados
      .slice()
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, MAX_FILAS);
  }, [itemsFiltrados]);

  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    itemsTodos.forEach((i) => {
      const ym = toYearMonth(i.fecha);
      if (ym) monthSet.add(ym);
    });
    return Array.from(monthSet).sort().reverse();
  }, [itemsTodos]);

  const cuentas = useMemo(
    () =>
      accounts
        .filter((a) => a.id != null)
        .map((a) => ({
          id: a.id as number,
          label: a.alias ?? a.banco?.name ?? a.bank ?? `#${a.id}`,
        })),
    [accounts],
  );

  // ── Acciones de punteo ─────────────────────────────────────────────────────

  const onConfirmar = async (item: ItemPunteo, cambios?: CambiosPunteo) => {
    if (item.kind !== 'evento' || busy) return;
    if (item.cuentaId == null && cambios?.cuentaId == null) {
      showToastV5('Asigna una cuenta para poder puntear esta previsión', 'warn');
      return;
    }
    setBusy(true);
    try {
      await confirmTreasuryEvent(item.refId, {
        amount: cambios?.importe,
        date: cambios?.fecha,
        accountId: cambios?.cuentaId,
      });
      showToastV5('Punteado · movimiento real creado', 'success');
      invalidateCachedStores(['treasuryEvents', 'movements']);
      reload();
    } catch (err) {
      showToastV5(err instanceof Error ? err.message : 'No se pudo puntear', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onNoPaso = async (item: ItemPunteo) => {
    if (item.kind !== 'evento' || busy) return;
    setBusy(true);
    try {
      await deleteTreasuryEventCompletely(item.refId);
      showToastV5('Previsión descartada · este mes no pasa', 'success');
      invalidateCachedStores(['treasuryEvents']);
      reload();
    } catch (err) {
      showToastV5(err instanceof Error ? err.message : 'No se pudo descartar', 'error');
    } finally {
      setBusy(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className={styles.filtersBar}>
        <button
          type="button"
          className={`${styles.filtChip} ${accountFilter == null ? styles.active : ''}`}
          onClick={() => setAccountFilter(null)}
        >
          Todas las cuentas
        </button>
        {accounts.filter((a) => a.id != null).map((a) => (
          <button
            key={a.id}
            type="button"
            className={`${styles.filtChip} ${accountFilter === a.id ? styles.active : ''}`}
            onClick={() => setAccountFilter(a.id as number)}
          >
            {a.alias ?? a.banco?.name ?? a.bank ?? `#${a.id}`}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <select
          className={styles.monthSelect}
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          aria-label="Filtrar por mes"
        >
          <option value="">Todos los meses</option>
          {availableMonths.map((ym) => (
            <option key={ym} value={ym}>
              {new Date(`${ym}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </option>
          ))}
        </select>
        {dayFilter && (
          <button
            type="button"
            className={styles.filtChipClear}
            onClick={clearDayFilter}
            aria-label={`Quitar filtro día ${dayFilter}`}
            title="Quitar filtro día"
          >
            {dayFilter} <Icons.Close size={11} strokeWidth={2.5} />
          </button>
        )}
        <span className={styles.filtSearch}>
          <Icons.Search size={13} strokeWidth={2} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por concepto · activo · importe…"
            aria-label="Buscar movimientos"
          />
        </span>
        <button
          type="button"
          className={`${styles.filtChip} ${styles.filtChipPrimary ?? ''}`}
          onClick={() => setShowAddModal(true)}
          aria-label="Añadir movimiento manual"
        >
          + Añadir
        </button>
      </div>

      <div className={styles.tableWrap} style={{ padding: '10px 14px' }}>
        <PunteoList
          items={items}
          chip={chip}
          onChipChange={setChip}
          cuentas={cuentas}
          ocultarCuenta={accountFilter != null}
          onConfirmar={onConfirmar}
          onNoPaso={onNoPaso}
        />
      </div>

      {itemsFiltrados.length > MAX_FILAS && (
        <div
          style={{
            padding: '12px 16px',
            fontSize: 12,
            color: 'var(--atlas-v5-ink-4)',
            fontFamily: 'var(--atlas-v5-font-ui)',
          }}
        >
          Mostrando los {MAX_FILAS} más recientes de {itemsFiltrados.length} totales. Usa los filtros para acotar.
        </div>
      )}

      {/* PR-C1 · modal compartido con /conciliacion V2 para alta de
          movimientos esporádicos desde Tesorería V5. */}
      {showAddModal && (
        <AddMovementModal
          accounts={accounts}
          properties={properties}
          defaultYear={new Date().getFullYear()}
          defaultMonth0={new Date().getMonth()}
          onClose={() => setShowAddModal(false)}
          onCreated={async () => {
            invalidateCachedStores(['treasuryEvents', 'movements']);
            reload();
          }}
        />
      )}
    </>
  );
};

export default MovimientosTab;
