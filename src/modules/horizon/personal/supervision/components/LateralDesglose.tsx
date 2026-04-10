import React from 'react';
import { Banknote, Briefcase, UserPlus, Home, UtensilsCrossed, Shield, CreditCard, Car, Gamepad2, Heart, GraduationCap, Package } from 'lucide-react';

export interface FuenteIngreso {
  nombre: string;
  meta?: string;
  importe: number | null;
  porcentaje?: number;
  iconKey: 'nomina' | 'autonomo' | 'conyuge';
  vacio?: boolean;
}

export interface CosteVida {
  nombre: string;
  meta?: string;
  importe: number | null;
  iconKey: string;
}

interface LateralDesgloseProps {
  año: number;
  fuentes: FuenteIngreso[];
  costesVida: CosteVida[];
  financiacion: number | null;
  financiacionPct?: number;
  gastoVidaEstimado: boolean;
  onConfigurarConyuge?: () => void;
}

const ICONS_FUENTE: Record<string, React.ElementType> = {
  nomina: Banknote,
  autonomo: Briefcase,
  conyuge: UserPlus,
};

const ICONS_COSTE: Record<string, React.ElementType> = {
  vivienda: Home,
  alquiler: Home,
  alimentacion: UtensilsCrossed,
  transporte: Car,
  ocio: Gamepad2,
  salud: Heart,
  seguros: Shield,
  educacion: GraduationCap,
  otros: Package,
};

const fmt = (v: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v);

const SepLabel: React.FC<{ label: string; right?: React.ReactNode }> = ({ label, right }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0 6px',
    borderBottom: '1px solid var(--grey-200, #DDE3EC)',
    marginBottom: 8,
  }}>
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--grey-500, #6C757D)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    }}>
      {label}
    </span>
    {right && <span style={{ fontSize: 11, color: 'var(--grey-500, #6C757D)' }}>{right}</span>}
  </div>
);

const BarRow: React.FC<{
  icon: React.ReactNode;
  nombre: string;
  meta?: string;
  importe: number | null;
  pct?: number;
  color?: string;
  vacio?: boolean;
  onAction?: () => void;
  actionLabel?: string;
}> = ({ icon, nombre, meta, importe, pct, color = 'var(--navy-900)', vacio, onAction, actionLabel }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 0',
    opacity: vacio ? 0.45 : 1,
  }}>
    <div style={{ flexShrink: 0, width: 20, display: 'flex', justifyContent: 'center' }}>
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--grey-900, #1A2332)',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {nombre}
      </div>
      {meta && (
        <div style={{
          fontSize: 11,
          color: 'var(--grey-400, #9CA3AF)',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          marginTop: 1,
        }}>
          {meta}
        </div>
      )}
      {pct !== undefined && pct > 0 && !vacio && (
        <div style={{
          height: 3,
          background: 'var(--grey-100, #EEF1F5)',
          borderRadius: 2,
          marginTop: 4,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(pct, 100)}%`,
            background: color,
            borderRadius: 2,
          }} />
        </div>
      )}
    </div>
    <div style={{
      flexShrink: 0,
      textAlign: 'right',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      {vacio && onAction ? (
        <button
          onClick={onAction}
          style={{
            fontSize: 11,
            color: 'var(--navy-900, #042C5E)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}
        >
          {actionLabel || '+ Añadir'}
        </button>
      ) : (
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color,
          fontFamily: "'IBM Plex Mono', monospace",
          fontVariantNumeric: 'tabular-nums',
        }}>
          {importe !== null ? `${fmt(importe)} €` : '—'}
        </span>
      )}
    </div>
  </div>
);

const Badge: React.FC<{ label: string; bg: string; color: string; italic?: boolean }> = ({
  label, bg, color: c, italic,
}) => (
  <span style={{
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: 10,
    background: bg,
    color: c,
    fontStyle: italic ? 'italic' : 'normal',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  }}>
    {label}
  </span>
);

const LateralDesglose: React.FC<LateralDesgloseProps> = ({
  año,
  fuentes,
  costesVida,
  financiacion,
  financiacionPct,
  gastoVidaEstimado,
  onConfigurarConyuge,
}) => {
  return (
    <div style={{
      background: 'var(--white, #FFFFFF)',
      border: '1px solid var(--grey-200, #DDE3EC)',
      borderRadius: 'var(--r-lg, 12px)',
      padding: '16px',
    }}>
      {/* Fuentes de ingreso */}
      <SepLabel label="Fuentes de ingreso" right={`año ${año}`} />
      {fuentes.map((f, i) => {
        const Icon = ICONS_FUENTE[f.iconKey] || Banknote;
        return (
          <BarRow
            key={i}
            icon={<Icon size={16} style={{
              color: f.vacio
                ? 'var(--grey-400)'
                : f.iconKey === 'autonomo'
                  ? 'var(--navy-700, #142C50)'
                  : 'var(--navy-900, #042C5E)',
              strokeDasharray: f.vacio ? '3 3' : undefined,
            } as React.CSSProperties} />}
            nombre={f.nombre}
            meta={f.meta}
            importe={f.importe}
            pct={f.porcentaje}
            color={f.iconKey === 'autonomo' ? 'var(--navy-700, #142C50)' : 'var(--navy-900, #042C5E)'}
            vacio={f.vacio}
            onAction={f.vacio ? onConfigurarConyuge : undefined}
            actionLabel="+ Añadir"
          />
        );
      })}

      {/* Coste de vida */}
      <div style={{ marginTop: 12 }}>
        <SepLabel
          label="Coste de vida"
          right={
            gastoVidaEstimado
              ? <Badge label="Estimación" bg="var(--grey-100, #EEF1F5)" color="var(--grey-400, #9CA3AF)" italic />
              : <Badge label="Sin configurar" bg="var(--grey-100, #EEF1F5)" color="var(--grey-400, #9CA3AF)" italic />
          }
        />
        {costesVida.map((c, i) => {
          const Icon = ICONS_COSTE[c.iconKey] || Shield;
          return (
            <BarRow
              key={i}
              icon={<Icon size={16} style={{ color: 'var(--grey-500, #6C757D)' }} />}
              nombre={c.nombre}
              meta={c.meta}
              importe={c.importe}
              color="var(--grey-500, #6C757D)"
            />
          );
        })}
      </div>

      {/* Financiación personal */}
      <div style={{ marginTop: 12 }}>
        <SepLabel label="Financiación personal" />
        <BarRow
          icon={<CreditCard size={16} style={{ color: 'var(--teal-600, #1DA0BA)' }} />}
          nombre="Préstamos personales"
          importe={financiacion}
          pct={financiacionPct}
          color="var(--teal-600, #1DA0BA)"
        />
      </div>
    </div>
  );
};

export default LateralDesglose;
