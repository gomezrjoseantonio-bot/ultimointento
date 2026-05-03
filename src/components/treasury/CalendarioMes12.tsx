// ============================================================================
// ATLAS · T31 · CalendarioMes12 (mockup atlas-tesoreria-v8)
// ============================================================================
//
// Grid 4x3 de 12 meses + paginación entre ventanas de 12 meses (anterior/
// siguiente). Sustituye al CalendarioRolling24m anterior · misma data
// pero con UX más cercana al mockup canónico:
//
//   · Header · "Calendario · {label-rango}" · sub "12 meses · clic para abrir"
//   · Footer · cierre previsto · saldo inicio rango
//   · Grid 4×3 de mes-cards uniformes (misma talla todas)
//   · Border-left de salud · tag pill · saldo + entradas/salidas
//   · Botones ← → para hojear ventanas de 12 meses
//
// Página 0 (default) = mes en curso + 11 siguientes.
// Página -1 = 12 meses anteriores · Página 1 = 12 meses adelante (months
// 12..23 from current month). Saldo acumulado se reinicia desde 0 en la
// primera página visible · es indicativo, no contable.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MESES_CORTO = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const formatEur = (v: number): string =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export interface CalendarTreasuryEvent {
  predictedDate: string;
  type: 'income' | 'expense' | 'financing';
  amount: number;
  status: 'predicted' | 'confirmed' | 'executed' | string;
}

export interface CalendarMovement {
  date: string;
  amount: number;
}

export interface CalendarioMes12Props {
  events: CalendarTreasuryEvent[];
  movements: CalendarMovement[];
  onMonthClick: (year: number, monthIndex0: number) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

type Estado = 'cerrado' | 'en_curso' | 'previsto';
type Salud = 'pos' | 'gold' | 'neg';
type TagVariant = 'default' | 'now' | 'warn' | 'good';

interface DatosMes {
  year: number;
  monthIndex0: number;
  estado: Estado;
  salud: Salud;
  tagLabel: string;
  tagVariant: TagVariant;
  saldoFinal: number;
  entradas: number;
  salidas: number;
  esMesActual: boolean;
}

function deriveTag(
  monthIndex0: number,
  estado: Estado,
  esMesActual: boolean,
  neto: number,
): { label: string; variant: TagVariant } {
  if (esMesActual) return { label: 'en curso · hoy', variant: 'now' };
  if (estado === 'cerrado') return { label: 'cerrado', variant: 'default' };
  if (monthIndex0 === 5) return { label: 'irpf', variant: 'warn' };
  if (monthIndex0 === 10) return { label: 'irpf 2º plazo', variant: 'warn' };
  if (monthIndex0 === 6 || monthIndex0 === 11) return { label: 'paga extra', variant: 'good' };
  if (neto < -3000) return { label: 'tensión', variant: 'warn' };
  return { label: 'previsto', variant: 'default' };
}

function deriveSalud(neto: number, estado: Estado): Salud {
  if (estado === 'cerrado') return neto >= 0 ? 'pos' : 'neg';
  if (neto >= 0) return 'pos';
  if (neto < -3000) return 'neg';
  return 'gold';
}

// ─── Componente ─────────────────────────────────────────────────────────────

const CalendarioMes12: React.FC<CalendarioMes12Props> = ({
  events,
  movements,
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

  const meses: DatosMes[] = useMemo(() => {
    const arr: DatosMes[] = [];
    let saldoAcumulado = 0;
    for (let i = 0; i < 12; i++) {
      const fechaInicio = addMonths(inicioPagina, i);
      const year = fechaInicio.getFullYear();
      const m = fechaInicio.getMonth();

      const eventosMes = events.filter((e) => {
        if (!e.predictedDate) return false;
        const d = new Date(e.predictedDate);
        return d.getFullYear() === year && d.getMonth() === m;
      });
      const movsMes = movements.filter((mv) => {
        if (!mv.date) return false;
        const d = new Date(mv.date);
        return d.getFullYear() === year && d.getMonth() === m;
      });

      const entradas = eventosMes
        .filter((e) => e.type === 'income')
        .reduce((s, e) => s + e.amount, 0);
      const salidas = eventosMes
        .filter((e) => e.type === 'expense' || e.type === 'financing')
        .reduce((s, e) => s + e.amount, 0);
      const neto = entradas - salidas;
      saldoAcumulado += neto;

      const tieneMov = movsMes.length > 0;
      const tienePredicted = eventosMes.some((e) => e.status === 'predicted');
      let estado: Estado;
      if (tieneMov && !tienePredicted) estado = 'cerrado';
      else if (tieneMov && tienePredicted) estado = 'en_curso';
      else estado = 'previsto';

      const esMesActual = year === hoy.getFullYear() && m === hoy.getMonth();
      if (esMesActual) estado = 'en_curso';

      const tag = deriveTag(m, estado, esMesActual, neto);
      const salud = deriveSalud(neto, estado);

      arr.push({
        year,
        monthIndex0: m,
        estado,
        salud,
        tagLabel: tag.label,
        tagVariant: tag.variant,
        saldoFinal: saldoAcumulado,
        entradas,
        salidas,
        esMesActual,
      });
    }
    return arr;
  }, [events, movements, inicioPagina, hoy]);

  const primerMes = meses[0];
  const ultimoMes = meses[meses.length - 1];
  const rangoLabel =
    primerMes && ultimoMes
      ? primerMes.year === ultimoMes.year
        ? `${primerMes.year}`
        : `${MESES_CORTO[primerMes.monthIndex0]} ${primerMes.year} – ${MESES_CORTO[ultimoMes.monthIndex0]} ${ultimoMes.year}`
      : '';

  const totalEntradas = meses.reduce((s, m) => s + m.entradas, 0);
  const totalSalidas = meses.reduce((s, m) => s + m.salidas, 0);
  const resultado = totalEntradas - totalSalidas;
  const cierrePrevisto = ultimoMes?.saldoFinal ?? 0;

  return (
    <div>
      {/* Header con rango + paginación */}
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
              fontSize: 14,
              fontWeight: 600,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
              fontSize: 12.5,
              color: 'var(--atlas-v5-ink-3)',
            }}
          >
            cierre previsto ·{' '}
            <strong style={{ color: 'var(--atlas-v5-ink)' }}>
              {formatEur(cierrePrevisto)} €
            </strong>
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

      {/* Footer con totales */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid var(--atlas-v5-line-2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--atlas-v5-ink-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontWeight: 600,
            }}
          >
            Resultado previsto
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
              fontWeight: 700,
              fontSize: 18,
              color: resultado >= 0 ? 'var(--atlas-v5-pos)' : 'var(--atlas-v5-neg)',
              marginTop: 4,
              letterSpacing: '-0.02em',
            }}
          >
            {resultado >= 0 ? '+ ' : '− '}{formatEur(Math.abs(resultado))} €
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 10,
              color: 'var(--atlas-v5-ink-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontWeight: 600,
            }}
          >
            Cierre previsto
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
              fontWeight: 700,
              fontSize: 18,
              color: 'var(--atlas-v5-ink)',
              marginTop: 4,
              letterSpacing: '-0.02em',
            }}
          >
            {formatEur(cierrePrevisto)} €
          </div>
        </div>
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

