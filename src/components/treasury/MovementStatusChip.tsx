/**
 * ATLAS HORIZON - Movement Status Chip Component
 * 
 * Implements color-only status chips per requirements:
 * - Red: Expenses (gastos)
 * - Green: Income (ingresos)
 * - Gray: Unplanned (no planificado)  
 * - Blue: Confirmed/realized (confirmado/conciliado)
 * - NO TEXT LABELS - only colors as specified
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
  movementType?: 'Ingreso' | 'Gasto' | 'Transferencia' | 'Ajuste'; // To determine red vs green for previsto
}

export const MovementStatusChip: React.FC<StatusChipProps> = ({ 
  status, 
  className = '', 
  movementType = 'Gasto' 
}) => {
  const getStatusConfig = (status: UnifiedMovementStatus) => {
    switch (status) {
      case 'previsto':
        // Green for income, red for expenses per requirements
        if (movementType === 'Ingreso') {
          return {
            bgColor: 'bg-green-500', // Green for income
            size: 'w-3 h-3',
            icon: null
          };
        } else if (movementType === 'Gasto') {
          return {
            bgColor: 'bg-red-500', // Red for expenses
            size: 'w-3 h-3', 
            icon: null
          };
        } else {
          // Transferencia, Ajuste, or undefined - use neutral gray
          return {
            bgColor: 'bg-gray-500',
            size: 'w-3 h-3', 
            icon: null
          };
        }
      case 'confirmado':
      case 'conciliado':
        return {
          bgColor: 'bg-blue-500', // Blue for confirmed/realized
          size: 'w-3 h-3',
          icon: null
        };
      case 'vencido':
        return {
          bgColor: 'bg-yellow-500', // Yellow for overdue
          size: 'w-3 h-3',
          icon: <AlertTriangle className="w-2 h-2 text-white" />
        };
      case 'no_planificado':
        return {
          bgColor: 'bg-gray-500', // Gray for unplanned
          size: 'w-3 h-3',
          icon: null
        };
      default:
        return {
          bgColor: 'bg-gray-400', // Default gray
          size: 'w-3 h-3',
          icon: null
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span 
      className={`
        inline-flex items-center justify-center rounded-full 
        ${config.bgColor} ${config.size} ${className}
      `}
      title={status} // Keep status as tooltip for accessibility
    >
      {config.icon}
    </span>
  );
};

export default MovementStatusChip;