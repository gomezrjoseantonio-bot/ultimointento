/**
 * ImpuestosSupervisionPage.tsx
 * 
 * Pantalla de SUPERVISIÓN de Impuestos — Rediseño completo.
 * Cabecera blanca estándar, sin botones de acción.
 * Una sola pantalla, sin tabs. Sin historial separado.
 * La gráfica interactiva ES el historial — clic en un año cambia toda la pantalla.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Scale, Home, Car, Package, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  resolverTodosLosEjercicios,
  type DatosFiscalesEjercicio,
} from '../../../../services/fiscalResolverService';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

type EstadoEjercicio = 'en_curso' | 'pendiente' | 'declarado' | 'prescrito';

interface EjercicioData extends DatosFiscalesEjercicio {
  tipoEfectivo: number;
}

interface InmuebleFiscal {
  rc: string;
  direccion: string;
  tipo: 'piso' | 'parking' | 'trastero';
  ingresos_integros: number;
  gastos: { concepto: string; importe: number; destacado?: boolean }[];
  reduccion_pct: number;
  reduccion_importe: number;
  rnr: number; // rendimiento neto reducido
}

interface FuenteRenta {
  nombre: string;
  importe: number;
}

// ══════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ══════════════════════════════════════════════════════════════

/** Maximum marginal tax rate in Spain (used for tipo efectivo scale bar) */
const MAX_TAX_RATE_PERCENT = 47;

/** Threshold for highlighting large repair/financing expenses (euros) */
const HIGHLIGHT_EXPENSE_THRESHOLD = 5000;

const ESTADO_BADGE: Record<EstadoEjercicio, { bg: string; color: string; texto: string }> = {
  en_curso: { bg: 'var(--teal-100)', color: 'var(--teal-600)', texto: 'En curso' },
  pendiente: { bg: 'var(--grey-100)', color: 'var(--grey-700)', texto: 'Pendiente' },
  declarado: { bg: 'var(--navy-100)', color: 'var(--navy-700)', texto: 'Declarado' },
  prescrito: { bg: 'var(--grey-100)', color: 'var(--grey-400)', texto: 'Prescrito' },
};

// Format Euro (with 2 decimals)
const formatEur = (n: number): string =>
  Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Format Euro (no decimals, for large KPIs)
const formatEur0 = (n: number): string =>
  Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Compute tipo efectivo (cuota / base * 100)
const calcTipoEfectivo = (cuota: number | null, base: number | null): number => {
  if (!cuota || !base || base === 0) return 0;
  return (Math.abs(cuota) / Math.abs(base)) * 100;
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const kpiCardStyle: React.CSSProperties = {
  background: 'var(--white)',
  border: '1px solid var(--grey-200)',
  borderRadius: 12,
  padding: '16px 18px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--grey-400)',
  marginBottom: 6,
};

const monoStyle: React.CSSProperties = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontVariantNumeric: 'tabular-nums',
};

const pillStyle: React.CSSProperties = {
  padding: '4px 13px',
  borderRadius: 20,
  border: '1.5px solid var(--grey-200)',
  background: 'var(--white)',
  color: 'var(--grey-500)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: "'IBM Plex Sans', sans-serif",
  transition: 'all 0.12s',
};

const pillActiveStyle: React.CSSProperties = {
  ...pillStyle,
  background: 'var(--navy-900)',
  borderColor: 'var(--navy-900)',
  color: '#fff',
};

// ══════════════════════════════════════════════════════════════
// COMPONENT: Supervision Header (white, no buttons)
// ══════════════════════════════════════════════════════════════

