import React from 'react';
import { Shield, ArrowRight } from 'lucide-react';

interface SaludFinancieraProps {
  liquidezHoy: number;
  gastoMedioMensual: number;
  colchonMeses: number;
  estado: 'ok' | 'warning' | 'critical';
  proyeccion30d: {
    estimado: number;
    ingresos: number;
    gastos: number;
  };
}

/**
 * SaludFinanciera - Financial health indicator
 * 
 * Shows:
 * - Current liquidity
 * - Financial cushion in months (progress bar)
 * - Status indicator (ok/warning/critical)
 * - 30-day projection with breakdown
 * 
 * 100% ATLAS Design Bible compliant:
 * - Lucide icons only
 * - Monochromatic + semantic colors (green/yellow/red)
 * - Spanish locale formatting
 */
const SaludFinanciera: React.FC<SaludFinancieraProps> = ({
  liquidezHoy,
  gastoMedioMensual,
  colchonMeses,
  estado,
  proyeccion30d
}) => {
  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Get status color
  const getStatusColor = () => {
    switch (estado) {
      case 'ok':
        return 'var(--ok)';
      case 'warning':
        return 'var(--warn)';
      case 'critical':
        return 'var(--alert)';
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (estado) {
      case 'ok':
        return 'Saludable';
      case 'warning':
        return 'Atención';
      case 'critical':
        return 'Crítico';
    }
  };

  // Calculate progress bar percentage (max 6 months)
  const maxMonths = 6;
  const progressPercentage = Math.min((colchonMeses / maxMonths) * 100, 100);

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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px'
        }}
      >
        <Shield
          size={20}
          strokeWidth={1.5}
          style={{ color: 'var(--atlas-blue)' }}
          aria-hidden="true"
        />
        <h2
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-gray)',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          SALUD FINANCIERA
        </h2>
      </div>

      {/* Current liquidity */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-gray)',
            marginBottom: '4px'
          }}
        >
          Disponible hoy
        </div>
        <div
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'var(--atlas-navy-1)',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {formatCurrency(liquidezHoy)}
        </div>
      </div>

      {/* Cushion indicator */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
            Colchón
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--atlas-navy-1)',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {colchonMeses.toFixed(1)} meses
            </span>
            <div
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: `${getStatusColor()}20`,
                color: getStatusColor(),
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              {getStatusText()}
            </div>
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
              width: `${progressPercentage}%`,
              height: '100%',
              backgroundColor: getStatusColor(),
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      </div>

      {/* 30-day projection */}
      <div
        style={{
          padding: '12px',
          backgroundColor: 'var(--bg)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-gray)',
            marginBottom: '8px'
          }}
        >
          Proyección 30d
        </div>
        <div
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--atlas-navy-1)',
            fontVariantNumeric: 'tabular-nums',
            marginBottom: '8px'
          }}
        >
          {formatCurrency(proyeccion30d.estimado)}
        </div>

        {/* Income and expenses breakdown */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            fontSize: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--ok)', fontWeight: 600 }}>
              +{formatCurrency(proyeccion30d.ingresos)}
            </span>
            <span style={{ color: 'var(--text-gray)' }}>ingresos</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--alert)', fontWeight: 600 }}>
              -{formatCurrency(proyeccion30d.gastos)}
            </span>
            <span style={{ color: 'var(--text-gray)' }}>gastos</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaludFinanciera;
