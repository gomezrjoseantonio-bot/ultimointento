import React from 'react';
import { TrendingUp, TrendingDown, Wallet, Shield } from 'lucide-react';

interface LiquidezSectionProps {
  disponibleHoy: number;
  comprometido30d: number;
  ingresos30d: number;
  proyeccion30d: number;
  colchonMeses?: number;
  estadoColchon?: 'ok' | 'warning' | 'critical';
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
  proyeccion30d,
  colchonMeses,
  estadoColchon = 'ok'
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

  // Colchón de Emergencia helpers
  const getColchonColor = () => {
    switch (estadoColchon) {
      case 'ok': return 'var(--ok)';
      case 'warning': return 'var(--warn)';
      case 'critical': return 'var(--alert)';
      default: return 'var(--text-gray)';
    }
  };

  const getColchonLabel = () => {
    switch (estadoColchon) {
      case 'ok': return 'Seguro';
      case 'warning': return 'Atención';
      case 'critical': return 'Crítico';
      default: return 'Desconocido';
    }
  };

  const maxColchonMeses = 6;
  const colchonProgress = colchonMeses !== undefined
    ? Math.min((colchonMeses / maxColchonMeses) * 100, 100)
    : 0;

  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: 'var(--hz-card-bg)',
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

      {/* Colchón de Emergencia - prominently highlighted */}
      {colchonMeses !== undefined && (
        <div
          style={{
            padding: '16px',
            marginBottom: '20px',
            backgroundColor: `${getColchonColor()}10`,
            border: `2px solid ${getColchonColor()}`,
            borderRadius: '10px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield
                size={18}
                strokeWidth={1.5}
                style={{ color: getColchonColor() }}
                aria-hidden="true"
              />
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--atlas-navy-1)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Colchón de Emergencia
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--atlas-navy-1)',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {colchonMeses.toFixed(1)} meses
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: `${getColchonColor()}20`,
                  color: getColchonColor(),
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                {getColchonLabel()}
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--hz-neutral-100)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${colchonProgress}%`,
                height: '100%',
                backgroundColor: getColchonColor(),
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <div
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-gray)',
              marginTop: '6px'
            }}
          >
            Objetivo: 6 meses de gastos familiares
          </div>
        </div>
      )}

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
