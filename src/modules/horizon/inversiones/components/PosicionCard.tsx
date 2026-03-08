// PosicionCard.tsx
// ATLAS HORIZON: Investment position card component

import React from 'react';
import { Eye, TrendingUp, LineChart, BarChart3, PiggyBank, Briefcase, Coins, Wallet, Package, Building2, Landmark, CreditCard } from 'lucide-react';
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
      reit: 'REIT',
      plan_pensiones: 'Plan pensiones',
      plan_empleo: 'Plan empleo',
      crypto: 'Crypto',
      deposito: 'Depósito',
      deposito_plazo: 'Depósito a plazo',
      cuenta_remunerada: 'Cuenta remunerada',
      prestamo_p2p: 'Préstamo P2P',
      otro: 'Otro',
    };
    return labels[tipo] || tipo;
  };

  const getTipoCategoria = (): 'rendimiento' | 'dividendos' | 'simple' => {
    if (['cuenta_remunerada', 'prestamo_p2p', 'deposito_plazo'].includes(posicion.tipo)) return 'rendimiento';
    if (['accion', 'etf', 'reit'].includes(posicion.tipo)) return 'dividendos';
    return 'simple';
  };

  const getCategoryColor = (): string => {
    const cat = getTipoCategoria();
    if (cat === 'rendimiento') return '#0d9488';
    if (cat === 'dividendos') return '#1d4ed8';
    return 'var(--text-gray)';
  };

  const getTipoIcon = () => {
    const iconColor = getCategoryColor();
    const iconProps = { size: 24, style: { color: iconColor } };
    const icons: Record<string, React.ReactElement> = {
      fondo_inversion: <TrendingUp {...iconProps} />,
      accion: <LineChart {...iconProps} />,
      etf: <BarChart3 {...iconProps} />,
      reit: <Building2 {...iconProps} />,
      plan_pensiones: <PiggyBank {...iconProps} />,
      plan_empleo: <Briefcase {...iconProps} />,
      crypto: <Coins {...iconProps} />,
      deposito: <Wallet {...iconProps} />,
      deposito_plazo: <Landmark {...iconProps} />,
      cuenta_remunerada: <CreditCard {...iconProps} />,
      prestamo_p2p: <TrendingUp {...iconProps} />,
      otro: <Package {...iconProps} />,
    };
    return icons[posicion.tipo] || <TrendingUp {...iconProps} />;
  };

  const getCategoryBadge = () => {
    const cat = getTipoCategoria();
    const posAny = posicion as any;
    
    if (cat === 'rendimiento' && posAny.rendimiento?.tasa_interes_anual) {
      return {
        label: `Genera intereses ${posAny.rendimiento.tasa_interes_anual}%/año`,
        bg: '#ccfbf1',
        color: '#0d9488',
      };
    }
    if (cat === 'dividendos') {
      const pagaDividendos = posAny.dividendos?.paga_dividendos;
      return pagaDividendos
        ? { label: 'Paga dividendos', bg: '#dbeafe', color: '#1d4ed8' }
        : { label: 'Acumulación', bg: '#eff6ff', color: '#1d4ed8' };
    }
    return { label: 'Valoración simple', bg: '#f3f4f6', color: 'var(--text-gray)' };
  };

  const categoryBadge = getCategoryBadge();
  const rentabilidadColor = posicion.rentabilidad_euros >= 0 ? 'var(--ok)' : 'var(--error)';

  return (
    <div
      style={{
        background: 'var(--hz-card-bg)',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1rem',
        transition: 'box-shadow 0.2s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      onClick={() => onViewDetails(posicion.id)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(4, 44, 94, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '0.75rem',
              flexShrink: 0,
            }}>
              {getTipoIcon()}
            </div>
            <div>
              <h3 style={{
                fontFamily: 'var(--font-base)',
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--atlas-navy-1)',
                margin: 0,
              }}>
                {posicion.nombre}
              </h3>
              <div style={{
                fontFamily: 'var(--font-base)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-gray)',
                marginTop: '0.125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                {getTipoLabel(posicion.tipo)} · {posicion.entidad}
                <span style={{
                  display: 'inline-block',
                  padding: '0.1rem 0.5rem',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  background: categoryBadge.bg,
                  color: categoryBadge.color,
                }}>
                  {categoryBadge.label}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-base)', fontSize: 'var(--text-sm)', color: 'var(--text-gray)', marginBottom: '0.25rem' }}>
                Valor
              </div>
              <div style={{ fontFamily: 'var(--font-base)', fontSize: '1rem', fontWeight: 600, color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(posicion.valor_actual)}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-base)', fontSize: 'var(--text-sm)', color: 'var(--text-gray)', marginBottom: '0.25rem' }}>
                Aportado
              </div>
              <div style={{ fontFamily: 'var(--font-base)', fontSize: '1rem', fontWeight: 600, color: 'var(--atlas-navy-1)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(posicion.total_aportado)}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-base)', fontSize: 'var(--text-sm)', color: 'var(--text-gray)', marginBottom: '0.25rem' }}>
                Rentabilidad
              </div>
              <div style={{ fontFamily: 'var(--font-base)', fontSize: '1rem', fontWeight: 600, color: rentabilidadColor, fontVariantNumeric: 'tabular-nums' }}>
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
            fontFamily: 'var(--font-base)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--blue-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--atlas-blue)'; }}
        >
          <Eye size={16} />
          Ver más
        </button>
      </div>
    </div>
  );
};

export default PosicionCard;
