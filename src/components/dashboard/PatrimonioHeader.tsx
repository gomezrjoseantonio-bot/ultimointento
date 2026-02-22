import React from 'react';
import { Wallet, TrendingUp, TrendingDown, Building2, LineChart, Landmark, CreditCard, Zap } from 'lucide-react';

interface PatrimonioHeaderProps {
  patrimonioNeto: number;
  variacionPorcentaje: number;
  desglose?: {
    inmuebles: number;
    inversiones: number;
    cuentas: number;
    deuda: number;
  };
  fechaCalculo?: string;
  onActualizarValores?: () => void;
}

/**
 * PatrimonioHeader - Header showing total net worth with breakdown
 * 
 * Displays:
 * - Title "PATRIMONIO NETO"
 * - Current date
 * - Total net worth with variation percentage and trend indicator
 * - Breakdown with 4 icons: Inmuebles, Inversiones, Cuentas, Deuda
 * 
 * 100% ATLAS Design Bible compliant:
 * - Lucide icons only (NO emojis)
 * - Monochromatic colors + semantic (green/red for trends)
 * - Spanish locale formatting (1.234,56 €)
 */
const PatrimonioHeader: React.FC<PatrimonioHeaderProps> = ({
  patrimonioNeto,
  variacionPorcentaje,
  desglose,
  fechaCalculo,
  onActualizarValores,
}) => {
  // Format currency in Spanish locale
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  // Get current date formatted
  const getCurrentDate = (): string => {
    const date = fechaCalculo ? new Date(fechaCalculo) : new Date();
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const isPositive = variacionPorcentaje > 0;

  return (
    <div
      style={{
        padding: '24px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg)',
        fontFamily: 'var(--font-inter)'
      }}
    >
      {/* Header row with title and date */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}
      >
        <h1
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-gray)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          <Wallet size={18} strokeWidth={1.5} style={{ color: 'var(--atlas-blue)' }} aria-hidden="true" />
          PATRIMONIO NETO
        </h1>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-gray)',
            fontWeight: 500
          }}
        >
          {getCurrentDate()}
        </span>
      </div>

      {/* Net worth display with variation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '16px',
          marginBottom: '12px'
        }}
      >
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

        {/* Variation indicator - only show if not zero */}
        {variacionPorcentaje !== 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: isPositive ? 'var(--ok)' : 'var(--alert)',
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
          </div>
        )}
      </div>

      {/* Actualizar valores button */}
      {onActualizarValores && (
        <button
          onClick={onActualizarValores}
          aria-label="Actualizar valores de activos"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            border: '1px solid var(--atlas-blue)',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            color: 'var(--atlas-blue)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-inter)',
            marginBottom: '16px',
            transition: 'background-color 0.2s',
          }}
        >
          <Zap size={14} strokeWidth={2} aria-hidden="true" />
          Actualizar valores
        </button>
      )}

      {/* Breakdown - 4 icons with amounts */}
      {desglose && (
        <div
          style={{
            display: 'flex',
            gap: '24px',
            alignItems: 'center'
          }}
        >
          {/* Inmuebles */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Building2 
              size={16} 
              strokeWidth={1.5} 
              style={{ color: 'var(--atlas-blue)' }} 
              aria-hidden="true" 
            />
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--atlas-navy-1)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {formatCurrency(desglose.inmuebles)}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-gray)',
                fontWeight: 400
              }}
            >
              Inmuebles
            </span>
          </div>

          {/* Inversiones */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <LineChart 
              size={16} 
              strokeWidth={1.5} 
              style={{ color: 'var(--atlas-blue)' }} 
              aria-hidden="true" 
            />
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--atlas-navy-1)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {formatCurrency(desglose.inversiones)}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-gray)',
                fontWeight: 400
              }}
            >
              Inversiones
            </span>
          </div>

          {/* Cuentas */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Landmark 
              size={16} 
              strokeWidth={1.5} 
              style={{ color: 'var(--atlas-blue)' }} 
              aria-hidden="true" 
            />
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--atlas-navy-1)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {formatCurrency(desglose.cuentas)}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-gray)',
                fontWeight: 400
              }}
            >
              Cuentas
            </span>
          </div>

          {/* Deuda */}
          {desglose.deuda > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CreditCard 
                size={16} 
                strokeWidth={1.5} 
                style={{ color: 'var(--alert)' }} 
                aria-hidden="true" 
              />
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--alert)',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                -{formatCurrency(desglose.deuda)}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-gray)',
                  fontWeight: 400
                }}
              >
                Deuda
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatrimonioHeader;
