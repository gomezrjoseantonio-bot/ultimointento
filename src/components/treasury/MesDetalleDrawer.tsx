// ============================================================================
// ATLAS · T31 · MesDetalleDrawer
// ============================================================================
//
// Drawer telescópico que se abre desde el clic en una mes-card del calendario
// rodante 24m. Replica el diseño del mockup atlas-tesoreria-v8.html con DOS
// niveles anidados:
//
//   Nivel 1 · MES
//     · KPIs (Entradas · Salidas · Balance neto)
//     · Mini-calendario "día a día" (L M X J V S D) con neto por día
//     · Listas "↑ Ingresos previstos" y "↓ Gastos previstos"
//     · Clic en una celda de día → empuja Nivel 2
//
//   Nivel 2 · DÍA
//     · Botón "atrás" para volver al mes
//     · KPIs (Saldo inicio día · Movimientos · Saldo fin día)
//     · Lista de cuentas con flujo + saldo proyectado fin día
//     · Banner si alguna cuenta cae bajo 0
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const formatEur = (v: number): string =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatCompact = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1000) {
    const k = (v / 1000).toFixed(1).replace(/\.0$/, '');
    return `${v < 0 ? '−' : '+'}${k}K`;
  }
  return `${v < 0 ? '−' : '+'}${formatEur(Math.abs(v))}`;
};

