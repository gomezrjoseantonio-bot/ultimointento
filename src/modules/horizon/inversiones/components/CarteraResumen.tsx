// CarteraResumen.tsx
// ATLAS HORIZON: Investment portfolio summary KPIs

import React from 'react';
import { TrendingUp, DollarSign } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CarteraResumenProps {
  valorTotal: number;
  rentabilidadEuros: number;
  rentabilidadPorcentaje: number;
  porTipo: Record<string, number>;
}

const tipoLabels: Record<string, string> = {
  fondo_inversion: 'Fondos',
  accion: 'Acciones',
  etf: 'ETFs',
  plan_pensiones: 'Pensiones',
  plan_empleo: 'Plan empleo',
  crypto: 'Crypto',
  deposito: 'Depósitos',
  otro: 'Otros',
};

const CHART_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

const CarteraResumen: React.FC<CarteraResumenProps> = ({
  valorTotal,
  rentabilidadEuros,
  rentabilidadPorcentaje,
  porTipo,
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

  const rentabilidadColor = rentabilidadEuros >= 0 ? 'var(--s-pos)' : 'var(--s-neg)';

  const pieData = Object.entries(porTipo)
    .map(([tipo, valor]) => ({
      name: tipoLabels[tipo] || tipo,
      value: valor,
      tipo,
    }))
    .sort((a, b) => b.value - a.value);

  const pieColorByTipo = pieData.reduce<Record<string, string>>((acc, item, idx) => {
    acc[item.tipo] = CHART_COLORS[idx % CHART_COLORS.length];
    return acc;
  }, {});

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(3, 1fr)', 
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
            background: 'var(--n-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '0.75rem'
          }}>
            <DollarSign size={20} style={{ color: 'var(--atlas-blue)' }} />
          </div>
          <span style={{ 
            fontFamily: 'var(--font-base)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--text-gray)' 
          }}>
            Valor Total
          </span>
        </div>
        <div style={{ 
          fontFamily: 'var(--font-base)',
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          color: 'var(--n-700)',
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
            background: 'var(--n-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '0.75rem'
          }}>
            <TrendingUp size={20} style={{ color: 'var(--blue)' }} />
          </div>
          <span style={{ 
            fontFamily: 'var(--font-base)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--text-gray)' 
          }}>
            Rentabilidad
          </span>
        </div>
        <div style={{ 
          fontFamily: 'var(--font-base)',
          fontSize: 'var(--text-xl)',
          fontWeight: 600,
          color: rentabilidadColor,
          fontVariantNumeric: 'tabular-nums'
        }}>
          {formatPercentage(rentabilidadPorcentaje)}
        </div>
        <div style={{ 
          fontFamily: 'var(--font-base)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-gray)',
          marginTop: '0.25rem',
          fontVariantNumeric: 'tabular-nums'
        }}>
          {formatCurrency(rentabilidadEuros)}
        </div>
      </div>

      {/* Distribución por tipo */}
      <div style={{
        background: 'var(--hz-card-bg)',
        border: '1px solid var(--hz-neutral-300)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ 
            fontFamily: 'var(--font-base)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--text-gray)' 
          }}>
            Distribución por tipo
          </span>
        </div>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.tipo} fill={pieColorByTipo[entry.tipo] || 'var(--c5)'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) =>
                  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
                }
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontFamily: 'var(--font-base)', fontSize: 'var(--text-sm)', color: 'var(--n-700)' }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ 
            fontFamily: 'var(--font-base)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-gray)',
            textAlign: 'center',
            paddingTop: '1rem',
          }}>
            Sin datos
          </div>
        )}
      </div>
    </div>
  );
};

export default CarteraResumen;
