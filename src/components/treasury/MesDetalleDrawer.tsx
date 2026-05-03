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

  // Agregado por día · neto del día
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
              accounts={accounts}
              onSelectDia={(d) => setDiaSeleccionado(d)}
            />
          ) : (
            <NivelDia
              year={year!}
              monthIndex0={monthIndex0!}
              dia={diaSeleccionado}
              eventosMes={eventosMes}
              accounts={accounts}
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
  accounts: MesDrawerAccount[];
  onSelectDia: (dia: number) => void;
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
  accounts,
  onSelectDia,
}) => {
  const accountAlias = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of accounts) {
      if (a.id != null) map.set(a.id, shortAlias(a));
    }
    return map;
  }, [accounts]);

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

      {/* Mini calendario día a día */}
      <SectionHd>Día a día · clic para ver el detalle</SectionHd>
      <MiniCalendario
        year={year}
        monthIndex0={monthIndex0}
        netoPorDia={netoPorDia}
        onSelectDia={onSelectDia}
      />

      {/* Ingresos previstos */}
      {ingresos.length > 0 && (
        <>
          <SectionHd tone="pos" arrow="up" style={{ marginTop: 22 }}>
            Ingresos previstos
          </SectionHd>
          {ingresos.map((e, idx) => (
            <EventoRow
              key={`in-${e.id ?? idx}`}
              evento={e}
              accountAlias={accountAlias}
            />
          ))}
        </>
      )}

      {/* Gastos previstos */}
      {gastos.length > 0 && (
        <>
          <SectionHd tone="neg" arrow="down" style={{ marginTop: 22 }}>
            Gastos previstos
          </SectionHd>
          {gastos.map((e, idx) => (
            <EventoRow
              key={`out-${e.id ?? idx}`}
              evento={e}
              accountAlias={accountAlias}
            />
          ))}
        </>
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
  onSelectDia: (d: number) => void;
}> = ({ year, monthIndex0, netoPorDia, onSelectDia }) => {
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
          const isToday = c.day === diaHoy;
          const cellBg = isToday
            ? 'var(--atlas-v5-gold-2)'
            : 'var(--atlas-v5-card-alt)';
          const numColor = isToday ? 'var(--atlas-v5-white)' : 'var(--atlas-v5-ink)';
          const amtColor = isToday
            ? 'rgba(255,255,255,0.85)'
            : neto >= 0
              ? 'var(--atlas-v5-pos)'
              : 'var(--atlas-v5-neg)';
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
                border: '1px solid transparent',
                cursor: 'pointer',
                fontSize: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontWeight: 700, color: numColor, fontSize: 10.5 }}>
                {c.day}
              </span>
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
}

const NivelDia: React.FC<NivelDiaProps> = ({
  year,
  monthIndex0,
  dia,
  eventosMes,
  accounts,
}) => {
  const fechaIso = dayKey(year, monthIndex0, dia);

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

      <SectionHd>Saldo proyectado por cuenta · fin de día</SectionHd>
      {breakdown.length === 0 ? (
        <div style={{ padding: '20px 0', color: 'var(--atlas-v5-ink-4)', fontSize: 13 }}>
          No hay cuentas configuradas.
        </div>
      ) : (
        breakdown.map((b, idx) => (
          <CuentaDiaRow key={b.account.id ?? idx} breakdown={b} />
        ))
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

// ─── Pieza · CuentaDiaRow ───────────────────────────────────────────────────

const CuentaDiaRow: React.FC<{
  breakdown: {
    account: MesDrawerAccount;
    saldoInicio: number;
    entradasDia: number;
    salidasDia: number;
    saldoFin: number;
    warn: boolean;
  };
}> = ({ breakdown }) => {
  const { account, entradasDia, salidasDia, saldoFin, warn } = breakdown;
  const flowParts: string[] = [];
  flowParts.push(entradasDia > 0 ? `+ ${formatEur(entradasDia)}` : '—');
  flowParts.push(salidasDia > 0 ? `− ${formatEur(salidasDia)}` : '—');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto auto',
        gap: 12,
        padding: '12px 14px',
        borderBottom: '1px solid var(--atlas-v5-line-2)',
        alignItems: 'center',
        fontSize: 12,
        background: warn ? 'rgba(164,51,40,0.06)' : 'transparent',
        borderLeft: warn ? '3px solid var(--atlas-v5-neg)' : '3px solid transparent',
        paddingLeft: warn ? 11 : 14,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--atlas-v5-white)',
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          fontSize: 9,
          fontWeight: 700,
          background: bankColor(account),
        }}
      >
        {logoInitials(account)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            color: 'var(--atlas-v5-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {shortAlias(account)}
        </div>
        <div
          style={{
            fontSize: 10,
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
          fontSize: 11.5,
          color: 'var(--atlas-v5-ink-3)',
          whiteSpace: 'nowrap',
        }}
      >
        {flowParts[0]} / {flowParts[1]}
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          fontWeight: 700,
          fontSize: 12.5,
          minWidth: 90,
          textAlign: 'right',
          color: warn ? 'var(--atlas-v5-neg)' : 'var(--atlas-v5-ink)',
        }}
      >
        {saldoFin < 0 ? '−' : ''}{formatEur(Math.abs(saldoFin))} €
      </div>
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
}> = ({ evento, accountAlias }) => {
  const isPos = evento.type === 'income';
  const cuenta = evento.accountId != null ? accountAlias.get(evento.accountId) : undefined;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
        padding: '10px 12px',
        border: '1px solid var(--atlas-v5-line-2)',
        borderRadius: 8,
        marginBottom: 6,
        alignItems: 'center',
        background: 'var(--atlas-v5-card)',
      }}
    >
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
          {evento.status === 'confirmed' || evento.status === 'executed' ? ' · ✓' : ''}
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
    </div>
  );
};
