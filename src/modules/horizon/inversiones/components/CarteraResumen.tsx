// CarteraResumen.tsx
// ATLAS HORIZON: Investment portfolio summary KPIs

import React from 'react';
import { TrendingUp, DollarSign, Package } from 'lucide-react';

interface CarteraResumenProps {
  valorTotal: number;
  rentabilidadEuros: number;
  rentabilidadPorcentaje: number;
  numPosiciones: number;
}

const CarteraResumen: React.FC<CarteraResumenProps> = ({
  valorTotal,
  rentabilidadEuros,
  rentabilidadPorcentaje,
  numPosiciones,
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const rentabilidadColor = rentabilidadEuros >= 0 ? 'var(--ok)' : 'var(--error)';

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
      gap: '1rem',
      marginBottom: '2rem' 
    }}>
      {/* Valor Total */}
      <div style={{
        background: 'var(--hz-card-bg)',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            background: 'var(--hz-info-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '0.75rem'
          }}>
            <DollarSign size={20} style={{ color: 'var(--atlas-blue)' }} />
          </div>
          <span style={{ 
            fontFamily: 'var(--font-inter)',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
            color: 'var(--text-gray)' 
          }}>
            Valor Total
          </span>
        </div>
        <div style={{ 
          fontFamily: 'var(--font-inter)',
          fontSize: 'var(--text-kpi)',
          fontWeight: 600,
          color: 'var(--atlas-navy-1)',
          fontVariantNumeric: 'tabular-nums'
        }}>
          {formatCurrency(valorTotal)}
        </div>
      </div>

      {/* Rentabilidad */}
      <div style={{
        background: 'var(--hz-card-bg)',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            background: rentabilidadEuros >= 0 ? 'var(--hz-success-soft)' : 'var(--hz-error-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '0.75rem'
          }}>
            <TrendingUp size={20} style={{ color: rentabilidadColor }} />
          </div>
          <span style={{ 
            fontFamily: 'var(--font-inter)',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
            color: 'var(--text-gray)' 
          }}>
            Rentabilidad
          </span>
        </div>
        <div style={{ 
          fontFamily: 'var(--font-inter)',
          fontSize: 'var(--text-kpi)',
          fontWeight: 600,
          color: rentabilidadColor,
          fontVariantNumeric: 'tabular-nums'
        }}>
          {formatPercentage(rentabilidadPorcentaje)}
        </div>
        <div style={{ 
          fontFamily: 'var(--font-inter)',
          fontSize: 'var(--text-caption)',
          color: 'var(--text-gray)',
          marginTop: '0.25rem',
          fontVariantNumeric: 'tabular-nums'
        }}>
          {formatCurrency(rentabilidadEuros)}
        </div>
      </div>

      {/* Número de posiciones */}
      <div style={{
        background: 'var(--hz-card-bg)',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            background: 'var(--hz-info-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '0.75rem'
          }}>
            <Package size={20} style={{ color: 'var(--atlas-blue)' }} />
          </div>
          <span style={{ 
            fontFamily: 'var(--font-inter)',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
            color: 'var(--text-gray)' 
          }}>
            Posiciones
          </span>
        </div>
        <div style={{ 
          fontFamily: 'var(--font-inter)',
          fontSize: 'var(--text-kpi)',
          fontWeight: 600,
          color: 'var(--atlas-navy-1)',
          fontVariantNumeric: 'tabular-nums'
        }}>
          {numPosiciones}
        </div>
      </div>
    </div>
  );
};

export default CarteraResumen;
