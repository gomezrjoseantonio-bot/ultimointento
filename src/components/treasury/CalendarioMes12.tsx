// ============================================================================
// ATLAS · S-TESORERIA-FASE-B · CalendarioMes12 (mockup atlas-tesoreria-v8)
// ============================================================================
//
// Grid 4×3 de 12 meses + paginación entre ventanas de 12 meses (anterior/
// siguiente). Sigue el mockup canónico v8 · cards reformuladas:
//
//   · Mes en curso · pill "en curso" oro + Saldo HOY + Saldo cierre
//                    + divider + Pendientes entrar + Pendientes salir
//   · Resto meses · Saldo cierre + variación vs mes anterior (muted)
//                   + divider + Pendientes entrar + Pendientes salir
//   · Cabecera · "Calendario · {mes-actual} – {mes-cierre}" + cierre previsto
//   · NO etiquetas IRPF · paga extra · tensión (eliminadas en sub-tarea 3)
//
// Página 0 (default) = mes en curso + 11 siguientes.
// `totalSaldo` = saldo consolidado HOY (anchor de la proyección acumulada).
// ============================================================================

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const formatEur = (v: number): string =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export interface CalendarTreasuryEvent {
  predictedDate: string;
  type: 'income' | 'expense' | 'financing';
  amount: number;
  status: 'predicted' | 'confirmed' | 'executed' | string;
  executedMovementId?: number;
}

export interface CalendarMovement {
  date: string;
  amount: number;
  isOpeningBalance?: boolean;
}

export interface CalendarAccount {
  id?: number;
  balance?: number;
  openingBalance?: number;
}

