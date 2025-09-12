import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Search } from 'lucide-react';
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
}

const TreasuryPage: React.FC = () => {
  // State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  
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
      
      // Filter by search text (description/counterparty)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        accountMovements = accountMovements.filter(movement => 
          movement.description?.toLowerCase().includes(searchLower) ||
          movement.counterparty?.toLowerCase().includes(searchLower)
        );
      }

      // Sort by date descending (newest first)
      accountMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setMovements(accountMovements);
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

  // Get selected account
  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);

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

      {/* Movements Table */}
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
          ) : movements.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No hay movimientos</h3>
              <p>No se encontraron movimientos para los filtros seleccionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contraparte
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Importe
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Moneda
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fuente
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {movements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(movement.date).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {movement.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {movement.counterparty || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        <span className={movement.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {movement.amount >= 0 ? '+' : ''}{formatEuro(movement.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {movement.currency || 'EUR'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center">
                        {movement.source === 'extracto' ? 'Extracto' : 
                         movement.source === 'inbox' ? 'Inbox' : 
                         movement.source || 'Manual'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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