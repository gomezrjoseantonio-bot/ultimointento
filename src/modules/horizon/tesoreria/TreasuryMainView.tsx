import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { initDB } from '../../../services/db';
import { treasuryAPI } from '../../../services/treasuryApiService';
import { formatEuro, maskIBAN } from '../../../utils/formatUtils';
import { ImportResult } from '../../../types/unifiedTreasury';
import ImportStatementModal from './components/ImportStatementModal';

/**
 * ATLAS HORIZON - Treasury Main View
 * 
 * Implementation per problem statement:
 * - Main view with account cards
 * - Global totals band with balance, income, expenses, net flow
 * - Account cards with bank logo, alias, IBAN mask, balances
 * - Manual account ordering via orderIndex
 * - Show/hide inactive accounts toggle
 */

interface AccountCardData {
  id: number;
  alias: string;
  bank: string;
  iban: string;
  balance: number;
  logo_url?: string;
  orderIndex?: number;
  isActive: boolean; // Legacy compatibility
  status?: 'ACTIVE' | 'INACTIVE' | 'DELETED'; // New status system
  // Period aggregates
  monthlyIncome: number;
  monthlyExpenses: number;
}

interface GlobalTotals {
  totalBalance: number;
  periodIncome: number;
  periodExpenses: number;
  netFlow: number;
}

