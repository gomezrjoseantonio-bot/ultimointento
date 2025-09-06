// Status Chip Component for Bandeja de entrada
// Displays document status with proper colors: Verde/Ámbar/Rojo

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface StatusChipProps {
  status: string;
  warnings?: string[];
  className?: string;
}

const StatusChip: React.FC<StatusChipProps> = ({ status, warnings = [], className = '' }) => {
  const getStatusConfig = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    
    switch (normalizedStatus) {
      case 'procesado':
      case 'importado':
      case 'completado':
        return {
          label: 'Procesado',
          icon: CheckCircle,
          bgColor: 'bg-success-100',
          textColor: 'text-success-800',
          borderColor: 'border-success-200',
          iconColor: 'text-success-600'
        };
      
      case 'warning':
      case 'incompleto':
      case 'procesado_ocr':
        return {
          label: warnings.length > 0 ? 'Warning' : 'Incompleto',
          icon: AlertTriangle,
          bgColor: 'bg-amber-100',
          textColor: 'text-amber-800',
          borderColor: 'border-amber-200',
          iconColor: 'text-amber-600'
        };
      
      case 'error':
      case 'duplicado':
      case 'failed':
        return {
          label: normalizedStatus === 'duplicado' ? 'Duplicado' : 'Error',
          icon: XCircle,
          bgColor: 'bg-error-100',
          textColor: 'text-error-800',
          borderColor: 'border-error-200',
          iconColor: 'text-error-600'
        };
      
      case 'pendiente':
      case 'pending':
      default:
        return {
          label: 'Pendiente',
          icon: Clock,
          bgColor: 'bg-neutral-100',
          textColor: 'text-neutral-800',
          borderColor: 'border-neutral-200',
          iconColor: 'text-neutral-600'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;
  
  return (
    <div className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
      ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}
    `}>
      <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
      <span>{config.label}</span>
      {warnings.length > 0 && (
        <div className="ml-1">
          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" title={warnings.join(', ')} />
        </div>
      )}
    </div>
  );
};

export default StatusChip;