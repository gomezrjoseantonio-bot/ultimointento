import React from 'react';
import { Calculator } from 'lucide-react';

interface LiveCalculationFooterProps {
  cuotaMensual: number | null;
  tae: number | null;
  tinEfectivo: number | null;
  isVisible: boolean;
}

const fmt = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const LiveCalculationFooter: React.FC<LiveCalculationFooterProps> = ({
  cuotaMensual,
  tae,
  tinEfectivo,
  isVisible,
}) => {
  if (!isVisible) return null;

  return (
    <div
      style={{
        backgroundColor: 'rgba(40,167,69,0.08)',
        border: '1px solid rgba(40,167,69,0.2)',
        borderRadius: 8,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ok)', fontSize: 13, fontWeight: 600 }}>
        <Calculator size={16} strokeWidth={1.5} />
        Cálculo en vivo
      </span>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-gray)', marginBottom: 2 }}>Cuota mensual</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--atlas-navy-1)' }}>
            {cuotaMensual !== null ? `${fmt(cuotaMensual)} €` : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-gray)', marginBottom: 2 }}>TAE aprox.</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--atlas-navy-1)' }}>
            {tae !== null ? `${fmt(tae * 100)} %` : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-gray)', marginBottom: 2 }}>TIN efectivo</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--atlas-navy-1)' }}>
            {tinEfectivo !== null ? `${fmt(tinEfectivo * 100)} %` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCalculationFooter;
