// ============================================================================
// ATLAS · T31 · CalendarioRolling24m
// ============================================================================
//
// Vista calendario rodante 24 meses · estilo mes-card del mockup
// docs/audit-inputs/atlas-tesoreria-v8.html · 4 secciones jerárquicas:
//
//   1. Próximos 3 meses           · cards GRANDES (mes en curso + 2 siguientes)
//   2. Resto del año en curso     · cards estándar
//   3. Año siguiente completo     · cards estándar
//   4. Inicio del año (+2)        · cards estándar
//
// Cada card respeta los tokens v5 del mockup:
//   · background card-alt cream
//   · border-left 3px de salud (pos · gold · neg)
//   · tag pill (cerrado · en curso · hoy · previsto · irpf · paga extra · tensión)
//   · saldo en JetBrains Mono · entradas/salidas mono
//
// El clic invoca onMonthClick(year, monthIndex0).
// ============================================================================

import React, { useMemo } from 'react';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MESES_CORTO = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
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

export interface CalendarioRolling24mProps {
  events: CalendarTreasuryEvent[];
  movements: CalendarMovement[];
  onMonthClick: (year: number, monthIndex0: number) => void;
  horizonteMeses?: number;
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

// Etiqueta heurística simple según mes calendario y signo del neto.
// Identifica IRPF (jun/nov), Paga extra (jul/dic), Tensión (neto < umbral),
// "en curso · hoy" y "cerrado".
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

const CalendarioRolling24m: React.FC<CalendarioRolling24mProps> = ({
  events,
  movements,
  onMonthClick,
  horizonteMeses = 24,
}) => {
  const hoy = useMemo(() => new Date(), []);
  const inicioMesActual = useMemo(() => startOfMonth(hoy), [hoy]);

  const meses: DatosMes[] = useMemo(() => {
    const arr: DatosMes[] = [];
    let saldoAcumulado = 0;
    for (let i = 0; i < horizonteMeses; i++) {
      const fechaInicio = addMonths(inicioMesActual, i);
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
  }, [events, movements, inicioMesActual, hoy, horizonteMeses]);

  const secciones = useMemo(() => {
    if (meses.length === 0) {
      return { proximos: [], restoActual: [], anioSig: [], inicioMas2: [] };
    }
    const yearActual = inicioMesActual.getFullYear();
    const yearSig = yearActual + 1;
    const proximos = meses.slice(0, Math.min(3, meses.length));
    const restoActual = meses.slice(3).filter((m) => m.year === yearActual);
    const anioSig = meses.slice(3).filter((m) => m.year === yearSig);
    const inicioMas2 = meses.slice(3).filter((m) => m.year >= yearSig + 1);
    return { proximos, restoActual, anioSig, inicioMas2 };
  }, [meses, inicioMesActual]);

  const yearActual = inicioMesActual.getFullYear();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {secciones.proximos.length > 0 && (
        <Section title="Próximos 3 meses · corto plazo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {secciones.proximos.map((m) => (
              <MesCard
                key={`p-${m.year}-${m.monthIndex0}`}
                datos={m}
                size="lg"
                onClick={onMonthClick}
              />
            ))}
          </div>
        </Section>
      )}
      {secciones.restoActual.length > 0 && (
        <Section title={`Resto de ${yearActual}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {secciones.restoActual.map((m) => (
              <MesCard
                key={`r-${m.year}-${m.monthIndex0}`}
                datos={m}
                size="md"
                onClick={onMonthClick}
              />
            ))}
          </div>
        </Section>
      )}
      {secciones.anioSig.length > 0 && (
        <Section title={`Año siguiente · ${yearActual + 1}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {secciones.anioSig.map((m) => (
              <MesCard
                key={`s-${m.year}-${m.monthIndex0}`}
                datos={m}
                size="md"
                onClick={onMonthClick}
              />
            ))}
          </div>
        </Section>
      )}
      {secciones.inicioMas2.length > 0 && (
        <Section title={`Inicio ${yearActual + 2}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {secciones.inicioMas2.map((m) => (
              <MesCard
                key={`s2-${m.year}-${m.monthIndex0}`}
                datos={m}
                size="md"
                onClick={onMonthClick}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

export default CalendarioRolling24m;

// ─── Sub-componentes ────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div>
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--atlas-v5-ink-4)',
        marginBottom: 10,
        paddingLeft: 4,
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

interface MesCardProps {
  datos: DatosMes;
  size: 'lg' | 'md';
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

const MesCard: React.FC<MesCardProps> = ({ datos, size, onClick }) => {
  const handle = (): void => onClick(datos.year, datos.monthIndex0);
  const isLg = size === 'lg';
  const isCurrent = datos.esMesActual;
  const isPast = datos.estado === 'cerrado';

  const mesLabel = isLg
    ? `${MESES[datos.monthIndex0]} ${datos.year}`
    : `${MESES_CORTO[datos.monthIndex0]} ${datos.year}`;

  const cardStyle: React.CSSProperties = {
    background: isCurrent
      ? 'var(--atlas-v5-gold-wash)'
      : 'var(--atlas-v5-card-alt)',
    border: `1px solid ${
      isCurrent ? 'var(--atlas-v5-gold-2)' : 'var(--atlas-v5-line)'
    }`,
    borderLeft: `3px solid ${SALUD_BORDER[datos.salud]}`,
    borderRadius: 10,
    padding: isLg ? '16px 16px 16px 13px' : '12px 12px 12px 11px',
    cursor: 'pointer',
    transition: 'border-color .12s, transform .12s, box-shadow .12s',
    opacity: isPast ? 0.78 : 1,
  };

  const tagStyle: React.CSSProperties = {
    display: 'inline-block',
    fontSize: isLg ? 10 : 9.5,
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
          fontSize: isLg ? 14 : 13,
          fontWeight: 700,
          color: 'var(--atlas-v5-ink)',
          marginBottom: 4,
        }}
      >
        {mesLabel}
      </div>
      <div style={tagStyle}>{datos.tagLabel}</div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          fontSize: isLg ? 22 : 18,
          fontWeight: 700,
          color: 'var(--atlas-v5-ink)',
          letterSpacing: '-0.025em',
          marginBottom: 10,
        }}
      >
        {formatEur(datos.saldoFinal)} €
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: isLg ? 11 : 10.5,
          color: 'var(--atlas-v5-ink-4)',
          padding: '2px 0',
        }}
      >
        <span>Entradas</span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
            fontWeight: 600,
            fontSize: isLg ? 12 : 11,
            color: 'var(--atlas-v5-pos)',
          }}
        >
          +{formatEur(datos.entradas)}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: isLg ? 11 : 10.5,
          color: 'var(--atlas-v5-ink-4)',
          padding: '2px 0',
        }}
      >
        <span>Salidas</span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
            fontWeight: 600,
            fontSize: isLg ? 12 : 11,
            color: 'var(--atlas-v5-neg)',
          }}
        >
          −{formatEur(datos.salidas)}
        </span>
      </div>
    </div>
  );
};