const SupervisionHeader: React.FC = () => (
  <div style={{
    background: 'var(--white)',
    borderBottom: '1px solid var(--grey-200)',
    padding: '18px 32px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <Scale size={20} color="var(--grey-500)" strokeWidth={1.5} />
      <div>
        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--grey-900)',
          lineHeight: 1,
          margin: 0,
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}>
          Impuestos
        </h1>
        <p style={{
          fontSize: 13,
          color: 'var(--grey-500)',
          marginTop: 2,
          margin: 0,
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}>
          Evolución fiscal y salud tributaria
        </p>
      </div>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// COMPONENT: Year Pills Selector
// ══════════════════════════════════════════════════════════════

interface YearPillsProps {
  años: number[];
  añoActivo: number;
  onSelectAño: (año: number) => void;
  estadoBadge: { bg: string; color: string; texto: string };
}

const YearPills: React.FC<YearPillsProps> = ({ años, añoActivo, onSelectAño, estadoBadge }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  }}>
    <div style={{ display: 'flex', gap: 5 }}>
      {años.map(año => (
        <button
          key={año}
          onClick={() => onSelectAño(año)}
          style={año === añoActivo ? pillActiveStyle : pillStyle}
          onMouseEnter={(e) => {
            if (año !== añoActivo) {
              e.currentTarget.style.borderColor = 'var(--navy-700)';
              e.currentTarget.style.color = 'var(--navy-700)';
            }
          }}
          onMouseLeave={(e) => {
            if (año !== añoActivo) {
              e.currentTarget.style.borderColor = 'var(--grey-200)';
              e.currentTarget.style.color = 'var(--grey-500)';
            }
          }}
        >
          {año}
        </button>
      ))}
    </div>
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      padding: '3px 9px',
      borderRadius: 5,
      background: estadoBadge.bg,
      color: estadoBadge.color,
    }}>
      {estadoBadge.texto}
    </span>
  </div>
);

// ══════════════════════════════════════════════════════════════
// COMPONENT: KPI Card - Base Imponible (equation card)
// ══════════════════════════════════════════════════════════════

interface TarjetaBaseImponibleProps {
  ingresos: number;
  gastos: number;
  base: number;
  fuentes: FuenteRenta[];
}

const TarjetaBaseImponible: React.FC<TarjetaBaseImponibleProps> = ({
  ingresos,
  gastos,
  base,
  fuentes,
}) => (
  <div style={{ ...kpiCardStyle, borderTop: '3px solid var(--navy-900)' }}>
    <div style={kpiLabelStyle}>Base imponible</div>

    {/* Ecuación visual */}
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--grey-400)', marginBottom: 2 }}>
          Ingresos
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-900)', ...monoStyle }}>
          {formatEur(ingresos)} €
        </div>
      </div>
      <div style={{ fontSize: 20, color: 'var(--grey-300)', paddingBottom: 2 }}>−</div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--grey-400)', marginBottom: 2 }}>
          Gastos ded.
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal-600)', ...monoStyle }}>
          {formatEur(gastos)} €
        </div>
      </div>
      <div style={{ fontSize: 20, color: 'var(--grey-300)', paddingBottom: 2 }}>=</div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--grey-400)', marginBottom: 2 }}>
          Base
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy-900)', ...monoStyle }}>
          {formatEur(base)} €
        </div>
      </div>
    </div>

    {/* Desglose de fuentes */}
    <div style={{ height: 1, background: 'var(--grey-100)', marginBottom: 8 }} />
    {fuentes.filter(f => f.importe > 0).map(f => (
      <div key={f.nombre} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 0' }}>
        <span style={{ color: 'var(--grey-500)' }}>{f.nombre}</span>
        <span style={{ color: 'var(--grey-700)', ...monoStyle }}>{formatEur(f.importe)} €</span>
      </div>
    ))}
  </div>
);

// ══════════════════════════════════════════════════════════════
// COMPONENT: KPI Card - Cuota Íntegra
// ══════════════════════════════════════════════════════════════

interface TarjetaCuotaProps {
  cuota: number;
  tipoEfectivo: number;
}

