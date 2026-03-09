// StatusBadge.tsx
// ATLAS HORIZON: Badge for payment/rendimiento status

import React from 'react';

type Status = 'pendiente' | 'pagado' | 'reinvertido';

interface StatusBadgeProps {
  status: Status;
}

const config: Record<Status, { label: string; bg: string; color: string }> = {
  pendiente: { label: 'Pendiente', bg: '#fef9c3', color: '#854d0e' },
  pagado: { label: 'Pagado', bg: '#ccfbf1', color: '#0d9488' },
  reinvertido: { label: 'Reinvertido', bg: '#dbeafe', color: '#1d4ed8' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { label, bg, color } = config[status] || config.pendiente;
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.6rem',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      fontFamily: 'var(--font-inter)',
      background: bg,
      color,
    }}>
      {label}
    </span>
  );
};

export default StatusBadge;