export interface CalendarioMes12Props {
  events: CalendarTreasuryEvent[];
  /**
   * Movimientos · reservados para futura compatibilidad. La proyección
   * actual se infiere íntegramente de `events`, pero mantenemos el prop
   * (opcional) para no romper integraciones existentes.
   */
  movements?: CalendarMovement[];
  /** Cuentas activas · usadas para fallback si totalSaldo no se pasa. */
  accounts?: CalendarAccount[];
  /** Saldo consolidado HOY · anchor de la proyección (mockup v8). */
  totalSaldo?: number;
  onMonthClick: (year: number, monthIndex0: number) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

interface DatosMes {
  year: number;
  monthIndex0: number;
  esMesActual: boolean;
  esPasado: boolean;
  /** Saldo proyectado al cierre del mes. */
  saldoCierre: number;
  /** Saldo HOY · solo se renderiza para el mes en curso. */
  saldoHoy?: number;
  /** Diferencia vs saldo cierre del mes anterior (para meses NO en curso). */
  variacion: number;
  /** Suma eventos status='predicted' tipo income en el mes. */
  pendientesEntrar: number;
  /** Suma eventos status='predicted' tipo expense/financing en el mes. */
  pendientesSalir: number;
}

// ─── Componente ─────────────────────────────────────────────────────────────

const CalendarioMes12: React.FC<CalendarioMes12Props> = ({
  events,
  // `movements` se mantiene en el tipo público por compat (ver doc en
  // CalendarioMes12Props) · la proyección se calcula 100% desde `events`.
  movements: _movements,
  accounts,
  totalSaldo,
  onMonthClick,
}) => {
  const hoy = useMemo(() => new Date(), []);
  const inicioMesActual = useMemo(() => startOfMonth(hoy), [hoy]);

  // Página 0 · mes actual + 11 siguientes. Página +1 · siguientes 12 meses.
  const [page, setPage] = useState(0);

  const inicioPagina = useMemo(
    () => addMonths(inicioMesActual, page * 12),
    [inicioMesActual, page],
  );

  // Anchor = saldo consolidado HOY · si no se pasa, fallback a accounts.
  const saldoActual = useMemo(() => {
    if (typeof totalSaldo === 'number') return totalSaldo;
    if (!accounts) return 0;
    return accounts.reduce(
      (sum, a) => sum + (a.balance ?? a.openingBalance ?? 0),
      0,
    );
  }, [totalSaldo, accounts]);

  const meses: DatosMes[] = useMemo(() => {
    const yActual = hoy.getFullYear();
    const mActual = hoy.getMonth();
    const diaHoy = hoy.getDate();

    const computeMonthAggregates = (
      year: number,
      monthIndex0: number,
    ): {
      neto: number;
      pendientesEntrar: number;
      pendientesSalir: number;
    } => {
      let neto = 0;
      let pendientesEntrar = 0;
      let pendientesSalir = 0;
      for (const e of events) {
        if (!e.predictedDate) continue;
        const d = new Date(
          e.predictedDate.length > 10
            ? e.predictedDate
            : `${e.predictedDate}T00:00:00`,
        );
        if (Number.isNaN(d.getTime())) continue;
        if (d.getFullYear() !== year || d.getMonth() !== monthIndex0) continue;
        const isExpense = e.type === 'expense' || e.type === 'financing';
        const signed = isExpense ? -e.amount : e.amount;
        neto += signed;
        if (e.status === 'predicted' && !e.executedMovementId) {
          if (e.type === 'income') pendientesEntrar += e.amount;
          else if (isExpense) pendientesSalir += e.amount;
        }
      }
      return { neto, pendientesEntrar, pendientesSalir };
    };

    // Saldo cierre mes actual:
    //   saldoActual ya refleja todos los movements ejecutados hasta hoy.
    //   Sumamos los eventos restantes del mes con status='predicted' y
    //   fecha >= hoy. Eventos ya ejecutados (executedMovementId) NO se
    //   suman porque ya están en saldoActual.
    let entradasRestantes = 0;
    let salidasRestantes = 0;
    for (const e of events) {
      if (!e.predictedDate) continue;
      if (e.status !== 'predicted' || e.executedMovementId) continue;
      const d = new Date(
        e.predictedDate.length > 10
          ? e.predictedDate
          : `${e.predictedDate}T00:00:00`,
      );
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() !== yActual || d.getMonth() !== mActual) continue;
      if (d.getDate() < diaHoy) continue;
      if (e.type === 'income') entradasRestantes += e.amount;
      else if (e.type === 'expense' || e.type === 'financing') {
        salidasRestantes += e.amount;
      }
    }
    const saldoCierreActual =
      saldoActual + entradasRestantes - salidasRestantes;

    const arr: DatosMes[] = [];
    let saldoCierreAnterior: number | null = null;

    for (let i = 0; i < 12; i++) {
      const fechaInicio = addMonths(inicioPagina, i);
      const year = fechaInicio.getFullYear();
      const m = fechaInicio.getMonth();

      const agg = computeMonthAggregates(year, m);
      const esMesActual = year === yActual && m === mActual;

      let saldoCierre: number;
      if (esMesActual) {
        saldoCierre = saldoCierreActual;
      } else if (saldoCierreAnterior != null) {
        saldoCierre = saldoCierreAnterior + agg.neto;
      } else {
        // Primer mes de la ventana NO es el actual · derivar desde ancla.
        const diff = (year - yActual) * 12 + (m - mActual);
        if (diff > 0) {
          let acum = saldoCierreActual;
          for (let k = 1; k <= diff; k++) {
            const f = addMonths(inicioMesActual, k);
            const a = computeMonthAggregates(f.getFullYear(), f.getMonth());
            acum += a.neto;
          }
          saldoCierre = acum;
        } else {
          let acum = saldoCierreActual;
          for (let k = -1; k >= diff; k--) {
            const f = addMonths(inicioMesActual, k + 1);
            const a = computeMonthAggregates(f.getFullYear(), f.getMonth());
            acum -= a.neto;
          }
          saldoCierre = acum;
        }
      }

      const variacion =
        saldoCierreAnterior != null ? saldoCierre - saldoCierreAnterior : 0;

      const esPasado = year < yActual || (year === yActual && m < mActual);

      arr.push({
        year,
        monthIndex0: m,
        esMesActual,
        esPasado,
        saldoCierre,
        saldoHoy: esMesActual ? saldoActual : undefined,
        variacion,
        pendientesEntrar: agg.pendientesEntrar,
        pendientesSalir: agg.pendientesSalir,
      });

      saldoCierreAnterior = saldoCierre;
    }

    void _movements; // `movements` reservado para compat · ver tipo público
    return arr;
  }, [events, _movements, inicioPagina, hoy, inicioMesActual, saldoActual]);

  const primerMes = meses[0];
  const ultimoMes = meses[meses.length - 1];
  const rangoLabel =
    primerMes && ultimoMes
      ? `${MESES[primerMes.monthIndex0]} ${primerMes.year} – ${MESES[ultimoMes.monthIndex0]} ${ultimoMes.year}`
      : '';

  const cierrePrevisto = ultimoMes?.saldoCierre ?? 0;

