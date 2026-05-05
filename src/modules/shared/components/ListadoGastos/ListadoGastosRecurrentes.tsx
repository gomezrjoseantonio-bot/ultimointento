import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Sparkles, Search } from 'lucide-react';
import { EmptyState, Icons, showToastV5 } from '../../../../design-system/v5';
import ConfirmationModal from '../../../../components/common/ConfirmationModal';
import { cuentasService } from '../../../../services/cuentasService';
import type { Account } from '../../../../services/db';
import type { CompromisoRecurrente } from '../../../../types/compromisosRecurrentes';
import type {
  ListadoGastosRecurrentesProps,
  SortField,
  SortState,
} from './ListadoGastosRecurrentes.types';
import { groupByCatalog } from './utils/groupingHelpers';
import { getFamilyIcon } from './utils/iconMapping';
import KpiStrip from './components/KpiStrip';
import FilterPills from './components/FilterPills';
import GroupCard from './components/GroupCard';
import EditDrawer from './components/EditDrawer';

const LS_KEY = (mode: string) => `listadoGastos.expandedGroups.${mode}`;

function loadExpandedGroups(mode: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY(mode));
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function saveExpandedGroups(mode: string, state: Record<string, boolean>): void {
  try {
    localStorage.setItem(LS_KEY(mode), JSON.stringify(state));
  } catch {
    // ignore
  }
}

