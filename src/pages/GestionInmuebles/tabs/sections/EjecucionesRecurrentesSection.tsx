// src/pages/GestionInmuebles/tabs/sections/EjecucionesRecurrentesSection.tsx
//
// PR5.5 · Sección "Ejecuciones del año" debajo de las plantillas recurrentes.
// PR5-HOTFIX v3 · se elimina el modal inline `AddGastoPuntualModal` y se usa
// el `AddMovementModal` unificado de Conciliación v2 con pre-fill + locked.
// Además se añade la columna Cuenta a la tabla.
//
// Muestra todas las líneas de `gastosInmueble` del inmueble cuya casilla AEAT
// sea 0109/0113/0114/0115, agrupadas por año.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Account, GastoInmueble, Property } from '../../../../services/db';
import { initDB } from '../../../../services/db';
import { gastosInmuebleService } from '../../../../services/gastosInmuebleService';
import { confirmDelete } from '../../../../services/confirmationService';
import AddMovementModal from '../../../../modules/horizon/conciliacion/v2/components/AddMovementModal';
import '../../../../modules/horizon/conciliacion/v2/conciliacion-v2.css';

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

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
  ' €';

const fmtDate = (iso: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

function accountLabel(a: Account | undefined): string {
  if (!a) return '—';
  const name = a.alias ?? a.banco?.name ?? a.bank ?? `Cuenta ${a.id ?? ''}`;
  const tail = a.iban ? a.iban.slice(-4) : '';
  return tail ? `${name} ·${tail}` : name;
}

interface Props {
  propertyId: number;
}

const EjecucionesRecurrentesSection: React.FC<Props> = ({ propertyId }) => {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [ejecuciones, setEjecuciones] = useState<GastoInmueble[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [gastos, accs, props] = await Promise.all([
        gastosInmuebleService.getByInmueble(propertyId),
        (async () => {
          const db = await initDB();
          return (await db.getAll('accounts')) as Account[];
        })(),
        (async () => {
          const db = await initDB();
          return (await db.getAll('properties')) as Property[];
        })(),
      ]);
      setAccounts(accs);
      setProperties(props);
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

  // PR5-HOTFIX v3 · cache por-id para pintar la columna "Cuenta". La
  // relación línea→cuenta vive en `cuentaBancaria` (string con el id
  // numérico) · si falla, queda en '—'.
  const accountsById = useMemo(() => {
    const map = new Map<number, Account>();
    for (const a of accounts) if (a.id != null) map.set(a.id, a);
    return map;
  }, [accounts]);

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
                <Th>Cuenta</Th>
                <Th align="right">Importe</Th>
                <Th>Tipo</Th>
                <Th>Origen</Th>
                <Th>Tesorería</Th>
                <Th align="center">Doc</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {ejecuciones.map((e) => {
                const accountIdNum = e.cuentaBancaria ? Number(e.cuentaBancaria) : NaN;
                const account = Number.isFinite(accountIdNum)
                  ? accountsById.get(accountIdNum)
                  : undefined;
                return (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${C.grey100}` }}>
                    <Td mono>{fmtDate(e.fecha)}</Td>
                    <Td bold>{e.concepto}</Td>
                    <Td>{e.proveedorNombre || e.proveedorNIF || '—'}</Td>
                    <Td mono>{accountLabel(account)}</Td>
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
                        {/* PR5-HOTFIX v3 · la edición en-tabla se ha retirado
                            para evitar rutas paralelas a la cadena event ↔
                            movement ↔ línea; el botón sigue clicable para
                            informar al usuario con un toast. */}
                        <IconButton
                          title="Editar desde Conciliación"
                          onClick={() => {
                            toast('Edita desde Conciliación para propagar cambios', { icon: 'ℹ️' });
                          }}
                        >
                          <Pencil size={14} />
                        </IconButton>
                        <IconButton title="Eliminar" onClick={() => void handleDelete(e)}>
                          <Trash2 size={14} />
                        </IconButton>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PR5-HOTFIX v3 · modal unificado con el de Conciliación. Llega con
          Tipo/Ámbito/Inmueble pre-rellenados y bloqueados + filtrado de
          categorías a las 6 permitidas en OPEX. */}
      {showAddModal && (
        <AddMovementModal
          accounts={accounts}
          properties={properties}
          defaultYear={year}
          defaultMonth0={new Date().getMonth()}
          prefill={{
            tipo: 'gasto',
            ambito: 'inmueble',
            inmuebleId: propertyId,
          }}
          locked={{
            tipo: true,
            ambito: true,
            inmueble: true,
          }}
          restrictCategoriesTo="opex"
          onClose={() => setShowAddModal(false)}
          onCreated={async () => {
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
      whiteSpace: mono ? 'nowrap' : undefined,
    }}
  >
    {children}
  </td>
);

const IconButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ title, onClick, children, disabled }) => (
  <button
    title={title}
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: 6,
      background: 'transparent',
      border: 'none',
      borderRadius: 4,
      cursor: disabled ? 'not-allowed' : 'pointer',
      color: C.grey500,
      display: 'inline-flex',
      alignItems: 'center',
      opacity: disabled ? 0.4 : 1,
    }}
    onMouseEnter={(e) => {
      if (disabled) return;
      e.currentTarget.style.color = C.navy900;
      e.currentTarget.style.background = C.grey50;
    }}
    onMouseLeave={(e) => {
      if (disabled) return;
      e.currentTarget.style.color = C.grey500;
      e.currentTarget.style.background = 'transparent';
    }}
  >
    {children}
  </button>
);

// ═══════════════════════════════════════════════════════════════════════
// Estilos inline
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

export default EjecucionesRecurrentesSection;
