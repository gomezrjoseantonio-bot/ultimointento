import React, { useState, useMemo } from 'react';
import { Calendar, Search, ToggleLeft, ToggleRight, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatEuro } from '../../../../utils/formatUtils';
import MovementDrawer from './MovementDrawer';
import { Movement as DBMovement } from '../../../../services/db';

interface Account {
  id: number;
  name: string;
  bank: string;
  iban: string;
  balance: number;
  logo_url?: string;
  currency: string;
}

// Use the database Movement interface  
type Movement = DBMovement;

interface CalendarDay {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  movements: Movement[];
  endOfDayBalance: number;
}

interface AccountCalendarProps {
  account: Account;
  movements: Movement[];
  excludePersonal: boolean;
  searchText: string;
  monthYear: string;
  onMonthYearChange: (monthYear: string) => void;
}

const AccountCalendar: React.FC<AccountCalendarProps> = ({
  account,
  movements,
  excludePersonal,
  searchText,
  monthYear,
  onMonthYearChange,
}) => {
  // Local state for calendar search and toggle
  const [localExcludePersonal, setLocalExcludePersonal] = useState(excludePersonal);
  const [localSearchText, setLocalSearchText] = useState(searchText);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [showMovementDrawer, setShowMovementDrawer] = useState(false);

  // Navigate month
  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = monthYear.split('-').map(Number);
    const newDate = new Date(year, month - 1);
    
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    
    const newMonthYear = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    onMonthYearChange(newMonthYear);
  };

  // Generate calendar days
  const calendarDays = useMemo((): CalendarDay[] => {
    const [year, month] = monthYear.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const startOfWeek = new Date(firstDay);
    
    // Adjust to Monday start (getDay() returns 0=Sunday, 1=Monday, etc.)
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(firstDay.getDate() - daysToSubtract);

    const days: CalendarDay[] = [];
    
    // Generate 42 days (6 weeks × 7 days) for consistent grid
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      
      const dateStr = currentDate.toISOString().split('T')[0];
      const isCurrentMonth = currentDate.getMonth() === month - 1;
      
      // Get movements for this day
      let dayMovements = movements.filter(movement => {
        const movementDate = new Date(movement.date);
        return movementDate.toDateString() === currentDate.toDateString();
      });

      // Apply filters
      if (localExcludePersonal) {
        dayMovements = dayMovements.filter(movement => 
          movement.ambito !== 'PERSONAL' && 
          !movement.description?.toLowerCase().includes('personal')
        );
      }

      if (localSearchText) {
        const searchLower = localSearchText.toLowerCase();
        dayMovements = dayMovements.filter(movement => 
          movement.description?.toLowerCase().includes(searchLower) ||
          movement.counterparty?.toLowerCase().includes(searchLower) ||
          movement.categoria?.toLowerCase().includes(searchLower)
        );
      }

      // Sort movements: by hour if available, then by absolute amount desc, then alphabetical
      dayMovements.sort((a, b) => {
        // Sort by absolute amount descending
        const amountDiff = Math.abs(b.amount) - Math.abs(a.amount);
        if (amountDiff !== 0) return amountDiff;
        
        // Then alphabetical by description
        return (a.description || '').localeCompare(b.description || '');
      });

      // Calculate end of day balance (cumulative up to this day)
      const movementsUpToThisDay = movements.filter(movement => {
        const movementDate = new Date(movement.date);
        return movementDate <= currentDate && movementDate.getMonth() === month - 1;
      });
      
      const totalMovements = movementsUpToThisDay.reduce((sum, movement) => sum + movement.amount, 0);
      const endOfDayBalance = account.balance + totalMovements;

      days.push({
        date: currentDate,
        dateStr,
        isCurrentMonth,
        movements: dayMovements,
        endOfDayBalance
      });
    }

    return days;
  }, [monthYear, movements, account.balance, localExcludePersonal, localSearchText]);

  // Get movement pill style based on status and type - Treasury v1.2 Enhanced
  const getMovementStyle = (movement: Movement) => {
    const baseStyle = 'text-xs px-2 py-1 mb-1 cursor-pointer hover:opacity-80 transition-opacity';
    
    // Problem statement color scheme:
    // - Azul si conciliado (match)
    // - Gris si no planificado (sin match)  
    // - Verde ingreso / Rojo gasto (if no state applies)
    
    // Check movement state/status first
    if (movement.state === 'reconciled') {
      // Conciliado - Blue
      return `${baseStyle} bg-blue-500`;
    }
    
    if (movement.state === 'pending' || !movement.state) {
      // No planificado - Gray
      return `${baseStyle} bg-gray-400`;
    }
    
    if (movement.state === 'ignored') {
      // Ignorado - Red
      return `${baseStyle} bg-red-400`;
    }
    
    // Fallback to amount-based colors
    if (movement.amount >= 0) {
      // Ingreso - Green
      return `${baseStyle} bg-green-500`;
    } else {
      // Gasto - Red
      return `${baseStyle} bg-red-500`;
    }
  };

  // Get movement dot color for calendar days
  const getMovementDotColor = (movement: Movement): string => {
    // Problem statement color scheme for dots:
    // ingreso: verde, gasto: rojo, conciliado: azul, sin match: gris
    
    if (movement.state === 'reconciled') {
      return 'bg-blue-500'; // conciliado: azul
    }
    
    if (movement.state === 'pending' || movement.state === 'ignored' || !movement.state) {
      return 'bg-gray-400'; // sin match: gris
    }
    
    // Based on amount: ingreso = verde, gasto = rojo
    return movement.amount >= 0 ? 'bg-green-500' : 'bg-red-500';
  };

  // Calculate daily net amount with proper sign and color
  const getDayNetAmount = (dayMovements: Movement[]) => {
    const total = dayMovements.reduce((sum, movement) => sum + movement.amount, 0);
    
    // Count positive and negative movements for +N / −N display
    const positiveCount = dayMovements.filter(m => m.amount > 0).length;
    const negativeCount = dayMovements.filter(m => m.amount < 0).length;
    
    let countDisplay = '';
    if (positiveCount > 0 && negativeCount > 0) {
      countDisplay = `+${positiveCount} / −${negativeCount}`;
    } else if (positiveCount > 0) {
      countDisplay = `+${positiveCount}`;
    } else if (negativeCount > 0) {
      countDisplay = `−${negativeCount}`;
    }
    
    return {
      amount: total,
      color: total > 0 ? 'text-green-600' : total < 0 ? 'text-red-600' : 'text-gray-500',
      sign: total > 0 ? '+' : total < 0 ? '' : '', // negative already has minus
      countDisplay
    };
  };

  // Check if day is outside current month (should be grayed out)
  const isDayOutsideMonth = (day: CalendarDay): boolean => {
    return !day.isCurrentMonth;
  };

  // Handle movement click
  const handleMovementClick = (movement: Movement) => {
    setSelectedMovement(movement);
    setShowMovementDrawer(true);
  };

  // Handle day double-click for creating new movement
  const handleDayDoubleClick = (day: CalendarDay) => {
    if (day.isCurrentMonth) {
      // TODO: Implement create new movement on this day
      console.log('Create movement on', day.dateStr);
    }
  };

  // Day names for calendar header (Spanish, Monday start)
  const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  // Get month name in Spanish
  const getMonthName = (monthYear: string) => {
    const [year, month] = monthYear.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="p-6">
      {/* Calendar Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Month/Year Selector with Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1 rounded"
              title="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4 text-gray-700" />
            </button>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900 min-w-[140px] text-center">
                {getMonthName(monthYear)}
              </span>
            </div>
            
            <button
              onClick={() => navigateMonth('next')}
              className="p-1 rounded"
              title="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4 text-gray-700" />
            </button>
          </div>

          {/* Current Balance */}
          <div className="text-sm text-gray-600">
            Saldo actual: <span className={`font-medium ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatEuro(account.balance)}
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={localSearchText}
              onChange={(e) => setLocalSearchText(e.target.value)}
              className="btn-secondary-horizon pl-10 pr-4 py-1.5 text-sm "
            />
          </div>
          
          <button
            onClick={() => setLocalExcludePersonal(!localExcludePersonal)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
            title={localExcludePersonal ? 'Mostrar movimientos personales' : 'Ocultar movimientos personales'}
          >
            {localExcludePersonal ? (
              <ToggleRight className="h-4 w-4 text-blue-600" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
            <span>Excluir personal</span>
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {dayNames.map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body - Enhanced for Treasury v1.2 */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dayNet = getDayNetAmount(day.movements);
            const isOutsideMonth = isDayOutsideMonth(day);
            
            return (
              <div
                key={index}
                className={`min-h-[120px] p-2 border rounded ${
                  isOutsideMonth
                    ? 'border-gray-200 bg-gray-50 text-gray-400 opacity-40' // 40% opacity as per problem statement
                    : 'border-gray-300 bg-white cursor-pointer'                }`}
                onDoubleClick={() => !isOutsideMonth && handleDayDoubleClick(day)}
                title={!isOutsideMonth ? `Doble click para crear movimiento el ${day.dateStr}` : ''}
              >
                {/* Date and Daily Net */}
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-medium ${
                    isOutsideMonth ? 'text-gray-400' : 'text-gray-900'
                  }`}>
                    {day.date.getDate()}
                  </span>
                  
                  {/* Daily net amount and count in corner - problem statement requirement */}
                  {!isOutsideMonth && day.movements.length > 0 && (
                    <div className="text-right">
                      <div className={`text-xs font-medium ${dayNet.color}`}>
                        {dayNet.sign}{Math.abs(dayNet.amount).toFixed(0)}€
                      </div>
                      {dayNet.countDisplay && (
                        <div className="text-xs text-gray-500">
                          {dayNet.countDisplay}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Movement dots and preview - Only for current month */}
                {!isOutsideMonth && day.movements.length > 0 && (
                  <div className="space-y-1">
                    {/* Movement dots - problem statement requirement */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {day.movements.slice(0, 8).map((movement, idx) => (
                        <div
                          key={movement.id || idx}
                          className={`w-2 h-2 ${getMovementDotColor(movement)}`}
                          title={`${movement.description} - ${formatEuro(movement.amount)}`}
                        />
                      ))}
                      {day.movements.length > 8 && (
                        <div className="text-xs text-gray-500">+{day.movements.length - 8}</div>
                      )}
                    </div>

                    {/* Movement preview - top 2 movements */}
                    {day.movements.slice(0, 2).map((movement) => (
                      <div
                        key={movement.id}
                        className={getMovementStyle(movement)}
                        onClick={() => handleMovementClick(movement)}
                        title={`${movement.description} - ${formatEuro(movement.amount)}\nClick para detalles`}
                      >
                        <div className="flex items-center justify-between min-w-0">
                          <span className="font-medium text-xs">
                            {formatEuro(movement.amount)}
                          </span>
                          <span className="truncate text-xs opacity-90 ml-1">
                            {(movement.counterparty || movement.description || '').slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {/* Show "more" indicator */}
                    {day.movements.length > 2 && (
                      <button
                        onClick={() => {
                          // Open day movements modal - to be implemented
                          console.log('Show all movements for day:', day.dateStr);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 w-full text-center py-1"
                      >
                        Ver {day.movements.length - 2} más
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Movement Drawer */}
      {showMovementDrawer && selectedMovement && (
        <MovementDrawer
          movement={selectedMovement}
          onClose={() => setShowMovementDrawer(false)}
          onUpdate={(updatedMovement) => {
            // TODO: Handle movement update
            console.log('Update movement:', updatedMovement);
            setShowMovementDrawer(false);
          }}
        />
      )}
    </div>
  );
};

export default AccountCalendar;