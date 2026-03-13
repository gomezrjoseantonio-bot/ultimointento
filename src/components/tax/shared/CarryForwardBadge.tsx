import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface CarryForwardBadgeProps {
  text: string;
  warning?: boolean;
}

const CarryForwardBadge: React.FC<CarryForwardBadgeProps> = ({ text, warning = false }) => (
  <div className={`carry-forward-badge ${warning ? 'is-warning' : 'is-ok'}`}>
    {warning ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
    <span>{text}</span>
  </div>
);

export default CarryForwardBadge;
