import React, { useState, useEffect } from 'react';
import { Banknote, Edit, Plus, AlertTriangle } from 'lucide-react';
import { initDB, Account } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';

const CuentasPanel: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

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
        <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-navy hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-navy">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Cuenta
        </button>
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
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Detalle de Cuentas</h3>
        </div>
        
        {accounts.length === 0 ? (
          <div className="p-6 text-center">
            <Banknote className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay cuentas configuradas</h3>
            <p className="text-gray-500 mb-4">Agrega tu primera cuenta bancaria para comenzar.</p>
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-brand-navy hover:bg-navy-800">
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
                <div key={account.id} className="p-6 hover:bg-gray-50">
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
                      </div>
                      
                      <button className="p-2 text-gray-400 hover:text-gray-600">
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