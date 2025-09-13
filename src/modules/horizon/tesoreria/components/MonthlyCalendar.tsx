import React, { useState, useEffect } from 'react';
import { Movement, RentaMensual, initDB } from '../../../../services/db';
import MovementStatusChip from '../../../../components/treasury/MovementStatusChip';
import MovementQuickActions from '../../../../components/treasury/MovementQuickActions';

interface MonthlyCalendarProps {
  movements: Movement[];
  monthYear: string; // YYYY-MM format
  onMovementAction: (movement: Movement, action: 'confirm' | 'edit' | 'link' | 'reclassify') => void;
}

// Combined type for calendar entries
interface CalendarEntry {
  id: string;
  type: 'movement' | 'rent';
  date: string;
  amount: number;
  description: string;
  status: string;
  movement?: Movement;
  rent?: RentaMensual;
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
  const [rents, setRents] = useState<RentaMensual[]>([]);

  // Load rent entries for the month
  useEffect(() => {
    const loadRents = async () => {
      try {
        const db = await initDB();
        const allRents = await db.getAll('rentaMensual');
        const monthRents = allRents.filter(rent => rent.periodo === monthYear);
        setRents(monthRents);
      } catch (error) {
        console.error('Error loading rents:', error);
      }
    };
    loadRents();
  }, [monthYear]);
  
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

  // Get combined entries (movements + rents) for a specific day
  const getEntriesForDay = (day: number): CalendarEntry[] => {
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entries: CalendarEntry[] = [];

    // Add movements
    const dayMovements = movements.filter(mov => mov.date.startsWith(dayStr));
    dayMovements.forEach(mov => {
      entries.push({
        id: `movement-${mov.id}`,
        type: 'movement',
        date: mov.date,
        amount: mov.amount,
        description: mov.description,
        status: mov.unifiedStatus,
        movement: mov
      });
    });

    // Add rents (show on first day of the month)
    if (day === 1) {
      rents.forEach(rent => {
        entries.push({
          id: `rent-${rent.id}`,
          type: 'rent',
          date: `${year}-${String(month).padStart(2, '0')}-01`,
          amount: rent.importePrevisto,
          description: `Renta prevista (${rent.periodo})`,
          status: rent.estado,
          rent: rent
        });
      });
    }

    return entries.sort((a, b) => {
      // Sort by time if available, otherwise by creation order
      const timeA = a.movement?.valueDate || '00:00';
      const timeB = b.movement?.valueDate || '00:00';
      return timeA.localeCompare(timeB);
    });
  };

  const getDayBalance = (day: number): number => {
    const dayMovements = getMovementsForDay(day);
    let balance = dayMovements.reduce((sum, mov) => 
      sum + (mov.type === 'Ingreso' ? mov.amount : -mov.amount), 0
    );

    // Add rent amounts on first day of month
    if (day === 1) {
      balance += rents.reduce((sum, rent) => sum + rent.importePrevisto, 0);
    }

    return balance;
  };

  const getEntryColor = (entry: CalendarEntry): string => {
    if (entry.type === 'movement' && entry.movement) {
      switch (entry.movement.unifiedStatus) {
        case 'previsto':
          return entry.movement.type === 'Ingreso' ? 'text-movement-previsto-ingreso' : 'text-movement-previsto-gasto';
        case 'confirmado':
          return 'text-movement-confirmado';
        case 'no_planificado':
          return 'text-movement-no-previsto';
        case 'vencido':
          return 'text-movement-vencido';
        default:
          return 'text-movement-no-previsto';
      }
    } else if (entry.type === 'rent') {
      // Rent status colors
      switch (entry.status) {
        case 'pendiente':
          return 'text-movement-previsto-ingreso';
        case 'cobrada':
          return 'text-movement-confirmado';
        case 'parcial':
          return 'text-movement-vencido';
        case 'impago':
          return 'text-movement-vencido';
        default:
          return 'text-movement-no-previsto';
      }
    }
    return 'text-movement-no-previsto';
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
    <div className="bg-hz-card-bg">
      {/* Calendar Header */}
      <div className="grid grid-cols-7 gap-px bg-hz-neutral-300 border border-hz-neutral-300 rounded-t-lg">
        {weekDays.map(day => (
          <div key={day} className="bg-hz-neutral-100 p-3 text-center text-sm font-medium text-hz-neutral-800">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-hz-neutral-300 border-x border-b border-hz-neutral-300 rounded-b-lg">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={index} className="bg-hz-neutral-100 h-32" />;
          }

          const dayEntries = getEntriesForDay(day);
          const dayBalance = getDayBalance(day);
          const today = isToday(day);

          return (
            <div 
              key={day} 
              className={`bg-hz-card-bg p-2 h-32 border-r border-b border-hz-neutral-200 relative overflow-hidden ${
                today ? 'bg-primary-50 border-primary-200' : ''
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

              {/* Entry Pills (Movements + Rents) */}
              <div className="space-y-1 overflow-y-auto max-h-20">
                {dayEntries.map(entry => (
                  <div 
                    key={entry.id} 
                    className="group relative"
                  >
                    <div className={`text-xs p-1 rounded border ${getEntryColor(entry)} bg-hz-card-bg hover:bg-hz-neutral-100 cursor-pointer`}>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">
                            {entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString('es-ES', { 
                              style: 'currency', 
                              currency: 'EUR',
                              minimumFractionDigits: 0
                            })}
                          </div>
                          <div className="truncate text-hz-neutral-700">
                            {entry.description}
                          </div>
                        </div>
                        {entry.type === 'movement' && entry.movement && (
                          <MovementStatusChip 
                            status={entry.movement.unifiedStatus as any} 
                            movementType={entry.movement.type}
                            className="flex-shrink-0"
                          />
                        )}
                        {entry.type === 'rent' && (
                          <span className={`px-1 py-0.5 text-xs rounded ${
                            entry.status === 'cobrada' ? 'bg-success-100 text-success-800' :
                            entry.status === 'pendiente' ? 'bg-warning-100 text-warning-800' :
                            entry.status === 'impago' ? 'bg-error-100 text-error-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {entry.status}
                          </span>
                        )}
                      </div>
                      
                      {/* Quick Actions - Show on Hover (only for movements) */}
                      {entry.type === 'movement' && entry.movement && (
                        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-hz-card-bg border border-hz-neutral-300 rounded shadow-lg p-1 z-10">
                          <MovementQuickActions
                            movement={entry.movement}
                            onConfirm={() => onMovementAction(entry.movement!, 'confirm')}
                            onEdit={() => onMovementAction(entry.movement!, 'edit')}
                            onLinkInvoice={() => onMovementAction(entry.movement!, 'link')}
                            onReclassify={() => onMovementAction(entry.movement!, 'reclassify')}
                            className="flex-row"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* More entries indicator */}
              {dayEntries.length > 3 && (
                <div className="absolute bottom-1 right-1 text-xs text-gray-400">
                  +{dayEntries.length - 3} más
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