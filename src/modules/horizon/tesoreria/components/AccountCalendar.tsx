import React, { useState, useMemo } from 'react';
import { Calendar, Search, ToggleLeft, ToggleRight, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatEuro } from '../../../../utils/formatUtils';
import MovementDrawer from './MovementDrawer';

interface Account {
  id: number;
  name: string;
  bank: string;
  iban: string;
  balance: number;
  logo_url?: string;
  currency: string;
}

interface Movement {
  id: number;
  accountId: number;
  date: string; // YYYY-MM-DD
  description: string;
  counterparty?: string;
  amount: number;
  currency: string;
  source?: string;
  reference?: string;
  status?: 'previsto' | 'confirmado' | 'no_planificado';
  category?: string;
  scope?: 'personal' | 'inmueble';
  inmuebleId?: number;
  planned?: boolean;
  confirmed?: boolean;
  type?: 'Gasto' | 'Ingreso' | 'Transferencia';
}

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
          movement.scope !== 'personal' && 
          !movement.description?.toLowerCase().includes('personal')
        );
      }

      if (localSearchText) {
        const searchLower = localSearchText.toLowerCase();
        dayMovements = dayMovements.filter(movement => 
          movement.description?.toLowerCase().includes(searchLower) ||
          movement.counterparty?.toLowerCase().includes(searchLower) ||
          movement.category?.toLowerCase().includes(searchLower)
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

  // Get movement pill style based on status and type
  const getMovementStyle = (movement: Movement) => {
    const baseStyle = 'text-xs px-2 py-1 rounded-md mb-1 cursor-pointer hover:opacity-80 transition-opacity';
    const isOverdue = isMovementOverdue(movement);
    
    // Overdue indicator (planned but not confirmed and past due)
    if (isOverdue) {
      return `${baseStyle} bg-hz-warning text-white relative`;
    }
    
    // Confirmed (both planned and unplanned become blue when confirmed)
    if (movement.confirmed || movement.status === 'confirmado') {
      return `${baseStyle} bg-hz-primary text-white`;
    }
    
    // Planned/forecast
    if (movement.planned || movement.status === 'previsto') {
      if (movement.amount >= 0) {
        // Income - green
        return `${baseStyle} bg-hz-success text-white`;
      } else {
        // Expense/outgoing transfer - red
        return `${baseStyle} bg-hz-error text-white`;
      }
    }
    
    // Not planned - gray
    return `${baseStyle} bg-hz-neutral-500 text-white`;
  };

  // Check if movement is overdue
  const isMovementOverdue = (movement: Movement) => {
    if (movement.confirmed || movement.status === 'confirmado') return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const movementDate = new Date(movement.date);
    movementDate.setHours(0, 0, 0, 0);
    
    return movementDate < today && (movement.planned || movement.status === 'previsto');
  };

  // Get movement display content
  const getMovementDisplay = (movement: Movement) => {
    const isOverdue = isMovementOverdue(movement);
    const label = movement.category || movement.counterparty || movement.description?.slice(0, 15) || 'Sin descripción';
    
    return (
      <div className="flex items-center gap-1 min-w-0">
        {isOverdue && (
          <AlertTriangle className="h-3 w-3 text-hz-warning flex-shrink-0" />
        )}
        <span className="font-medium">{formatEuro(movement.amount)}</span>
        <span className="truncate text-xs opacity-90">• {label}</span>
      </div>
    );
  };

  // Get balance color for day
  const getBalanceColor = (balance: number) => {
    return balance >= 0 ? 'text-hz-neutral-700' : 'text-hz-error';
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
      {/* Calendar Controls - Single line as specified */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Month/Year Selector with Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1 hover:bg-hz-neutral-100 rounded"
              title="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4 text-hz-neutral-700" />
            </button>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-hz-neutral-500" />
              <span className="font-medium text-hz-neutral-900 min-w-[140px] text-center">
                {getMonthName(monthYear)}
              </span>
            </div>
            
            <button
              onClick={() => navigateMonth('next')}
              className="p-1 hover:bg-hz-neutral-100 rounded"
              title="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4 text-hz-neutral-700" />
            </button>
          </div>

          {/* Current Balance */}
          <div className="text-sm">
            <span className="text-hz-neutral-700">Saldo hoy: </span>
            <span className={`font-semibold ${getBalanceColor(account.balance)}`}>
              {formatEuro(account.balance)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Exclude Personal Toggle */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-hz-neutral-700">Excluir personal</label>
            <button
              onClick={() => setLocalExcludePersonal(!localExcludePersonal)}
              className={`p-1 rounded transition-colors ${
                localExcludePersonal ? 'text-hz-primary' : 'text-hz-neutral-500'
              }`}
            >
              {localExcludePersonal ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
            </button>
          </div>

          {/* Search Text */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-hz-neutral-500" />
            <input
              type="text"
              placeholder="Buscar..."
              value={localSearchText}
              onChange={(e) => setLocalSearchText(e.target.value)}
              className="pl-10 pr-4 py-2 border border-hz-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-hz-primary focus:border-transparent w-48"
            />
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div>
        {/* Calendar Header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-hz-neutral-700">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => (
            <div
              key={index}
              className={`min-h-[120px] p-2 border border-hz-neutral-300 rounded ${
                day.isCurrentMonth 
                  ? 'bg-hz-card-bg' 
                  : 'bg-hz-neutral-100 text-hz-neutral-500'
              } cursor-pointer hover:bg-hz-neutral-100 transition-colors`}
              onDoubleClick={() => handleDayDoubleClick(day)}
              title={day.isCurrentMonth ? `Doble click para crear movimiento el ${day.dateStr}` : ''}
            >
              {/* Date and Balance */}
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-medium ${
                  day.isCurrentMonth ? 'text-hz-neutral-900' : 'text-hz-neutral-500'
                } ${day.endOfDayBalance < 0 && day.isCurrentMonth ? 'bg-hz-error text-white px-1 rounded' : ''}`}>
                  {day.date.getDate()}
                </span>
                {day.isCurrentMonth && (
                  <div className={`text-xs px-1 py-0.5 bg-hz-neutral-100 rounded ${getBalanceColor(day.endOfDayBalance)}`}>
                    {formatEuro(day.endOfDayBalance)}
                  </div>
                )}
              </div>

              {/* Movement Pills - Max 4 visible, rest collapsed */}
              {day.isCurrentMonth && day.movements.length > 0 && (
                <div className="space-y-1">
                  {day.movements.slice(0, 4).map((movement) => (
                    <div
                      key={movement.id}
                      className={getMovementStyle(movement)}
                      onClick={() => handleMovementClick(movement)}
                      title={`${movement.description} - ${formatEuro(movement.amount)}\nClick para detalles`}
                    >
                      {getMovementDisplay(movement)}
                    </div>
                  ))}
                  {day.movements.length > 4 && (
                    <div className="text-xs text-hz-neutral-500 text-center">
                      +{day.movements.length - 4} más
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
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