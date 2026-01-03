import React from 'react';
import { ArrowRight } from 'lucide-react';

interface BolsilloCardProps {
  icono: string; // Emoji icon
  titulo: string; // Card title (e.g., "TRABAJO", "INMUEBLES", "INVERSIONES")
  cantidad: string; // Formatted amount (e.g., "+€3.200/mes")
  subtitulo: string; // Subtitle (e.g., "Neto trabajo", "Cashflow")
  link: string; // Navigation link
  onClick?: () => void; // Click handler for navigation
  tendencia?: 'up' | 'down' | 'stable'; // Trend indicator
}

/**
 * BolsilloCard - Individual card for each "bolsillo" (pocket)
 * 
 * Displays one of the 3 main income sources:
 * - 💼 TRABAJO (Work/Personal income)
 * - 🏢 INMUEBLES (Real estate cashflow)
 * - 📈 INVERSIONES (Investment dividends)
 * 
 * 100% ATLAS Design Bible compliant:
 * - Inter font with tabular-nums
 * - CSS tokens only
 * - Hover states with smooth transitions
 * - Accessible with ARIA labels
 */
const BolsilloCard: React.FC<BolsilloCardProps> = ({
  icono,
  titulo,
  cantidad,
  subtitulo,
  link,
  onClick,
  tendencia = 'stable'
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  // Determine if amount is positive, negative, or zero
  const isPositive = cantidad.includes('+');
  const isNegative = cantidad.includes('-');
  const amountColor = isPositive
    ? 'var(--ok)'
    : isNegative
    ? 'var(--error)'
    : 'var(--atlas-navy-1)';

  return (
    <button
      onClick={handleClick}
      aria-label={`Ver detalles de ${titulo}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        backgroundColor: 'white',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textAlign: 'left',
        width: '100%',
        fontFamily: 'var(--font-inter)',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        e.currentTarget.style.borderColor = 'var(--atlas-blue)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {/* Icon and title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px'
        }}
      >
        <span
          style={{
            fontSize: '1.5rem',
            lineHeight: 1
          }}
          role="img"
          aria-label={titulo}
        >
          {icono}
        </span>
        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--atlas-navy-1)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0
          }}
        >
          {titulo}
        </h3>
      </div>

      {/* Amount */}
      <div
        style={{
          marginBottom: '8px'
        }}
      >
        <span
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: amountColor,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2
          }}
        >
          {cantidad}
        </span>
      </div>

      {/* Subtitle */}
      <div
        style={{
          marginBottom: '16px'
        }}
      >
        <span
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-gray)',
            fontWeight: 400
          }}
        >
          {subtitulo}
        </span>
      </div>

      {/* View link with arrow */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: 'var(--atlas-blue)',
          fontSize: '0.875rem',
          fontWeight: 500,
          marginTop: 'auto'
        }}
      >
        <span>Ver</span>
        <ArrowRight size={16} strokeWidth={2} />
      </div>
    </button>
  );
};

export default BolsilloCard;