interface MesCardProps {
  datos: DatosMes;
  onClick: (year: number, monthIndex0: number) => void;
}

const TAG_STYLES: Record<TagVariant, React.CSSProperties> = {
  default: {
    background: 'var(--atlas-v5-bg)',
    color: 'var(--atlas-v5-ink-4)',
  },
  now: {
    background: 'var(--atlas-v5-gold-2)',
    color: 'var(--atlas-v5-white)',
  },
  warn: {
    background: 'var(--atlas-v5-warn-wash)',
    color: 'var(--atlas-v5-gold-ink)',
  },
  good: {
    background: 'var(--atlas-v5-pos-wash)',
    color: 'var(--atlas-v5-pos)',
  },
};

const SALUD_BORDER: Record<Salud, string> = {
  pos: 'var(--atlas-v5-pos)',
  gold: 'var(--atlas-v5-gold-2)',
  neg: 'var(--atlas-v5-neg)',
};

const MesCard: React.FC<MesCardProps> = ({ datos, onClick }) => {
  const handle = (): void => onClick(datos.year, datos.monthIndex0);
  const isCurrent = datos.esMesActual;
  const isPast = datos.estado === 'cerrado';

  const cardStyle: React.CSSProperties = {
    background: isCurrent
      ? 'var(--atlas-v5-gold-wash)'
      : 'var(--atlas-v5-card-alt)',
    border: `1px solid ${
      isCurrent ? 'var(--atlas-v5-gold-2)' : 'var(--atlas-v5-line)'
    }`,
    borderLeft: `3px solid ${SALUD_BORDER[datos.salud]}`,
    borderRadius: 10,
    padding: '12px 14px 12px 11px',
    cursor: 'pointer',
    transition: 'border-color .12s, transform .12s, box-shadow .12s',
    opacity: isPast ? 0.78 : 1,
  };

  const tagStyle: React.CSSProperties = {
    display: 'inline-block',
    fontSize: 9.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '2px 6px',
    borderRadius: 4,
    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
    marginBottom: 10,
    ...TAG_STYLES[datos.tagVariant],
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
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--atlas-v5-ink)',
          marginBottom: 4,
        }}
      >
        {MESES[datos.monthIndex0]}
      </div>
      <div style={tagStyle}>{datos.tagLabel}</div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--atlas-v5-ink)',
          letterSpacing: '-0.025em',
          marginBottom: 8,
        }}
      >
        {formatEur(datos.saldoFinal)} €
      </div>
      <div style={cardRowStyle}>
        <span>Entradas</span>
        <span style={{ ...cardRowAmtStyle, color: 'var(--atlas-v5-pos)' }}>
          +{formatEur(datos.entradas)}
        </span>
      </div>
      <div style={cardRowStyle}>
        <span>Salidas</span>
        <span style={{ ...cardRowAmtStyle, color: 'var(--atlas-v5-neg)' }}>
          −{formatEur(datos.salidas)}
        </span>
      </div>
    </div>
  );
};

const cardRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 10.5,
  color: 'var(--atlas-v5-ink-4)',
  padding: '2px 0',
};
const cardRowAmtStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
  fontWeight: 600,
  fontSize: 11,
};
