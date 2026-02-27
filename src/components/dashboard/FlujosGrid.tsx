import React from 'react';
import { Home, PieChart, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FlujosGridProps {
  trabajo: {
    netoMensual: number;
    tendencia: 'up' | 'down' | 'stable';
    variacionPorcentaje: number;
  };
  inmuebles: {
    cashflow: number;
    ocupacion: number;
    tendencia: 'up' | 'down' | 'stable';
  };
  inversiones: {
    rendimientoMes: number;
    dividendosMes: number;
    tendencia: 'up' | 'down' | 'stable';
  };
  onNavigate: (route: string) => void;
}

/**
 * FlujosGrid - Grid displaying the 3 cashflow sources
 * 
 * Replaces TresBolsillosGrid with enhanced data:
 * 1. ECONOMÍA FAMILIAR - Net family income vs expenses (Home icon)
 * 2. INMUEBLES - Property cashflow with occupancy (Building2 icon)
 * 3. INVERSIONES - Investment returns (PieChart icon)
 * 
 * Responsive grid: 3 columns on desktop
 * 
 * 100% ATLAS Design Bible compliant:
 * - Lucide icons only (NO emojis)
 * - Monochromatic + semantic colors
 * - Spanish locale formatting
 */
const FlujosGrid: React.FC<FlujosGridProps> = ({
  trabajo,
  inmuebles,
  inversiones,
  onNavigate
}) => {
  // Format currency
  const formatAmount = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    const formatted = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(value));
    
    return `${sign}${formatted}`;
  };

  // Get trend icon
  const getTrendIcon = (tendencia: 'up' | 'down' | 'stable') => {
    switch (tendencia) {
      case 'up':
        return <TrendingUp size={14} strokeWidth={2} style={{ color: 'var(--ok)' }} />;
      case 'down':
        return <TrendingDown size={14} strokeWidth={2} style={{ color: 'var(--alert)' }} />;
      default:
        return <Minus size={14} strokeWidth={2} style={{ color: 'var(--text-gray)' }} />;
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        padding: '0 24px 16px 24px',
        fontFamily: 'var(--font-inter)'
      }}
    >
      {/* ECONOMÍA FAMILIAR Card */}
      <button
        onClick={() => onNavigate('/personal')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px',
          backgroundColor: 'var(--hz-card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          textAlign: 'left',
          fontFamily: 'var(--font-inter)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Home 
            size={18} 
            strokeWidth={1.5} 
            style={{ color: 'var(--atlas-blue)' }} 
            aria-hidden="true" 
          />
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-gray)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            ECONOMÍA FAMILIAR
          </span>
        </div>

        {/* Amount */}
        <div
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--atlas-navy-1)',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {formatAmount(trabajo.netoMensual)}
          <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-gray)' }}>
            /mes
          </span>
        </div>

        {/* Subtitle with trend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
            Ingresos - Gastos
          </span>
          {getTrendIcon(trabajo.tendencia)}
        </div>
      </button>

      {/* INMUEBLES Card */}
      <button
        onClick={() => onNavigate('/inmuebles/cartera')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px',
          backgroundColor: 'var(--hz-card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          textAlign: 'left',
          fontFamily: 'var(--font-inter)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Home 
            size={18} 
            strokeWidth={1.5} 
            style={{ color: 'var(--atlas-blue)' }} 
            aria-hidden="true" 
          />
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-gray)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            INMUEBLES
          </span>
        </div>

        {/* Amount */}
        <div
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--atlas-navy-1)',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {formatAmount(inmuebles.cashflow)}
          <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-gray)' }}>
            /mes
          </span>
        </div>

        {/* Subtitle with trend and occupancy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
            Cashflow · {inmuebles.ocupacion.toFixed(0)}% ocupación
          </span>
          {getTrendIcon(inmuebles.tendencia)}
        </div>
      </button>

      {/* INVERSIONES Card */}
      <button
        onClick={() => onNavigate('/inversiones')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px',
          backgroundColor: 'var(--hz-card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          textAlign: 'left',
          fontFamily: 'var(--font-inter)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChart 
            size={18} 
            strokeWidth={1.5} 
            style={{ color: 'var(--atlas-blue)' }} 
            aria-hidden="true" 
          />
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-gray)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            INVERSIONES
          </span>
        </div>

        {/* Amount */}
        <div
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--atlas-navy-1)',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {formatAmount(inversiones.rendimientoMes)}
          <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-gray)' }}>
            /mes
          </span>
        </div>

        {/* Subtitle with trend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
            Rendimiento mensual
          </span>
          {getTrendIcon(inversiones.tendencia)}
        </div>
      </button>
    </div>
  );
};

export default FlujosGrid;
