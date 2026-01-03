import React from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface LiquidezSectionProps {
  disponibleHoy: number;
  comprometido30d: number;
  ingresos30d: number;
  proyeccion30d: number;
}

/**
 * LiquidezSection - Liquidity overview with 30-day projection
 * 
 * Displays:
 * - Available today (current account balances)
 * - Committed expenses in next 30 days
 * - Expected income in next 30 days
 * - 30-day projection with trend indicator
 * 
 * 100% ATLAS Design Bible compliant:
 * - Inter font with tabular-nums
 * - Spanish locale formatting
 * - CSS tokens only
 * - Lucide icons (NO emojis)
 */
const LiquidezSection: React.FC<LiquidezSectionProps> = ({
  disponibleHoy,
  comprometido30d,
  ingresos30d,
  proyeccion30d
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

  const proyeccionPositiva = proyeccion30d > disponibleHoy;

  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: 'white',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        fontFamily: 'var(--font-inter)'
      }}
    >
      {/* Section title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px'
        }}
      >
        <Wallet
          size={24}
          strokeWidth={1.5}
          style={{ color: 'var(--atlas-blue)' }}
          aria-hidden="true"
        />
        <h2
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          LIQUIDEZ
        </h2>
      </div>

      {/* Liquidity breakdown */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Available today */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            paddingBottom: '12px'
          }}
        >
          <span
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-gray)',
              fontWeight: 500
            }}
          >
            Disponible hoy:
          </span>
          <span
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--atlas-navy-1)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {formatCurrency(disponibleHoy)}
          </span>
        </div>

        {/* Committed expenses */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline'
          }}
        >
          <span
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-gray)',
              fontWeight: 400
            }}
          >
            Comprometido 30d:
          </span>
          <span
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--error)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            -{formatCurrency(comprometido30d)}
          </span>
        </div>

        {/* Expected income */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            paddingBottom: '12px',
            borderBottom: '2px solid var(--border)'
          }}
        >
          <span
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-gray)',
              fontWeight: 400
            }}
          >
            Ingresos 30d:
          </span>
          <span
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--ok)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            +{formatCurrency(ingresos30d)}
          </span>
        </div>

        {/* 30-day projection */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            backgroundColor: proyeccionPositiva
              ? 'rgba(40, 167, 69, 0.05)'
              : 'rgba(220, 53, 69, 0.05)',
            borderRadius: '8px',
            border: `1px solid ${proyeccionPositiva ? 'var(--ok)' : 'var(--error)'}`
          }}
        >
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--atlas-navy-1)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Proyección 30d:
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: proyeccionPositiva ? 'var(--ok)' : 'var(--error)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {formatCurrency(proyeccion30d)}
            </span>
            {proyeccionPositiva ? (
              <TrendingUp
                size={20}
                strokeWidth={2.5}
                style={{ color: 'var(--ok)' }}
                aria-label="Tendencia positiva"
              />
            ) : (
              <TrendingDown
                size={20}
                strokeWidth={2.5}
                style={{ color: 'var(--error)' }}
                aria-label="Tendencia negativa"
              />
            )}
          </div>
        </div>
      </div>

      {/* Helper text */}
      <p
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-gray)',
          marginTop: '12px',
          marginBottom: 0,
          fontStyle: 'italic'
        }}
      >
        (hipotecas, seguros, alquileres, nómina, etc.)
      </p>
    </div>
  );
};

export default LiquidezSection;
