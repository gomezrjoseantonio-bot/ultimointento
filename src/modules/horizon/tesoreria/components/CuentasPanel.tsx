import React, { useState, useEffect } from 'react';
import { Banknote, Edit, Plus, AlertTriangle, ArrowLeft, Upload, TrendingUp, TrendingDown } from 'lucide-react';
import { initDB, Account, Movement } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';
import { getTreasuryProjections } from '../../../../services/treasuryForecastService';
import { treasuryAPI, validateIBAN, parseEuropeanNumber } from '../../../../services/treasuryApiService';
import toast from 'react-hot-toast';

interface AccountProjection {
  currentBalance: number;
  projectedBalance: number;
  projectedBalance7d: number;
  movements: Movement[];
  status: 'healthy' | 'warning' | 'critical';
}

const CuentasPanel: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountProjection, setAccountProjection] = useState<AccountProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  
  // New account form state
  const [newAccountForm, setNewAccountForm] = useState({
    alias: '',
    bank: '',
    iban: '',
    openingBalance: '',
    minimumBalance: '',
    includeInConsolidated: true
  });

  const loadAccounts = async () => {
    try {
      const db = await initDB();
      const allAccounts = await db.getAll('accounts');
      const horizonAccounts = allAccounts.filter(acc => acc.destination === 'horizon' && acc.isActive);
      setAccounts(horizonAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAccountDetails = async (account: Account) => {
    try {
      const db = await initDB();
      
      // Get movements for this account
      const allMovements = await db.getAll('movements');
      const accountMovements = allMovements.filter(mov => mov.accountId === account.id);
      
      // Get projections for this specific account
      const { accountBalances } = await getTreasuryProjections(30, [account.id!]);
      const { accountBalances: sevenDayBalances } = await getTreasuryProjections(7, [account.id!]);
      
      const currentBalance = account.balance;
      const projectedBalance = accountBalances.get(account.id!)?.projected || currentBalance;
      const projectedBalance7d = sevenDayBalances.get(account.id!)?.projected || currentBalance;
      
      // Determine status
      const minimumBalance = account.minimumBalance || 200;
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (projectedBalance < 0) status = 'critical';
      else if (projectedBalance < minimumBalance) status = 'warning';
      
      setAccountProjection({
        currentBalance,
        projectedBalance,
        projectedBalance7d,
        movements: accountMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10),
        status
      });
    } catch (error) {
      console.error('Error loading account details:', error);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const getAccountStatus = (account: Account): 'healthy' | 'warning' | 'critical' => {
    const minimumBalance = account.minimumBalance || 200;
    
    if (account.balance < 0) return 'critical';
    if (account.balance < minimumBalance) return 'warning';
    return 'healthy';
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical'): string => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getStatusIcon = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'healthy': return <Banknote className="w-4 h-4 text-green-500" />;
    }
  };

  // New account form handlers
  const handleNewAccountChange = (field: string, value: string | boolean) => {
    setNewAccountForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateAccount = async () => {
    // Validation
    if (!newAccountForm.alias.trim()) {
      toast.error('El alias de la cuenta es obligatorio');
      return;
    }
    
    if (!newAccountForm.bank.trim()) {
      toast.error('El banco es obligatorio');
      return;
    }

    if (newAccountForm.iban && !validateIBAN(newAccountForm.iban)) {
      toast.error('Formato de IBAN inválido');
      return;
    }

    try {
      setIsCreatingAccount(true);
      
      const accountData = {
        alias: newAccountForm.alias.trim(),
        bank: newAccountForm.bank.trim(),
        iban: newAccountForm.iban.trim() || undefined,
        includeInConsolidated: newAccountForm.includeInConsolidated,
        openingBalance: parseEuropeanNumber(newAccountForm.openingBalance),
        openingBalanceDate: new Date().toISOString()
      };

      const newAccount = await treasuryAPI.accounts.createAccount(accountData);
      
      // Update minimum balance if specified
      if (newAccountForm.minimumBalance) {
        const db = await initDB();
        const updatedAccount = {
          ...newAccount,
          minimumBalance: parseEuropeanNumber(newAccountForm.minimumBalance)
        };
        await db.put('accounts', updatedAccount);
      }

      toast.success('Cuenta creada correctamente');
      
      // Reset form and reload accounts
      setNewAccountForm({
        alias: '',
        bank: '',
        iban: '',
        openingBalance: '',
        minimumBalance: '',
        includeInConsolidated: true
      });
      setShowImport(false);
      await loadAccounts();
      
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error(error instanceof Error ? error.message : 'Error al crear la cuenta');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Individual Account View
  if (selectedAccount) {
    return (
      <div className="space-y-6">
        {/* Account Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setSelectedAccount(null);
                setAccountProjection(null);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{selectedAccount.name}</h2>
              <p className="text-sm text-gray-500">{selectedAccount.bank} • {selectedAccount.iban?.slice(-4)}</p>
            </div>
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50">
            <Edit className="w-4 h-4 mr-2" />
            Editar Cuenta
          </button>
        </div>

        {/* Account Overview */}
        {accountProjection && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <Banknote className="w-8 h-8 text-brand-teal mr-3" />
                <div>
                  <div className="text-sm font-medium text-gray-500">Saldo Actual</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatEuro(accountProjection.currentBalance)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex items-center">
                  {accountProjection.projectedBalance7d > accountProjection.currentBalance ? (
                    <TrendingUp className="w-8 h-8 text-green-500 mr-3" />
                  ) : (
                    <TrendingDown className="w-8 h-8 text-red-500 mr-3" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-500">Proyección 7d</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatEuro(accountProjection.projectedBalance7d)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex items-center">
                  {accountProjection.projectedBalance > accountProjection.currentBalance ? (
                    <TrendingUp className="w-8 h-8 text-green-500 mr-3" />
                  ) : (
                    <TrendingDown className="w-8 h-8 text-red-500 mr-3" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-500">Proyección 30d</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatEuro(accountProjection.projectedBalance)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${getStatusColor(accountProjection.status)} mr-3`}>
                  {getStatusIcon(accountProjection.status)}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Estado</div>
                  <div className="text-lg font-semibold">
                    {accountProjection.status === 'healthy' ? 'Saludable' : 
                     accountProjection.status === 'warning' ? 'Atención' : 'Crítico'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Movements */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Movimientos Recientes</h3>
          </div>
          
          {accountProjection && accountProjection.movements.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {accountProjection.movements.map((movement, index) => (
                <div key={movement.id || index} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {movement.amount > 0 ? (
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {movement.description || 'Movimiento'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(movement.date).toLocaleDateString('es-ES')}
                        </div>
                      </div>
                    </div>
                    <div className={`text-lg font-semibold ${
                      movement.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {movement.amount > 0 ? '+' : ''}{formatEuro(movement.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              <p>No hay movimientos recientes para esta cuenta</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Import Modal
  if (showImport) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowImport(false)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Importar Cuenta</h2>
              <p className="text-sm text-gray-500">Añade una nueva cuenta manualmente o importa desde extracto</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Cuenta Manual</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alias de la cuenta *</label>
                <input
                  type="text"
                  value={newAccountForm.alias}
                  onChange={(e) => handleNewAccountChange('alias', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                  placeholder="ej. Cuenta Corriente Principal"
                  disabled={isCreatingAccount}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banco *</label>
                <input
                  type="text"
                  value={newAccountForm.bank}
                  onChange={(e) => handleNewAccountChange('bank', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                  placeholder="ej. Banco Santander"
                  disabled={isCreatingAccount}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IBAN (opcional)</label>
                <input
                  type="text"
                  value={newAccountForm.iban}
                  onChange={(e) => handleNewAccountChange('iban', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                  placeholder="ES91 2100 0418 4502 0005 1332"
                  disabled={isCreatingAccount}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial</label>
                <input
                  type="text"
                  value={newAccountForm.openingBalance}
                  onChange={(e) => handleNewAccountChange('openingBalance', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                  placeholder="1.234,56"
                  disabled={isCreatingAccount}
                />
                <p className="text-xs text-gray-500 mt-1">Formato europeo: 1.234,56</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Mínimo</label>
                <input
                  type="text"
                  value={newAccountForm.minimumBalance}
                  onChange={(e) => handleNewAccountChange('minimumBalance', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-brand-navy focus:border-brand-navy"
                  placeholder="200,00"
                  disabled={isCreatingAccount}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeInConsolidated"
                  checked={newAccountForm.includeInConsolidated}
                  onChange={(e) => handleNewAccountChange('includeInConsolidated', e.target.checked)}
                  className="h-4 w-4 text-brand-navy focus:ring-brand-navy border-gray-300 rounded"
                  disabled={isCreatingAccount}
                />
                <label htmlFor="includeInConsolidated" className="ml-2 block text-sm text-gray-700">
                  Incluir en consolidado
                </label>
              </div>
              <button 
                onClick={handleCreateAccount}
                disabled={isCreatingAccount}
                className="w-full bg-brand-navy text-white py-3 px-4 rounded-lg hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingAccount ? 'Creando...' : 'Crear Cuenta'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Importar desde Extracto</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">Arrastra tu extracto aquí</p>
              <p className="text-sm text-gray-500 mb-4">
                Formatos soportados: PDF, Excel (XLS, XLSX), CSV
              </p>
              <button className="bg-brand-navy text-white py-2 px-4 rounded-lg hover:bg-navy-800">
                Seleccionar Archivo
              </button>
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> El sistema detectará automáticamente el saldo inicial y los movimientos del extracto para configurar la cuenta.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Cuentas Bancarias</h2>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de cuentas, saldos y configuración bancaria
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowImport(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-navy hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-navy">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Cuenta
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Banknote className="w-8 h-8 text-brand-teal" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Total Saldo</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatEuro(accounts.reduce((sum, acc) => sum + acc.balance, 0))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-brand-teal text-white flex items-center justify-center font-bold">
                {accounts.length}
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Cuentas Activas</div>
              <div className="text-2xl font-bold text-gray-900">{accounts.length}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">En Riesgo</div>
              <div className="text-2xl font-bold text-gray-900">
                {accounts.filter(acc => getAccountStatus(acc) !== 'healthy').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Detalle de Cuentas</h3>
          {accounts.length > 0 && (
            <button 
              onClick={() => setShowImport(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-navy hover:bg-navy-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Cuenta
            </button>
          )}
        </div>
        
        {accounts.length === 0 ? (
          <div className="p-6 text-center">
            <Banknote className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay cuentas configuradas</h3>
            <p className="text-gray-500 mb-4">Agrega tu primera cuenta bancaria para comenzar.</p>
            <button 
              onClick={() => setShowImport(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-navy hover:bg-navy-800"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Cuenta
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {accounts.map(account => {
              const status = getAccountStatus(account);
              const minimumBalance = account.minimumBalance || 200;
              
              return (
                <div 
                  key={account.id} 
                  className="p-6 hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedAccount(account);
                    loadAccountDetails(account);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg border ${getStatusColor(status)}`}>
                        {getStatusIcon(status)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{account.name}</div>
                        <div className="text-sm text-gray-500">
                          {account.bank} {account.iban && `• ${account.iban.slice(-4)}`}
                        </div>
                        {account.minimumBalance && (
                          <div className="text-xs text-gray-400">
                            Saldo mínimo: {formatEuro(minimumBalance)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">
                          {formatEuro(account.balance)}
                        </div>
                        <div className={`text-sm px-2 py-1 rounded-full ${getStatusColor(status)}`}>
                          {status === 'healthy' ? 'Saludable' : 
                           status === 'warning' ? 'Atención' : 'Crítico'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Ver proyección 30d →
                        </div>
                      </div>
                      
                      <button 
                        className="p-2 text-gray-400 hover:text-gray-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle edit action
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CuentasPanel;