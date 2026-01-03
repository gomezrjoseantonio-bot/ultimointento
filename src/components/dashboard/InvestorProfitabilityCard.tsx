import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface InvestorProfitabilityCardProps {
  netReturn: number;
  netReturnTrend?: 'up' | 'down' | 'neutral';
  monthlyCashflow: number;
  occupancy: number;
}

/**
 * InvestorProfitabilityCard - Bloque de Rentabilidad para InvestorDashboard
 * 
 * Muestra KPIs principales: rentabilidad neta, cashflow mensual y ocupación
 * Cumple 100% ATLAS Design Bible
 */
const InvestorProfitabilityCard: React.FC<InvestorProfitabilityCardProps> = ({
  netReturn,
  netReturnTrend = 'neutral',
  monthlyCashflow,
  occupancy
}) => {
  // Formato ES-ES: punto miles, coma decimales
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Formato porcentaje ES-ES: coma decimal
  const formatPercent = (value: number) => {
    return `${value.toLocaleString('es-ES', { 
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}%`;
  };

  const getTrendIcon = () => {
    if (netReturnTrend === 'up') {
      return <TrendingUp size={16} style={{ color: 'var(--ok)' }} aria-hidden="true" />;
    } else if (netReturnTrend === 'down') {
      return <TrendingDown size={16} style={{ color: 'var(--error)' }} aria-hidden="true" />;
    }
    return null;
  };

  return (
    <div 
      style={{ 
        backgroundColor: 'var(--hz-card-bg)',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 2px rgba(15, 61, 98, .06), 0 4px 12px rgba(15, 61, 98, .04)'
      }}
    >
      {/* Título con icono */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <TrendingUp 
          size={24} 
          strokeWidth={1.5} 
          style={{ color: 'var(--atlas-blue)' }} 
          aria-hidden="true"
        />
        <h3 
          style={{ 
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            margin: 0,
            fontFamily: 'var(--font-inter)'
          }}
        >
          Rentabilidad
        </h3>
      </div>

      {/* KPIs Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Rentabilidad neta */}
        <div>
          <div 
            style={{ 
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--text-gray)',
              marginBottom: '8px',
              fontFamily: 'var(--font-inter)'
            }}
          >
            Rent. neta
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span 
              style={{ 
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--atlas-navy-1)',
                fontFamily: 'var(--font-inter)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {formatPercent(netReturn)}
            </span>
            {getTrendIcon()}
          </div>
        </div>

        {/* Cashflow mensual */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span 
            style={{ 
              fontSize: '0.875rem',
              color: 'var(--text-gray)',
              fontFamily: 'var(--font-inter)'
            }}
          >
            Cashflow mes:
          </span>
          <span 
            style={{ 
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--atlas-navy-1)',
              fontFamily: 'var(--font-inter)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {formatCurrency(monthlyCashflow)}
          </span>
        </div>

        {/* Ocupación */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span 
            style={{ 
              fontSize: '0.875rem',
              color: 'var(--text-gray)',
              fontFamily: 'var(--font-inter)'
            }}
          >
            Ocupación:
          </span>
          <span 
            style={{ 
              fontSize: '1rem',
              fontWeight: 600,
              color: occupancy >= 90 ? 'var(--ok)' : occupancy >= 75 ? 'var(--warn)' : 'var(--error)',
              fontFamily: 'var(--font-inter)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {formatPercent(occupancy)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default InvestorProfitabilityCard;
