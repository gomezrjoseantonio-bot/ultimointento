// src/pages/GestionInmuebles/tabs/LineasAnualesTab.tsx
// Tab compartida para Reparaciones / Mejoras / Mobiliario
// - Selector de año · KPIs · Tabla de líneas
// - Al guardar una línea dispara movimiento pagado conciliado en Tesorería

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, Pencil, Paperclip, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type {
  Account,
  GastoInmueble,
  MejoraInmueble,
  MuebleInmueble,
  TreasuryEvent,
} from '../../../services/db';
import { initDB } from '../../../services/db';
import { gastosInmuebleService } from '../../../services/gastosInmuebleService';
import { mejorasInmuebleService } from '../../../services/mejorasInmuebleService';
import { mueblesInmuebleService } from '../../../services/mueblesInmuebleService';
import { confirmDelete } from '../../../services/confirmationService';
import { confirmTreasuryEvent } from '../../../services/treasuryConfirmationService';
import LineaAnualForm, { type LineaAnualFormData } from './LineaAnualForm';
import FacturaSelectorModal from './FacturaSelectorModal';

const C = {
  navy900: 'var(--navy-900, #042C5E)',
  teal600: 'var(--teal-600, #00A7B5)',
  grey50: 'var(--grey-50, #F8F9FA)',
  grey200: 'var(--grey-200, #DDE3EC)',
  grey300: 'var(--grey-300, #C8D0DC)',
  grey500: 'var(--grey-500, #6C757D)',
  grey700: 'var(--grey-700, #303A4C)',
  grey900: 'var(--grey-900, #1A2332)',
  white: '#FFFFFF',
};

export type Categoria = 'reparacion' | 'mejora' | 'mobiliario';

const CATEGORY_CONFIG: Record<Categoria, { label: string; singular: string; event: string }> = {
  reparacion: { label: 'reparaciones', singular: 'reparación', event: 'gestion-inmueble:new-reparacion' },
  mejora: { label: 'mejoras', singular: 'mejora', event: 'gestion-inmueble:new-mejora' },
  mobiliario: { label: 'mobiliario', singular: 'mobiliario', event: 'gestion-inmueble:new-mobiliario' },
};

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
  ' €';

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
};

type CategoriaStore = 'gastosInmueble' | 'mejorasInmueble' | 'mueblesInmueble';

const storeForCategoria = (categoria: Categoria): CategoriaStore => {
  if (categoria === 'reparacion') return 'gastosInmueble';
  if (categoria === 'mejora') return 'mejorasInmueble';
  return 'mueblesInmueble';
};

// PR3: una fila puede venir de una línea confirmada (gastos/mejoras/muebles)
// o de una previsión en treasuryEvents (kind === 'prevision').
type LineaKind = 'linea' | 'prevision';

interface LineaUI {
  id: number;                    // id del store correspondiente (linea) o del treasuryEvent (prevision)
  kind: LineaKind;
  fecha: string;
  concepto: string;
  proveedorNIF?: string;
  importe: number;
  origen: 'manual' | 'xml_aeat' | 'otro';
  estado: string;
  documentId?: number;          // factura vinculada del Inbox
  movimientoId?: number;        // movimiento Tesorería vinculado (sólo lineas confirmadas)
  accountId?: number;           // cuenta resuelta (del movimiento o cuentaBancaria / event.accountId)
  estadoTesoreria?: 'conciliado' | 'predicted' | 'pendiente' | null;
  vidaUtil?: number;            // mobiliario
  amortizacionAnual?: number;   // mobiliario
  // Para previsiones: el treasuryEventId (igual a id cuando kind==='prevision')
  treasuryEventId?: number;
  raw: GastoInmueble | MejoraInmueble | MuebleInmueble | TreasuryEvent;
}

// Resuelve la cuenta para precargar el formulario al editar.
// Preferimos el accountId ya cacheado en la línea (resuelto al cargar).
const resolveEditingAccountId = (linea: LineaUI): number | undefined => linea.accountId;

