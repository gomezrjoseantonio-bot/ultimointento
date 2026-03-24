import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface DashboardGaugeProps {
  value: number;
  max: number;
  chartColor: string;
  icon: LucideIcon;
  label: string;
  unit: string;
}

const DashboardGauge: React.FC<DashboardGaugeProps> = ({ value, max, chartColor, icon: Icon, label, unit }) => {
  const size = 80;
  const r = 32;
  const circ = 2 * Math.PI * r;
  const ratio = Math.min(value / max, 1);
  const offset = circ * (1 - ratio);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--n-100)" strokeWidth={5} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={chartColor} strokeWidth={5} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} strokeWidth={1.5} style={{ color: chartColor }} />
        </div>
      </div>
      <div>
        <div className="dash-mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--n-900)', lineHeight: 1 }}>
          {value}{unit}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--n-700)', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
};

export default DashboardGauge;
