// StatusChip — tokens V3, escala de iconos 16px (Lucide)

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface StatusChipProps {
  status: string;
  warnings?: string[];
  className?: string;
}

type ChipConfig = {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  border: string;
  iconColor: string;
};

const getConfig = (status: string, warnings: string[]): ChipConfig => {
  switch (status.toLowerCase()) {
    case 'procesado':
    case 'importado':
    case 'completado':
    case 'auto-guardado ok':
    case 'classified_ok':
      return {
        label: status.toLowerCase().includes('auto') ? 'Auto-guardado OK' : 'Procesado',
        icon: CheckCircle,
        bg:     'var(--s-pos-bg)',
        text:   'var(--s-pos)',
        border: 'var(--s-pos)',
        iconColor: 'var(--s-pos)',
      };

    case 'warning':
    case 'incompleto':
    case 'procesado_ocr':
    case 'needs_review':
    case 'revisión':
    case 'fein_revision':
      return {
        label: status.toLowerCase().includes('fein')
          ? 'Revisión'
          : warnings.length > 0 ? 'Warning' : 'Incompleto',
        icon: AlertTriangle,
        bg:     'var(--s-warn-bg)',
        text:   'var(--s-warn)',
        border: 'var(--s-warn)',
        iconColor: 'var(--s-warn)',
      };

    case 'error':
    case 'duplicado':
    case 'failed':
      return {
        label: status.toLowerCase() === 'duplicado' ? 'Duplicado' : 'Error',
        icon: XCircle,
        bg:     'var(--s-neg-bg)',
        text:   'var(--s-neg)',
        border: 'var(--s-neg)',
        iconColor: 'var(--s-neg)',
      };

    case 'pendiente':
    case 'pending':
    default:
      return {
        label: 'Pendiente',
        icon: Clock,
        bg:     'var(--s-neu-bg)',
        text:   'var(--s-neu)',
        border: 'var(--n-300)',
        iconColor: 'var(--n-500)',
      };
  }
};

const StatusChip: React.FC<StatusChipProps> = ({
  status,
  warnings = [],
  className = '',
}) => {
  const cfg = getConfig(status, warnings);
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      style={{
        padding: '3px 10px',
        borderRadius: 'var(--r-sm)',
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        color: cfg.text,
        fontFamily: 'var(--font-base)',
        fontSize: 'var(--t-xs)',
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      <Icon size={16} style={{ color: cfg.iconColor, flexShrink: 0 }} />
      {cfg.label}
      {warnings.length > 0 && (
        <span
          title={warnings.join(', ')}
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--s-warn)',
            marginLeft: 2,
            flexShrink: 0,
          }}
        />
      )}
    </span>
  );
};

export default StatusChip;