const TarjetaCuota: React.FC<TarjetaCuotaProps> = ({ cuota, tipoEfectivo }) => (
  <div style={{ ...kpiCardStyle, borderTop: '3px solid var(--grey-300)' }}>
    <div style={kpiLabelStyle}>Cuota íntegra</div>
    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--grey-700)', lineHeight: 1, marginBottom: 4, ...monoStyle }}>
      {formatEur0(cuota)} €
    </div>
    <div style={{ fontSize: 11, color: 'var(--grey-400)' }}>Tipo efectivo</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--grey-700)', marginTop: 2, ...monoStyle }}>
      {tipoEfectivo.toFixed(2).replace('.', ',')}%
    </div>
    {/* Mini scale bar showing tipo efectivo relative to max rate */}
    <div style={{ marginTop: 10, height: 4, background: 'var(--grey-100)', borderRadius: 2 }}>
      <div style={{
        height: 4,
        width: `${Math.min((tipoEfectivo / MAX_TAX_RATE_PERCENT) * 100, 100)}%`,
        background: 'var(--grey-300)',
        borderRadius: 2,
      }} />
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// COMPONENT: KPI Card - Retenciones
// ══════════════════════════════════════════════════════════════

interface TarjetaRetencionesProps {
  retenciones: number;
  cuota: number;
}

const TarjetaRetenciones: React.FC<TarjetaRetencionesProps> = ({ retenciones, cuota }) => (
  <div style={{ ...kpiCardStyle, borderTop: '3px solid var(--teal-600)' }}>
    <div style={kpiLabelStyle}>Retenciones</div>
    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--teal-600)', lineHeight: 1, marginBottom: 4, ...monoStyle }}>
      −{formatEur0(retenciones)} €
    </div>
    <div style={{ fontSize: 11, color: 'var(--grey-400)' }}>Ya pagadas durante el año</div>
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--grey-500)' }}>
        Cuota: {formatEur0(cuota)} €
      </div>
      <div style={{ fontSize: 11, color: 'var(--teal-600)' }}>
        Pagado: {formatEur0(retenciones)} €
      </div>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// COMPONENT: KPI Card - Resultado (special layout)
// ══════════════════════════════════════════════════════════════

interface TarjetaResultadoProps {
  resultado: number;
  tipoEfectivo: number;
  añoActivo: number;
}