const ListadoGastosRecurrentes: React.FC<ListadoGastosRecurrentesProps> = ({
  catalog,
  compromisos,
  mode,
  onDelete,
  onReload,
  onNuevo,
  onImportar,
  onDetectar,
  onEdit: onEditOverride,
  inmuebleId,
}) => {
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 200);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const [filterFamilia, setFilterFamilia] = useState<string | null>(null);

  const [sort, setSort] = useState<SortState>({ field: null, dir: 'asc' });
  const handleSort = useCallback((field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' },
    );
  }, []);

  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    void cuentasService.list().then(setAccounts);
  }, []);
  const accountsById = useMemo(() => {
    const map: Record<number, Account> = {};
    for (const a of accounts) {
      if (a.id != null) map[a.id] = a;
    }
    return map;
  }, [accounts]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const saved = loadExpandedGroups(mode);
    const defaults: Record<string, boolean> = {};
    catalog.forEach((t) => {
      defaults[t.id] = saved[t.id] !== undefined ? saved[t.id] : true;
    });
    return defaults;
  });

  const toggleGroup = useCallback(
    (id: string) => {
      setExpandedGroups((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        saveExpandedGroups(mode, next);
        return next;
      });
    },
    [mode],
  );

  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const toggleRow = useCallback((id: number) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  }, []);

  const [editTarget, setEditTarget] = useState<CompromisoRecurrente | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(CompromisoRecurrente & { id: number }) | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget);
      showToastV5(`Gasto "${deleteTarget.alias}" eliminado`, 'success');
      setDeleteTarget(null);
    } catch (err) {
      showToastV5(
        `Error al eliminar: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, onDelete]);

  const filtered = useMemo(() => {
    return compromisos.filter((c) => {
      if (filterFamilia) {
        const fam = c.tipoFamilia ?? 'otros';
        if (fam !== filterFamilia) return false;
      }
      if (!search) return true;
      const s = search.toLowerCase();
      const subtipoLabel = (() => {
        const fam = catalog.find((t) => t.id === (c.tipoFamilia ?? ''));
        return fam?.subtipos.find((sb) => sb.id === c.subtipo)?.label ?? '';
      })();
      return (
        c.alias.toLowerCase().includes(s) ||
        (c.proveedor?.nombre ?? '').toLowerCase().includes(s) ||
        (c.categoria ?? '').toLowerCase().includes(s) ||
        (c.subtipo ?? '').toLowerCase().includes(s) ||
        subtipoLabel.toLowerCase().includes(s)
      );
    });
  }, [compromisos, filterFamilia, search, catalog]);

  const groups = useMemo(
    () => groupByCatalog(filtered, catalog, mode),
    [filtered, catalog, mode],
  );

  const pillOptions = useMemo(
    () =>
      catalog
        .map((t) => ({
          id: t.id,
          label: t.label,
          icon: getFamilyIcon(t.id, mode),
          count: compromisos.filter((c) => (c.tipoFamilia ?? 'otros') === t.id).length,
        }))
        .filter((opt) => opt.count > 0),
    [catalog, compromisos, mode],
  );

  const handleNuevo = onNuevo ?? (() => {
    if (mode === 'personal') navigate('/personal/gastos/nuevo');
    else if (inmuebleId) navigate(`/inmuebles/${inmuebleId}/gastos/nuevo`);
  });

  if (compromisos.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <button type="button" style={btnGold} onClick={handleNuevo}>
            <Plus size={12} strokeWidth={2.5} style={{ marginRight: 4 }} />
            Nuevo gasto recurrente
          </button>
        </div>
        <EmptyState
          icon={<Icons.Tesoreria size={20} />}
          title="Sin compromisos registrados"
          sub="Da de alta tus gastos recurrentes para que ATLAS los proyecte automáticamente."
          ctaLabel={
            mode === 'personal' ? 'Detectar desde histórico' : 'Nuevo gasto recurrente'
          }
          onCtaClick={
            mode === 'personal'
              ? (onDetectar ?? (() => navigate('/personal/gastos/detectar-compromisos')))
              : handleNuevo
          }
        />
      </div>
    );
  }

  const noResults = groups.length === 0;

  return (
    <>
      <KpiStrip compromisos={compromisos} />

      <div style={toolbar}>
        <div style={searchWrap}>
          <Search size={14} strokeWidth={2} style={{ color: 'var(--atlas-v5-ink-4)' }} />
          <input
            type="search"
            placeholder="Buscar gasto · proveedor · subtipo..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Buscar gastos"
            style={searchInputCss}
          />
        </div>
        {mode === 'personal' && (
          <>
            <button
              type="button"
              style={btnGhost}
              onClick={onImportar ?? (() => navigate('/inmuebles/importar-contratos'))}
            >
              <Upload size={11} strokeWidth={2} style={{ marginRight: 4 }} />
              Importar
            </button>
            <button
              type="button"
              style={btnGhost}
              onClick={
                onDetectar ?? (() => navigate('/personal/gastos/detectar-compromisos'))
              }
            >
              <Sparkles size={11} strokeWidth={2} style={{ marginRight: 4 }} />
              Detectar
            </button>
          </>
        )}
        <button type="button" style={btnGold} onClick={handleNuevo}>
          <Plus size={12} strokeWidth={2.5} style={{ marginRight: 4 }} />
          Nuevo gasto recurrente
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <FilterPills
          options={pillOptions}
          active={filterFamilia}
          total={compromisos.length}
          onChange={setFilterFamilia}
        />
      </div>

      {noResults && (
        <div style={emptyResults}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--atlas-v5-ink)', marginBottom: 4 }}>
            No hay resultados para ese filtro
          </div>
          <button
            type="button"
            style={btnGhost}
            onClick={() => {
              setFilterFamilia(null);
              setSearchInput('');
              setSearch('');
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {groups.map((g, idx) => (
        <GroupCard
          key={g.familiaId}
          familiaId={g.familiaId}
          familiaLabel={g.familiaLabel}
          compromisos={g.compromisos}
          mode={mode}
          isExpanded={expandedGroups[g.familiaId] !== false}
          onToggleGroup={() => toggleGroup(g.familiaId)}
          expandedRowId={expandedRowId}
          onToggleRow={toggleRow}
          onEdit={(c) => {
            if (onEditOverride) {
              onEditOverride(c);
            } else {
              setEditTarget(c);
            }
          }}
          onDelete={(c) => setDeleteTarget(c as CompromisoRecurrente & { id: number })}
          accountsById={accountsById}
          sort={sort}
          onSort={handleSort}
          showHeader={idx === 0}
        />
      ))}

      {editTarget && (
        <EditDrawer
          catalog={catalog}
          compromiso={editTarget}
          mode={mode}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            onReload?.();
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmationModal
          isOpen={true}
          title="Eliminar gasto recurrente"
          message={`¿Eliminar "${deleteTarget.alias}"? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          onConfirm={() => void handleDeleteConfirm()}
          onClose={() => setDeleteTarget(null)}
          isLoading={deleting}
          variant="danger"
        />
      )}
    </>
  );
};

const toolbar: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginBottom: 16,
  flexWrap: 'wrap',
  alignItems: 'center',
};
const searchWrap: React.CSSProperties = {
  flex: 1,
  minWidth: 240,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 8,
  background: 'var(--atlas-v5-card)',
};
const searchInputCss: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  fontSize: 13,
  flex: 1,
  background: 'transparent',
  color: 'var(--atlas-v5-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const btnGold: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1.5px solid var(--atlas-v5-gold)',
  background: 'var(--atlas-v5-gold)',
  color: 'var(--atlas-v5-white)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-3)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const emptyResults: React.CSSProperties = {
  background: 'var(--atlas-v5-card)',
  border: '1px dashed var(--atlas-v5-line)',
  borderRadius: 12,
  padding: '32px 20px',
  textAlign: 'center',
  marginBottom: 14,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
};

export default ListadoGastosRecurrentes;
