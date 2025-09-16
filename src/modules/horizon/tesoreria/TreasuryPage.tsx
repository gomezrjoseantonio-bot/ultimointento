import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/common/PageHeader';
import ImportStatementModal from './components/ImportStatementModal';
import AccountCard from './components/AccountCard';
import { ImportResult } from '../../../types/unifiedTreasury';

interface Account {
  id: number;
  name: string; // alias
  bank: string;
  iban: string;
  balance: number;
  logo_url?: string;
  currency: string;
  status?: 'verde' | 'ambar' | 'rojo'; // Health indicator
}

interface Movement {
  id: number;
  accountId: number;
  date: string; // YYYY-MM-DD (dateValue from spec)
  description: string;
  counterparty?: string; // proveedor/contraparte
  amount: number;
  currency: string;
  source?: string; // 'import' | 'manual'
  reference?: string;
  status?: 'previsto' | 'confirmado' | 'no_planificado';
  category?: string; // tipo/subtipo
  scope?: 'personal' | 'inmueble';
  inmuebleId?: number;
  planned?: boolean;
  confirmed?: boolean;
  type?: 'Gasto' | 'Ingreso' | 'Transferencia';
  sign?: '+' | '-';
}

const TreasuryPage: React.FC = () => {
  // State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allMovements, setAllMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set());
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [excludePersonal, setExcludePersonal] = useState(false);
  const [searchText, setSearchText] = useState('');

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
        name: acc.name || `Cuenta ${acc.bank || 'Banco'}`, // alias
        bank: acc.bank || 'Banco',
        iban: acc.iban,
        balance: acc.balance || 0,
        logo_url: acc.logo_url,
        currency: acc.currency || 'EUR',
        status: 'verde' // TODO: Calculate health status based on movements/balance
      }));
      
      setAccounts(formattedAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Error al cargar las cuentas');
      setAccounts([]);
    }
  }, []);

  // Load all movements for all accounts
  const loadMovements = useCallback(async () => {
    try {
      const { initDB } = await import('../../../services/db');
      const db = await initDB();
      const allDbMovements = await db.getAll('movements');
      
      // Enhance movements with status and classification per spec
      const enhancedMovements: Movement[] = allDbMovements.map(movement => ({
        ...movement,
        status: movement.status || (movement.source === 'extracto' ? 'confirmado' : 'no_planificado') as 'previsto' | 'confirmado' | 'no_planificado',
        category: movement.category,
        scope: movement.scope as 'personal' | 'inmueble' | undefined,
        planned: movement.planned || movement.status === 'previsto',
        confirmed: movement.confirmed || movement.status === 'confirmado',
        sign: movement.amount >= 0 ? '+' : '-',
        type: movement.amount >= 0 ? 'Ingreso' : (movement.description?.toLowerCase().includes('transfer') ? 'Transferencia' : 'Gasto')
      }));
      
      setAllMovements(enhancedMovements);
    } catch (error) {
      console.error('Error loading movements:', error);
      toast.error('Error al cargar los movimientos');
      setAllMovements([]);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  useEffect(() => {
    setLoading(false);
  }, [accounts]);

  // Handle account expand/collapse
  const toggleAccountExpanded = (accountId: number) => {
    setExpandedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  // Handle import completion
  const handleImportComplete = (result: ImportResult) => {
    // Reload movements to show imported data
    loadMovements();
    toast.success(`Importación completada: ${result.confirmedMovements} movimientos`);
  };

  // Get movements for a specific account
  const getAccountMovements = (accountId: number): Movement[] => {
    return allMovements.filter(movement => movement.accountId === accountId);
  };

  return (
    <div className="min-h-screen bg-hz-bg">
      {/* Page Header */}
      <PageHeader
        title="Tesorería"
        subtitle="Vista unificada de cuentas bancarias"
        primaryAction={{
          label: "Importar extracto",
          onClick: () => setShowImportModal(true)
        }}
      />

      {/* Main Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-hz-primary border-t-transparent"></div>
            <span className="ml-2 text-hz-neutral-700">Cargando cuentas...</span>
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-12 text-center text-hz-neutral-700">
            <div className="w-12 h-12 mx-auto mb-4 bg-hz-neutral-300 rounded-lg flex items-center justify-center">
              <span className="text-hz-neutral-600 font-medium">€</span>
            </div>
            <h3 className="text-lg font-medium mb-2">No hay cuentas configuradas</h3>
            <p>Configura tus cuentas bancarias en el módulo de Configuración</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Account Cards List */}
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                movements={getAccountMovements(account.id)}
                isExpanded={expandedAccounts.has(account.id)}
                onToggleExpanded={() => toggleAccountExpanded(account.id)}
                excludePersonal={excludePersonal}
                searchText={searchText}
                monthYear={monthYear}
                onMonthYearChange={setMonthYear}
              />
            ))}
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