import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface DashboardKpiCompactProps {
  icon: LucideIcon;
  value: string;
  label: string;
  context?: string;
  chartColor: string;
}

const DashboardKpiCompact: React.FC<DashboardKpiCompactProps> = ({ icon: Icon, value, label, context, chartColor }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
    <div style={{
      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
      background: 'var(--n-100)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={18} strokeWidth={1.5} style={{ color: chartColor || 'var(--n-700)' }} />
    </div>
    <div>
      <div className="dash-mono" style={{ fontSize: 22, fontWeight: 600, color: 'var(--n-900)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--n-700)', marginTop: 3 }}>{label}</div>
      {context && <div style={{ fontSize: 11, color: 'var(--n-500)', marginTop: 1 }}>{context}</div>}
    </div>
  </div>
);

export default DashboardKpiCompact;
