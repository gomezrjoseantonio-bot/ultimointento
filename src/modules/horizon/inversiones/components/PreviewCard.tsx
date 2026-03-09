// PreviewCard.tsx
// ATLAS HORIZON: Preview card showing estimated returns

import React from 'react';
import { IRPF_RATE } from '../../../../constants/inversiones';

interface PreviewCardProps {
  tasaAnual: number;
  capital: number;
  frecuencia: 'mensual' | 'trimestral' | 'semestral' | 'anual';
}

const IRPF = IRPF_RATE;

const divisores: Record<string, number> = {
  mensual: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
};

const frecuenciaLabel: Record<string, string> = {
  mensual: 'mensual',
  trimestral: 'trimestral',
  semestral: 'semestral',
  anual: 'anual',
};

const PreviewCard: React.FC<PreviewCardProps> = ({ tasaAnual, capital, frecuencia }) => {
  const divisor = divisores[frecuencia] || 12;
  const importeBruto = (capital * (tasaAnual / 100)) / divisor;
  const retencion = importeBruto * IRPF;
  const importeNeto = importeBruto - retencion;
  const importeAnualNeto = importeNeto * divisor;

  const formatEuro = (v: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  if (!tasaAnual || !capital) return null;

  return (
    <div style={{
      background: '#f0fdfa',
      border: '1px solid #99f6e4',
      borderRadius: '8px',
      padding: '1rem',
    }}>
      <p style={{ fontFamily: 'var(--font-inter)', fontSize: 'var(--text-caption)', fontWeight: 600, color: '#0d9488', margin: '0 0 0.5rem 0' }}>
        Estimación de rendimientos
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-gray)' }}>
            Bruto {frecuenciaLabel[frecuencia]}
          </div>
          <div style={{ fontWeight: 600, color: 'var(--atlas-navy-1)', fontFamily: 'var(--font-inter)' }}>
            {formatEuro(importeBruto)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-gray)' }}>
            IRPF ({IRPF_RATE * 100}%)
          </div>
          <div style={{ fontWeight: 600, color: 'var(--error)', fontFamily: 'var(--font-inter)' }}>
            -{formatEuro(retencion)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-gray)' }}>
            Neto anual
          </div>
          <div style={{ fontWeight: 600, color: '#0d9488', fontFamily: 'var(--font-inter)' }}>
            {formatEuro(importeAnualNeto)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewCard;
