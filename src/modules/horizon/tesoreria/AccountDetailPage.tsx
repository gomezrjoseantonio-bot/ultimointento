import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { initDB, Account, Movement } from '../../../services/db';
import { treasuryAPI } from '../../../services/treasuryApiService';
import { formatEuro, maskIBAN } from '../../../utils/formatUtils';
import { ImportResult } from '../../../types/unifiedTreasury';
import ImportStatementModal from './components/ImportStatementModal';
import MovementDrawer from './components/DayMovementDrawer';

/**
 * ATLAS HORIZON - Account Detail Page (/tesoreria/cuenta/:id)
 * 
 * Implementation per problem statement:
 * - Monthly calendar view with movement indicators  
 * - Month selector and period totals for this account
 * - "Import statement" button pre-assigned to this account
 * - Day click → movement drawer functionality
 * - Color coding: Income=green, Expense=red, Conciliated=blue, No match=gray
 * - Day counters and amounts: +N / -M · +X€ / -Y€
 */

// Helper functions moved outside component to avoid useCallback dependencies

// Generate calendar days for the month
const generateCalendarDays = (year: number, month: number, movements: Movement[]): CalendarDay[] => {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();
  
  const days: CalendarDay[] = [];
  
  // Previous month padding days
  const prevMonth = new Date(year, month - 2, 0);
  for (let i = startOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 2, prevMonth.getDate() - i);
    days.push(createCalendarDay(date, false, []));
  }
  
  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dateStr = date.toISOString().split('T')[0];
    const dayMovements = movements.filter(mov => mov.date === dateStr);
    days.push(createCalendarDay(date, true, dayMovements));
  }
  
  // Next month padding days
  const totalCells = Math.ceil(days.length / 7) * 7;
  for (let day = 1; days.length < totalCells; day++) {
    const date = new Date(year, month, day);
    days.push(createCalendarDay(date, false, []));
  }
  
  return days;
};

// Create a calendar day object
const createCalendarDay = (date: Date, isCurrentMonth: boolean, movements: Movement[]): CalendarDay => {
  const dateStr = date.toISOString().split('T')[0];
  
  const incomeMovements = movements.filter(mov => mov.amount > 0);
  const expenseMovements = movements.filter(mov => mov.amount < 0);
  
  return {
    date,
    dateStr,
    isCurrentMonth,
    movements,
    incomeCount: incomeMovements.length,
    expenseCount: expenseMovements.length,
    incomeAmount: incomeMovements.reduce((sum, mov) => sum + mov.amount, 0),
    expenseAmount: expenseMovements.reduce((sum, mov) => sum + Math.abs(mov.amount), 0)
  };
};

// Calculate period totals
const calculatePeriodTotals = (movements: Movement[]): PeriodTotals => {
  const totalIncome = movements
    .filter(mov => mov.amount > 0)
    .reduce((sum, mov) => sum + mov.amount, 0);
    
  const totalExpenses = movements
    .filter(mov => mov.amount < 0)
    .reduce((sum, mov) => sum + Math.abs(mov.amount), 0);
    
  return {
    totalIncome,
    totalExpenses,
    netAmount: totalIncome - totalExpenses
  };
};

interface CalendarDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  movements: Movement[];
  incomeCount: number;
  expenseCount: number;
  incomeAmount: number;
  expenseAmount: number;
}

interface PeriodTotals {
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
}

interface AccountDetailPageProps {
  accountId: number;
}

