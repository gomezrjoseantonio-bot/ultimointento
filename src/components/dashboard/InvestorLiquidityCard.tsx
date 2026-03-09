import React from 'react';
import { Wallet } from 'lucide-react';

interface InvestorLiquidityCardProps {
  currentBalance: number;
  projection7d: number;
  projection30d: number;
}

/**
 * InvestorLiquidityCard - Bloque de Liquidez para InvestorDashboard
 * 
 * Muestra el saldo actual y proyecciones a 7 y 30 días
 * Cumple 100% ATLAS Design Bible
 */
const InvestorLiquidityCard: React.FC<InvestorLiquidityCardProps> = ({
  currentBalance,
  projection7d,
  projection30d
}) => {
  // Formato ES-ES: punto miles, coma decimales, espacio antes del €
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatProjection = (amount: number) => {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}${formatCurrency(amount)}`;
  };

  return (
    <div 
      style={{ 
        backgroundColor: 'var(--hz-card-bg)',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: 'var(--shadow-1)'
      }}
    >
      {/* Título con icono */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Wallet 
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
          Liquidez
        </h3>
      </div>

      {/* Saldo actual */}
      <div style={{ marginBottom: '20px' }}>
        <div 
          style={{ 
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--text-gray)',
            marginBottom: '8px',
            fontFamily: 'var(--font-inter)'
          }}
        >
          Saldo actual
        </div>
        <div 
          style={{ 
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--atlas-navy-1)',
            fontFamily: 'var(--font-inter)',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {formatCurrency(currentBalance)}
        </div>
      </div>

      {/* Proyecciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Proyección 7 días */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span 
            style={{ 
              fontSize: '0.875rem',
              color: 'var(--text-gray)',
              fontFamily: 'var(--font-inter)'
            }}
          >
            Próximos 7d:
          </span>
          <span 
            style={{ 
              fontSize: '1rem',
              fontWeight: 600,
              color: projection7d >= 0 ? 'var(--ok)' : 'var(--error)',
              fontFamily: 'var(--font-inter)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {formatProjection(projection7d)}
          </span>
        </div>

        {/* Proyección 30 días */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span 
            style={{ 
              fontSize: '0.875rem',
              color: 'var(--text-gray)',
              fontFamily: 'var(--font-inter)'
            }}
          >
            Próximos 30d:
          </span>
          <span 
            style={{ 
              fontSize: '1rem',
              fontWeight: 600,
              color: projection30d >= 0 ? 'var(--ok)' : 'var(--error)',
              fontFamily: 'var(--font-inter)',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {formatProjection(projection30d)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default InvestorLiquidityCard;
