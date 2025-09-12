import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Search, ArrowLeftRight, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/common/PageHeader';
import ImportStatementModal from './components/ImportStatementModal';
import { ImportResult } from '../../../types/unifiedTreasury';
import { formatEuro } from '../../../services/aeatClassificationService';

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
  date: string;
  description: string;
  counterparty?: string;
  amount: number;
  currency: string;
  source?: string;
  reference?: string;
  status?: 'previsto' | 'real' | 'no_planificado';
  category?: string;
  is_transfer_internal?: boolean;
  transfer_origin?: string;
  transfer_destination?: string;
}

interface CalendarDay {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  movements: Movement[];
  endOfDayBalance: number;
}

const TreasuryPage: React.FC = () => {
  // State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [excludePersonal, setExcludePersonal] = useState(false);
  const [calendarSearch, setCalendarSearch] = useState('');
  
  // Filters as specified in problem statement
  const [filters, setFilters] = useState({
    accountId: null as number | null,
    monthYear: new Date().toISOString().slice(0, 7), // Current month YYYY-MM
    search: ''
  });

  // Modal state
  const [showImportModal, setShowImportModal] = useState(false);

  // Load real accounts from Configuration
  const loadAccounts = useCallback(async () => {
    try {
      const { treasuryAPI } = await import('../../../services/treasuryApiService');
      const dbAccounts = await treasuryAPI.accounts.getAccounts(false); // Only active accounts
      const horizonAccounts = dbAccounts.filter(acc => acc.destination === 'horizon');
      
      const formattedAccounts: Account[] = horizonAccounts.map(acc => ({
        id: acc.id!,
        name: acc.name || `Cuenta ${acc.bank}`,
        bank: acc.bank,
        iban: acc.iban,
        balance: acc.balance,
        logo_url: acc.logo_url,
        currency: acc.currency
      }));
      
      setAccounts(formattedAccounts);
      
      // Auto-select first account if none selected
      if (formattedAccounts.length > 0 && !selectedAccountId) {
        const firstAccount = formattedAccounts[0];
        setSelectedAccountId(firstAccount.id);
        setFilters(prev => ({ ...prev, accountId: firstAccount.id }));
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Error al cargar las cuentas');
      setAccounts([]);
    }
  }, [selectedAccountId]);

  // Load movements for selected account and filters
  const loadMovements = useCallback(async () => {
    if (!selectedAccountId) {
      setMovements([]);
      return;
    }

    try {
      const { initDB } = await import('../../../services/db');
      const db = await initDB();
      const allMovements = await db.getAll('movements');
      
      // Filter by account
      let accountMovements = allMovements.filter(m => m.accountId === selectedAccountId);
      
      // Filter by date range (current month by default)
      const [year, month] = filters.monthYear.split('-').map(Number);
      accountMovements = accountMovements.filter(movement => {
        const movementDate = new Date(movement.date);
        return movementDate.getFullYear() === year && movementDate.getMonth() === month - 1;
      });
      
      // Enhance movements with status and classification
      const enhancedMovements = accountMovements.map(movement => ({
        ...movement,
        status: movement.status || (movement.source === 'extracto' ? 'real' : 'no_planificado') as 'previsto' | 'real' | 'no_planificado',
        category: movement.category,
        is_transfer_internal: movement.is_transfer_internal || false,
        transfer_origin: movement.transfer_origin,
        transfer_destination: movement.transfer_destination
      }));
      
      // Filter by search text (description/counterparty) - applied after calendar search
      let filteredMovements = enhancedMovements;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredMovements = enhancedMovements.filter(movement => 
          movement.description?.toLowerCase().includes(searchLower) ||
          movement.counterparty?.toLowerCase().includes(searchLower)
        );
      }

      // Sort by date ascending for proper balance calculation
      filteredMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setMovements(filteredMovements);
    } catch (error) {
      console.error('Error loading movements:', error);
      toast.error('Error al cargar los movimientos');
      setMovements([]);
    }
  }, [selectedAccountId, filters.monthYear, filters.search]);

  // Load data on mount and when filters change
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  useEffect(() => {
    setLoading(false);
  }, [accounts]);

  // Handle account selection
  const handleAccountChange = (accountId: string) => {
    const id = parseInt(accountId);
    setSelectedAccountId(id);
    setFilters(prev => ({ ...prev, accountId: id }));
  };

  // Handle import completion
  const handleImportComplete = (result: ImportResult) => {
    // Reload movements to show imported data
    loadMovements();
    toast.success(`Importación completada: ${result.confirmedMovements} movimientos`);
  };

  // Generate calendar days for the selected month
  const generateCalendarDays = useCallback((): CalendarDay[] => {
    const [year, month] = filters.monthYear.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const startOfWeek = new Date(firstDay);
    
    // Adjust to Monday start (getDay() returns 0=Sunday, 1=Monday, etc.)
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(firstDay.getDate() - daysToSubtract);

    const days: CalendarDay[] = [];
    const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
    const initialBalance = selectedAccount?.balance || 0;

    // Generate 35 days (5 weeks × 7 days)
    for (let i = 0; i < 35; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      
      const dateStr = currentDate.toISOString().split('T')[0];
      const isCurrentMonth = currentDate.getMonth() === month - 1;
      
      // Get movements for this day
      const dayMovements = movements.filter(movement => {
        const movementDate = new Date(movement.date);
        return movementDate.toDateString() === currentDate.toDateString();
      });

      // Apply calendar search filter
      const filteredDayMovements = calendarSearch 
        ? dayMovements.filter(movement => 
            movement.description?.toLowerCase().includes(calendarSearch.toLowerCase()) ||
            movement.counterparty?.toLowerCase().includes(calendarSearch.toLowerCase())
          )
        : dayMovements;

      // Filter personal movements if excluded
      const finalMovements = excludePersonal 
        ? filteredDayMovements.filter(movement => 
            movement.category !== 'Personal' && !movement.description?.toLowerCase().includes('personal')
          )
        : filteredDayMovements;

      // Calculate end of day balance (cumulative up to this day)
      const movementsUpToThisDay = movements.filter(movement => {
        const movementDate = new Date(movement.date);
        return movementDate <= currentDate && movementDate.getMonth() === month - 1;
      });
      
      const totalMovements = movementsUpToThisDay.reduce((sum, movement) => sum + movement.amount, 0);
      const endOfDayBalance = initialBalance + totalMovements;

      days.push({
        date: currentDate,
        dateStr,
        isCurrentMonth,
        movements: finalMovements,
        endOfDayBalance
      });
    }

    return days;
  }, [filters.monthYear, movements, selectedAccountId, accounts, calendarSearch, excludePersonal]);

  // Get calendar days
  const calendarDays = generateCalendarDays();

  // Get selected account
  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);

  // Helper function to get movement style based on status and type
  const getMovementStyle = (movement: Movement) => {
    if (movement.is_transfer_internal) {
      return 'text-blue-600 text-xs px-2 py-1 bg-blue-50 rounded border-l-2 border-blue-400';
    }
    
    switch (movement.status) {
      case 'previsto':
        return movement.amount >= 0 
          ? 'text-green-600 text-xs px-2 py-1 bg-green-50 rounded border-l-2 border-green-400'
          : 'text-red-600 text-xs px-2 py-1 bg-red-50 rounded border-l-2 border-red-400';
      case 'real':
        return 'text-blue-700 text-xs px-2 py-1 bg-blue-100 rounded border-l-2 border-blue-500';
      case 'no_planificado':
      default:
        return 'text-gray-500 text-xs px-2 py-1 bg-gray-100 rounded border-l-2 border-gray-300';
    }
  };

  // Helper function to get movement display text
  const getMovementDisplay = (movement: Movement) => {
    if (movement.is_transfer_internal) {
      return (
        <div className="flex items-center gap-1">
          <ArrowLeftRight className="h-3 w-3" />
          <span className="truncate">
            {movement.transfer_origin} → {movement.transfer_destination}
          </span>
        </div>
      );
    }
    
    if (movement.status === 'no_planificado') {
      return (
        <div>
          <div className="font-medium">{formatEuro(movement.amount)}</div>
          <div className="text-xs bg-gray-200 text-gray-600 px-1 rounded">No planificado</div>
        </div>
      );
    }
    
    return (
      <div>
        <div className="font-medium">{formatEuro(movement.amount)}</div>
        <div className="truncate" title={movement.description}>
          {movement.description?.slice(0, 20)}...
        </div>
      </div>
    );
  };

  // Helper function to get balance color
  const getBalanceColor = (balance: number) => {
    return balance >= 0 ? 'text-gray-700' : 'text-red-600 font-semibold';
  };

  // Day names for calendar header (Spanish, Monday start)
  const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <PageHeader
        title="Tesorería"
        subtitle="Vista unificada de movimientos bancarios"
        primaryAction={{
          label: "Importar extracto",
          onClick: () => setShowImportModal(true)
        }}
      />

      {/* Filter Header - Single line as specified */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Account Selector with logos */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Cuenta:</label>
              <select
                value={selectedAccountId || ''}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[250px]"
              >
                <option value="">Seleccionar cuenta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {account.iban.slice(-4)} ({account.bank})
                  </option>
                ))}
              </select>
              {/* Show logo next to selector if available */}
              {selectedAccount?.logo_url && (
                <div className="w-8 h-8 rounded overflow-hidden">
                  <img 
                    src={selectedAccount.logo_url} 
                    alt={`Logo ${selectedAccount.bank}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input
                type="month"
                value={filters.monthYear}
                onChange={(e) => setFilters(prev => ({ ...prev, monthYear: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Search Filter */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar en descripción/contraparte..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            <span className="ml-2 text-gray-600">Cargando movimientos...</span>
          </div>
        ) : !selectedAccount ? (
          <div className="p-12 text-center text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">Selecciona una cuenta</h3>
            <p>Elige una cuenta bancaria para ver sus movimientos</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Account Calendar Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Account Info */}
                  <div className="flex items-center gap-3">
                    {selectedAccount.logo_url ? (
                      <div className="w-8 h-8 rounded overflow-hidden">
                        <img 
                          src={selectedAccount.logo_url} 
                          alt={`Logo ${selectedAccount.bank}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
                        {selectedAccount.bank.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {selectedAccount.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {selectedAccount.iban.slice(-4)} · {selectedAccount.bank}
                      </div>
                    </div>
                  </div>

                  {/* Current Balance */}
                  <div className="text-sm">
                    <span className="text-gray-500">Saldo hoy: </span>
                    <span className={`font-semibold ${getBalanceColor(selectedAccount.balance)}`}>
                      {formatEuro(selectedAccount.balance)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Exclude Personal Toggle */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Excluir personal</label>
                    <button
                      onClick={() => setExcludePersonal(!excludePersonal)}
                      className={`p-1 rounded transition-colors ${
                        excludePersonal ? 'text-blue-600' : 'text-gray-400'
                      }`}
                    >
                      {excludePersonal ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Calendar Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={calendarSearch}
                      onChange={(e) => setCalendarSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-6">
              {/* Calendar Header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Body */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => (
                  <div
                    key={index}
                    className={`min-h-[120px] p-2 border border-gray-200 rounded ${
                      day.isCurrentMonth 
                        ? 'bg-white' 
                        : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    {/* Date and Balance */}
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-sm font-medium ${
                        day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {day.date.getDate()}
                      </span>
                      {day.isCurrentMonth && (
                        <div className={`text-xs px-1 py-0.5 bg-gray-100 rounded ${getBalanceColor(day.endOfDayBalance)}`}>
                          {formatEuro(day.endOfDayBalance)}
                        </div>
                      )}
                    </div>

                    {/* Movements */}
                    {day.isCurrentMonth && day.movements.length > 0 && (
                      <div className="space-y-1">
                        {day.movements.slice(0, 3).map((movement) => (
                          <div
                            key={movement.id}
                            className={getMovementStyle(movement)}
                            title={`${movement.description} - ${formatEuro(movement.amount)}`}
                          >
                            {getMovementDisplay(movement)}
                          </div>
                        ))}
                        {day.movements.length > 3 && (
                          <div className="text-xs text-gray-400 text-center">
                            +{day.movements.length - 3} más
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <ImportStatementModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      )}
    </div>
  );
};

export default TreasuryPage;