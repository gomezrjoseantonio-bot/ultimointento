import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface DashboardFlujoProgressProps {
  icon: LucideIcon;
  label: string;
  actual: number;
  previsto: number;
  chartColor: string;
  sub: string;
  isLast?: boolean;
}

const euro = (v: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v);

const DashboardFlujoProgress: React.FC<DashboardFlujoProgressProps> = ({ icon: Icon, label, actual, previsto, chartColor, sub, isLast }) => {
  const ratio = previsto > 0 ? Math.min(actual / previsto, 1.15) : 0;
  const pctNum = previsto > 0 ? (actual / previsto * 100) : 0;

  return (
    <div style={{ padding: '14px 0', borderBottom: isLast ? 'none' : '1px solid var(--n-100)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--n-100)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={14} strokeWidth={1.5} style={{ color: chartColor }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--n-700)' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="dash-mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--n-900)' }}>
            {euro(actual)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--n-500)' }}>/ {euro(previsto)}</span>
        </div>
      </div>

      <div style={{ position: 'relative', height: 6, background: 'var(--n-100)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(ratio * 100, 100)}%`,
          background: chartColor,
          borderRadius: 3,
          transition: 'width 0.8s ease',
          opacity: 0.65,
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--n-500)' }}>{sub}</span>
        <span className="dash-mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--n-700)' }}>
          {pctNum.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

export default DashboardFlujoProgress;
