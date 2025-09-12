import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Search } from 'lucide-react';
import { initDB, Account, Movement } from '../../../services/db';
import AccountLogo from '../../../components/common/AccountLogo';
import ImportStatementModal from './components/ImportStatementModal';
import MonthlyCalendar from './components/MonthlyCalendar';

/**
 * ATLAS HORIZON - Unified Treasury View
 * 
 * Single screen implementation per problem statement:
 * - All accounts collapsed by default with KPI balance
 * - Monthly calendar when expanded showing movements
 * - Unified import functionality (same as Inbox)
 * - No subtabs, single consolidated view
 */
const Tesoreria: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [expandedAccountId, setExpandedAccountId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters state
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [excludePersonal, setExcludePersonal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [showImportModal, setShowImportModal] = useState(false);

  const loadTreasuryData = useCallback(async () => {
    try {
      setLoading(true);
      const db = await initDB();
      
      // Load accounts
      const allAccounts = await db.getAll('accounts');
      let filteredAccounts = allAccounts.filter(acc => acc.isActive && !acc.deleted_at);
      
      if (excludePersonal) {
        filteredAccounts = filteredAccounts.filter(acc => acc.destination !== 'personal');
      }
      
      setAccounts(filteredAccounts);
      
      // Load movements for the selected month
      const allMovements = await db.getAll('movements');
      const [year, month] = monthYear.split('-');
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);
      
      const monthMovements = allMovements.filter(mov => {
        const movDate = new Date(mov.date);
        return movDate >= startDate && movDate <= endDate;
      });
      
      setMovements(monthMovements);
    } catch (error) {
      console.error('Error loading treasury data:', error);
    } finally {
      setLoading(false);
    }
  }, [monthYear, excludePersonal]);

  useEffect(() => {
    loadTreasuryData();
  }, [loadTreasuryData]);

  const getAccountBalance = (accountId: number): number => {
    return movements
      .filter(mov => mov.accountId === accountId)
      .reduce((sum, mov) => sum + (mov.type === 'Ingreso' ? mov.amount : -mov.amount), 0);
  };

  const getAccountMovements = (accountId: number): Movement[] => {
    return movements
      .filter(mov => mov.accountId === accountId)
      .filter(mov => {
        if (!searchTerm) return true;
        return mov.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
               mov.counterparty?.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const handleAccountToggle = (accountId: number) => {
    setExpandedAccountId(expandedAccountId === accountId ? null : accountId);
  };

  const handleMovementConfirm = async (movement: Movement) => {
    try {
      const db = await initDB();
      await db.put('movements', {
        ...movement,
        unifiedStatus: 'confirmado',
        state: 'CONFIRMED'
      });
      await loadTreasuryData();
    } catch (error) {
      console.error('Error confirming movement:', error);
    }
  };

  const handleMovementEdit = (movement: Movement) => {
    // TODO: Open edit movement modal
    console.log('Edit movement:', movement);
  };

  const handleMovementLinkInvoice = (movement: Movement) => {
    // TODO: Open link invoice modal
    console.log('Link invoice to movement:', movement);
  };

  const handleMovementReclassify = (movement: Movement) => {
    // TODO: Open reclassify modal
    console.log('Reclassify movement:', movement);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
        <span className="ml-2 text-gray-600">Cargando tesorería...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">Tesorería</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-hz-primary text-white rounded-lg hover:bg-hz-primary-dark transition-colors"
            >
              <Upload size={16} />
              Importar extracto
            </button>
          </div>
        </div>
        
        {/* Filters Row */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-hz-neutral-800">Mes:</label>
            <input
              type="month"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
              className="px-3 py-2 border border-hz-neutral-300 rounded-md text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="excludePersonal"
              checked={excludePersonal}
              onChange={(e) => setExcludePersonal(e.target.checked)}
              className="rounded border-hz-neutral-300"
            />
            <label htmlFor="excludePersonal" className="text-sm text-hz-neutral-800">
              Excluir personal
            </label>
          </div>
          
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search size={16} className="text-hz-neutral-500" />
            <input
              type="text"
              placeholder="Buscar por descripción/contraparte..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-hz-neutral-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="px-6 space-y-4">
        {accounts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-hz-neutral-700">No hay cuentas disponibles</p>
          </div>
        ) : (
          accounts.map(account => {
            const balance = getAccountBalance(account.id!);
            const accountMovements = getAccountMovements(account.id!);
            const isExpanded = expandedAccountId === account.id;
            
            return (
              <div key={account.id} className="bg-hz-card-bg border border-hz-neutral-300 rounded-lg">
                {/* Account Header (Collapsed State) */}
                <div 
                  className="flex items-center justify-between p-6 cursor-pointer hover:bg-hz-neutral-100"
                  onClick={() => handleAccountToggle(account.id!)}
                >
                  <div className="flex items-center gap-4">
                    <AccountLogo account={account} size="lg" />
                    <div>
                      <h3 className="font-semibold text-hz-neutral-900">
                        {account.name || `${account.bank} ****${account.iban?.slice(-4)}`}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-2 h-2 bg-hz-success rounded-full" title="Cuenta operativa" />
                        <span className="text-sm text-hz-neutral-700">
                          {account.bank} • {account.iban?.slice(-4)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-hz-neutral-900">
                      {balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </div>
                    <div className="text-sm text-hz-neutral-700">Saldo actual</div>
                  </div>
                </div>
                
                {/* Expanded Calendar View */}
                {isExpanded && (
                  <div className="border-t border-hz-neutral-300 p-6">
                    <MonthlyCalendar
                      movements={accountMovements}
                      monthYear={monthYear}
                      onMovementAction={(movement, action) => {
                        switch (action) {
                          case 'confirm':
                            handleMovementConfirm(movement);
                            break;
                          case 'edit':
                            handleMovementEdit(movement);
                            break;
                          case 'link':
                            handleMovementLinkInvoice(movement);
                            break;
                          case 'reclassify':
                            handleMovementReclassify(movement);
                            break;
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Import Statement Modal */}
      {showImportModal && (
        <ImportStatementModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={(result) => {
            loadTreasuryData();
            setShowImportModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Tesoreria;