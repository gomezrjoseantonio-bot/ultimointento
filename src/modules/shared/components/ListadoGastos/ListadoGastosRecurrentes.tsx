import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Sparkles, Search } from 'lucide-react';
import { EmptyState, Icons, showToastV5 } from '../../../design-system/v5';
import ConfirmationModal from '../../../components/common/ConfirmationModal';
import type { CompromisoRecurrente } from '../../../types/compromisosRecurrentes';
import type { ListadoGastosRecurrentesProps, SortField, SortState } from './ListadoGastosRecurrentes.types';
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

  const [filterFamilia, setFilterFamilia] = useState<string | null>(null);

  const [sort, setSort] = useState<SortState>({ field: null, dir: 'asc' });
  const handleSort = useCallback((field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' },
    );
  }, []);

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
      return (
        c.alias.toLowerCase().includes(s) ||
        (c.proveedor?.nombre ?? '').toLowerCase().includes(s) ||
        (c.categoria ?? '').toLowerCase().includes(s)
      );
    });
  }, [compromisos, filterFamilia, search]);

  const groups = useMemo(
    () => groupByCatalog(filtered, catalog, mode),
    [filtered, catalog, mode],
  );

  const pillOptions = useMemo(
    () =>
      catalog.map((t) => ({
        id: t.id,
        label: t.label,
        icon: getFamilyIcon(t.id, mode),
        count: compromisos.filter((c) => (c.tipoFamilia ?? 'otros') === t.id).length,
      })),
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

  return (
    <>
      <KpiStrip compromisos={compromisos} />

      <div style={toolbar}>
        <div style={searchWrap}>
          <Search size={13} strokeWidth={1.8} style={{ color: 'var(--atlas-v5-ink-4)' }} />
          <input
            type="search"
            placeholder="Buscar por nombre, proveedor, categoría…"
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

      {groups.length === 0 && (
        <div
          style={{
            padding: '32px 0',
            textAlign: 'center',
            color: 'var(--atlas-v5-ink-4)',
            fontSize: 13,
          }}
        >
          Sin compromisos que coincidan con los filtros aplicados.
        </div>
      )}

      {groups.map((g) => (
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
          onEdit={(c) => setEditTarget(c)}
          onDelete={(c) => setDeleteTarget(c as CompromisoRecurrente & { id: number })}
          sort={sort}
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
  gap: 8,
  marginBottom: 12,
  flexWrap: 'wrap',
  alignItems: 'center',
};
const searchWrap: React.CSSProperties = {
  flex: 1,
  minWidth: 180,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 10px',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 6,
  background: 'var(--atlas-v5-card)',
  height: 36,
};
const searchInputCss: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  fontSize: 12,
  flex: 1,
  background: 'transparent',
  color: 'var(--atlas-v5-ink-2)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const btnGold: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: 6,
  fontSize: 12,
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
  padding: '8px 12px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-3)',
  fontFamily: 'var(--atlas-v5-font-ui)',
};

export default ListadoGastosRecurrentes;
