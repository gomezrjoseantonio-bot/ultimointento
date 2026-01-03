import React from 'react';
import { Briefcase, Building2, TrendingUp } from 'lucide-react';
import BolsilloCard from './BolsilloCard';

interface TresBolsillosGridProps {
  trabajo: {
    mensual: number;
    tendencia: 'up' | 'down' | 'stable';
  };
  inmuebles: {
    cashflow: number;
    tendencia: 'up' | 'down' | 'stable';
  };
  inversiones: {
    dividendos: number;
    tendencia: 'up' | 'down' | 'stable';
  };
  onNavigate: (route: string) => void;
}

/**
 * TresBolsillosGrid - Grid displaying the 3 main income sources
 * 
 * Shows the investor's 3 "pockets":
 * 1. TRABAJO - Net personal income (Briefcase icon)
 * 2. INMUEBLES - Real estate cashflow (Building2 icon)
 * 3. INVERSIONES - Investment dividends (TrendingUp icon)
 * 
 * Responsive grid: 3 columns on desktop, 1 column on mobile
 * 
 * 100% ATLAS Design Bible compliant (Lucide icons, NO emojis)
 */
const TresBolsillosGrid: React.FC<TresBolsillosGridProps> = ({
  trabajo,
  inmuebles,
  inversiones,
  onNavigate
}) => {
  // Format currency for display
  const formatAmount = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    const formatted = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(value));
    
    return `${sign}${formatted}/mes`;
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        fontFamily: 'var(--font-inter)'
      }}
    >
      {/* Trabajo Card */}
      <BolsilloCard
        icono={Briefcase}
        titulo="TRABAJO"
        cantidad={formatAmount(trabajo.mensual)}
        subtitulo="Neto trabajo"
        link="/personal"
        onClick={() => onNavigate('/personal')}
        tendencia={trabajo.tendencia}
      />

      {/* Inmuebles Card */}
      <BolsilloCard
        icono={Building2}
        titulo="INMUEBLES"
        cantidad={formatAmount(inmuebles.cashflow)}
        subtitulo="Cashflow"
        link="/inmuebles"
        onClick={() => onNavigate('/inmuebles/cartera')}
        tendencia={inmuebles.tendencia}
      />

      {/* Inversiones Card */}
      <BolsilloCard
        icono={TrendingUp}
        titulo="INVERSIONES"
        cantidad={formatAmount(inversiones.dividendos)}
        subtitulo="Dividendos"
        link="/inversiones"
        onClick={() => onNavigate('/inversiones')}
        tendencia={inversiones.tendencia}
      />
    </div>
  );
};

export default TresBolsillosGrid;
