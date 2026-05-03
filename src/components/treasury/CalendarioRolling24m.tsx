// ============================================================================
// ATLAS · T31 · CalendarioRolling24m
// ============================================================================
//
// Vista de calendario rodante de 24 meses. 4 secciones jerárquicas en una
// única tira temporal continua:
//
//   1. Próximos 3 meses          → cards GRANDES (mes en curso + 2 siguientes)
//   2. Resto del año en curso    → cards MEDIANAS
//   3. Año siguiente completo    → cards PEQUEÑAS
//   4. Inicio del año (+2)       → cards PEQUEÑAS
//
// Las secciones vacías se omiten (no se renderiza ni el título).
// El mes en curso se destaca con borde acentuado.
// El clic en una card invoca onMonthClick(year, monthIndex0).
// ============================================================================

import React, { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MESES_CORTO = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const formatEur = (v: number): string =>
  v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tipo mínimo del evento que necesitamos. Coincide con el shape de
// `treasuryEvents` en IndexedDB (campos relevantes para el cálculo mensual).
export interface CalendarTreasuryEvent {
  predictedDate: string;
  type: 'income' | 'expense' | 'financing';
  amount: number;
  status: 'predicted' | 'confirmed' | 'executed' | string;
}

export interface CalendarMovement {
  date: string;
  amount: number;
  // El sentido (ingreso/gasto) lo da el signo de amount o un campo adicional;
  // para la suma de "movements del mes" usamos amount con signo si existe.
}

export interface CalendarioRolling24mProps {
  /** Eventos en `treasuryEvents` (predicted + confirmed + executed) */
  events: CalendarTreasuryEvent[];
  /** Movimientos bancarios reales en `movements` (para detectar mes "cerrado") */
  movements: CalendarMovement[];
  /** Callback al hacer clic en una card de mes (year, monthIndex0) */
  onMonthClick: (year: number, monthIndex0: number) => void;
  /** Default 24. */
  horizonteMeses?: number;
}

// ─── Helpers de fecha ───────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

interface DatosMes {
  year: number;
  monthIndex0: number;
  fechaInicio: Date;
  fechaFin: Date;
  estado: 'cerrado' | 'en_curso' | 'previsto';
  saldoFinal: number;
  entradas: number;
  salidas: number;
  neto: number;
  esMesActual: boolean;
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

  // Construir lista plana de 24 meses
  const meses: DatosMes[] = useMemo(() => {
    const arr: DatosMes[] = [];
    let saldoAcumulado = 0;
    for (let i = 0; i < horizonteMeses; i++) {
      const fechaInicio = addMonths(inicioMesActual, i);
      const fechaFin = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() + 1, 0);
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
      let estado: DatosMes['estado'];
      if (tieneMov && !tienePredicted) estado = 'cerrado';
      else if (tieneMov && tienePredicted) estado = 'en_curso';
      else estado = 'previsto';

      const esMesActual =
        year === hoy.getFullYear() && m === hoy.getMonth();
      if (esMesActual) estado = 'en_curso';

      arr.push({
        year,
        monthIndex0: m,
        fechaInicio,
        fechaFin,
        estado,
        saldoFinal: saldoAcumulado,
        entradas,
        salidas,
        neto,
        esMesActual,
      });
    }
    return arr;
  }, [events, movements, inicioMesActual, hoy, horizonteMeses]);

  // Particionar en 4 secciones
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* SECCIÓN 1 · Próximos 3 meses · cards grandes */}
      {secciones.proximos.length > 0 && (
        <SectionWrapper title="Próximos 3 meses · corto plazo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {secciones.proximos.map((m) => (
              <MonthCardLarge key={`l-${m.year}-${m.monthIndex0}`} datos={m} onClick={onMonthClick} />
            ))}
          </div>
        </SectionWrapper>
      )}

      {/* SECCIÓN 2 · Resto del año en curso · cards medianas */}
      {secciones.restoActual.length > 0 && (
        <SectionWrapper title={`Resto de ${yearActual}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {secciones.restoActual.map((m) => (
              <MonthCardMedium key={`m-${m.year}-${m.monthIndex0}`} datos={m} onClick={onMonthClick} />
            ))}
          </div>
        </SectionWrapper>
      )}

      {/* SECCIÓN 3 · Año siguiente · 12 cards pequeñas */}
      {secciones.anioSig.length > 0 && (
        <SectionWrapper title={`Año siguiente · ${yearActual + 1}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
            {secciones.anioSig.map((m) => (
              <MonthCardSmall key={`s-${m.year}-${m.monthIndex0}`} datos={m} onClick={onMonthClick} />
            ))}
          </div>
        </SectionWrapper>
      )}

      {/* SECCIÓN 4 · Inicio del año +2 · cards pequeñas */}
      {secciones.inicioMas2.length > 0 && (
        <SectionWrapper title={`Inicio ${yearActual + 2}`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
            {secciones.inicioMas2.map((m) => (
              <MonthCardSmall key={`s2-${m.year}-${m.monthIndex0}`} datos={m} onClick={onMonthClick} />
            ))}
          </div>
        </SectionWrapper>
      )}
    </div>
  );
};