// Dado el categoryLabel de un treasuryEvent, decide si pertenece a la tab
// actual. "Reparación inmueble" → reparación tab, etc.
const eventBelongsToCategoria = (
  event: TreasuryEvent,
  categoria: Categoria,
): boolean => {
  const label = (event.categoryLabel ?? '').toLowerCase();
  if (categoria === 'reparacion') return label.includes('repar');
  if (categoria === 'mejora') return label.includes('mejora');
  if (categoria === 'mobiliario')
    return label.includes('mobiliario') || label.includes('muebles');
  return false;
};

interface Props {
  propertyId: number;
  categoria: Categoria;
}

const LineasAnualesTab: React.FC<Props> = ({ propertyId, categoria }) => {
  const config = CATEGORY_CONFIG[categoria];
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [lineas, setLineas] = useState<LineaUI[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [xmlDeclarado, setXmlDeclarado] = useState<number>(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LineaUI | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const db = await initDB();
      const allAccounts = (await db.getAll('accounts')) as Account[];
      setAccounts(allAccounts);

      // Cache de accountId por movimiento para poder cruzar al cargar líneas.
      // Hacemos un solo getAll('movements') en lugar de fetch por línea.
      const allMovements = (await db.getAll('movements').catch(() => [])) as any[];
      const movementAccountById = new Map<number, number>();
      for (const mv of allMovements) {
        if (typeof mv?.id === 'number' && typeof mv?.accountId === 'number') {
          movementAccountById.set(mv.id, mv.accountId);
        }
      }

      const parseCuentaBancaria = (raw: unknown): number | undefined => {
        if (raw == null) return undefined;
        const n = Number(raw);
        return Number.isFinite(n) ? n : undefined;
      };

      let years = new Set<number>();
      let declaradoAnual = 0;
      const ui: LineaUI[] = [];

      if (categoria === 'reparacion') {
        const all = await gastosInmuebleService.getByInmueble(propertyId);
        for (const g of all) {
          years.add(g.ejercicio);
          if (g.casillaAEAT === '0106' && g.ejercicio === year) {
            if (g.origen === 'xml_aeat') declaradoAnual += g.importe;
          }
        }
        for (const g of all) {
          if (g.casillaAEAT !== '0106') continue;
          if (g.ejercicio !== year) continue;
          const movimientoIdNum = g.movimientoId ? Number(g.movimientoId) : undefined;
          const fromMovement =
            movimientoIdNum != null && Number.isFinite(movimientoIdNum)
              ? movementAccountById.get(movimientoIdNum)
              : undefined;
          const accountId = fromMovement ?? parseCuentaBancaria(g.cuentaBancaria);
          ui.push({
            id: g.id!,
            kind: 'linea',
            fecha: g.fecha,
            concepto: g.concepto,
            proveedorNIF: g.proveedorNIF,
            importe: g.importe,
            origen: g.origen === 'xml_aeat' ? 'xml_aeat' : g.origen === 'manual' ? 'manual' : 'otro',
            estado: g.estado,
            documentId: g.documentId,
            movimientoId: Number.isFinite(movimientoIdNum) ? movimientoIdNum : undefined,
            accountId,
            estadoTesoreria: Number.isFinite(movimientoIdNum) ? 'conciliado' : null,
            treasuryEventId: (g as any).treasuryEventId,
            raw: g,
          });
        }
      } else if (categoria === 'mejora') {
        const all = await mejorasInmuebleService.getPorInmueble(propertyId);
        for (const m of all) {
          years.add(m.ejercicio);
          if (m.ejercicio === year && m.tipo !== 'reparacion') {
            const movimientoIdNum = m.movimientoId ? Number(m.movimientoId) : undefined;
            const accountId =
              movimientoIdNum != null && Number.isFinite(movimientoIdNum)
                ? movementAccountById.get(movimientoIdNum)
                : undefined;
            ui.push({
              id: m.id!,
              kind: 'linea',
              fecha: m.fecha,
              concepto: m.descripcion,
              proveedorNIF: m.proveedorNIF,
              importe: m.importe,
              origen: 'manual',
              estado: 'conciliado',
              documentId: m.documentId,
              movimientoId: Number.isFinite(movimientoIdNum) ? movimientoIdNum : undefined,
              accountId,
              estadoTesoreria: Number.isFinite(movimientoIdNum) ? 'conciliado' : null,
              treasuryEventId: (m as any).treasuryEventId,
              raw: m,
            });
          }
        }
      } else if (categoria === 'mobiliario') {
        const all = await mueblesInmuebleService.getPorInmueble(propertyId);
        for (const mu of all) {
          const ejercicio = new Date(mu.fechaAlta).getFullYear();
          years.add(ejercicio);
          if (ejercicio === year) {
            const movimientoIdNum = mu.movimientoId ? Number(mu.movimientoId) : undefined;
            const accountId =
              movimientoIdNum != null && Number.isFinite(movimientoIdNum)
                ? movementAccountById.get(movimientoIdNum)
                : undefined;
            ui.push({
              id: mu.id!,
              kind: 'linea',
              fecha: mu.fechaAlta,
              concepto: mu.descripcion,
              proveedorNIF: mu.proveedorNIF,
              importe: mu.importe,
              origen: 'manual',
              estado: mu.activo ? 'activo' : 'baja',
              documentId: mu.documentId,
              movimientoId: Number.isFinite(movimientoIdNum) ? movimientoIdNum : undefined,
              accountId,
              estadoTesoreria: Number.isFinite(movimientoIdNum) ? 'conciliado' : null,
              vidaUtil: mu.vidaUtil,
              amortizacionAnual: mu.importe / (mu.vidaUtil || 10),
              treasuryEventId: (mu as any).treasuryEventId,
              raw: mu,
            });
          }
        }
      }

      // PR3: añadir previsiones (treasuryEvents predicted) como filas
      // adicionales. Así la tab refleja la realidad de Conciliación.
      const coveredTreasuryEventIds = new Set<number>();
      for (const linea of ui) {
        if (linea.treasuryEventId != null) {
          coveredTreasuryEventIds.add(linea.treasuryEventId);
        }
      }
      const allEvents = (await db.getAll('treasuryEvents').catch(() => [])) as TreasuryEvent[];
      for (const ev of allEvents) {
        if (ev.ambito !== 'INMUEBLE') continue;
        if (ev.inmuebleId !== propertyId) continue;
        if (!eventBelongsToCategoria(ev, categoria)) continue;
        if (ev.status !== 'predicted') continue;
        const evDate = ev.predictedDate ?? '';
        const evYear = Number(evDate.slice(0, 4));
        if (Number.isFinite(evYear)) years.add(evYear);
        if (evYear !== year) continue;
        if (ev.id != null && coveredTreasuryEventIds.has(ev.id)) continue;
        ui.push({
          id: ev.id!,
          kind: 'prevision',
          fecha: evDate,
          concepto: ev.description,
          proveedorNIF: ev.counterparty,
          importe: Math.abs(ev.amount),
          origen: 'manual',
          estado: 'previsto',
          accountId: typeof ev.accountId === 'number' ? ev.accountId : undefined,
          estadoTesoreria: 'predicted',
          treasuryEventId: ev.id,
          vidaUtil: categoria === 'mobiliario' ? 10 : undefined,
          amortizacionAnual: categoria === 'mobiliario' ? Math.abs(ev.amount) / 10 : undefined,
          raw: ev,
        });
      }

      ui.sort((a, b) => a.fecha.localeCompare(b.fecha));

      const sortedYears = Array.from(years).sort((a, b) => a - b);
      // Always include current year
      const currentYear = new Date().getFullYear();
      if (!sortedYears.includes(currentYear)) sortedYears.push(currentYear);

      setAvailableYears(sortedYears);
      setLineas(ui);
      setXmlDeclarado(declaradoAnual);
    } catch (err) {
      console.error('Error cargando líneas:', err);
      toast.error(`Error al cargar las ${config.label}`);
    } finally {
      setLoading(false);
    }
  }, [propertyId, categoria, year, config.label]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handler = () => {
      setEditing(null);
      setShowForm(true);
    };
    window.addEventListener(config.event, handler);
    return () => window.removeEventListener(config.event, handler);
  }, [config.event]);

  const desglosado = useMemo(
    () => lineas.filter((l) => l.origen !== 'xml_aeat').reduce((s, l) => s + l.importe, 0),
    [lineas],
  );
  const totalAnual = useMemo(() => lineas.reduce((s, l) => s + l.importe, 0), [lineas]);
  const pendiente = Math.max(0, xmlDeclarado - desglosado);
  const pct = xmlDeclarado > 0 ? Math.min(100, (desglosado / xmlDeclarado) * 100) : 0;

  const inmuebleAlias = useMemo(() => {
    // Lazy: intentamos usar el alias desde la última línea raw; si no,
    // caemos al id. Evita un fetch extra para cada save.
    const raw: any = lineas[0]?.raw;
    return raw?.inmuebleAlias || `inmueble ${propertyId}`;
  }, [lineas, propertyId]);

  const handleSave = async (data: LineaAnualFormData) => {
    if (!data.accountId) {
      toast.error('Selecciona una cuenta de pago');
      return;
    }
    try {
      // PR3: Editar previsión (treasuryEvent predicted) — sólo actualiza el
      // event, no toca movements ni crea línea. Se confirmará al puntear.
      if (editing && editing.kind === 'prevision') {
        await updatePredictedEvent(editing.id, {
          amount: data.importe,
          date: data.fecha,
          accountId: data.accountId,
          description: data.concepto,
          counterparty: data.proveedorNIF,
        });
        toast.success('Previsión actualizada');
        setShowForm(false);
        setEditing(null);
        void reload();
        return;
      }

      // PR3: Editar línea confirmada — mantiene el flujo anterior
      // (actualizar línea + movement vinculado).
      if (editing && editing.kind === 'linea') {
        const ejercicio = new Date(data.fecha).getFullYear();
        if (categoria === 'reparacion') {
          await gastosInmuebleService.update(editing.id, {
            concepto: data.concepto,
            fecha: data.fecha,
            importe: data.importe,
            proveedorNIF: data.proveedorNIF,
            ejercicio,
          });
        } else if (categoria === 'mejora') {
          await mejorasInmuebleService.actualizar(editing.id, {
            descripcion: data.concepto,
            fecha: data.fecha,
            importe: data.importe,
            proveedorNIF: data.proveedorNIF,
            ejercicio,
          });
        } else if (categoria === 'mobiliario') {
          await mueblesInmuebleService.actualizar(editing.id, {
            descripcion: data.concepto,
            fechaAlta: data.fecha,
            importe: data.importe,
            vidaUtil: data.vidaUtil ?? 10,
            proveedorNIF: data.proveedorNIF,
          });
        }
        await syncLinkedMovement(editing, data, propertyId, inmuebleAlias, categoria);
        toast.success('Línea actualizada');
        setShowForm(false);
        setEditing(null);
        void reload();
        return;
      }

      // PR3: Nueva línea → se crea sólo como previsión. Cuando el usuario
      // puntea desde Conciliación (o desde esta misma tab con el botón ✓)
      // se materializa el movement + la línea en gastosInmueble/… vía
      // confirmTreasuryEvent.
      await createExpensePrevision({
        categoria,
        accountId: data.accountId,
        date: data.fecha,
        amount: data.importe,
        concepto: data.concepto,
        proveedorNIF: data.proveedorNIF,
        propertyId,
      });
      toast.success('Previsión creada. Confírmala al ver el cargo en el banco.');
      setShowForm(false);
      setEditing(null);
      void reload();
    } catch (err) {
      console.error('Error guardando línea:', err);
      toast.error('Error al guardar la línea');
    }
  };

  // PR3: Puntear inline desde la tab del inmueble (botón ✓)
  const handleQuickConfirm = async (eventId: number) => {
    try {
      await confirmTreasuryEvent(eventId);
      toast.success('Confirmada y conciliada');
      void reload();
    } catch (err) {
      console.error('Error confirmando previsión:', err);
      toast.error(err instanceof Error ? err.message : 'Error al confirmar');
    }
  };

  const handleDelete = async (linea: LineaUI) => {
    const ok = await confirmDelete(`"${linea.concepto}"`);
    if (!ok) return;
    try {
      // PR3: Borrar previsión — sólo elimina el treasuryEvent.
      if (linea.kind === 'prevision') {
        const db = await initDB();
        await db.delete('treasuryEvents', linea.id);
        toast.success('Previsión eliminada');
        void reload();
        return;
      }

      // Elimina el movimiento Tesorería vinculado primero (si existe) para
      // que Conciliación quede consistente con la línea borrada.
      if (linea.movimientoId != null) {
        try {
          const db = await initDB();
          await db.delete('movements', linea.movimientoId);
        } catch (err) {
          console.warn('No se pudo eliminar el movimiento vinculado:', err);
        }
      }
      if (categoria === 'reparacion') {
        await gastosInmuebleService.delete(linea.id);
      } else if (categoria === 'mejora') {
        await mejorasInmuebleService.eliminar(linea.id);
      } else if (categoria === 'mobiliario') {
        await mueblesInmuebleService.eliminar(linea.id);
      }
      toast.success('Línea eliminada');
      void reload();
    } catch (err) {
      console.error('Error eliminando línea:', err);
      toast.error('Error al eliminar la línea');
    }
  };

  const [facturaModalLinea, setFacturaModalLinea] = useState<LineaUI | null>(null);

  const handleAssociateFactura = async (documentId: number | null) => {
    if (!facturaModalLinea) return;
    // PR3: sólo las líneas confirmadas admiten factura. Previsiones no
    // tienen registro físico en gastosInmueble/… hasta que se punteen.
    if (facturaModalLinea.kind !== 'linea') {
      toast.error('Confirma la previsión antes de asociar una factura');
      setFacturaModalLinea(null);
      return;
    }
    try {
      const db = await initDB();
      const store = storeForCategoria(categoria);
      const existing: any = await db.get(store, facturaModalLinea.id);
      if (!existing) throw new Error('Línea no encontrada');
      await db.put(store, {
        ...existing,
        documentId: documentId ?? undefined,
        updatedAt: new Date().toISOString(),
      });
      toast.success(documentId ? 'Factura vinculada' : 'Factura desvinculada');
      setFacturaModalLinea(null);
      void reload();
    } catch (err) {
      console.error('Error asociando factura:', err);
      toast.error('Error al asociar la factura');
    }
  };

  return (
    <div>
      {/* Selector + KPI bar */}
      <div
        style={{
          background: C.white,
          border: `1px solid ${C.grey200}`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}
      >
        {/* Year pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: C.grey500, letterSpacing: '.06em', marginRight: 4 }}>
            Año
          </span>
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: `1px solid ${y === year ? C.navy900 : C.grey300}`,
                background: y === year ? C.navy900 : C.white,
                color: y === year ? C.white : C.grey700,
                fontSize: 12,
                fontWeight: y === year ? 500 : 400,
                cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              }}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Status row */}
        {categoria === 'reparacion' && xmlDeclarado > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 16, alignItems: 'center' }}>
            <Stat label="Declarado AEAT" value={fmtEuro(xmlDeclarado)} />
            <Stat label="Desglosado" value={fmtEuro(desglosado)} />
            <Stat label="Pendiente" value={fmtEuro(pendiente)} color={pendiente > 0 ? C.teal600 : undefined} />
            <div>
              <div style={{ fontSize: 11, color: C.grey500, marginBottom: 4, textAlign: 'right' }}>{pct.toFixed(0)}%</div>
              <div style={{ height: 8, background: C.grey200, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: C.navy900, transition: 'width 300ms ease' }} />
              </div>
            </div>
          </div>
        ) : (
          <Stat label={`Total ${year}`} value={fmtEuro(totalAnual)} />
        )}
      </div>

      {/* Table */}
      <div style={{ background: C.white, border: `1px solid ${C.grey200}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.grey500 }}>Cargando...</div>
        ) : lineas.length === 0 && pendiente === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.grey500 }}>
            No hay {config.label} registradas para {year}.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.grey50, borderBottom: `1px solid ${C.grey200}` }}>
                <Th>Fecha</Th>
                <Th>Concepto</Th>
                <Th>Proveedor NIF</Th>
                <Th align="right">Importe</Th>
                {categoria === 'mobiliario' && <Th align="right">Amort. anual</Th>}
                {categoria === 'mobiliario' && <Th align="right">Vida útil</Th>}
                {categoria !== 'mobiliario' && <Th>Origen</Th>}
                <Th>Tesorería</Th>
                <Th align="center">Factura</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((linea) => {
                const esPrevision = linea.kind === 'prevision';
                const rowBg = esPrevision ? C.grey50 : undefined;
                const textColor = esPrevision ? C.grey500 : C.grey900;
                return (
                <tr key={`${linea.kind}-${linea.id}`} style={{ borderBottom: `1px solid ${C.grey200}`, background: rowBg }}>
                  <Td mono color={textColor}>{fmtDate(linea.fecha)}</Td>
                  <Td bold color={textColor}>{linea.concepto}</Td>
                  <Td mono color={textColor}>{linea.proveedorNIF || '—'}</Td>
                  <Td align="right" mono color={textColor}>
                    {fmtEuro(linea.importe)}
                  </Td>
                  {categoria === 'mobiliario' && (
                    <>
                      <Td align="right" mono color={textColor}>
                        {linea.amortizacionAnual != null ? fmtEuro(linea.amortizacionAnual) : '—'}
                      </Td>
                      <Td align="right" mono color={textColor}>
                        {linea.vidaUtil ? `${linea.vidaUtil} años` : '—'}
                      </Td>
                    </>
                  )}
                  {categoria !== 'mobiliario' && (
                    <Td color={textColor}>{linea.origen === 'xml_aeat' ? 'XML AEAT' : 'Manual'}</Td>
                  )}
                  <Td>
                    {linea.estadoTesoreria === 'conciliado' ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'var(--teal-100, #E0F7F9)',
                          color: 'var(--teal-600, #00A7B5)',
                          fontSize: 11,
                          fontWeight: 500,
                          letterSpacing: '.02em',
                        }}
                      >
                        conciliado
                      </span>
                    ) : linea.estadoTesoreria === 'predicted' ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: C.grey200,
                          color: C.grey700,
                          fontSize: 11,
                          fontWeight: 500,
                          letterSpacing: '.02em',
                        }}
                      >
                        previsto
                      </span>
                    ) : (
                      <span style={{ color: C.grey500 }}>—</span>
                    )}
                  </Td>
                  <Td align="center">
                    {linea.origen === 'xml_aeat' || esPrevision ? (
                      <span style={{ color: C.grey500 }}>—</span>
                    ) : (
                      <IconButton
                        title={linea.documentId ? 'Factura anexada · clic para cambiar' : 'Asociar factura del Inbox'}
                        onClick={() => setFacturaModalLinea(linea)}
                      >
                        <Paperclip
                          size={14}
                          color={linea.documentId ? 'var(--teal-600, #00A7B5)' : undefined}
                        />
                      </IconButton>
                    )}
                  </Td>
                  <Td align="right">
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      {esPrevision && linea.treasuryEventId != null && (
                        <IconButton
                          title="Confirmar (puntear)"
                          onClick={() => void handleQuickConfirm(linea.treasuryEventId as number)}
                        >
                          <Check size={14} color="var(--teal-600, #00A7B5)" />
                        </IconButton>
                      )}
                      {linea.origen !== 'xml_aeat' && (
                        <IconButton
                          title="Editar"
                          onClick={() => {
                            setEditing(linea);
                            setShowForm(true);
                          }}
                        >
                          <Pencil size={14} />
                        </IconButton>
                      )}
                      {linea.origen !== 'xml_aeat' && (
                        <IconButton title="Eliminar" onClick={() => void handleDelete(linea)}>
                          <Trash2 size={14} />
                        </IconButton>
                      )}
                    </div>
                  </Td>
                </tr>
              );
              })}
              {categoria === 'reparacion' && pendiente > 0 && (
                <tr style={{ borderBottom: `1px solid ${C.grey200}`, background: C.grey50 }}>
                  <Td mono>—</Td>
                  <Td bold>Pendiente de desglosar</Td>
                  <Td>—</Td>
                  <Td align="right" mono>
                    {fmtEuro(pendiente)}
                  </Td>
                  <Td>XML AEAT</Td>
                  <Td>
                    <span style={{ color: C.grey500 }}>—</span>
                  </Td>
                  <Td align="center">
                    <span style={{ color: C.grey500 }}>—</span>
                  </Td>
                  <Td align="right">
                    <IconButton
                      title="Desglosar"
                      onClick={() => {
                        setEditing(null);
                        setShowForm(true);
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <LineaAnualForm
          categoria={categoria}
          accounts={accounts}
          initial={
            editing
              ? {
                  id: editing.id,
                  concepto: editing.concepto,
                  fecha: editing.fecha,
                  proveedorNIF: editing.proveedorNIF,
                  importe: editing.importe,
                  vidaUtil: editing.vidaUtil,
                  accountId: resolveEditingAccountId(editing),
                }
              : null
          }
          pendiente={pendiente}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}

      {facturaModalLinea && (
        <FacturaSelectorModal
          linea={{
            id: facturaModalLinea.id,
            concepto: facturaModalLinea.concepto,
            proveedorNIF: facturaModalLinea.proveedorNIF,
            importe: facturaModalLinea.importe,
            currentDocumentId: facturaModalLinea.documentId,
          }}
          onCancel={() => setFacturaModalLinea(null)}
          onAssociate={handleAssociateFactura}
        />
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div>
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        color: 'var(--grey-500, #6C757D)',
        letterSpacing: '.06em',
        marginBottom: 4,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: color ?? 'var(--grey-900, #1A2332)' }}>
      {value}
    </div>
  </div>
);

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' | 'center' }> = ({ children, align = 'left' }) => (
  <th
    style={{
      padding: '10px 16px',
      textAlign: align,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      color: C.grey500,
      letterSpacing: '.06em',
    }}
  >
    {children}
  </th>
);

const Td: React.FC<{
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  bold?: boolean;
  color?: string;
}> = ({ children, align = 'left', mono, bold, color }) => (
  <td
    style={{
      padding: '10px 16px',
      textAlign: align,
      fontSize: 13,
      color: color ?? C.grey900,
      fontWeight: bold ? 500 : 400,
      fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined,
    }}
  >
    {children}
  </td>
);

const IconButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, onClick, children }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      padding: 6,
      background: 'transparent',
      border: 'none',
      borderRadius: 4,
      cursor: 'pointer',
      color: C.grey500,
      display: 'inline-flex',
      alignItems: 'center',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = C.navy900;
      e.currentTarget.style.background = C.grey50;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = C.grey500;
      e.currentTarget.style.background = 'transparent';
    }}
  >
    {children}
  </button>
);

const CATEGORIA_TO_MOVEMENT: Record<
  Categoria,
  { prefix: string; tipoCategory: string; reference: (id: number) => string }
> = {
  reparacion: {
    prefix: 'Reparación',
    tipoCategory: 'Reparación inmueble',
    reference: (id) => `gestion_inmueble:reparacion:${id}`,
  },
  mejora: {
    prefix: 'Mejora',
    tipoCategory: 'Mejora inmueble',
    reference: (id) => `gestion_inmueble:mejora:${id}`,
  },
  mobiliario: {
    prefix: 'Mobiliario',
    tipoCategory: 'Mobiliario inmueble',
    reference: (id) => `gestion_inmueble:mobiliario:${id}`,
  },
};

interface CreateExpensePrevisionInput {
  categoria: Categoria;
  accountId: number;
  date: string;
  amount: number;
  concepto: string;
  proveedorNIF?: string;
  propertyId: number;
}

// PR3 · Arquitectura unificada: una nueva reparación/mejora/mobiliario nace
// como treasuryEvent predicted con ambito=INMUEBLE + categoryLabel. El
// movement real y la línea en gastos/mejoras/muebles se crean sólo al
// puntear (ver treasuryConfirmationService.confirmTreasuryEvent).
async function createExpensePrevision(
  input: CreateExpensePrevisionInput,
): Promise<number | null> {
  const config = CATEGORIA_TO_MOVEMENT[input.categoria];
  const now = new Date().toISOString();
  try {
    const db = await initDB();
    const event: Omit<TreasuryEvent, 'id'> = {
      type: 'expense',
      amount: Math.abs(input.amount),
      predictedDate: input.date,
      description: input.concepto,
      sourceType: 'manual',
      accountId: input.accountId,
      status: 'predicted',
      ambito: 'INMUEBLE',
      inmuebleId: input.propertyId,
      categoryLabel: config.tipoCategory,
      counterparty: input.proveedorNIF,
      createdAt: now,
      updatedAt: now,
    };
    const id = await db.add('treasuryEvents', event as any);
    return typeof id === 'number' ? id : null;
  } catch (err) {
    console.warn('No se pudo crear la previsión en Tesorería:', err);
    return null;
  }
}

// PR3: editar campos de un treasuryEvent predicted (desde el form de edición
// de la tab, cuando el usuario abre una fila "previsto").
async function updatePredictedEvent(
  eventId: number,
  data: {
    amount: number;
    date: string;
    accountId: number;
    description: string;
    counterparty?: string;
  },
): Promise<void> {
  const db = await initDB();
  const existing = (await db.get('treasuryEvents', eventId)) as
    | TreasuryEvent
    | undefined;
  if (!existing) return;
  if (existing.status !== 'predicted') return;
  await db.put('treasuryEvents', {
    ...existing,
    amount: Math.abs(data.amount),
    predictedDate: data.date,
    description: data.description,
    counterparty: data.counterparty,
    accountId: data.accountId,
    updatedAt: new Date().toISOString(),
  });
}

// Al editar una línea ya confirmada con movimiento vinculado, mantenemos
// sincronizados fecha, importe y descripción. Si el movimiento se borró por
// fuera, se deja la línea sin movement (el usuario tendrá que volver a
// conciliar manualmente). Sólo aplica a rows de kind === 'linea'.
async function syncLinkedMovement(
  editing: LineaUI,
  data: LineaAnualFormData,
  _propertyId: number,
  inmuebleAlias: string,
  categoria: Categoria,
): Promise<void> {
  if (!data.accountId) return;
  if (editing.kind !== 'linea') return;
  const config = CATEGORIA_TO_MOVEMENT[categoria];
  const now = new Date().toISOString();
  const db = await initDB();
  if (editing.movimientoId != null) {
    const existing: any = await db.get('movements', editing.movimientoId);
    if (existing) {
      await db.put('movements', {
        ...existing,
        accountId: data.accountId,
        date: data.fecha,
        valueDate: data.fecha,
        amount: -Math.abs(data.importe),
        description: `${config.prefix} ${inmuebleAlias} · ${data.concepto}`,
        counterparty: data.proveedorNIF || existing.counterparty || config.prefix,
        updatedAt: now,
      });
    }
  }
}

export default LineasAnualesTab;
