/**
 * ATLAS HORIZON - Movement Status Chip Component
 * 
 * Implements color-coded status chips per problem statement section 10:
 * - previsto: green (tenue)
 * - confirmado/conciliado: blue 
 * - no_planificado: gray
 * - vencido: red with warning icon
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Define the status type locally to avoid import issues
type UnifiedMovementStatus = 
  | 'previsto'      
  | 'confirmado'    
  | 'vencido'       
  | 'no_planificado'
  | 'conciliado';

interface StatusChipProps {
  status: UnifiedMovementStatus;
  className?: string;
}

export const MovementStatusChip: React.FC<StatusChipProps> = ({ status, className = '' }) => {
  const getStatusConfig = (status: UnifiedMovementStatus) => {
    switch (status) {
      case 'previsto':
        return {
          label: 'Previsto',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200',
          icon: null
        };
      case 'confirmado':
        return {
          label: 'Confirmado',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200',
          icon: null
        };
      case 'conciliado':
        return {
          label: 'Conciliado',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200',
          icon: null
        };
      case 'vencido':
        return {
          label: 'Vencido',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-200',
          icon: <AlertTriangle className="w-3 h-3" />
        };
      case 'no_planificado':
        return {
          label: 'No planificado',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-200',
          icon: null
        };
      default:
        return {
          label: 'Desconocido',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-200',
          icon: null
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span 
      className={`
        inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border
        ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}
      `}
    >
      {config.icon}
      {config.label}
    </span>
  );
};

export default MovementStatusChip;