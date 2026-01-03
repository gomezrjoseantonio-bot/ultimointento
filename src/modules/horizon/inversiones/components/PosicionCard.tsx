// PosicionCard.tsx
// ATLAS HORIZON: Investment position card component

import React from 'react';
import { TrendingUp, Eye } from 'lucide-react';
import { PosicionInversion } from '../../../../types/inversiones';

interface PosicionCardProps {
  posicion: PosicionInversion;
  onViewDetails: (id: number) => void;
}

const PosicionCard: React.FC<PosicionCardProps> = ({ posicion, onViewDetails }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      fondo_inversion: 'Fondo inversión',
      accion: 'Acción',
      etf: 'ETF',
      plan_pensiones: 'Plan pensiones',
      plan_empleo: 'Plan empleo',
      crypto: 'Crypto',
      deposito: 'Depósito',
      otro: 'Otro',
    };
    return labels[tipo] || tipo;
  };

  const getTipoIcon = () => {
    return '📈';
  };

  const rentabilidadColor = posicion.rentabilidad_euros >= 0 ? 'var(--ok)' : 'var(--error)';

  return (
    <div style={{
      background: 'var(--hz-card-bg)',
      border: '1px solid var(--hz-neutral-300)',
      borderRadius: '12px',
      padding: '1.5rem',
      marginBottom: '1rem',
      transition: 'box-shadow 0.2s',
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = 'none';
    }}
    onClick={() => onViewDetails(posicion.id)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem', marginRight: '0.5rem' }}>
              {getTipoIcon()}
            </span>
            <div>
              <h3 style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--atlas-navy-1)',
                margin: 0,
              }}>
                {posicion.nombre}
              </h3>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-gray)',
                marginTop: '0.125rem',
              }}>
                {getTipoLabel(posicion.tipo)} · {posicion.entidad}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex',
            gap: '2rem',
            marginTop: '1rem',
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-gray)',
                marginBottom: '0.25rem',
              }}>
                Valor
              </div>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--atlas-navy-1)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {formatCurrency(posicion.valor_actual)}
              </div>
            </div>

            <div>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-gray)',
                marginBottom: '0.25rem',
              }}>
                Aportado
              </div>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--atlas-navy-1)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {formatCurrency(posicion.total_aportado)}
              </div>
            </div>

            <div>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: 'var(--text-caption)',
                color: 'var(--text-gray)',
                marginBottom: '0.25rem',
              }}>
                Rentabilidad
              </div>
              <div style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '1rem',
                fontWeight: 600,
                color: rentabilidadColor,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {formatPercentage(posicion.rentabilidad_porcentaje)}
              </div>
            </div>
          </div>
        </div>

        {/* Ver más button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(posicion.id);
          }}
          style={{
            background: 'var(--atlas-blue)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontFamily: 'var(--font-inter)',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#03234a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--atlas-blue)';
          }}
        >
          <Eye size={16} />
          Ver más
        </button>
      </div>
    </div>
  );
};

export default PosicionCard;
