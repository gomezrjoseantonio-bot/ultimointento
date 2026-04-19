// src/pages/GestionInmuebles/tabs/sections/EjecucionesRecurrentesSection.tsx
//
// PR5.5 · Sección "Ejecuciones del año" debajo de las plantillas recurrentes.
// Muestra todas las líneas de `gastosInmueble` del inmueble cuya casilla AEAT
// sea 0109/0113/0114/0115, agrupadas por año.
//
// Permite:
//   - Ver origen (Plantilla | Manual) y estado de tesorería (Pendiente | Conciliado).
//   - Ver iconos de documentación (reutiliza DocIcon del PR5).
//   - Añadir un gasto puntual con "+ Nuevo gasto puntual" — crea un
//     treasuryEvent predicted + línea gastosInmueble con la casilla correcta.
//   - Editar / eliminar la línea (cascada via gastosInmuebleService → lineasInmuebleService).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Account, GastoCategoria, GastoInmueble, TreasuryEvent } from '../../../../services/db';
import { initDB } from '../../../../services/db';
import { gastosInmuebleService } from '../../../../services/gastosInmuebleService';
import { confirmDelete } from '../../../../services/confirmationService';

const C = {
  navy900: 'var(--navy-900, #042C5E)',
  teal600: 'var(--teal-600, #1DA0BA)',
  teal100: 'var(--teal-100, #E6F7FA)',
  grey50: 'var(--grey-50, #F8F9FA)',
  grey100: 'var(--grey-100, #EEF1F5)',
  grey200: 'var(--grey-200, #DDE3EC)',
  grey300: 'var(--grey-300, #C8D0DC)',
  grey500: 'var(--grey-500, #6C757D)',
  grey600: 'var(--grey-600, #4B5563)',
  grey700: 'var(--grey-700, #303A4C)',
  grey900: 'var(--grey-900, #1A2332)',
  white: '#FFFFFF',
};

// Casillas relevantes para la pestaña de gastos recurrentes. Las
// reparaciones (0106), intereses (0105) y servicios/gestión (0112) viven en
// sus propios tabs.
const CASILLAS_RECURRENTES = ['0109', '0113', '0114', '0115'] as const;
type CasillaRecurrente = (typeof CASILLAS_RECURRENTES)[number];

const CASILLA_TIPO_LABEL: Record<CasillaRecurrente, string> = {
  '0109': 'Comunidad',
  '0113': 'Suministro',
  '0114': 'Seguro',
  '0115': 'IBI/Tributo',
};

// Mapeo tipo → casilla + categoria fiscal para crear gastos puntuales.
const TIPO_CONFIG: Array<{
  value: CasillaRecurrente;
  label: string;
  categoria: GastoCategoria;
}> = [
  { value: '0109', label: 'Comunidad', categoria: 'comunidad' },
  { value: '0113', label: 'Suministro', categoria: 'suministro' },
  { value: '0114', label: 'Seguro', categoria: 'seguro' },
  { value: '0115', label: 'IBI / Tributo', categoria: 'ibi' },
];

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
  ' €';