const formatDateShort = (iso: string): string => {
  const d = new Date(iso.length > 10 ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
};

export interface MesDrawerEvent {
  id?: number | string;
  predictedDate: string;
  type: 'income' | 'expense' | 'financing';
  amount: number;
  description?: string;
  status?: string;
  accountId?: number;
  sourceType?: string;
}

export interface MesDrawerAccount {
  id?: number;
  alias?: string;
  name?: string;
  iban?: string;
  balance?: number;
  openingBalance?: number;
  banco?: { name?: string };
}

export interface MesDetalleDrawerProps {
  open: boolean;
  year: number | null;
  monthIndex0: number | null;
  events: MesDrawerEvent[];
  accounts: MesDrawerAccount[];
  onClose: () => void;
  /** Navegar a Conciliación filtrada por día + cuenta. Sub-tarea 3 calendario fixes. */
  onIrAConciliacionDia?: (dayIso: string, accountId: number | undefined) => void;
  /**
   * Conciliar un treasury event desde el drawer día. Recibe los ids de los
   * eventos seleccionados y devuelve `{ ok, failed }`. Sub-tarea 4.
   */
  onConciliarSeleccion?: (
    eventIds: number[],
  ) => Promise<{ ok: number; failed: number }>;
  /**
   * S-TESORERIA-FASE-B sub-tarea 4 · clic en un item del listado de
   * Ingresos/Gastos previstos · abre el drawer de movimiento existente.
   */
  onEventClick?: (eventId: number | string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function dayKey(year: number, monthIndex0: number, day: number): string {
  const mm = String(monthIndex0 + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function eventDay(e: MesDrawerEvent): { y: number; m: number; d: number } | null {
  if (!e.predictedDate) return null;
  const dt = new Date(e.predictedDate.length > 10 ? e.predictedDate : `${e.predictedDate}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() };
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function dayOfWeekMon0(year: number, monthIndex0: number, day: number): number {
  // 0 = Lunes, 6 = Domingo
  const js = new Date(year, monthIndex0, day).getDay(); // 0=Domingo
  return (js + 6) % 7;
}

function shortAlias(account: MesDrawerAccount): string {
  return account.alias || account.banco?.name || account.name || `Cuenta ${account.id ?? '?'}`;
}

function ibanLast4(account: MesDrawerAccount): string {
  if (!account.iban) return '';
  const trimmed = account.iban.replace(/\s+/g, '');
  return trimmed.length >= 4 ? `···· ${trimmed.slice(-4)}` : trimmed;
}

function logoInitials(account: MesDrawerAccount): string {
  const name = (account.banco?.name || account.alias || account.name || '?').trim();
  // Tomar 2 primeras consonantes mayúsculas o las 2 primeras letras
  const upper = name.toUpperCase().replace(/[^A-Z]/g, '');
  return (upper.slice(0, 2) || name.slice(0, 2)).toUpperCase();
}

// Color por banco · derivado del nombre (mantiene consistencia visual sin
// requerir nuevos campos en Account).
function bankColor(account: MesDrawerAccount): string {
  const n = (account.banco?.name || account.name || '').toLowerCase();
  if (n.includes('santander')) return 'var(--atlas-v5-brand-santander, #EC0000)';
  if (n.includes('sabadell')) return 'var(--atlas-v5-brand-sabadell, #024EA5)';
  if (n.includes('unicaja')) return 'var(--atlas-v5-brand-unicaja, #009639)';
  if (n.includes('myinvestor')) return 'var(--atlas-v5-cripto, #6E5BC7)';
  if (n.includes('bbva')) return '#072146';
  if (n.includes('trade')) return '#0F0F0F';
  return 'var(--atlas-v5-brand)';
}

// ─── Componente ─────────────────────────────────────────────────────────────

const MesDetalleDrawer: React.FC<MesDetalleDrawerProps> = ({
  open,
  year,
  monthIndex0,
  events,
  accounts,
  onClose,
  onIrAConciliacionDia,
  onConciliarSeleccion,
  onEventClick,
}) => {
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);

  // Reset nivel al cerrar/cambiar de mes
  useEffect(() => {
    if (!open) setDiaSeleccionado(null);
  }, [open, year, monthIndex0]);

  // Cierre con Escape · si estoy en nivel día → vuelvo a mes; si estoy en mes → cierro.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (diaSeleccionado != null) setDiaSeleccionado(null);
      else onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, diaSeleccionado]);

  // Eventos del mes
  const eventosMes = useMemo(() => {
    if (year == null || monthIndex0 == null) return [];
    return events
      .filter((e) => {
        const d = eventDay(e);
        return d != null && d.y === year && d.m === monthIndex0;
      })
      .sort((a, b) => a.predictedDate.localeCompare(b.predictedDate));
  }, [events, year, monthIndex0]);

  // Agregado por día · neto del día + marca dominante (mockup v8)
  // marca: 'confirmed' si TODOS los eventos del día están conciliados,
  //        'pending' si hay alguno predicted.
  const netoPorDia = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of eventosMes) {
      const dia = eventDay(e)?.d;
      if (dia == null) continue;
      const signed = e.type === 'income' ? e.amount : -e.amount;
      map.set(dia, (map.get(dia) ?? 0) + signed);
    }
    return map;
  }, [eventosMes]);

  const marcaPorDia = useMemo(() => {
    const map = new Map<number, 'confirmed' | 'pending'>();
    for (const e of eventosMes) {
      const dia = eventDay(e)?.d;
      if (dia == null) continue;
      // Un evento se considera "pending" cuando NO está conciliado/ejecutado.
      // status='predicted' o status ausente → pending. Solo 'confirmed' o
      // 'executed' cuentan como definitivamente conciliados.
      const isConfirmed = e.status === 'confirmed' || e.status === 'executed';
      const cur = map.get(dia);
      // 'pending' tiene prioridad · si hay alguno pending, marca pending.
      if (cur === 'pending') continue;
      map.set(dia, isConfirmed ? 'confirmed' : 'pending');
    }
    return map;
  }, [eventosMes]);

  const ingresos = eventosMes.filter((e) => e.type === 'income');
  const gastos = eventosMes.filter((e) => e.type === 'expense' || e.type === 'financing');
  const totalEntradas = ingresos.reduce((s, e) => s + e.amount, 0);
  const totalSalidas = gastos.reduce((s, e) => s + e.amount, 0);
  const balanceNeto = totalEntradas - totalSalidas;

  const titulo =
    diaSeleccionado != null && monthIndex0 != null
      ? `${diaSeleccionado} ${MESES[monthIndex0].toLowerCase()}`
      : year != null && monthIndex0 != null
        ? `${MESES[monthIndex0]} ${year}`
        : '';

  const sub =
    diaSeleccionado != null
      ? 'desglose por cuenta · saldo inicio y fin de día'
      : `${eventosMes.length} evento${eventosMes.length === 1 ? '' : 's'} · clic en un día para ver el detalle`;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(14,20,35,0.42)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .22s ease',
          zIndex: 100,
        }}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        aria-hidden={!open}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '44%',
          maxWidth: 640,
          minWidth: 380,
          background: 'var(--atlas-v5-card)',
          borderLeft: '1px solid var(--atlas-v5-line)',
          boxShadow: '-8px 0 24px rgba(14,20,35,0.08)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .26s cubic-bezier(.32,.72,0,1)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px 14px',
            borderBottom: '1px solid var(--atlas-v5-line)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--atlas-v5-card)',
            flexShrink: 0,
          }}
        >
          {diaSeleccionado != null && (
            <button
              type="button"
              onClick={() => setDiaSeleccionado(null)}
              aria-label="Volver al mes"
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                border: '1px solid var(--atlas-v5-line)',
                background: 'var(--atlas-v5-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--atlas-v5-ink-3)',
              }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--atlas-v5-ink)',
                letterSpacing: '-0.02em',
              }}
            >
              {titulo}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--atlas-v5-ink-4)',
                marginTop: 2,
                fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
              }}
            >
              {sub}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar drawer"
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              border: '1px solid var(--atlas-v5-line)',
              background: 'var(--atlas-v5-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--atlas-v5-ink-3)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
          {diaSeleccionado == null ? (
            <NivelMes
              year={year}
              monthIndex0={monthIndex0}
              eventosMes={eventosMes}
              ingresos={ingresos}
              gastos={gastos}
              totalEntradas={totalEntradas}
              totalSalidas={totalSalidas}
              balanceNeto={balanceNeto}
              netoPorDia={netoPorDia}
              marcaPorDia={marcaPorDia}
              accounts={accounts}
              onSelectDia={(d) => setDiaSeleccionado(d)}
              onEventClick={onEventClick}
            />
          ) : (
            <NivelDia
              year={year!}
              monthIndex0={monthIndex0!}
              dia={diaSeleccionado}
              eventosMes={eventosMes}
              accounts={accounts}
              onIrAConciliacion={onIrAConciliacionDia}
              onConciliarSeleccion={onConciliarSeleccion}
              onEventClick={onEventClick}
            />
          )}
        </div>
      </aside>
    </>
  );
};

export default MesDetalleDrawer;

// ─── Nivel 1 · MES ──────────────────────────────────────────────────────────

interface NivelMesProps {
  year: number | null;
  monthIndex0: number | null;
  eventosMes: MesDrawerEvent[];
  ingresos: MesDrawerEvent[];
  gastos: MesDrawerEvent[];
  totalEntradas: number;
  totalSalidas: number;
  balanceNeto: number;
  netoPorDia: Map<number, number>;
  marcaPorDia: Map<number, 'confirmed' | 'pending'>;
  accounts: MesDrawerAccount[];
  onSelectDia: (dia: number) => void;
  onEventClick?: (eventId: number | string) => void;
}

const NivelMes: React.FC<NivelMesProps> = ({
  year,
  monthIndex0,
  eventosMes,
  ingresos,
  gastos,
  totalEntradas,
  totalSalidas,
  balanceNeto,
  netoPorDia,
  marcaPorDia,
  accounts,
  onSelectDia,
  onEventClick,
}) => {
  const accountAlias = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of accounts) {
      if (a.id != null) map.set(a.id, shortAlias(a));
    }
    return map;
  }, [accounts]);

  // Counters confirmed/pending para los headers de los colapsables
  const ingresosCounters = useMemo(() => {
    let conf = 0, pend = 0;
    for (const e of ingresos) {
      if (e.status === 'confirmed' || e.status === 'executed') conf += 1;
      else pend += 1;
    }
    return { conf, pend };
  }, [ingresos]);

  const gastosCounters = useMemo(() => {
    let conf = 0, pend = 0;
    for (const e of gastos) {
      if (e.status === 'confirmed' || e.status === 'executed') conf += 1;
      else pend += 1;
    }
    return { conf, pend };
  }, [gastos]);

  const [openIngresos, setOpenIngresos] = useState(true);
  const [openGastos, setOpenGastos] = useState(false);

  if (year == null || monthIndex0 == null) return null;

  return (
    <>
      <KpisGrid>
        <Kpi label="Entradas" value={`+${formatEur(totalEntradas)} €`} tone="pos" />
        <Kpi label="Salidas" value={`−${formatEur(totalSalidas)} €`} tone="neg" />
        <Kpi
          label="Balance neto"
          value={`${balanceNeto >= 0 ? '+' : '−'}${formatEur(Math.abs(balanceNeto))} €`}
          tone={balanceNeto >= 0 ? 'pos' : 'neg'}
          last
        />
      </KpisGrid>

      {/* Mini calendario día a día · marcas conf/pend en cada celda */}
      <SectionHd>Día a día · clic para ver el detalle</SectionHd>
      <MiniCalendario
        year={year}
        monthIndex0={monthIndex0}
        netoPorDia={netoPorDia}
        marcaPorDia={marcaPorDia}
        onSelectDia={onSelectDia}
      />

      {/* Ingresos previstos · colapsable (mockup v8) */}
      {ingresos.length > 0 && (
        <Collapsible
          open={openIngresos}
          onToggle={() => setOpenIngresos((v) => !v)}
          title="Ingresos previstos"
          counter={`${ingresos.length} · ${ingresosCounters.conf} conf · ${ingresosCounters.pend} pend`}
          amount={`+${formatEur(totalEntradas)} €`}
          tone="pos"
        >
          {ingresos.map((e, idx) => (
            <EventoRow
              key={`in-${e.id ?? idx}`}
              evento={e}
              accountAlias={accountAlias}
              onClick={onEventClick}
            />
          ))}
        </Collapsible>
      )}

      {/* Gastos previstos · colapsable (mockup v8) */}
      {gastos.length > 0 && (
        <Collapsible
          open={openGastos}
          onToggle={() => setOpenGastos((v) => !v)}
          title="Gastos previstos"
          counter={`${gastos.length} · ${gastosCounters.conf} conf · ${gastosCounters.pend} pend`}
          amount={`−${formatEur(totalSalidas)} €`}
          tone="neg"
        >
          {gastos.map((e, idx) => (
            <EventoRow
              key={`out-${e.id ?? idx}`}
              evento={e}
              accountAlias={accountAlias}
              onClick={onEventClick}
            />
          ))}
        </Collapsible>
      )}

      {eventosMes.length === 0 && (
        <div
          style={{
            padding: '40px 12px',
            textAlign: 'center',
            color: 'var(--atlas-v5-ink-4)',
            fontSize: 13,
          }}
        >
          Sin eventos para este mes.
        </div>
      )}
    </>
  );
};

// ─── Mini calendario ─────────────────────────────────────────────────────────

const MiniCalendario: React.FC<{
  year: number;
  monthIndex0: number;
  netoPorDia: Map<number, number>;
  marcaPorDia: Map<number, 'confirmed' | 'pending'>;
  onSelectDia: (d: number) => void;
}> = ({ year, monthIndex0, netoPorDia, marcaPorDia, onSelectDia }) => {
  const total = daysInMonth(year, monthIndex0);
  const lead = dayOfWeekMon0(year, monthIndex0, 1);
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < lead; i++) cells.push({ day: null, key: `lead-${i}` });
  for (let d = 1; d <= total; d++) cells.push({ day: d, key: `d-${d}` });
  while (cells.length % 7 !== 0) cells.push({ day: null, key: `tail-${cells.length}` });

  const hoy = new Date();
  const esMesActual = year === hoy.getFullYear() && monthIndex0 === hoy.getMonth();
  const diaHoy = esMesActual ? hoy.getDate() : -1;

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7,1fr)',
          fontSize: 10,
          color: 'var(--atlas-v5-ink-4)',
          textAlign: 'center',
          fontWeight: 600,
          paddingBottom: 4,
        }}
      >
        <span>L</span><span>M</span><span>X</span><span>J</span>
        <span>V</span><span>S</span><span>D</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {cells.map((c) => {
          if (c.day == null) {
            return (
              <div
                key={c.key}
                aria-hidden="true"
                style={{
                  aspectRatio: '1',
                  background: 'var(--atlas-v5-card-alt)',
                  opacity: 0.3,
                  borderRadius: 5,
                }}
              />
            );
          }
          const neto = netoPorDia.get(c.day) ?? 0;
          const marca = marcaPorDia.get(c.day);
          const isToday = c.day === diaHoy;
          // Today · borde oro 2px (no fill) · resto fondo card-alt (mockup v8)
          const cellBg = 'var(--atlas-v5-card-alt)';
          const cellBorder = isToday
            ? '2px solid var(--atlas-v5-gold)'
            : '1px solid transparent';
          const numColor = 'var(--atlas-v5-ink)';
          const amtColor =
            neto >= 0 ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)';
          // Mark dot · navy si confirmed, oro si pending
          const markColor =
            marca === 'confirmed'
              ? 'var(--atlas-v5-brand)'
              : marca === 'pending'
                ? 'var(--atlas-v5-gold)'
                : null;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onSelectDia(c.day!)}
              aria-label={`Día ${c.day}`}
              style={{
                aspectRatio: '1',
                padding: '5px 4px',
                borderRadius: 5,
                background: cellBg,
                border: cellBorder,
                cursor: 'pointer',
                fontSize: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                fontFamily: 'inherit',
                position: 'relative',
              }}
            >
              <span style={{ fontWeight: 700, color: numColor, fontSize: 10.5 }}>
                {c.day}
              </span>
              {markColor && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: markColor,
                  }}
                />
              )}
              {neto !== 0 && (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
                    fontSize: 8.5,
                    fontWeight: 600,
                    marginTop: 'auto',
                    color: amtColor,
                    lineHeight: 1.1,
                  }}
                >
                  {formatCompact(neto)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
};

// ─── Nivel 2 · DÍA ──────────────────────────────────────────────────────────

interface NivelDiaProps {
  year: number;
  monthIndex0: number;
  dia: number;
  eventosMes: MesDrawerEvent[];
  accounts: MesDrawerAccount[];
  onIrAConciliacion?: (dayIso: string, accountId: number | undefined) => void;
  onConciliarSeleccion?: (
    eventIds: number[],
  ) => Promise<{ ok: number; failed: number }>;
  onEventClick?: (eventId: number | string) => void;
}

const NivelDia: React.FC<NivelDiaProps> = ({
  year,
  monthIndex0,
  dia,
  eventosMes,
  accounts,
  onIrAConciliacion,
  onConciliarSeleccion,
  onEventClick,
}) => {
  const fechaIso = dayKey(year, monthIndex0, dia);
  const [isConciliando, setIsConciliando] = useState(false);
  // Reset al cambiar de día (placeholder · no hay estado mutable por día
  // tras eliminar la selección bulk multi-banco · cada BankDayCard tiene
  // su propio "Conciliar pendientes (N)").
  useEffect(() => {
    /* noop · hook reservado para futuro reset de UI por día */
  }, [year, monthIndex0, dia]);

  // Saldo proyectado por cuenta a fin del día seleccionado.
  // Sumamos · balance actual + todos los eventos del mes hasta el día (inclusive).
  // Para días previos al mes en curso esto es aproximación visual.
  const breakdown = useMemo(() => {
    return accounts
      .filter((a) => a.id != null)
      .map((a) => {
        const accId = a.id as number;
        const eventosCuenta = eventosMes.filter((e) => e.accountId === accId);
        const eventosDelDia = eventosCuenta.filter(
          (e) => e.predictedDate.startsWith(fechaIso),
        );
        const eventosPrevios = eventosCuenta.filter(
          (e) => e.predictedDate < fechaIso,
        );

        const saldoBase = a.balance ?? a.openingBalance ?? 0;
        const flujoPrevio = eventosPrevios.reduce(
          (s, e) => s + (e.type === 'income' ? e.amount : -e.amount),
          0,
        );
        const saldoInicio = saldoBase + flujoPrevio;

        const entradasDia = eventosDelDia
          .filter((e) => e.type === 'income')
          .reduce((s, e) => s + e.amount, 0);
        const salidasDia = eventosDelDia
          .filter((e) => e.type === 'expense' || e.type === 'financing')
          .reduce((s, e) => s + e.amount, 0);
        const saldoFin = saldoInicio + entradasDia - salidasDia;

        return {
          account: a,
          saldoInicio,
          entradasDia,
          salidasDia,
          saldoFin,
          warn: saldoFin < 0,
        };
      });
  }, [accounts, eventosMes, fechaIso]);

  const saldoInicioTotal = breakdown.reduce((s, b) => s + b.saldoInicio, 0);
  const entradasDiaTotal = breakdown.reduce((s, b) => s + b.entradasDia, 0);
  const salidasDiaTotal = breakdown.reduce((s, b) => s + b.salidasDia, 0);
  const saldoFinTotal = saldoInicioTotal + entradasDiaTotal - salidasDiaTotal;

  const cuentasEnRiesgo = breakdown.filter((b) => b.warn);

  // Sub-tarea 3 calendario fixes · listado de eventos del día con cuenta afectada
  // y acción "Ver en Conciliación" (filtra por día + cuenta).
  const eventosDelDia = useMemo(
    () => eventosMes.filter((e) => e.predictedDate.startsWith(fechaIso)),
    [eventosMes, fechaIso],
  );
  // S-TESORERIA-FASE-B sub-tarea 5 · agrupación banco-protagonista
  // Solo bancos con movimientos ese día se renderizan. Cada uno con su
  // propia card · header (logo + alias + iban + saldo inicio→fin) +
  // listado de eventos del día (mark conf/pend + concept + amount) +
  // acción "Conciliar pendientes (N)" si hay pendientes.
  const breakdownConMovs = useMemo(
    () => breakdown.filter((b) => b.entradasDia + b.salidasDia > 0),
    [breakdown],
  );

  return (
    <>
      <KpisGrid>
        <Kpi
          label="Saldo inicio día"
          value={`${formatEur(saldoInicioTotal)} €`}
          tone="ink"
        />
        <Kpi
          label="Movimientos"
          value={`${entradasDiaTotal - salidasDiaTotal >= 0 ? '+' : '−'}${formatEur(Math.abs(entradasDiaTotal - salidasDiaTotal))} €`}
          tone={entradasDiaTotal - salidasDiaTotal >= 0 ? 'pos' : 'neg'}
        />
        <Kpi
          label="Saldo fin día"
          value={`${saldoFinTotal >= 0 ? '' : '−'}${formatEur(Math.abs(saldoFinTotal))} €`}
          tone={saldoFinTotal >= 0 ? 'ink' : 'neg'}
          last
        />
      </KpisGrid>

      {breakdownConMovs.length === 0 ? (
        <div
          style={{
            padding: '40px 12px',
            textAlign: 'center',
            color: 'var(--atlas-v5-ink-4)',
            fontSize: 13,
          }}
        >
          Sin movimientos en ningún banco para este día.
        </div>
      ) : (
        breakdownConMovs.map((b) => {
          const accId = b.account.id as number;
          const eventosBanco = eventosDelDia.filter(
            (e) => e.accountId === accId,
          );
          const pendientes = eventosBanco.filter(
            (e) => e.status !== 'executed' && e.status !== 'confirmed',
          );
          const confirmados = eventosBanco.length - pendientes.length;
          const netoBanco = b.entradasDia - b.salidasDia;
          return (
            <BankDayCard
              key={accId}
              account={b.account}
              saldoInicio={b.saldoInicio}
              saldoFin={b.saldoFin}
              warn={b.warn}
              eventos={eventosBanco}
              netoBanco={netoBanco}
              confirmados={confirmados}
              pendientesCount={pendientes.length}
              onEventClick={onEventClick}
              onConciliarPendientes={
                onConciliarSeleccion && pendientes.length > 0
                  ? async () => {
                      const ids = pendientes
                        .map((p) => (typeof p.id === 'number' ? p.id : null))
                        .filter((x): x is number => x != null);
                      if (ids.length === 0) return;
                      setIsConciliando(true);
                      try {
                        await onConciliarSeleccion(ids);
                      } finally {
                        setIsConciliando(false);
                      }
                    }
                  : undefined
              }
              isConciliando={isConciliando}
              onIrAConciliacion={
                onIrAConciliacion
                  ? () => onIrAConciliacion(fechaIso, accId)
                  : undefined
              }
            />
          );
        })
      )}

      {cuentasEnRiesgo.length > 0 && (
        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: 'var(--atlas-v5-ink-4)',
            padding: '12px 14px',
            background: 'var(--atlas-v5-card-alt)',
            borderRadius: 8,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: 'var(--atlas-v5-ink-3)' }}>
            {cuentasEnRiesgo.length === 1
              ? `${shortAlias(cuentasEnRiesgo[0].account)} bajo umbral.`
              : `${cuentasEnRiesgo.length} cuentas bajo umbral.`}
          </strong>{' '}
          {cuentasEnRiesgo.length === 1
            ? `El saldo proyectado queda en ${formatEur(cuentasEnRiesgo[0].saldoFin)} € · considera transferir antes del cargo.`
            : `Algunas cuentas quedarían en negativo · considera reagrupar saldos.`}
        </div>
      )}
    </>
  );
};

// ─── Sub-tarea 5 · BankDayCard (mockup v8) ──────────────────────────────────
// Banco protagonista del día · header con logo + alias + iban + saldo
// inicio→fin · listado de eventos con mark conf/pend (clic abre drawer del
// movimiento existente) · acción "Conciliar pendientes" si hay pendientes.

const BankDayCard: React.FC<{
  account: MesDrawerAccount;
  saldoInicio: number;
  saldoFin: number;
  warn: boolean;
  eventos: MesDrawerEvent[];
  netoBanco: number;
  confirmados: number;
  pendientesCount: number;
  onEventClick?: (eventId: number | string) => void;
  onConciliarPendientes?: () => Promise<void> | void;
  isConciliando: boolean;
  onIrAConciliacion?: () => void;
}> = ({
  account,
  saldoInicio,
  saldoFin,
  warn,
  eventos,
  netoBanco,
  confirmados,
  pendientesCount,
  onEventClick,
  onConciliarPendientes,
  isConciliando,
  onIrAConciliacion,
}) => {
  const movsLabel =
    pendientesCount > 0 && confirmados > 0
      ? `${confirmados} conf · ${pendientesCount} pend`
      : pendientesCount > 0
        ? `${pendientesCount} pendiente${pendientesCount === 1 ? '' : 's'}`
        : `${confirmados} confirmado${confirmados === 1 ? '' : 's'}`;
  return (
    <div
      style={{
        border: `1px solid ${warn ? 'var(--atlas-v5-neg)' : 'var(--atlas-v5-line)'}`,
        borderRadius: 10,
        marginBottom: 10,
        background: 'var(--atlas-v5-card)',
        overflow: 'hidden',
      }}
    >
      {/* Header · logo + alias + iban + saldo inicio→fin */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '36px 1fr auto',
          gap: 12,
          padding: '12px 14px',
          alignItems: 'center',
          borderBottom: '1px solid var(--atlas-v5-line-2)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--atlas-v5-white)',
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            background: bankColor(account),
          }}
        >
          {logoInitials(account)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              color: 'var(--atlas-v5-ink)',
              fontSize: 13.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {shortAlias(account)}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--atlas-v5-ink-4)',
              fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
              marginTop: 2,
            }}
          >
            {ibanLast4(account)}
          </div>
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
            fontSize: 12,
            color: 'var(--atlas-v5-ink-3)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <span>{formatEur(saldoInicio)} €</span>
          <span style={{ color: 'var(--atlas-v5-ink-5)' }}>→</span>
          <span
            style={{
              fontWeight: 700,
              color: warn ? 'var(--atlas-v5-neg)' : 'var(--atlas-v5-ink)',
            }}
          >
            {saldoFin < 0 ? '−' : ''}{formatEur(Math.abs(saldoFin))} €
          </span>
        </div>
      </div>

      {/* Sub-header · contador + neto */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px 6px',
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            color: 'var(--atlas-v5-ink-4)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}
        >
          Movimientos · {movsLabel}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
            fontSize: 12,
            fontWeight: 700,
            color: netoBanco >= 0 ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
          }}
        >
          {netoBanco >= 0 ? '+' : '−'}{formatEur(Math.abs(netoBanco))} €
        </span>
      </div>

      {/* Eventos del día · clic abre drawer movimiento */}
      <div style={{ padding: '0 10px 10px' }}>
        {eventos.map((e, idx) => {
          const isPos = e.type === 'income';
          const isConfirmed =
            e.status === 'confirmed' || e.status === 'executed';
          const clickable = onEventClick != null && e.id != null;
          const baseStyle: React.CSSProperties = {
            display: 'grid',
            gridTemplateColumns: '18px 1fr auto',
            gap: 10,
            padding: '8px 8px',
            borderRadius: 6,
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            width: '100%',
            textAlign: 'left',
            fontFamily: 'inherit',
            cursor: clickable ? 'pointer' : 'default',
          };
          const inner = (
            <>
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isConfirmed
                    ? 'var(--atlas-v5-brand)'
                    : 'var(--atlas-v5-gold-wash)',
                  color: isConfirmed
                    ? 'var(--atlas-v5-white)'
                    : 'var(--atlas-v5-gold-ink)',
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {isConfirmed ? '✓' : '⏳'}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--atlas-v5-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {e.description || (isPos ? 'Ingreso' : 'Gasto')}
                </div>
              </div>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: isPos ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
                }}
              >
                {isPos ? '+' : '−'}{formatEur(e.amount)} €
              </span>
            </>
          );
          return clickable ? (
            <button
              key={`bev-${e.id ?? idx}`}
              type="button"
              style={baseStyle}
              onClick={() => onEventClick!(e.id!)}
            >
              {inner}
            </button>
          ) : (
            <div key={`bev-${e.id ?? idx}`} style={baseStyle}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Acción · Conciliar pendientes (N) */}
      {pendientesCount > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '0 12px 12px',
          }}
        >
          {onIrAConciliacion && (
            <button
              type="button"
              onClick={onIrAConciliacion}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--atlas-v5-line)',
                background: 'var(--atlas-v5-card)',
                borderRadius: 7,
                fontSize: 11.5,
                fontWeight: 600,
                color: 'var(--atlas-v5-ink-2)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ver en Conciliación
            </button>
          )}
          {onConciliarPendientes && (
            <button
              type="button"
              onClick={onConciliarPendientes}
              disabled={isConciliando}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--atlas-v5-brand)',
                background: 'var(--atlas-v5-brand)',
                borderRadius: 7,
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--atlas-v5-white)',
                cursor: isConciliando ? 'not-allowed' : 'pointer',
                opacity: isConciliando ? 0.7 : 1,
                fontFamily: 'inherit',
              }}
            >
              {isConciliando
                ? 'Conciliando…'
                : `Conciliar pendientes (${pendientesCount})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Piezas comunes ─────────────────────────────────────────────────────────

const KpisGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 0,
      padding: '14px 0',
      marginBottom: 18,
      background: 'var(--atlas-v5-card-alt)',
      borderRadius: 10,
    }}
  >
    {children}
  </div>
);

const Kpi: React.FC<{
  label: string;
  value: string;
  tone: 'pos' | 'neg' | 'ink';
  last?: boolean;
}> = ({ label, value, tone, last }) => (
  <div
    style={{
      padding: '0 14px',
      borderRight: last ? 'none' : '1px solid var(--atlas-v5-line-2)',
    }}
  >
    <div
      style={{
        fontSize: 9.5,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--atlas-v5-ink-4)',
        fontWeight: 700,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        fontSize: 16,
        fontWeight: 700,
        marginTop: 5,
        color:
          tone === 'pos'
            ? 'var(--atlas-v5-pos)'
            : tone === 'neg'
              ? 'var(--atlas-v5-neg)'
              : 'var(--atlas-v5-ink)',
      }}
    >
      {value}
    </div>
  </div>
);

const SectionHd: React.FC<{
  children: React.ReactNode;
  tone?: 'pos' | 'neg';
  arrow?: 'up' | 'down';
  style?: React.CSSProperties;
}> = ({ children, tone, arrow, style }) => (
  <div
    style={{
      fontSize: 10.5,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      marginBottom: 10,
      paddingBottom: 6,
      borderBottom: '1px solid var(--atlas-v5-line-2)',
      color:
        tone === 'pos'
          ? 'var(--atlas-v5-pos)'
          : tone === 'neg'
            ? 'var(--atlas-v5-neg)'
            : 'var(--atlas-v5-ink-4)',
      ...style,
    }}
  >
    {arrow === 'up' && '↑ '}
    {arrow === 'down' && '↓ '}
    {children}
  </div>
);

const EventoRow: React.FC<{
  evento: MesDrawerEvent;
  accountAlias: Map<number, string>;
  onClick?: (eventId: number | string) => void;
}> = ({ evento, accountAlias, onClick }) => {
  const isPos = evento.type === 'income';
  const cuenta = evento.accountId != null ? accountAlias.get(evento.accountId) : undefined;
  const isConfirmed =
    evento.status === 'confirmed' || evento.status === 'executed';
  const clickable = onClick != null && evento.id != null;

  const content = (
    <>
      {/* Mark · ✓ navy si confirmed, ⏳ gold si pending (mockup v8) */}
      <span
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isConfirmed
            ? 'var(--atlas-v5-brand)'
            : 'var(--atlas-v5-gold-wash)',
          color: isConfirmed
            ? 'var(--atlas-v5-white)'
            : 'var(--atlas-v5-gold-ink)',
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {isConfirmed ? '✓' : '⏳'}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--atlas-v5-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {evento.description || (isPos ? 'Ingreso' : 'Gasto')}
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--atlas-v5-ink-4)',
            marginTop: 2,
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          }}
        >
          {formatDateShort(evento.predictedDate)}
          {cuenta ? ` · ${cuenta}` : ''}
        </div>
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          fontSize: 13,
          fontWeight: 700,
          color: isPos ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
        }}
      >
        {isPos ? '+' : '−'}{formatEur(evento.amount)} €
      </div>
    </>
  );

  const baseStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '18px 1fr auto',
    gap: 10,
    padding: '10px 12px',
    border: '1px solid var(--atlas-v5-line-2)',
    borderRadius: 8,
    marginBottom: 6,
    alignItems: 'center',
    background: 'var(--atlas-v5-card)',
    width: '100%',
    textAlign: 'left',
    fontFamily: 'inherit',
  };

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => onClick!(evento.id!)}
        style={{ ...baseStyle, cursor: 'pointer' }}
      >
        {content}
      </button>
    );
  }
  return <div style={baseStyle}>{content}</div>;
};