const AccountDetailPage: React.FC<AccountDetailPageProps> = ({ accountId }) => {
  const navigate = useNavigate();
  
  // State
  const [account, setAccount] = useState<Account | null>(null);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [periodTotals, setPeriodTotals] = useState<PeriodTotals>({
    totalIncome: 0,
    totalExpenses: 0,
    netAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [showMovementDrawer, setShowMovementDrawer] = useState(false);
  
  // Current month/year for calendar
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Load account data and movements
  const loadAccountData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load account details
      const allAccounts = await treasuryAPI.accounts.getAccounts(true);
      const foundAccount = allAccounts.find(acc => acc.id === accountId);
      
      if (!foundAccount) {
        toast.error('Cuenta no encontrada');
        navigate('/tesoreria');
        return;
      }
      
      setAccount(foundAccount);
      
      // Load movements for the calendar month
      const db = await initDB();
      const allMovements = await db.getAll('movements');
      
      // Filter movements for this account and month
      const [year, month] = monthYear.split('-').map(Number);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      
      const accountMovements = allMovements.filter(mov => 
        mov.accountId === accountId &&
        new Date(mov.date) >= monthStart &&
        new Date(mov.date) <= monthEnd
      );

      // Generate calendar days
      const days = generateCalendarDays(year, month, accountMovements);
      setCalendarDays(days);
      
      // Calculate period totals
      const totals = calculatePeriodTotals(accountMovements);
      setPeriodTotals(totals);
      
    } catch (error) {
      console.error('Error loading account data:', error);
      toast.error('Error al cargar los datos de la cuenta');
    } finally {
      setLoading(false);
    }
  }, [accountId, monthYear, navigate]);

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  // Navigate month
  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = monthYear.split('-').map(Number);
    const newDate = new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1);
    const newMonthYear = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    setMonthYear(newMonthYear);
    setCurrentDate(newDate);
  };

  // Handle day click
  const handleDayClick = (day: CalendarDay) => {
    if (day.isCurrentMonth && day.movements.length > 0) {
      setSelectedDay(day);
      setShowMovementDrawer(true);
    }
  };

  // Handle import completion
  const handleImportComplete = (result?: ImportResult) => {
    loadAccountData(); // Reload data after import
    setShowImportModal(false);
  };

  // Get month name in Spanish
  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-hz-bg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-hz-primary border-t-transparent"></div>
          <span className="ml-2 text-hz-neutral-700">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-hz-bg">
        <div className="text-center py-12">
          <div className="text-hz-neutral-500 mb-4">Cuenta no encontrada</div>
          <button
            onClick={() => navigate('/tesoreria')}
            className="btn-primary-horizon"
          >
            Volver a Tesorería
          </button>
        </div>
      </div>
    );
  }

  const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <div className="min-h-screen bg-hz-bg">
      {/* Breadcrumb and Header */}
      <div className="bg-white border-b border-hz-neutral-300">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center text-sm text-hz-neutral-600 mb-4">
            <button
              onClick={() => navigate('/tesoreria')}
              className="hover:text-hz-primary transition-colors"
            >
              Tesorería
            </button>
            <span className="mx-2">/</span>
            <span className="text-hz-neutral-900">
              {account.alias || maskIBAN(account.iban)}
            </span>
          </nav>

          {/* Account Header */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
              {account.logo_url ? (
                <img
                  src={account.logo_url}
                  alt={`${account.bank} logo`}
                  className="w-full h-full object-cover rounded"
           onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    if (target.nextElementSibling) {
                      (target.nextElementSibling as HTMLElement).style.display = 'flex';
                    }
                  }}
                 />
              ) : null}
              <div
                className="w-full h-full bg-hz-neutral-300 rounded flex items-center justify-center font-medium text-hz-neutral-600"
            style={{ display: account.logo_url ? 'none' : 'flex' }}
          >
                {(account.bank || '').slice(0, 2).toUpperCase()}
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-hz-neutral-900">
                {account.alias || 'Sin alias'}
              </h1>
              <p className="text-sm text-hz-neutral-600">
                {account.bank} • {maskIBAN(account.iban)}
              </p>
            </div>
          </div>

          {/* Period Controls and Totals */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 text-hz-neutral-600 hover:text-hz-neutral-900 hover:bg-hz-neutral-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="text-lg font-medium text-hz-neutral-900 min-w-[200px] text-center">
                {getMonthName(currentDate)}
              </div>
              
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 text-hz-neutral-600 hover:text-hz-neutral-900 hover:bg-hz-neutral-100 rounded-lg transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="flex items-center gap-6">
              {/* Period Totals */}
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <div className="text-hz-neutral-600">Ingresos</div>
                  <div className="font-medium text-hz-success">
                    {formatEuro(periodTotals.totalIncome)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-hz-neutral-600">Gastos</div>
                  <div className="font-medium text-hz-error">
                    {formatEuro(periodTotals.totalExpenses)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-hz-neutral-600">Neto</div>
                  <div className={`font-medium ${
                    periodTotals.netAmount >= 0 ? 'text-hz-success' : 'text-hz-error'
                  }`}>
                    {formatEuro(periodTotals.netAmount)}
                  </div>
                </div>
              </div>

              {/* Import Button */}
              <button
                onClick={() => setShowImportModal(true)}
                className="btn-primary-horizon flex items-center gap-2"
              >
                <Upload size={16} />
                Importar extracto
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-hz-neutral-300 overflow-hidden">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 border-b border-hz-neutral-300">
            {dayNames.map((day) => (
              <div key={day} className="p-4 text-center text-sm font-medium text-hz-neutral-700 bg-hz-neutral-50">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Body */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={`min-h-[120px] p-3 border-r border-b border-hz-neutral-200 ${
                  day.isCurrentMonth ? 'bg-white' : 'bg-hz-neutral-50'
                } ${
                  day.movements.length > 0 ? 'cursor-pointer hover:bg-hz-neutral-100' : ''
                } transition-colors`}
                onClick={() => handleDayClick(day)}
              >
                {/* Date */}
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-medium ${
                    day.isCurrentMonth ? 'text-hz-neutral-900' : 'text-hz-neutral-500'
                  }`}>
                    {day.date.getDate()}
                  </span>
                </div>

                {/* Movement Summary for current month days */}
                {day.isCurrentMonth && (day.incomeCount > 0 || day.expenseCount > 0) && (
                  <div className="space-y-1">
                    {/* Counters */}
                    <div className="text-xs text-hz-neutral-600">
                      {day.incomeCount > 0 && (
                        <span className="text-hz-success">+{day.incomeCount}</span>
                      )}
                      {day.incomeCount > 0 && day.expenseCount > 0 && ' / '}
                      {day.expenseCount > 0 && (
                        <span className="text-hz-error">-{day.expenseCount}</span>
                      )}
                    </div>
                    
                    {/* Amounts */}
                    <div className="text-xs">
                      {day.incomeAmount > 0 && (
                        <div className="text-hz-success font-medium">
                          +{formatEuro(day.incomeAmount)}
                        </div>
                      )}
                      {day.expenseAmount > 0 && (
                        <div className="text-hz-error font-medium">
                          -{formatEuro(day.expenseAmount)}
                        </div>
                      )}
                    </div>

                    {/* Status indicators (dots) */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {day.movements.slice(0, 4).map((movement, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            movement.status === 'conciliado' ? 'bg-hz-info' :        // Blue for reconciled
                            movement.amount > 0 ? 'bg-hz-success' :                  // Green for income
                            movement.amount < 0 ? 'bg-hz-error' :                    // Red for expense  
                            'bg-hz-neutral-500'                                      // Gray for others
                          }`}
                          title={movement.description}
                        />
                      ))}
                      {day.movements.length > 4 && (
                        <div className="text-xs text-hz-neutral-500">
                          +{day.movements.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <ImportStatementModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
          preselectedAccountId={accountId}
        />
      )}

      {/* Movement Drawer */}
      {showMovementDrawer && selectedDay && (
        <MovementDrawer
          day={selectedDay}
          onClose={() => setShowMovementDrawer(false)}
          onMovementUpdate={loadAccountData}
        />
      )}
    </div>
  );
};

export default AccountDetailPage;