const TreasuryMainView: React.FC = () => {
  const navigate = useNavigate();

  // State for main treasury view
  const [accounts, setAccounts] = useState<AccountCardData[]>([]);
  const [globalTotals, setGlobalTotals] = useState<GlobalTotals>({
    totalBalance: 0,
    periodIncome: 0,
    periodExpenses: 0,
    netFlow: 0
  });
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Current period for calculations (current month)
  const [currentPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Sync accounts from localStorage (cuentasService) to IndexedDB (treasuryApiService)
  const syncAccountsFromLocalStorage = useCallback(async () => {
    try {
      const db = await initDB();
      
      // Get accounts from localStorage (created via configuration)
      const storedAccounts = localStorage.getItem('atlas_accounts');
      if (!storedAccounts) return;
      
      const atlasAccounts = JSON.parse(storedAccounts);
      if (!Array.isArray(atlasAccounts)) return;
      
      // Get existing accounts from IndexedDB
      const existingAccounts = await db.getAll('accounts');
      const existingIbans = new Set(existingAccounts.map(acc => acc.iban));
      
      // Create map of deleted accounts from localStorage for cleanup
      const deletedAccountIbans = new Set(
        atlasAccounts
          .filter(acc => acc.deleted_at || acc.activa === false)
          .map(acc => acc.iban)
      );
      
      // Clean up deleted accounts from IndexedDB
      for (const existingAccount of existingAccounts) {
        if (deletedAccountIbans.has(existingAccount.iban) && existingAccount.id) {
          await db.delete('accounts', existingAccount.id);
          console.info('[TREASURY] Cleaned up deleted account from IndexedDB:', {
            alias: existingAccount.alias || 'Sin alias',
            iban: existingAccount.iban.slice(-4)
          });
        }
      }
      
      // Add missing accounts to IndexedDB
      for (const atlasAccount of atlasAccounts) {
        // Skip accounts that don't have IBAN, already exist, or are marked as deleted
        if (!atlasAccount.iban || existingIbans.has(atlasAccount.iban) || 
            atlasAccount.deleted_at || atlasAccount.activa === false) continue;
        
        // Transform atlas account to treasury account format
        const treasuryAccount = {
          alias: atlasAccount.alias,
          name: atlasAccount.alias,
          iban: atlasAccount.iban,
          banco: atlasAccount.banco,
          bank: atlasAccount.banco?.name || 'Banco',
          destination: 'horizon', // Set the required destination field
          activa: atlasAccount.activa ?? true,
          isActive: atlasAccount.activa ?? true,
          logoUser: atlasAccount.logoUser,
          logo_url: atlasAccount.logoUser || atlasAccount.banco?.brand?.logoUrl,
          tipo: atlasAccount.tipo || 'CORRIENTE',
          moneda: atlasAccount.moneda || 'EUR',
          currency: 'EUR',
          titular: atlasAccount.titular,
          isDefault: atlasAccount.isDefault || false,
          balance: 0, // Start with 0 balance
          openingBalance: 0,
          openingBalanceDate: atlasAccount.createdAt || new Date().toISOString(),
          includeInConsolidated: true,
          usage_scope: 'mixto',
          createdAt: atlasAccount.createdAt || new Date().toISOString(),
          updatedAt: atlasAccount.updatedAt || new Date().toISOString()
        };
        
        await db.add('accounts', treasuryAccount);
        console.info('[TREASURY] Synced account from localStorage:', { 
          alias: treasuryAccount.alias || 'Sin alias',
          iban: treasuryAccount.iban.slice(-4)
        });
      }
    } catch (error) {
      console.error('[TREASURY] Error syncing accounts from localStorage:', error);
    }
  }, []);

  // Load accounts and calculate totals
  const loadTreasuryData = useCallback(async () => {
    try {
      setLoading(true);
      
      // First sync accounts from localStorage to IndexedDB
      await syncAccountsFromLocalStorage();
      
      // Load accounts from configuration using new filtering
      const allAccounts = await treasuryAPI.accounts.getAccounts(true); // Include inactive for filtering
      
      // Filter only horizon accounts
      const horizonAccounts = allAccounts.filter(acc => acc.destination === 'horizon');
      
      // Load movements for period calculations
      const db = await initDB();
      const allMovements = await db.getAll('movements');
      
      // Filter movements for current period
      const [year, month] = currentPeriod.split('-').map(Number);
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0);
      
      const periodMovements = allMovements.filter(mov => {
        const movDate = new Date(mov.date);
        return movDate >= periodStart && movDate <= periodEnd;
      });

      // Process accounts with period calculations
      const accountCards: AccountCardData[] = horizonAccounts.map(acc => {
        const accountMovements = periodMovements.filter(mov => mov.accountId === acc.id);
        
        const monthlyIncome = accountMovements
          .filter(mov => mov.amount > 0)
          .reduce((sum, mov) => sum + mov.amount, 0);
          
        const monthlyExpenses = accountMovements
          .filter(mov => mov.amount < 0)
          .reduce((sum, mov) => sum + Math.abs(mov.amount), 0);

        return {
          id: acc.id!,
          alias: acc.alias || acc.name || 'Sin alias',
          bank: acc.bank || 'Banco',
          iban: acc.iban,
          balance: acc.balance || 0,
          logo_url: acc.logo_url,
          orderIndex: (acc as any).orderIndex || 0, // TODO: Add orderIndex to Account interface
          isActive: acc.status === 'ACTIVE' || (!acc.status && (acc.isActive || acc.activa)), // Enhanced status check
          status: acc.status,
          monthlyIncome,
          monthlyExpenses
        };
      });

      // Sort by orderIndex, then by alias/IBAN
      accountCards.sort((a, b) => {
        if (a.orderIndex !== b.orderIndex) {
          return (a.orderIndex || 0) - (b.orderIndex || 0);
        }
        return (a.alias || a.iban).localeCompare(b.alias || b.iban, 'es', { sensitivity: 'base' });
      });

      setAccounts(accountCards);

      // Calculate global totals (only active accounts unless showing inactive)
      const visibleAccounts = showInactive ? accountCards : accountCards.filter(acc => acc.isActive);
      
      const totals: GlobalTotals = {
        totalBalance: visibleAccounts.reduce((sum, acc) => sum + acc.balance, 0),
        periodIncome: visibleAccounts.reduce((sum, acc) => sum + acc.monthlyIncome, 0),
        periodExpenses: visibleAccounts.reduce((sum, acc) => sum + acc.monthlyExpenses, 0),
        netFlow: 0
      };
      
      totals.netFlow = totals.periodIncome - totals.periodExpenses;
      setGlobalTotals(totals);
      
    } catch (error) {
      console.error('Error loading treasury data:', error);
      toast.error('Error al cargar los datos de tesorería');
    } finally {
      setLoading(false);
    }
  }, [currentPeriod, showInactive, syncAccountsFromLocalStorage]);

  useEffect(() => {
    loadTreasuryData();
  }, [loadTreasuryData]);

  // Handle account card click
  const handleAccountClick = (accountId: number) => {
    navigate(`/tesoreria/cuenta/${accountId}`);
  };

  // Handle import completion
  const handleImportComplete = (result?: ImportResult) => {
    loadTreasuryData(); // Reload data after import
    setShowImportModal(false);
  };

  // Filter accounts for display
  const displayAccounts = showInactive ? accounts : accounts.filter(acc => acc.isActive);

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

  return (
    <div className="min-h-screen bg-hz-bg">
      {/* Page Header */}
      <div className="bg-white border-b border-hz-neutral-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-hz-neutral-900">Tesorería</h1>
              <p className="text-sm text-hz-neutral-600 mt-1">
                Vista principal de cuentas bancarias activas
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="atlas-atlas-atlas-atlas-btn-primary flex items-center gap-2"
              >
                <Upload size={16} />
                Importar extracto
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Totals Band */}
      <div className="bg-white border-b border-hz-neutral-300">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-sm text-hz-neutral-600">Saldo Total</div>
              <div className="text-xl font-semibold text-hz-neutral-900">
                {formatEuro(globalTotals.totalBalance)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-hz-neutral-600">Ingresos del Mes</div>
              <div className="text-xl font-semibold text-green-600">
                {formatEuro(globalTotals.periodIncome)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-hz-neutral-600">Gastos del Mes</div>
              <div className="text-xl font-semibold text-red-600">
                {formatEuro(globalTotals.periodExpenses)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-hz-neutral-600">Flujo Neto</div>
              <div className={`text-xl font-semibold ${
                globalTotals.netFlow >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatEuro(globalTotals.netFlow)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="flex items-center gap-2 text-sm text-hz-neutral-700 hover:text-hz-neutral-900 transition-colors"
            >
              {showInactive ? (
                <ToggleRight className="h-5 w-5 text-hz-primary" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-hz-neutral-400" />
              )}
              Mostrar inactivas
            </button>
          </div>
          <div className="text-sm text-hz-neutral-600">
            {displayAccounts.length} cuenta{displayAccounts.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        {displayAccounts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-hz-neutral-500 mb-4">
              {showInactive ? 'No hay cuentas configuradas' : 'No hay cuentas activas'}
            </div>
            <p className="text-sm text-hz-neutral-600">
              Ve a Cuenta ▸ Configuración ▸ Cuentas Bancarias para añadir cuentas
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayAccounts.map((account) => {
              const isInactive = !account.isActive || account.status === 'INACTIVE';
              
              return (
                <div
                  key={account.id}
                  className={`rounded-lg border p-6 cursor-pointer transition-all ${
                    isInactive 
                      ? 'bg-gray-50 border-gray-300 border-dashed opacity-75 hover:border-gray-400' 
                      : 'bg-white border-hz-neutral-300 hover:border-hz-primary hover:shadow-md'
                  }`}
                  onClick={() => handleAccountClick(account.id)}
                >
                  {/* Inactive banner */}
                  {isInactive && (
                    <div className="mb-3 -mx-6 -mt-6 bg-gray-100 border-b border-gray-300">
                      <span className="text-sm text-gray-600">
                        Cuenta inactiva
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3 mb-4">
                  {/* Bank Logo */}
                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
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
                      className="w-full h-full bg-hz-neutral-300 rounded flex items-center justify-center text-xs font-medium text-hz-neutral-600"
                      style={{ display: account.logo_url ? 'none' : 'flex' }}
                    >
                      {account.bank.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  
                  {/* Account Info */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${isInactive ? 'text-gray-500' : 'text-hz-neutral-900'}`}>
                      {account.alias}
                    </div>
                    <div className={`text-sm ${isInactive ? 'text-gray-400' : 'text-hz-neutral-600'}`}>
                      {account.bank}
                    </div>
                    <div className={`text-sm font-mono ${isInactive ? 'text-gray-400' : 'text-hz-neutral-500'}`}>
                      {maskIBAN(account.iban)}
                    </div>
                  </div>
                </div>

                {/* Balance */}
                <div className="mb-4">
                  <div className={`text-sm ${isInactive ? 'text-gray-400' : 'text-hz-neutral-600'}`}>Saldo actual</div>
                  <div className={`text-xl font-semibold ${isInactive ? 'text-gray-500' : 'text-hz-neutral-900'}`}>
                    {formatEuro(account.balance)}
                  </div>
                </div>

                {/* Period Summary - Hidden for inactive accounts */}
                {!isInactive && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-hz-neutral-600">Entradas</div>
                      <div className="font-medium text-green-600">
                        {formatEuro(account.monthlyIncome)}
                      </div>
                    </div>
                    <div>
                      <div className="text-hz-neutral-600">Salidas</div>
                      <div className="font-medium text-red-600">
                        {formatEuro(account.monthlyExpenses)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <ImportStatementModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      )}
    </div>
  );
};

export default TreasuryMainView;