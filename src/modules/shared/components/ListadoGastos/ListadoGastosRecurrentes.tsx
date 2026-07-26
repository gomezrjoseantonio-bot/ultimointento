// Pantalla de gastos recurrentes (§3.1/§3.2) · reconstruida contra el mockup
// atlas-gastos-recurrentes-v2.html: cabecera (H1 + subtítulo + botones), tira
// navy de cuatro cifras con borde de oro, línea de contexto de la financiación,
// y UNA tabla con cabecera navy, grupos por bloque, filas con edición en línea y
// la fila desplegada como formulario (RowForm), más el pie con el coste anual.
// Sin buscador ni chips de filtro (no están en el mockup).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Save, Copy, Sparkles } from 'lucide-react';
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
import type { ListadoGastosRecurrentesProps } from './ListadoGastosRecurrentes.types';
import { groupByCatalog, groupByBlocksInmueble } from './utils/groupingHelpers';
import type { GastoGroup } from './utils/groupingHelpers';
import { formatEur } from './utils/amountFormatter';
import KpiStrip from './components/KpiStrip';
import GroupSection, { TableHead } from './components/GroupCard';
import BajaModal from './components/BajaModal';
import ReactivarModal from './components/ReactivarModal';

const ListadoGastosRecurrentes: React.FC<ListadoGastosRecurrentesProps> = ({
  catalog,
  compromisos,
  mode,
  onDelete,
  onReload,
  onImportar,
  onDetectar,
  inmuebleId,
  subtitulo,
  contextoNombre,
}) => {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    void cuentasService.list().then(setAccounts);
  }, []);
  const accountsById = useMemo(() => {
    const map: Record<number, Account> = {};
    for (const a of accounts) if (a.id != null) map[a.id] = a;
    return map;
  }, [accounts]);

  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const toggleRow = useCallback((id: number) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  }, []);

  const [deleteTarget, setDeleteTarget] = useState<(CompromisoRecurrente & { id: number }) | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bajaTarget, setBajaTarget] = useState<(CompromisoRecurrente & { id: number }) | null>(null);
  const [reactivarTarget, setReactivarTarget] = useState<(CompromisoRecurrente & { id: number }) | null>(null);

  // Contexto de financiación (§3.1): la hipoteca / los préstamos NO se editan
  // aquí (viven en Financiación). Se suma de los treasuryEvents hipoteca/prestamo
  // del año en curso. No depende de `compromisos`.
  const [financiacionAnual, setFinanciacionAnual] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const db = await initDB();
        const eventos = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
        const year = new Date().getFullYear();
        const esFin = (e: TreasuryEvent) => e.sourceType === 'hipoteca' || e.sourceType === 'prestamo';
        const ambitoOk = (e: TreasuryEvent) =>
          mode === 'inmueble' ? e.inmuebleId === inmuebleId : e.ambito == null || e.ambito === 'PERSONAL';
        const total = eventos
          .filter((e) => esFin(e) && e.año === year && ambitoOk(e))
          .reduce((s, e) => s + Math.abs(e.amount), 0);
        if (!cancelled) setFinanciacionAnual(total > 0 ? total : null);
      } catch {
        if (!cancelled) setFinanciacionAnual(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, inmuebleId]);

  // Grupos (§2.3/§3.1): activos por bloque/categoría + Preparados + Dados de baja
  // (solo si tienen filas).
  const groups = useMemo(() => {
    const activos = compromisos.filter((c) => c.estado === 'activo');
    const preparados = compromisos.filter(
      (c): c is CompromisoRecurrente & { id: number } => c.estado === 'preparado' && c.id != null,
    );
    const bajas = compromisos.filter(
      (c): c is CompromisoRecurrente & { id: number } => c.estado === 'baja' && c.id != null,
    );
    const activeGroups =
      mode === 'inmueble' ? groupByBlocksInmueble(activos) : groupByCatalog(activos, catalog, mode);
    const estadoGroups: GastoGroup[] = [];
    if (preparados.length > 0)
      estadoGroups.push({ familiaId: '__preparados__', familiaLabel: 'Preparados · sin activar todavía', compromisos: preparados });
    if (bajas.length > 0)
      estadoGroups.push({ familiaId: '__bajas__', familiaLabel: 'Dados de baja', compromisos: bajas });
    return [...activeGroups, ...estadoGroups];
  }, [compromisos, catalog, mode]);

  // Pie (§3.1): coste anual · solo lo vigente. «—» si es 0 (nunca «-0 €»).
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

  // Alta EN LA TABLA (§3.2 · sin wizard): crea un preparado mínimo y despliega su
  // fila-formulario. Importe 0 → «—» hasta rellenarlo. Nace preparado (§2.3).
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
        showToastV5(`No se pudo crear el gasto: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    })();
  }, [mode, inmuebleId, accounts, onReload]);

  const handleToggleEstado = useCallback(
    async (c: CompromisoRecurrente & { id: number }) => {
      try {
        if (c.estado === 'activo') {
          const cuadrados = await tieneCargosCuadrados(c.id);
          if (cuadrados) setBajaTarget(c);
          else {
            await pasarAPreparado(c.id);
            showToastV5(`«${c.alias}» pasa a preparado`, 'success');
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
            showToastV5(`«${c.alias}» activado`, 'success');
            onReload?.();
          } else {
            showToastV5(`Para activar falta: ${que.join(', ')}`, 'warn');
            setExpandedRowId(c.id);
          }
        } else if (c.estado === 'baja') {
          if (puedeReactivar(c)) setReactivarTarget(c);
          else showToastV5('La baja fue por cambio de proveedor · crea uno nuevo copiando lo que valga', 'warn');
        }
      } catch (err) {
        showToastV5(`No se pudo cambiar el estado: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    },
    [onReload],
  );

  const handleBajaConfirm = useCallback(
    async (fecha: string, motivo: MotivoBaja) => {
      if (!bajaTarget) return;
      try {
        await darDeBajaCompromiso(bajaTarget.id, fecha, motivo);
        showToastV5(`«${bajaTarget.alias}» dado de baja`, 'success');
        setBajaTarget(null);
        onReload?.();
      } catch (err) {
        showToastV5(`Error al dar de baja: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    },
    [bajaTarget, onReload],
  );

  const handleReactivarConfirm = useCallback(
    async (fecha: string) => {
      if (!reactivarTarget) return;
      try {
        await reactivarCompromiso(reactivarTarget.id, fecha);
        showToastV5(`«${reactivarTarget.alias}» reactivado desde ${fecha}`, 'success');
        setReactivarTarget(null);
        onReload?.();
      } catch (err) {
        showToastV5(`Error al reactivar: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    },
    [reactivarTarget, onReload],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDelete(deleteTarget);
      showToastV5(`Gasto «${deleteTarget.alias}» suprimido`, 'success');
      setDeleteTarget(null);
    } catch (err) {
      showToastV5(`Error al suprimir: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, onDelete]);

  const breadcrumb =
    mode === 'inmueble'
      ? `Inmuebles › ${contextoNombre ?? 'Inmueble'} › Gastos recurrentes`
      : 'Personal › Gastos recurrentes';
  const subtituloFinal =
    subtitulo ??
    (mode === 'inmueble'
      ? 'Se proyectan mientras dure tu presupuesto'
      : 'Tus gastos que se repiten · se proyectan mientras dure tu presupuesto');

  const header = (
    <div style={headerWrap}>
      <div style={bc}>{breadcrumb}</div>
      <div style={headRow}>
        <div style={{ minWidth: 0 }}>
          <h1 style={h1}>Gastos recurrentes</h1>
          <div style={hsub}>{subtituloFinal}</div>
        </div>
        <div style={hact}>
          {mode === 'inmueble' ? (
            <button
              type="button"
              style={btnOutline}
              onClick={() => showToastV5('Copiar de otro inmueble · disponible próximamente', 'info')}
            >
              <Copy size={13} strokeWidth={2} />
              Copiar de otro inmueble
            </button>
          ) : (
            <button
              type="button"
              style={btnOutline}
              onClick={onDetectar ?? (() => navigate('/personal/gastos/detectar-compromisos'))}
            >
              <Sparkles size={13} strokeWidth={2} />
              Detectar
            </button>
          )}
          <button type="button" style={btnOutline} onClick={handleNuevo}>
            <Plus size={13} strokeWidth={2.5} />
            Añadir gasto
          </button>
          <button
            type="button"
            style={btnGold}
            onClick={() => {
              onReload?.();
              showToastV5('Cambios guardados', 'success');
            }}
          >
            <Save size={13} strokeWidth={2} />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  if (compromisos.length === 0) {
    return (
      <div>
        {header}
        <EmptyState
          icon={<Icons.Tesoreria size={20} />}
          title="Sin gastos recurrentes"
          sub="Añade un gasto para que ATLAS lo proyecte automáticamente."
          ctaLabel="Añadir gasto"
          onCtaClick={handleNuevo}
        />
        {mode === 'personal' && (
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <button
              type="button"
              style={btnGhostLink}
              onClick={onImportar ?? (() => navigate('/inmuebles/importar-contratos'))}
            >
              o importar desde un fichero
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {header}

      <KpiStrip compromisos={compromisos} />

      {financiacionAnual != null && (
        <div style={ctx} role="note">
          Además, {mode === 'inmueble' ? 'la hipoteca de este inmueble' : 'tus préstamos personales'}{' '}
          <strong>{formatEur(financiacionAnual)} al año</strong> · vive
          {mode === 'inmueble' ? '' : 'n'} en Financiación y no se edita
          {mode === 'inmueble' ? '' : 'n'} desde aquí.
        </div>
      )}

      <div style={card}>
        <TableHead />
        {groups.map((g) => (
          <GroupSection
            key={g.familiaId}
            familiaLabel={g.familiaLabel}
            compromisos={g.compromisos}
            expandedRowId={expandedRowId}
            onToggleRow={toggleRow}
            onDelete={(c) => setDeleteTarget(c as CompromisoRecurrente & { id: number })}
            onToggleEstado={(c) => void handleToggleEstado(c)}
            onRowSaved={() => onReload?.()}
            accountsById={accountsById}
            accounts={accounts}
          />
        ))}
        <div style={tfoot}>
          <span style={tfootLabel}>Coste anual · solo lo vigente</span>
          <span style={tfootTotal}>{costeAnualVigente > 0 ? formatEur(-Math.abs(costeAnualVigente)) : '—'}</span>
        </div>
      </div>

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
          title="Suprimir gasto recurrente"
          message={`¿Suprimir «${deleteTarget.alias}»? Se va el gasto y todas sus previsiones · es irreversible. Si lo que pasó es que dejó de cobrarse, dalo de baja con fecha para conservar el histórico deducible.`}
          confirmText="Suprimir"
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

const headerWrap: React.CSSProperties = { marginBottom: 16 };
const bc: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-4)',
  marginBottom: 11,
};
const headRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
};
const h1: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  lineHeight: 1.12,
  color: 'var(--atlas-v5-ink)',
  margin: 0,
};
const hsub: React.CSSProperties = {
  fontSize: 13.5,
  color: 'var(--atlas-v5-ink-4)',
  marginTop: 7,
  lineHeight: 1.5,
};
const hact: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
};
const btnOutline: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-3)',
  fontFamily: 'var(--atlas-v5-font-ui)',
  whiteSpace: 'nowrap',
};
const btnGold: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--atlas-v5-gold)',
  background: 'var(--atlas-v5-gold)',
  color: 'var(--atlas-v5-brand-ink)',
  fontFamily: 'var(--atlas-v5-font-ui)',
  whiteSpace: 'nowrap',
};
const btnGhostLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--atlas-v5-ink-4)',
  fontSize: 12.5,
  cursor: 'pointer',
  textDecoration: 'underline',
  fontFamily: 'var(--atlas-v5-font-ui)',
};
const ctx: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--atlas-v5-ink-4)',
  background: 'var(--atlas-v5-card)',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 8,
  padding: '9px 15px',
  marginBottom: 18,
  lineHeight: 1.5,
};
const card: React.CSSProperties = {
  background: 'var(--atlas-v5-card)',
  border: '1px solid var(--atlas-v5-line)',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: 'var(--atlas-v5-shadow-card)',
  marginBottom: 16,
};
const tfoot: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '13px 16px',
  background: 'var(--atlas-v5-card-alt)',
  borderTop: '2px solid var(--atlas-v5-line)',
};
const tfootLabel: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink-2)',
};
const tfootTotal: React.CSSProperties = {
  fontFamily: 'var(--atlas-v5-font-mono-num)',
  fontSize: 14.5,
  fontWeight: 700,
  color: 'var(--atlas-v5-ink-2)',
};

export default ListadoGastosRecurrentes;
