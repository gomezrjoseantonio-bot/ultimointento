import React, { useState, useEffect } from 'react';
import { Plus, Upload, Search, Filter, Edit2, Link, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../../components/common/PageLayout';
import { initDB, Account, Movement } from '../../../../services/db';
import { formatEuro, formatDate } from '../../../../utils/formatUtils';
import toast from 'react-hot-toast';

const TPMovimientos: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Load accounts and movements on component mount
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const db = await initDB();
      
      // Load Pulse accounts
      const allAccounts = await db.getAll('accounts');
      const pulseAccounts = allAccounts.filter(acc => acc.destination === 'pulse');
      setAccounts(pulseAccounts);
      
      // Load movements for Pulse accounts
      const allMovements = await db.getAll('movements');
      const pulseMovements = allMovements.filter((mov: Movement) => 
        pulseAccounts.some((acc: Account) => acc.id === mov.accountId)
      );
      setMovements(pulseMovements);
      
    } catch (error) {
      console.error('Error loading treasury data:', error);
      toast.error('Error al cargar los datos de tesorería');
    } finally {
      setLoading(false);
    }
  };
  
  const handleNavigateToImport = () => {
    navigate('/inbox', { state: { showBankStatements: true } });
    toast('Navega a Inbox para importar extractos bancarios', { icon: '📁' });
  };
  
  if (loading) {
    return (
      <PageLayout title="Movimientos" subtitle="Historial de transacciones bancarias.">
        <div className="flex items-center justify-center py-12">
          <div className="text-neutral-500">Cargando...</div>
        </div>
      </PageLayout>
    );
  }
  
  return (
    <PageLayout title="Movimientos" subtitle="Historial de transacciones bancarias.">
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Movimientos</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {/* TODO: Add manual movement */}}
              className="flex items-center gap-2 px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Añadir movimiento
            </button>
            <button
              onClick={handleNavigateToImport}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Importar extracto (Inbox)
            </button>
          </div>
        </div>
        
        {/* Accounts Summary */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <div key={account.id} className="bg-white border border-neutral-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-neutral-900">{account.name}</h3>
                    <p className="text-sm text-neutral-500">{account.bank}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-neutral-900">
                      {formatEuro(account.balance)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {account.isActive ? 'Activa' : 'Inactiva'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Movements List */}
        <div className="bg-white border border-neutral-200 rounded-lg">
          <div className="px-6 py-4 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-neutral-900">
                Últimos movimientos
              </h2>
              <div className="flex items-center gap-2">
                <button className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors">
                  <Search className="h-4 w-4" />
                </button>
                <button className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors">
                  <Filter className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          {movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
              <Upload className="h-12 w-12 mb-4 text-neutral-300" />
              <h3 className="text-lg font-medium mb-2">No hay movimientos</h3>
              <p className="text-sm mb-4">Comienza importando un extracto bancario en formato CSV</p>
              <button
                onClick={handleNavigateToImport}
                className="px-4 py-2 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 transition-colors"
              >
                Importar extracto (Inbox)
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Contraparte
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Importe
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {movements.slice(0, 50).map((movement) => (
                    <tr key={movement.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                        {formatDate(movement.date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900 max-w-xs">
                        <div className="truncate" title={movement.description}>
                          {movement.description}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                        {movement.counterparty || '—'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                        movement.amount >= 0 ? 'text-success-600' : 'text-error-600'
                      }`}>
                        {formatEuro(movement.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          movement.status === 'conciliado' ? 'bg-success-100 text-success-800' :
                          movement.status === 'parcial' ? 'bg-warning-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {movement.status === 'conciliado' ? 'Conciliado' :
                           movement.status === 'parcial' ? 'Parcial' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <button className="text-neutral-400 hover:text-neutral-600">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button className="text-neutral-400 hover:text-primary-600">
                            <Link className="h-4 w-4" />
                          </button>
                          <button className="text-neutral-400 hover:text-error-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default TPMovimientos;