  return (
    <div>
      {/* Header con rango + cierre previsto + paginación */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--atlas-v5-ink)',
              letterSpacing: '-0.01em',
            }}
          >
            Calendario · {rangoLabel}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--atlas-v5-ink-4)',
              marginTop: 2,
            }}
          >
            12 meses · clic en uno para abrir el desglose
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 10,
                color: 'var(--atlas-v5-ink-4)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: 600,
              }}
            >
              Cierre previsto
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--atlas-v5-ink)',
                marginTop: 2,
                letterSpacing: '-0.02em',
              }}
            >
              {formatEur(cierrePrevisto)} €
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              aria-label="Ventana anterior"
              onClick={() => setPage((p) => p - 1)}
              style={pageBtnStyle}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              aria-label="Ventana siguiente"
              onClick={() => setPage((p) => p + 1)}
              style={pageBtnStyle}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid 4×3 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
        }}
      >
        {meses.map((m) => (
          <MesCard
            key={`${m.year}-${m.monthIndex0}`}
            datos={m}
            onClick={onMonthClick}
          />
        ))}
      </div>
    </div>
  );
};

export default CalendarioMes12;

// ─── Sub-componentes ────────────────────────────────────────────────────────

const pageBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 7,
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--atlas-v5-ink-3)',
};

const MesCard: React.FC<{
  datos: DatosMes;
  onClick: (year: number, monthIndex0: number) => void;
}> = ({ datos, onClick }) => {
  const handle = (): void => onClick(datos.year, datos.monthIndex0);
  const isCurrent = datos.esMesActual;

  const cardStyle: React.CSSProperties = {
    background: isCurrent
      ? 'var(--atlas-v5-gold-wash)'
      : 'var(--atlas-v5-card-alt)',
    border: `1px solid ${
      isCurrent ? 'var(--atlas-v5-gold-2)' : 'var(--atlas-v5-line)'
    }`,
    borderRadius: 10,
    padding: '12px 14px',
    cursor: 'pointer',
    transition: 'border-color .12s, transform .12s, box-shadow .12s',
    opacity: datos.esPasado ? 0.78 : 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Detalle de ${MESES[datos.monthIndex0]} ${datos.year}`}
      onClick={handle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handle();
        }
      }}
      style={cardStyle}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--atlas-v5-ink)',
          }}
        >
          {MESES[datos.monthIndex0]}
        </span>
        {isCurrent && (
          <span
            style={{
              background: 'var(--atlas-v5-gold)',
              color: 'var(--atlas-v5-brand-ink)',
              padding: '2px 7px',
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
            }}
          >
            en curso
          </span>
        )}
      </div>

      {isCurrent && datos.saldoHoy != null ? (
        <>
          <PrimaryRow lbl="Saldo hoy" val={formatEur(datos.saldoHoy)} />
          <PrimaryRow lbl="Saldo cierre" val={formatEur(datos.saldoCierre)} />
        </>
      ) : (
        <>
          <PrimaryRow lbl="Saldo cierre" val={formatEur(datos.saldoCierre)} />
          <MutedRow
            lbl="vs mes ant."
            val={`${datos.variacion >= 0 ? '+' : '−'}${formatEur(Math.abs(datos.variacion))} €`}
          />
        </>
      )}

      <div
        style={{
          height: 1,
          background: 'var(--atlas-v5-line-2)',
          margin: '4px 0 2px',
        }}
      />

      <MiniRow
        lbl="Pendientes entrar"
        val={
          datos.pendientesEntrar > 0
            ? `+${formatEur(datos.pendientesEntrar)} €`
            : '0 €'
        }
        tone="pos"
      />
      <MiniRow
        lbl="Pendientes salir"
        val={
          datos.pendientesSalir > 0
            ? `−${formatEur(datos.pendientesSalir)} €`
            : '0 €'
        }
        tone="neg"
      />
    </div>
  );
};

const PrimaryRow: React.FC<{ lbl: string; val: string }> = ({ lbl, val }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 6,
    }}
  >
    <span style={{ fontSize: 11, color: 'var(--atlas-v5-ink-4)' }}>{lbl}</span>
    <span
      style={{
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        fontSize: 16,
        fontWeight: 700,
        color: 'var(--atlas-v5-ink)',
        letterSpacing: '-0.025em',
      }}
    >
      {val} €
    </span>
  </div>
);

const MutedRow: React.FC<{ lbl: string; val: string }> = ({ lbl, val }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 6,
      alignItems: 'baseline',
    }}
  >
    <span style={{ fontSize: 10.5, color: 'var(--atlas-v5-ink-5)' }}>{lbl}</span>
    <span
      style={{
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--atlas-v5-ink-4)',
      }}
    >
      {val}
    </span>
  </div>
);

const MiniRow: React.FC<{ lbl: string; val: string; tone: 'pos' | 'neg' }> = ({
  lbl,
  val,
  tone,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 6,
      alignItems: 'baseline',
    }}
  >
    <span style={{ fontSize: 10.5, color: 'var(--atlas-v5-ink-4)' }}>{lbl}</span>
    <span
      style={{
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        fontSize: 11.5,
        fontWeight: 600,
        color: tone === 'pos' ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
      }}
    >
      {val}
    </span>
  </div>
);