const fmtDate = (iso: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const parseAmount = (raw: string): number | null => {
  if (!raw) return null;
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
};

interface Props {
  propertyId: number;
}

const EjecucionesRecurrentesSection: React.FC<Props> = ({ propertyId }) => {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [ejecuciones, setEjecuciones] = useState<GastoInmueble[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoInmueble | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [gastos, accs] = await Promise.all([
        gastosInmuebleService.getByInmueble(propertyId),
        (async () => {
          const db = await initDB();
          return (await db.getAll('accounts')) as Account[];
        })(),
      ]);
      setAccounts(accs);
      const filtered = gastos.filter(
        (g) =>
          CASILLAS_RECURRENTES.includes(g.casillaAEAT as CasillaRecurrente) &&
          Number(String(g.fecha).slice(0, 4)) === year,
      );
      filtered.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      setEjecuciones(filtered);
    } catch (err) {
      console.error('[EjecucionesRecurrentesSection] reload failed', err);
      toast.error('No se pudieron cargar las ejecuciones');
    } finally {
      setLoading(false);
    }
  }, [propertyId, year]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleDelete = async (gasto: GastoInmueble) => {
    if (gasto.id == null) return;
    const ok = await confirmDelete(`gasto "${gasto.concepto}"`);
    if (!ok) return;
    try {
      await gastosInmuebleService.delete(gasto.id);
      toast.success('Gasto eliminado');
      void reload();
    } catch (err) {
      console.error('[EjecucionesRecurrentesSection] delete failed', err);
      toast.error('No se pudo eliminar el gasto');
    }
  };

  return (
    <section style={{ marginTop: 32 }}>
      <header style={headerStyle}>
        <div>
          <h3 style={sectionTitleStyle}>Ejecuciones del año</h3>
          <p style={sectionSubtitleStyle}>
            Comunidad, suministros, seguros e IBI registrados para este inmueble.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <YearSelector
            value={year}
            onChange={setYear}
            baseYear={thisYear}
          />
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={primaryBtnStyle}
          >
            <Plus size={14} /> Nuevo gasto puntual
          </button>
        </div>
      </header>

      <div
        style={{
          background: C.white,
          border: `1px solid ${C.grey200}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.grey500 }}>Cargando...</div>
        ) : ejecuciones.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.grey500, fontSize: 13 }}>
            No hay ejecuciones en {year}. Usa "Nuevo gasto puntual" para registrar uno.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.grey50, borderBottom: `1px solid ${C.grey200}` }}>
                <Th>Fecha</Th>
                <Th>Concepto</Th>
                <Th>Proveedor</Th>
                <Th align="right">Importe</Th>
                <Th>Tipo</Th>
                <Th>Origen</Th>
                <Th>Tesorería</Th>
                <Th align="center">Doc</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {ejecuciones.map((e) => (
                <tr key={e.id} style={{ borderBottom: `1px solid ${C.grey100}` }}>
                  <Td mono>{fmtDate(e.fecha)}</Td>
                  <Td bold>{e.concepto}</Td>
                  <Td>{e.proveedorNombre || e.proveedorNIF || '—'}</Td>
                  <Td align="right" mono>{fmtEuro(e.importe)}</Td>
                  <Td>{CASILLA_TIPO_LABEL[e.casillaAEAT as CasillaRecurrente] ?? '—'}</Td>
                  <Td><OrigenBadge origen={e.origen} origenId={e.origenId} /></Td>
                  <Td><TesoreriaBadge movimientoId={e.movimientoId} estadoTesoreria={e.estadoTesoreria} /></Td>
                  <Td align="center">
                    <DocIconsCompact
                      facturaId={e.facturaId}
                      facturaNoAplica={e.facturaNoAplica}
                      justificanteId={e.justificanteId}
                      justificanteNoAplica={e.justificanteNoAplica}
                    />
                  </Td>
                  <Td align="right">
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <IconButton
                        title="Editar"
                        onClick={() => setEditingGasto(e)}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton title="Eliminar" onClick={() => void handleDelete(e)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <AddGastoPuntualModal
          propertyId={propertyId}
          defaultYear={year}
          accounts={accounts}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            await reload();
          }}
        />
      )}

      {editingGasto && (
        <AddGastoPuntualModal
          propertyId={propertyId}
          defaultYear={year}
          accounts={accounts}
          gasto={editingGasto}
          onClose={() => setEditingGasto(null)}
          onSaved={async () => {
            await reload();
          }}
        />
      )}
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Sub-componentes presentacionales
// ═══════════════════════════════════════════════════════════════════════

const YearSelector: React.FC<{
  value: number;
  onChange: (year: number) => void;
  baseYear: number;
}> = ({ value, onChange, baseYear }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      background: C.white,
      border: `1.5px solid ${C.grey300}`,
      borderRadius: 8,
      padding: 4,
    }}
  >
    <button
      type="button"
      onClick={() => onChange(value - 1)}
      style={chevronBtnStyle}
      aria-label="Año anterior"
    >
      <ChevronLeft size={14} />
    </button>
    <span
      style={{
        fontSize: 13,
        fontWeight: 500,
        color: C.grey900,
        padding: '0 8px',
        minWidth: 60,
        textAlign: 'center',
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {value}
    </span>
    <button
      type="button"
      onClick={() => onChange(value + 1)}
      style={chevronBtnStyle}
      disabled={value >= baseYear + 2}
      aria-label="Año siguiente"
    >
      <ChevronRight size={14} />
    </button>
  </div>
);

const OrigenBadge: React.FC<{ origen?: string; origenId?: string }> = ({ origen, origenId }) => {
  const isPlantilla = origen === 'recurrente' && !!origenId;
  return (
    <span style={isPlantilla ? badgeTealStyle : badgeGreyStyle}>
      {isPlantilla ? 'Plantilla' : 'Manual'}
    </span>
  );
};

const TesoreriaBadge: React.FC<{ movimientoId?: string; estadoTesoreria?: string }> = ({
  movimientoId,
  estadoTesoreria,
}) => {
  const conciliado = !!movimientoId || estadoTesoreria === 'confirmed';
  return (
    <span style={conciliado ? badgeTealStyle : badgeGreyStyle}>
      {conciliado ? 'Conciliado' : 'Pendiente'}
    </span>
  );
};

const DocIconsCompact: React.FC<{
  facturaId?: number;
  facturaNoAplica?: boolean;
  justificanteId?: number;
  justificanteNoAplica?: boolean;
}> = ({ facturaId, facturaNoAplica, justificanteId, justificanteNoAplica }) => {
  const state = (hasDoc: boolean, noAplica: boolean): 'attached' | 'missing' | 'not_applicable' =>
    hasDoc ? 'attached' : noAplica ? 'not_applicable' : 'missing';

  const facturaState = state(!!facturaId, !!facturaNoAplica);
  const justificanteState = state(!!justificanteId, !!justificanteNoAplica);

  const colorFor = (s: 'attached' | 'missing' | 'not_applicable') =>
    s === 'attached' ? C.teal600 : s === 'not_applicable' ? C.grey300 : C.grey300;
  const opacityFor = (s: 'attached' | 'missing' | 'not_applicable') =>
    s === 'not_applicable' ? 0.5 : 1;

  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <span
        title={facturaState === 'attached' ? 'Factura adjunta' : facturaState === 'not_applicable' ? 'Factura no aplica' : 'Sin factura'}
        style={{ color: colorFor(facturaState), opacity: opacityFor(facturaState), display: 'inline-flex' }}
      >
        <FileText size={14} />
      </span>
      <span
        title={justificanteState === 'attached' ? 'Justificante adjunto' : justificanteState === 'not_applicable' ? 'Justificante no aplica' : 'Sin justificante'}
        style={{ color: colorFor(justificanteState), opacity: opacityFor(justificanteState), display: 'inline-flex' }}
      >
        <Landmark size={14} />
      </span>
    </span>
  );
};

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' | 'center' }> = ({
  children,
  align = 'left',
}) => (
  <th
    style={{
      padding: '10px 14px',
      textAlign: align,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      color: C.grey500,
      letterSpacing: '.04em',
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
}> = ({ children, align = 'left', mono, bold }) => (
  <td
    style={{
      padding: '10px 14px',
      textAlign: align,
      fontSize: 13,
      color: C.grey900,
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

// ═══════════════════════════════════════════════════════════════════════
// Modal "+ Nuevo gasto puntual"
// ═══════════════════════════════════════════════════════════════════════

interface AddModalProps {
  propertyId: number;
  defaultYear: number;
  accounts: Account[];
  gasto?: GastoInmueble;  // si viene, es edición
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const AddGastoPuntualModal: React.FC<AddModalProps> = ({
  propertyId,
  defaultYear,
  accounts,
  gasto,
  onClose,
  onSaved,
}) => {
  const isEdit = gasto != null;
  const defaultDate = gasto?.fecha
    ? gasto.fecha.slice(0, 10)
    : `${defaultYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

  const [tipo, setTipo] = useState<CasillaRecurrente>(
    (gasto?.casillaAEAT as CasillaRecurrente) ?? '0109',
  );
  const [concepto, setConcepto] = useState(gasto?.concepto ?? '');
  const [proveedor, setProveedor] = useState(
    gasto?.proveedorNombre ?? gasto?.proveedorNIF ?? '',
  );
  const [importe, setImporte] = useState(
    gasto?.importe != null ? String(gasto.importe).replace('.', ',') : '',
  );
  const [fecha, setFecha] = useState(defaultDate);
  const [accountId, setAccountId] = useState<number | undefined>(
    gasto?.cuentaBancaria
      ? Number(gasto.cuentaBancaria)
      : accounts.length > 0
      ? accounts[0].id
      : undefined,
  );
  const [busy, setBusy] = useState(false);

  const config = useMemo(() => TIPO_CONFIG.find((t) => t.value === tipo)!, [tipo]);

  const handleSubmit = async () => {
    const parsed = parseAmount(importe);
    if (!parsed) {
      toast.error('Importe no válido');
      return;
    }
    if (!concepto.trim()) {
      toast.error('Añade un concepto');
      return;
    }
    setBusy(true);
    try {
      if (isEdit && gasto?.id != null) {
        // Edición: gastosInmuebleService.update() propaga al event + movement
        // vía lineasInmuebleService.
        await gastosInmuebleService.update(gasto.id, {
          fecha,
          concepto: concepto.trim(),
          importe: parsed,
          categoria: config.categoria,
          casillaAEAT: config.value,
          proveedorNombre: proveedor.trim() || undefined,
        });
        toast.success('Gasto actualizado');
      } else {
        const now = new Date().toISOString();
        const ejercicio = Number(fecha.slice(0, 4));
        const db = await initDB();

        // 1. Crear treasuryEvent predicted (para que aparezca en /conciliacion).
        const eventPayload: Omit<TreasuryEvent, 'id'> = {
          type: 'expense',
          amount: parsed,
          predictedDate: fecha,
          description: concepto.trim(),
          sourceType: 'manual',
          accountId,
          status: 'predicted',
          ambito: 'INMUEBLE',
          inmuebleId: propertyId,
          categoryLabel: config.label,
          counterparty: proveedor.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        };
        const eventId = Number(await (db as any).add('treasuryEvents', eventPayload));

        // 2. Crear línea gastosInmueble predicted.
        await gastosInmuebleService.add({
          inmuebleId: propertyId,
          ejercicio,
          fecha,
          concepto: concepto.trim(),
          categoria: config.categoria,
          casillaAEAT: config.value,
          importe: parsed,
          origen: 'manual',
          estado: 'previsto',
          estadoTesoreria: 'predicted',
          treasuryEventId: eventId,
          proveedorNombre: proveedor.trim() || undefined,
        } as any);

        toast.success('Gasto creado');
      }
      await onSaved();
      onClose();
    } catch (err) {
      console.error('[AddGastoPuntualModal] save failed', err);
      toast.error(isEdit ? 'No se pudo actualizar el gasto' : 'No se pudo crear el gasto');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <header style={modalHeaderStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.grey900, margin: 0 }}>
            {isEdit ? 'Editar gasto' : 'Nuevo gasto puntual'}
          </h3>
        </header>

        <div style={{ padding: '18px 22px' }}>
          <div style={gridTwoStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as CasillaRecurrente)}
                style={inputStyle}
              >
                {TIPO_CONFIG.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Concepto</label>
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={`Ej: ${config.label} ${defaultYear}`}
              style={inputStyle}
            />
          </div>

          <div style={gridTwoStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Proveedor</label>
              <input
                type="text"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Nombre o NIF"
                style={inputStyle}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Importe (€)</label>
              <input
                type="text"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                placeholder="0,00"
                style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }}
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Cuenta</label>
            <select
              value={accountId ?? ''}
              onChange={(e) =>
                setAccountId(e.target.value ? Number(e.target.value) : undefined)
              }
              style={inputStyle}
            >
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.alias ?? a.banco?.name ?? (a as any).bank ?? `Cuenta ${a.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <footer style={modalFooterStyle}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle} disabled={busy}>
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} style={primaryBtnStyle} disabled={busy}>
            {isEdit ? 'Guardar cambios' : (<><Plus size={14} /> Crear gasto</>)}
          </button>
        </footer>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Estilos inline (consistentes con GastosRecurrentesTab)
// ═══════════════════════════════════════════════════════════════════════

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  marginBottom: 16,
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: C.grey900,
  margin: 0,
};
const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.grey500,
  margin: '2px 0 0 0',
};
const badgeBaseStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 500,
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
};
const badgeTealStyle: React.CSSProperties = {
  ...badgeBaseStyle,
  background: C.teal100,
  color: C.teal600,
};
const badgeGreyStyle: React.CSSProperties = {
  ...badgeBaseStyle,
  background: C.grey100,
  color: C.grey600,
};
const chevronBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '4px 6px',
  color: C.grey500,
  cursor: 'pointer',
  borderRadius: 4,
  display: 'inline-flex',
  alignItems: 'center',
};
const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
  background: C.navy900,
  color: C.white,
  fontFamily: 'inherit',
};
const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  border: `1px solid ${C.grey300}`,
  cursor: 'pointer',
  background: C.white,
  color: C.grey700,
  fontFamily: 'inherit',
};
const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(10, 22, 40, 0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  padding: '60px 20px',
  zIndex: 100,
};
const modalStyle: React.CSSProperties = {
  background: C.white,
  borderRadius: 12,
  width: 'min(560px, 100%)',
  boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
  overflow: 'hidden',
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
};
const modalHeaderStyle: React.CSSProperties = {
  padding: '16px 22px',
  borderBottom: `1px solid ${C.grey200}`,
};
const modalFooterStyle: React.CSSProperties = {
  padding: '12px 22px',
  borderTop: `1px solid ${C.grey200}`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  background: C.grey50,
};
const gridTwoStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 10,
};
const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: C.grey500,
  fontWeight: 500,
};
const inputStyle: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13,
  padding: '6px 10px',
  border: `1px solid ${C.grey300}`,
  borderRadius: 6,
  background: C.white,
  color: C.grey900,
  height: 32,
};

export default EjecucionesRecurrentesSection;