// ─── Collapsible (mockup v8 · sub-tarea 4) ──────────────────────────────────

const Collapsible: React.FC<{
  open: boolean;
  onToggle: () => void;
  title: string;
  counter: string;
  amount: string;
  tone: 'pos' | 'neg';
  children: React.ReactNode;
}> = ({ open, onToggle, title, counter, amount, tone, children }) => (
  <div
    style={{
      border: '1px solid var(--atlas-v5-line)',
      borderRadius: 10,
      marginTop: 16,
      background: 'var(--atlas-v5-card)',
      overflow: 'hidden',
    }}
  >
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '10px 14px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform .15s',
            color: 'var(--atlas-v5-ink-3)',
          }}
        >
          <ChevronLeft size={14} style={{ transform: 'rotate(180deg)' }} />
        </span>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: 'var(--atlas-v5-ink)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: 'var(--atlas-v5-ink-4)',
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
            marginLeft: 4,
          }}
        >
          {counter}
        </span>
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          fontSize: 13,
          fontWeight: 700,
          color: tone === 'pos' ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
        }}
      >
        {amount}
      </span>
    </button>
    {open && (
      <div
        style={{
          padding: '4px 10px 10px',
          borderTop: '1px solid var(--atlas-v5-line-2)',
        }}
      >
        {children}
      </div>
    )}
  </div>
);