const TarjetaResultado: React.FC<TarjetaResultadoProps> = ({ resultado, tipoEfectivo, añoActivo }) => {
  const navigate = useNavigate();
  const esDevolver = resultado < 0;

  return (
    <div style={{
      ...kpiCardStyle,
      borderTop: `3px solid ${esDevolver ? 'var(--teal-600)' : 'var(--navy-900)'}`,
    }}>
      <div style={kpiLabelStyle}>Resultado</div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* Left: Main amount */}
        <div>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: esDevolver ? 'var(--teal-600)' : 'var(--navy-900)',
            lineHeight: 1,
            ...monoStyle,
          }}>
            {esDevolver ? '−' : ''}{formatEur0(Math.abs(resultado))} €
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--grey-500)', marginTop: 4 }}>
            {esDevolver ? 'A devolver' : 'A pagar'}
          </div>
        </div>

        {/* Right: Tipo efectivo */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--grey-400)' }}>Tipo efectivo</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal-600)', ...monoStyle }}>
            {tipoEfectivo.toFixed(1).replace('.', ',')}%
          </div>
        </div>
      </div>

      {/* Link to full declaration */}
      <button
        onClick={() => navigate(`/fiscalidad/declaracion/${añoActivo}`)}
        style={{
          marginTop: 12,
          padding: 0,
          background: 'none',
          border: 'none',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--teal-600)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        Ver declaración completa
        <ExternalLink size={12} />
      </button>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// COMPONENT: Evolution Chart (horizontal bars, clickable)
// ══════════════════════════════════════════════════════════════

interface GraficaEvolucionProps {
  años: EjercicioData[];
  añoActivo: number;
  onSelectAño: (año: number) => void;
}

const GraficaEvolucion: React.FC<GraficaEvolucionProps> = ({ años, añoActivo, onSelectAño }) => {
  const MAX = Math.max(...años.map(a => Math.abs(a.resultado ?? 0)), 8000);
  const sortedAños = [...años].sort((a, b) => b.año - a.año);

  return (
    <div style={{ ...kpiCardStyle, padding: '18px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--grey-900)' }}>
            Resultado por ejercicio
          </div>
          <div style={{ fontSize: 11, color: 'var(--grey-400)', marginTop: 1 }}>
            Clic en un año para ver su detalle
          </div>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--grey-500)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--navy-900)' }} />
            Pagar
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--teal-600)' }} />
            Devolver
          </span>
        </div>
      </div>

      {sortedAños.map(ej => {
        const resultado = ej.resultado ?? 0;
        const pct = Math.round(Math.abs(resultado) / MAX * 100);
        const isSel = ej.año === añoActivo;
        const estado = mapEstado(ej.estado);
        const sb = ESTADO_BADGE[estado];
        const ant = años.find(a => a.año === ej.año - 1);
        const delta = ant?.resultado != null && ej.resultado != null ? ej.resultado - ant.resultado : null;
        const isPagar = resultado >= 0;

        return (
          <div
            key={ej.año}
            onClick={() => onSelectAño(ej.año)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 4px',
              borderBottom: '1px solid var(--grey-50)',
              borderRadius: 6,
              cursor: 'pointer',
              background: isSel ? 'var(--navy-50)' : 'transparent',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--grey-50)'; }}
            onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
          >
            {/* Year */}
            <div style={{
              fontSize: 12,
              fontWeight: isSel ? 700 : 400,
              color: isSel ? 'var(--navy-900)' : 'var(--grey-700)',
              width: 34,
            }}>
              {ej.año}
            </div>

            {/* Status badge */}
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              background: sb.bg,
              color: sb.color,
              width: 62,
              textAlign: 'center',
            }}>
              {sb.texto}
            </span>

            {/* Bar */}
            <div style={{
              flex: 1,
              height: 14,
              background: 'var(--grey-50)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: isPagar
                  ? (isSel ? 'var(--navy-900)' : 'var(--grey-300)')
                  : (isSel ? 'var(--teal-600)' : 'var(--teal-100)'),
                borderRadius: 3,
                transition: 'width 0.3s',
              }} />
            </div>

            {/* Amount */}
            <div style={{
              fontSize: 12,
              fontWeight: isSel ? 700 : 400,
              color: isSel ? (isPagar ? 'var(--navy-900)' : 'var(--teal-600)') : 'var(--grey-900)',
              width: 64,
              textAlign: 'right',
              ...monoStyle,
            }}>
              {isPagar ? '' : '−'}{formatEur0(Math.abs(resultado))} €
            </div>

            {/* Delta */}
            <div style={{
              fontSize: 10,
              color: 'var(--grey-400)',
              width: 58,
              textAlign: 'right',
              ...monoStyle,
            }}>
              {delta !== null ? `${delta > 0 ? '+' : '−'}${formatEur0(Math.abs(delta))} €` : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// COMPONENT: Panel Tipo Efectivo Histórico
// ══════════════════════════════════════════════════════════════

interface PanelTipoEfectivoProps {
  años: EjercicioData[];
  añoActivo: number;
}

const PanelTipoEfectivo: React.FC<PanelTipoEfectivoProps> = ({ años, añoActivo }) => {
  const sortedAños = [...años].sort((a, b) => b.año - a.año);
  const maxTipo = Math.max(...años.map(a => a.tipoEfectivo), 1);

  return (
    <div style={{ ...kpiCardStyle, padding: '14px 16px' }}>
      <div style={{ ...kpiLabelStyle, marginBottom: 10 }}>Tipo efectivo histórico</div>
      {sortedAños.map(ej => {
        const isSel = ej.año === añoActivo;
        const pct = Math.round((ej.tipoEfectivo / maxTipo) * 100);

        return (
          <div key={ej.año} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 0',
            borderBottom: '1px solid var(--grey-50)',
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: isSel ? 700 : 400,
              color: isSel ? 'var(--navy-900)' : 'var(--grey-700)',
              width: 32,
            }}>
              {ej.año}
            </div>
            <div style={{
              flex: 1,
              height: 5,
              background: 'var(--grey-100)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: isSel ? 'var(--navy-900)' : 'var(--grey-300)',
                borderRadius: 3,
              }} />
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: isSel ? 700 : 400,
              color: isSel ? 'var(--navy-900)' : 'var(--grey-700)',
              width: 34,
              textAlign: 'right',
              ...monoStyle,
            }}>
              {ej.tipoEfectivo.toFixed(1).replace('.', ',')}%
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// COMPONENT: Panel Fuentes de Renta
// ══════════════════════════════════════════════════════════════

interface PanelFuentesProps {
  fuentes: FuenteRenta[];
  añoActivo: number;
}

const PanelFuentes: React.FC<PanelFuentesProps> = ({ fuentes, añoActivo }) => {
  const maxFuente = Math.max(...fuentes.map(f => Math.abs(f.importe)), 1);

  return (
    <div style={{ ...kpiCardStyle, padding: '14px 16px' }}>
      <div style={{ ...kpiLabelStyle, marginBottom: 10 }}>Fuentes de renta · {añoActivo}</div>
      {fuentes.map(f => {
        const pct = Math.round((Math.abs(f.importe) / maxFuente) * 100);
        const hasValue = f.importe !== 0;

        return (
          <div key={f.nombre} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 0',
            borderBottom: '1px solid var(--grey-50)',
          }}>
            <div style={{
              fontSize: 11,
              color: hasValue ? 'var(--grey-900)' : 'var(--grey-400)',
              fontWeight: hasValue ? 500 : 400,
              flex: 1,
            }}>
              {f.nombre}
            </div>
            <div style={{
              width: 80,
              height: 5,
              background: 'var(--grey-100)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: hasValue ? `${pct}%` : '0%',
                background: 'var(--navy-900)',
                borderRadius: 3,
              }} />
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: hasValue ? 'var(--grey-900)' : 'var(--grey-400)',
              width: 58,
              textAlign: 'right',
              ...monoStyle,
            }}>
              {hasValue ? `${formatEur0(Math.abs(f.importe))} €` : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// COMPONENT: Card Inmueble Fiscal
// ══════════════════════════════════════════════════════════════

interface FilaInmProps {
  label: string;
  valor: number;
  color?: string;
}

const FilaInm: React.FC<FilaInmProps> = ({ label, valor, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
    <span style={{ color: 'var(--grey-500)' }}>{label}</span>
    <span style={{ color: color || 'var(--grey-700)', ...monoStyle }}>
      {valor < 0 ? '−' : ''}{formatEur(Math.abs(valor))} €
    </span>
  </div>
);

const CardInmuebleFiscal: React.FC<{ inm: InmuebleFiscal }> = ({ inm }) => {
  const [open, setOpen] = useState(false);
  const gastoTotal = inm.gastos.reduce((s, g) => s + g.importe, 0);
  const esNegativo = inm.rnr < 0;

  const iconoTipoInmueble = (tipo: string) => {
    switch (tipo) {
      case 'parking': return <Car size={13} color="var(--navy-900)" />;
      case 'trastero': return <Package size={13} color="var(--navy-900)" />;
      default: return <Home size={13} color="var(--navy-900)" />;
    }
  };

  return (
    <div style={{
      ...kpiCardStyle,
      borderTop: `3px solid ${esNegativo ? 'var(--teal-600)' : 'var(--navy-900)'}`,
    }}>
      {/* Header: icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: 'var(--navy-50)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {iconoTipoInmueble(inm.tipo)}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--grey-900)' }}>
            {inm.direccion}
          </div>
          {inm.reduccion_pct > 0 && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 3,
              background: 'var(--navy-100)',
              color: 'var(--navy-700)',
            }}>
              Red. {inm.reduccion_pct}%
            </span>
          )}
        </div>
      </div>

      {/* Sequence: ingresos → gastos → reducción → resultado */}
      <FilaInm label="Ingresos íntegros" valor={inm.ingresos_integros} />
      <FilaInm label="Total gastos" valor={-gastoTotal} color="var(--teal-600)" />
      {inm.reduccion_importe > 0 && (
        <FilaInm label={`Reducción ${inm.reduccion_pct}%`} valor={-inm.reduccion_importe} color="var(--teal-600)" />
      )}

      {/* Resultado del inmueble */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        padding: '5px 4px',
        background: 'var(--navy-50)',
        borderRadius: 4,
        marginTop: 6,
      }}>
        <span style={{ fontWeight: 600, color: 'var(--grey-900)' }}>Rto. neto reducido</span>
        <span style={{
          fontWeight: 700,
          color: esNegativo ? 'var(--teal-600)' : 'var(--navy-900)',
          ...monoStyle,
        }}>
          {esNegativo ? '−' : ''}{formatEur(Math.abs(inm.rnr))} €
        </span>
      </div>

      {/* Expandir gastos */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          fontSize: 11,
          color: 'var(--teal-600)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px 0 0',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? 'Ocultar desglose gastos' : 'Ver desglose gastos'}
      </button>

      {open && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--grey-100)', paddingTop: 7 }}>
          {inm.gastos.map((g, idx) => (
            <div key={`${g.concepto}-${idx}`} style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              padding: '2px 0',
            }}>
              <span style={{
                color: g.destacado ? 'var(--navy-900)' : 'var(--grey-500)',
                fontWeight: g.destacado ? 600 : 400,
              }}>
                {g.concepto}
              </span>
              <span style={{
                color: g.destacado ? 'var(--navy-900)' : 'var(--grey-700)',
                ...monoStyle,
              }}>
                −{formatEur(g.importe)} €
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// HELPER: Map resolver estado to supervision estado
// ══════════════════════════════════════════════════════════════

function mapEstado(estado: string): EstadoEjercicio {
  switch (estado) {
    case 'en_curso': return 'en_curso';
    case 'pendiente': return 'pendiente';
    case 'declarado': return 'declarado';
    case 'prescrito': return 'prescrito';
    default: return 'pendiente';
  }
}

// ══════════════════════════════════════════════════════════════
// HELPER: Build fuentes from datos
// ══════════════════════════════════════════════════════════════

function buildFuentes(datos: DatosFiscalesEjercicio): FuenteRenta[] {
  const trabajoDeclaracion = datos.declaracionCompleta?.baseGeneral?.rendimientosTrabajo?.rendimientoNeto ?? null;
  const inmueblesDeclaracion = datos.declaracionCompleta?.baseGeneral?.rendimientosInmuebles?.reduce(
    (sum, inm) => sum + (inm.rendimientoNetoReducido ?? inm.rendimientoNeto ?? 0),
    0,
  ) ?? null;
  const autonomoDeclaracion = datos.declaracionCompleta?.baseGeneral?.rendimientosAutonomo?.rendimientoNeto ?? null;
  const ahorroDeclaracion = datos.declaracionCompleta?.baseAhorro?.total ?? null;

  return [
    { nombre: 'Trabajo', importe: datos.rendimientosTrabajo ?? trabajoDeclaracion ?? 0 },
    { nombre: 'Autónomo', importe: datos.rendimientosActividades ?? autonomoDeclaracion ?? 0 },
    { nombre: 'Inmuebles', importe: datos.rendimientosInmuebles ?? inmueblesDeclaracion ?? 0 },
    { nombre: 'Capital', importe: datos.rendimientosAhorro ?? ahorroDeclaracion ?? 0 },
  ];
}

// ══════════════════════════════════════════════════════════════
// HELPER: Build inmuebles fiscales from datos
// ══════════════════════════════════════════════════════════════

function buildInmueblesFiscales(datos: DatosFiscalesEjercicio): InmuebleFiscal[] {
  if (!datos.declaracionCompleta?.baseGeneral?.rendimientosInmuebles) {
    return [];
  }

  return datos.declaracionCompleta.baseGeneral.rendimientosInmuebles.map(inm => {
    // Build gastos array from the inmueble data
    const gastos: { concepto: string; importe: number; destacado?: boolean }[] = [];
    
    if (inm.gastosDeducibles > 0) {
      gastos.push({ concepto: 'Gastos deducibles', importe: inm.gastosDeducibles });
    }
    if (inm.amortizacion > 0) {
      gastos.push({ concepto: 'Amortización', importe: inm.amortizacion });
    }
    if (inm.gastosFinanciacionYReparacion && inm.gastosFinanciacionYReparacion > 0) {
      // Highlight large repair/financing costs above threshold
      const destacado = inm.gastosFinanciacionYReparacion > HIGHLIGHT_EXPENSE_THRESHOLD;
      gastos.push({ concepto: 'Gastos financieros y reparación', importe: inm.gastosFinanciacionYReparacion, destacado });
    }

    // Detect tipo based on alias or other hints
    let tipo: 'piso' | 'parking' | 'trastero' = 'piso';
    const alias = (inm.alias || '').toLowerCase();
    if (alias.includes('parking') || alias.includes('garaje') || alias.includes('plaza')) {
      tipo = 'parking';
    } else if (alias.includes('trastero') || alias.includes('almacén')) {
      tipo = 'trastero';
    }

    return {
      rc: inm.inmuebleId?.toString() || '',
      direccion: inm.alias || `Inmueble ${inm.inmuebleId}`,
      tipo,
      ingresos_integros: inm.ingresosIntegros,
      gastos,
      reduccion_pct: Math.round((inm.porcentajeReduccionHabitual || 0) * 100),
      reduccion_importe: inm.reduccionHabitual || 0,
      rnr: inm.rendimientoNetoReducido,
    };
  });
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

const ImpuestosSupervisionPage: React.FC = () => {
  const [allData, setAllData] = useState<EjercicioData[]>([]);
  const [añoActivo, setAñoActivo] = useState<number>(new Date().getFullYear() - 1);
  const [loading, setLoading] = useState(true);

  // Load all ejercicios
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const data = await resolverTodosLosEjercicios();
        if (cancelled) return;

        // Enrich data with tipo efectivo
        const enriched: EjercicioData[] = data.map(d => ({
          ...d,
          tipoEfectivo: calcTipoEfectivo(d.cuotaIntegra, d.baseImponibleGeneral),
        }));

        setAllData(enriched);

        // Set initial active year to most recent with data, or current year - 1
        const withData = enriched.filter(d => d.resultado !== null);
        if (withData.length > 0) {
          setAñoActivo(withData[0].año);
        }
      } catch (e) {
        console.error('[ImpuestosSupervision] Error loading data:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Get current year data
  const datosActivo = useMemo(() => {
    return allData.find(d => d.año === añoActivo) || null;
  }, [allData, añoActivo]);

  // Build fuentes for current year
  const fuentes = useMemo(() => {
    if (!datosActivo) return [];
    return buildFuentes(datosActivo);
  }, [datosActivo]);

  // Build inmuebles for current year
  const inmuebles = useMemo(() => {
    if (!datosActivo) return [];
    return buildInmueblesFiscales(datosActivo);
  }, [datosActivo]);

  // Available years
  const añosDisponibles = useMemo(() => {
    return allData.map(d => d.año).sort((a, b) => b - a);
  }, [allData]);

  // Estado badge for current year
  const estadoBadge = useMemo(() => {
    if (!datosActivo) return ESTADO_BADGE.pendiente;
    return ESTADO_BADGE[mapEstado(datosActivo.estado)];
  }, [datosActivo]);

  // Calculate KPI values
  const ingresos = useMemo(() => {
    if (!datosActivo) return 0;
    return (datosActivo.baseImponibleGeneral
      ?? datosActivo.resumen.baseLiquidableGeneral
      ?? datosActivo.declaracionCompleta?.liquidacion?.baseImponibleGeneral
      ?? 0)
      + (datosActivo.baseImponibleAhorro
      ?? datosActivo.resumen.baseLiquidableAhorro
      ?? datosActivo.declaracionCompleta?.liquidacion?.baseImponibleAhorro
      ?? 0);
  }, [datosActivo]);

  const gastos = useMemo(() => {
    // Simplified: difference between total rendimientos and base
    if (!datosActivo) return 0;
    const totalRend = (datosActivo.rendimientosTrabajo ?? 0) +
                      (datosActivo.rendimientosInmuebles ?? 0) +
                      (datosActivo.rendimientosActividades ?? 0) +
                      (datosActivo.rendimientosAhorro ?? 0);
    const base = (datosActivo.baseImponibleGeneral ?? 0) + (datosActivo.baseImponibleAhorro ?? 0);
    return Math.max(0, totalRend - base);
  }, [datosActivo]);

  const base = useMemo(() => {
    if (!datosActivo) return 0;
    return (datosActivo.baseImponibleGeneral
      ?? datosActivo.resumen.baseLiquidableGeneral
      ?? datosActivo.declaracionCompleta?.liquidacion?.baseImponibleGeneral
      ?? 0)
      + (datosActivo.baseImponibleAhorro
      ?? datosActivo.resumen.baseLiquidableAhorro
      ?? datosActivo.declaracionCompleta?.liquidacion?.baseImponibleAhorro
      ?? 0);
  }, [datosActivo]);

  const handleSelectAño = useCallback((año: number) => {
    setAñoActivo(año);
  }, []);

  if (loading) {
    return (
      <div style={{ background: 'var(--grey-50)', minHeight: '100vh' }}>
        <SupervisionHeader />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '2px solid var(--navy-900)',
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--grey-50)', minHeight: '100vh' }}>
      <SupervisionHeader />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 56px' }}>
        {/* Year Pills Selector */}
        <YearPills
          años={añosDisponibles}
          añoActivo={añoActivo}
          onSelectAño={handleSelectAño}
          estadoBadge={estadoBadge}
        />

        {/* 4 KPI Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1.5fr',
          gap: 10,
          marginBottom: 16,
        }}>
          <TarjetaBaseImponible
            ingresos={ingresos}
            gastos={gastos}
            base={base}
            fuentes={fuentes}
          />
          <TarjetaCuota
            cuota={datosActivo?.cuotaIntegra ?? 0}
            tipoEfectivo={datosActivo?.tipoEfectivo ?? 0}
          />
          <TarjetaRetenciones
            retenciones={datosActivo?.retenciones ?? 0}
            cuota={datosActivo?.cuotaIntegra ?? 0}
          />
          <TarjetaResultado
            resultado={datosActivo?.resultado ?? 0}
            tipoEfectivo={datosActivo?.tipoEfectivo ?? 0}
            añoActivo={añoActivo}
          />
        </div>

        {/* Evolution Chart + Side Panels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 10,
          marginBottom: 24,
        }}>
          {/* Left: Evolution chart */}
          <GraficaEvolucion
            años={allData}
            añoActivo={añoActivo}
            onSelectAño={handleSelectAño}
          />

          {/* Right: Side panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PanelTipoEfectivo años={allData} añoActivo={añoActivo} />
            <PanelFuentes fuentes={fuentes} añoActivo={añoActivo} />
          </div>
        </div>

        {/* Desglose fiscal por inmueble */}
        {inmuebles.length > 0 && (
          <>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '.07em',
              textTransform: 'uppercase',
              color: 'var(--grey-400)',
              marginBottom: 10,
            }}>
              Desglose fiscal por inmueble · {añoActivo}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}>
              {inmuebles.map(inm => (
                <CardInmuebleFiscal key={inm.rc || inm.direccion} inm={inm} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImpuestosSupervisionPage;
