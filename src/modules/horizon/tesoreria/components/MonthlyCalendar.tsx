import React from 'react';
import { Movement } from '../../../../services/db';
import MovementStatusChip from '../../../../components/treasury/MovementStatusChip';
import MovementQuickActions from '../../../../components/treasury/MovementQuickActions';

interface MonthlyCalendarProps {
  movements: Movement[];
  monthYear: string; // YYYY-MM format
  onMovementAction: (movement: Movement, action: 'confirm' | 'edit' | 'link' | 'reclassify') => void;
}

/**
 * Monthly Calendar Component for Treasury Account Expansion
 * 
 * Shows movements organized by day in a calendar grid
 * Each day shows balance and movement pills ordered by time
 */
const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({
  movements,
  monthYear,
  onMovementAction
}) => {
  const [year, month] = monthYear.split('-').map(Number);
  
  // Generate calendar days
  const getDaysInMonth = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startOfWeek = firstDay.getDay(); // 0 = Sunday
    
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const getMovementsForDay = (day: number): Movement[] => {
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return movements
      .filter(mov => mov.date.startsWith(dayStr))
      .sort((a, b) => {
        // Sort by time if available, otherwise by creation order
        const timeA = a.valueDate || '00:00';
        const timeB = b.valueDate || '00:00';
        return timeA.localeCompare(timeB);
      });
  };

  const getDayBalance = (day: number): number => {
    const dayMovements = getMovementsForDay(day);
    return dayMovements.reduce((sum, mov) => 
      sum + (mov.type === 'Ingreso' ? mov.amount : -mov.amount), 0
    );
  };

  const getMovementColor = (movement: Movement): string => {
    switch (movement.unifiedStatus) {
      case 'previsto':
        return movement.type === 'Ingreso' ? 'text-green-600' : 'text-red-600';
      case 'confirmado':
        return 'text-blue-600';
      case 'no_planificado':
        return 'text-gray-600';
      case 'vencido':
        return 'text-amber-600';
      default:
        return 'text-gray-600';
    }
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return today.getFullYear() === year && 
           today.getMonth() === month - 1 && 
           today.getDate() === day;
  };

  const days = getDaysInMonth();
  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="bg-white">
      {/* Calendar Header */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-t-lg">
        {weekDays.map(day => (
          <div key={day} className="bg-gray-50 p-3 text-center text-sm font-medium text-gray-700">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 border-x border-b border-gray-200 rounded-b-lg">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={index} className="bg-gray-50 h-32" />;
          }

          const dayMovements = getMovementsForDay(day);
          const dayBalance = getDayBalance(day);
          const today = isToday(day);

          return (
            <div 
              key={day} 
              className={`bg-white p-2 h-32 border-r border-b border-gray-100 relative overflow-hidden ${
                today ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              {/* Day Number and Balance */}
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-medium ${today ? 'text-blue-600' : 'text-gray-900'}`}>
                  {day}
                </span>
                {dayBalance !== 0 && (
                  <span className="text-xs text-gray-500 font-medium">
                    {dayBalance > 0 ? '+' : ''}{dayBalance.toLocaleString('es-ES', { 
                      style: 'currency', 
                      currency: 'EUR',
                      minimumFractionDigits: 0
                    })}
                  </span>
                )}
              </div>

              {/* Movement Pills */}
              <div className="space-y-1 overflow-y-auto max-h-20">
                {dayMovements.map(movement => (
                  <div 
                    key={movement.id} 
                    className="group relative"
                  >
                    <div className={`text-xs p-1 rounded border ${getMovementColor(movement)} bg-white hover:bg-gray-50 cursor-pointer`}>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">
                            {movement.amount > 0 ? '+' : ''}{movement.amount.toLocaleString('es-ES', { 
                              style: 'currency', 
                              currency: 'EUR',
                              minimumFractionDigits: 0
                            })}
                          </div>
                          <div className="truncate text-gray-600">
                            {movement.description}
                          </div>
                        </div>
                        <MovementStatusChip 
                          status={movement.unifiedStatus as any} 
                          className="flex-shrink-0"
                        />
                      </div>
                      
                      {/* Quick Actions - Show on Hover */}
                      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded shadow-lg p-1 z-10">
                        <MovementQuickActions
                          movement={movement}
                          onConfirm={() => onMovementAction(movement, 'confirm')}
                          onEdit={() => onMovementAction(movement, 'edit')}
                          onLinkInvoice={() => onMovementAction(movement, 'link')}
                          onReclassify={() => onMovementAction(movement, 'reclassify')}
                          className="flex-row"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* More movements indicator */}
              {dayMovements.length > 3 && (
                <div className="absolute bottom-1 right-1 text-xs text-gray-400">
                  +{dayMovements.length - 3} más
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthlyCalendar;