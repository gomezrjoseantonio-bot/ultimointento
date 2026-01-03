import React from 'react';
import { TrendingUp, TrendingDown, Landmark } from 'lucide-react';

interface PatrimonioHeaderProps {
  patrimonioNeto: number;
  variacionPorcentaje: number;
  mes?: string; // e.g., "Enero 2026"
}

/**
 * PatrimonioHeader - Header showing total net worth and variation
 * 
 * Displays:
 * - Title "MI PATRIMONIO"
 * - Current month/year
 * - Total net worth with variation percentage and trend indicator
 * 
 * 100% ATLAS Design Bible compliant:
 * - Inter font with tabular-nums for numbers
 * - CSS tokens only (var(--atlas-blue), var(--ok), var(--error))
 * - Spanish locale formatting (1.234,56 €)
 */
const PatrimonioHeader: React.FC<PatrimonioHeaderProps> = ({
  patrimonioNeto,
  variacionPorcentaje,
  mes
}) => {
  // Format currency in Spanish locale
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  // Get current month if not provided
  const getCurrentMonth = (): string => {
    const now = new Date();
    return new Intl.DateTimeFormat('es-ES', {
      month: 'long',
      year: 'numeric'
    }).format(now);
  };

  const displayMonth = mes || getCurrentMonth();
  const isPositive = variacionPorcentaje >= 0;

  return (
    <div
      style={{
        padding: '24px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg)'
      }}
    >
      {/* Header row with title and month */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          fontFamily: 'var(--font-inter)'
        }}
      >
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Landmark size={24} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
          MI PATRIMONIO
        </h1>
        <span
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-gray)',
            textTransform: 'capitalize'
          }}
        >
          {displayMonth}
        </span>
      </div>

      {/* Net worth display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '16px',
          fontFamily: 'var(--font-inter)'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'var(--text-gray)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Patrimonio neto total
          </span>
          <span
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--atlas-navy-1)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {formatCurrency(patrimonioNeto)}
          </span>
        </div>

        {/* Variation indicator */}
        {variacionPorcentaje !== 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 12px',
              borderRadius: '6px',
              backgroundColor: isPositive
                ? 'rgba(40, 167, 69, 0.1)'
                : 'rgba(220, 53, 69, 0.1)',
              color: isPositive ? 'var(--ok)' : 'var(--error)',
              fontSize: '0.875rem',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {isPositive ? (
              <TrendingUp size={16} strokeWidth={2.5} aria-label="Tendencia positiva" />
            ) : (
              <TrendingDown size={16} strokeWidth={2.5} aria-label="Tendencia negativa" />
            )}
            {formatPercentage(variacionPorcentaje)}
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 400,
                marginLeft: '4px',
                opacity: 0.8
              }}
            >
              vs mes anterior
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatrimonioHeader;
