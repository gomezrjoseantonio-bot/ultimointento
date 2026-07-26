import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Sparkles, Search } from 'lucide-react';
import { EmptyState, Icons, showToastV5 } from '../../../../design-system/v5';
import ConfirmationModal from '../../../../components/common/ConfirmationModal';
import { cuentasService } from '../../../../services/cuentasService';
import { initDB } from '../../../../services/db';
import type { Account, TreasuryEvent } from '../../../../services/db';
import type { CompromisoRecurrente, MotivoBaja } from '../../../../types/compromisosRecurrentes';
import {
  crearCompromiso,
  pasarAPreparado,
  darDeBajaCompromiso,
  activarCompromiso,
  reactivarCompromiso,
  puedeReactivar,
  faltantesParaActivar,
  tieneCargosCuadrados,
  importeCompromisoEnMes,
} from '../../../../services/personal/compromisosRecurrentesService';
import { formatEur } from './utils/amountFormatter';
import type {
  ListadoGastosRecurrentesProps,
  SortField,
  SortState,
} from './ListadoGastosRecurrentes.types';
import { groupByCatalog, groupByBlocksInmueble } from './utils/groupingHelpers';
import type { GastoGroup } from './utils/groupingHelpers';
import { getFamilyIcon } from './utils/iconMapping';
import KpiStrip from './components/KpiStrip';
import FilterPills from './components/FilterPills';
import GroupCard from './components/GroupCard';
import BajaModal from './components/BajaModal';
import ReactivarModal from './components/ReactivarModal';

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

  // Contexto de financiación (§3.1): la hipoteca / los préstamos NO se editan
  // aquí (viven en Financiación) pero se muestran como coste anual para no dar
  // una foto incompleta. Se suma de los treasuryEvents de sourceType hipoteca /
  // prestamo del año en curso, filtrando por inmueble en modo inmueble.
  const [financiacionAnual, setFinanciacionAnual] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const db = await initDB();
        const eventos = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
        const year = new Date().getFullYear();
        const esFinanciacion = (e: TreasuryEvent) =>
          e.sourceType === 'hipoteca' || e.sourceType === 'prestamo';
        const ambitoOk = (e: TreasuryEvent) =>
          mode === 'inmueble'
            ? e.inmuebleId === inmuebleId
            : e.ambito == null || e.ambito === 'PERSONAL';
        const total = eventos
          .filter((e) => esFinanciacion(e) && e.año === year && ambitoOk(e))
          .reduce((s, e) => s + Math.abs(e.amount), 0);
        if (!cancelled) setFinanciacionAnual(total > 0 ? total : null);
      } catch {
        if (!cancelled) setFinanciacionAnual(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, inmuebleId, compromisos]);

  // Pie de tabla (§3.1): coste anual · solo lo vigente (compromisos activos),
  // con el cálculo canónico. Un mes no calculable no suma (hueco).
  const costeAnualVigente = useMemo(() => {
    const year = new Date().getFullYear();
    return compromisos
      .filter((c) => c.estado === 'activo')
      .reduce((tot, c) => {
        let s = 0;
        for (let m = 0; m < 12; m++) s += Math.abs(importeCompromisoEnMes(c, year, m) ?? 0);
        return tot + s;
      }, 0);
  }, [compromisos]);

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

  const [deleteTarget, setDeleteTarget] = useState<(CompromisoRecurrente & { id: number }) | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Estados (§2.3/§2.4)
  const [bajaTarget, setBajaTarget] = useState<(CompromisoRecurrente & { id: number }) | null>(null);
  const [reactivarTarget, setReactivarTarget] = useState<(CompromisoRecurrente & { id: number }) | null>(null);

  // El interruptor de la fila: apaga un activo (→ preparado o baja), activa un
  // preparado (→ pide las cuatro cosas) o reactiva una baja (→ pide fecha).
  const handleToggleEstado = useCallback(
    async (c: CompromisoRecurrente & { id: number }) => {
      try {
        if (c.estado === 'activo') {
          const cuadrados = await tieneCargosCuadrados(c.id);
          if (cuadrados) {
            setBajaTarget(c); // había cargos → pedir fecha del último cobro
          } else {
            await pasarAPreparado(c.id);
            showToastV5(`"${c.alias}" pasa a preparado`, 'success');
            onReload?.();
          }
        } else if (c.estado === 'preparado') {
          const faltan = faltantesParaActivar(c);
          const que = [
            faltan.importe && 'importe',
            faltan.primerCobro && 'primer cobro',
            faltan.calendario && 'calendario',
            faltan.medioPago && 'medio de pago',
          ].filter(Boolean) as string[];
          if (que.length === 0) {
            await activarCompromiso(c.id);
            showToastV5(`"${c.alias}" activado`, 'success');
            onReload?.();
          } else {
            // Nunca activo a medias: se abre la fila desplegada (RowForm) para
            // completar los campos · al guardar y volver a pulsar, se activa.
            showToastV5(`Para activar falta: ${que.join(', ')}`, 'warn');
            setExpandedRowId(c.id);
          }
        } else if (c.estado === 'baja') {
          if (puedeReactivar(c)) {
            setReactivarTarget(c);
          } else {
            showToastV5(
              'La baja fue por cambio de proveedor · crea uno nuevo copiando lo que valga',
              'warn',
            );
          }
        }
      } catch (err) {
        showToastV5(
          `No se pudo cambiar el estado: ${err instanceof Error ? err.message : String(err)}`,
          'error',
        );
      }
    },
    [onReload],
  );

  const handleBajaConfirm = useCallback(
    async (fecha: string, motivo: MotivoBaja) => {
      if (!bajaTarget) return;
      try {
        await darDeBajaCompromiso(bajaTarget.id, fecha, motivo);
        showToastV5(`"${bajaTarget.alias}" dado de baja`, 'success');
        setBajaTarget(null);
        onReload?.();
      } catch (err) {
        showToastV5(
          `Error al dar de baja: ${err instanceof Error ? err.message : String(err)}`,
          'error',
        );
      }
    },
    [bajaTarget, onReload],
  );

  const handleReactivarConfirm = useCallback(
    async (fecha: string) => {
      if (!reactivarTarget) return;
      try {
        await reactivarCompromiso(reactivarTarget.id, fecha);
        showToastV5(`"${reactivarTarget.alias}" reactivado desde ${fecha}`, 'success');
        setReactivarTarget(null);
        onReload?.();
      } catch (err) {
        showToastV5(
          `Error al reactivar: ${err instanceof Error ? err.message : String(err)}`,
          'error',
        );
      }
    },
    [reactivarTarget, onReload],
  );

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

  // Estados (§2.3/§2.4): los activos se agrupan por categoría/bloque; los
  // preparados y las bajas caen a sus propios grupos, que solo existen si hay
  // alguno. El grupo "Preparados" solo aparece si queda alguno (§2.3).
  const groups = useMemo(() => {
    const activos = filtered.filter((c) => c.estado === 'activo');
    const preparados = filtered.filter(
      (c): c is CompromisoRecurrente & { id: number } => c.estado === 'preparado' && c.id != null,
    );
    const bajas = filtered.filter(
      (c): c is CompromisoRecurrente & { id: number } => c.estado === 'baja' && c.id != null,
    );

    const activeGroups =
      mode === 'inmueble' ? groupByBlocksInmueble(activos) : groupByCatalog(activos, catalog, mode);

    const estadoGroups: GastoGroup[] = [];
    if (preparados.length > 0) {
      estadoGroups.push({
        familiaId: '__preparados__',
        familiaLabel: 'Preparados · sin activar todavía',
        compromisos: preparados,
      });
    }
    if (bajas.length > 0) {
      estadoGroups.push({
        familiaId: '__bajas__',
        familiaLabel: 'Dados de baja',
        compromisos: bajas,
      });
    }
    return [...activeGroups, ...estadoGroups];
  }, [filtered, catalog, mode]);

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

  // Alta EN LA PROPIA TABLA (§3.2 · sin wizard): se crea un preparado mínimo y
  // se despliega su fila-formulario para completarlo. El importe queda en 0 →
  // se pinta «—» hasta que se rellene. Nace preparado (§2.3): existe en el plan,
  // aún no contratado; no se proyecta hasta activarlo.
  const handleNuevo = useCallback(() => {
    void (async () => {
      try {
        const now = new Date();
        const skeleton = {
          ambito: mode === 'inmueble' ? 'inmueble' : 'personal',
          inmuebleId: mode === 'inmueble' ? inmuebleId : undefined,
          personalDataId: mode === 'personal' ? 1 : undefined,
          alias: 'Nuevo gasto',
          tipo: 'otros',
          proveedor: { nombre: '' },
          patron: { tipo: 'mensualDiaFijo', dia: 1 },
          importe: { modo: 'fijo', importe: 0 },
          cuentaCargo: accounts[0]?.id ?? 0,
          conceptoBancario: '',
          metodoPago: 'domiciliacion',
          categoria: 'otros',
          bolsaPresupuesto: mode === 'inmueble' ? 'inmueble' : 'necesidades',
          responsable: 'titular',
          fechaInicio: now.toISOString().slice(0, 10),
          estado: 'preparado',
        } as unknown as Omit<CompromisoRecurrente, 'id' | 'createdAt' | 'updatedAt'>;
        const creado = await crearCompromiso(skeleton);
        onReload?.();
        if (creado.id != null) setExpandedRowId(creado.id);
      } catch (err) {
        showToastV5(
          `No se pudo crear el gasto: ${err instanceof Error ? err.message : String(err)}`,
          'error',
        );
      }
    })();
  }, [mode, inmuebleId, accounts, onReload]);

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

      {financiacionAnual != null && (
        <div style={financLine} role="note">
          Además, {mode === 'inmueble' ? 'la hipoteca de este inmueble' : 'tus préstamos personales'}{' '}
          son <strong>{formatEur(financiacionAnual)} al año</strong> · vive
          {mode === 'inmueble' ? '' : 'n'} en Financiación y no se edita
          {mode === 'inmueble' ? '' : 'n'} desde aquí.
        </div>
      )}

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
          onDelete={(c) => setDeleteTarget(c as CompromisoRecurrente & { id: number })}
          onToggleEstado={(c) => void handleToggleEstado(c)}
          onRowSaved={() => onReload?.()}
          accountsById={accountsById}
          accounts={accounts}
          sort={sort}
          onSort={handleSort}
          showHeader={idx === 0}
        />
      ))}

      {!noResults && (
        <div style={tableFooter}>
          <span style={footerLabel}>Coste anual · solo lo vigente</span>
          <span style={footerTotal}>{formatEur(-Math.abs(costeAnualVigente))}</span>
        </div>
      )}

      {bajaTarget && (
        <BajaModal
          alias={bajaTarget.alias}
          onCancel={() => setBajaTarget(null)}
          onConfirm={(fecha, motivo) => void handleBajaConfirm(fecha, motivo)}
        />
      )}

      {reactivarTarget && (
        <ReactivarModal
          alias={reactivarTarget.alias}
          onCancel={() => setReactivarTarget(null)}
          onConfirm={(fecha) => void handleReactivarConfirm(fecha)}
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
const financLine: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--atlas-v5-ink-3)',
  background: 'var(--atlas-v5-card-alt)',
  border: '1px solid var(--atlas-v5-line-2)',
  borderRadius: 10,
  padding: '10px 14px',
  marginBottom: 14,
  lineHeight: 1.5,
};
const tableFooter: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 20px',
  background: 'var(--atlas-v5-card-alt)',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 12,
  marginTop: 4,
  marginBottom: 14,
  boxShadow: 'var(--atlas-v5-shadow-card)',
};
const footerLabel: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink-2)',
};
const footerTotal: React.CSSProperties = {
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--atlas-v5-neg)',
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