export default CalendarioRolling24m;

// ─── Subcomponentes ─────────────────────────────────────────────────────────

const SectionWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div>
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '.07em',
        textTransform: 'uppercase',
        color: 'var(--grey-400)',
        marginBottom: 8,
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

interface MonthCardProps {
  datos: DatosMes;
  onClick: (year: number, monthIndex0: number) => void;
}

const cardBaseStyle = (datos: DatosMes, opacity: number): React.CSSProperties => ({
  background: 'var(--white)',
  borderRadius: 10,
  cursor: 'pointer',
  transition: 'box-shadow 0.15s',
  border: `1.5px solid ${datos.esMesActual ? 'var(--navy-900)' : 'var(--grey-200)'}`,
  opacity,
});

const labelEstado = (estado: DatosMes['estado'], esMesActual: boolean): React.ReactNode => {
  if (esMesActual) {
    return (
      <span
        style={{
          display: 'inline-block',
          fontSize: 10,
          fontWeight: 600,
          padding: '1px 6px',
          borderRadius: 99,
          background: 'var(--teal-100)',
          color: 'var(--teal-600)',
        }}
      >
        Hoy
      </span>
    );
  }
  if (estado === 'cerrado') {
    return <CheckCircle2 size={11} color="var(--teal-600)" aria-label="Cerrado" />;
  }
  return (
    <span style={{ fontSize: 10, color: 'var(--grey-300)' }}>
      {estado === 'en_curso' ? 'En curso' : 'Previsto'}
    </span>
  );
};

const MonthCardLarge: React.FC<MonthCardProps> = ({ datos, onClick }) => {
  const handle = (): void => onClick(datos.year, datos.monthIndex0);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Detalle de ${MESES[datos.monthIndex0]} ${datos.year}`}
      className="tv4-month-card"
      onClick={handle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handle();
        }
      }}
      style={{ ...cardBaseStyle(datos, 1), padding: '16px 18px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy-900)' }}>
          {MESES[datos.monthIndex0]} {datos.year}
        </span>
        {labelEstado(datos.estado, datos.esMesActual)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--grey-400)', marginBottom: 2 }}>Saldo final estimado</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'IBM Plex Mono',
          color: datos.saldoFinal >= 0 ? 'var(--navy-900)' : 'var(--grey-700)',
          lineHeight: 1.1,
          marginBottom: 12,
        }}
      >
        {datos.saldoFinal >= 0 ? '' : '−'}{formatEur(Math.abs(datos.saldoFinal))} €
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--grey-500)' }}>Entradas</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--navy-900)' }}>
            +{formatEur(datos.entradas)} €
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--grey-500)' }}>Salidas</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, color: 'var(--grey-700)' }}>
            −{formatEur(datos.salidas)} €
          </span>
        </div>
      </div>
    </div>
  );
};

const MonthCardMedium: React.FC<MonthCardProps> = ({ datos, onClick }) => {
  const handle = (): void => onClick(datos.year, datos.monthIndex0);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Detalle de ${MESES[datos.monthIndex0]} ${datos.year}`}
      className="tv4-month-card"
      onClick={handle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handle();
        }
      }}
      style={{ ...cardBaseStyle(datos, 1), padding: '11px 12px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--grey-900)' }}>
          {MESES_CORTO[datos.monthIndex0]} {datos.year}
        </span>
        {labelEstado(datos.estado, datos.esMesActual)}
      </div>
      <div style={{ fontSize: 10, color: 'var(--grey-400)', marginBottom: 1 }}>Saldo final</div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'IBM Plex Mono',
          color: datos.saldoFinal >= 0 ? 'var(--navy-900)' : 'var(--grey-700)',
          marginBottom: 6,
        }}
      >
        {datos.saldoFinal >= 0 ? '' : '−'}{formatEur(Math.abs(datos.saldoFinal))} €
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--grey-500)' }}>
        <span>+{formatEur(datos.entradas)}</span>
        <span>−{formatEur(datos.salidas)}</span>
      </div>
    </div>
  );
};

const MonthCardSmall: React.FC<MonthCardProps> = ({ datos, onClick }) => {
  const handle = (): void => onClick(datos.year, datos.monthIndex0);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Detalle de ${MESES[datos.monthIndex0]} ${datos.year}`}
      className="tv4-month-card"
      onClick={handle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handle();
        }
      }}
      style={{ ...cardBaseStyle(datos, 0.85), padding: '8px 10px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--grey-700)' }}>
          {MESES_CORTO[datos.monthIndex0]} {datos.year}
        </span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--grey-400)' }}>Saldo</div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'IBM Plex Mono',
          color: datos.saldoFinal >= 0 ? 'var(--navy-900)' : 'var(--grey-700)',
          marginBottom: 2,
        }}
      >
        {datos.saldoFinal >= 0 ? '' : '−'}{formatEur(Math.abs(datos.saldoFinal))} €
      </div>
      <div style={{ fontSize: 9, color: 'var(--grey-500)' }}>
        Neto · {datos.neto >= 0 ? '+' : '−'}{formatEur(Math.abs(datos.neto))}
      </div>
    </div>
  );
};
