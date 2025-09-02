import React, { useState, useEffect } from 'react';
import { Upload, Search, Link, Check, X, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../../../components/common/PageLayout';
import { initDB, Account, Movement } from '../../../../services/db';
import { findEventMovementMatches, reconcileTreasuryEvent } from '../../../../services/treasuryForecastService';
import { findReconciliationMatches, reconcileTreasuryRecord } from '../../../../services/treasuryCreationService';
import { formatEuro } from '../../../../services/aeatClassificationService';
import toast from 'react-hot-toast';

const Movimientos: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [potentialMatches, setPotentialMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showReconciliation, setShowReconciliation] = useState(false);
  
  // Load accounts and movements on component mount
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showReconciliation) {
      loadPotentialMatches();
    }
  }, [showReconciliation]);
  
  const loadData = async () => {
    try {
      const db = await initDB();
      
      // Load Horizon accounts
      const allAccounts = await db.getAll('accounts');
      const horizonAccounts = allAccounts.filter(acc => acc.destination === 'horizon');
      setAccounts(horizonAccounts);
      
      // Load movements for Horizon accounts
      const allMovements = await db.getAll('movements');
      const horizonMovements = allMovements.filter(mov => 
        horizonAccounts.some(acc => acc.id === mov.accountId)
      );
      setMovements(horizonMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      
    } catch (error) {
      console.error('Error loading treasury data:', error);
      toast.error('Error al cargar los datos de tesorería');
    } finally {
      setLoading(false);
    }
  };

  const loadPotentialMatches = async () => {
    try {
      // Load both legacy treasury events and new treasury records matches
      const [eventMatches, recordMatches] = await Promise.all([
        findEventMovementMatches(),
        findReconciliationMatches()
      ]);
      
      // Combine both types of matches
      const allMatches = [...eventMatches, ...recordMatches];
      setPotentialMatches(allMatches);
    } catch (error) {
      console.error('Error finding matches:', error);
    }
  };

  const handleReconcile = async (eventId: number, movementId: number) => {
    try {
      await reconcileTreasuryEvent(eventId, movementId);
      toast.success('Movimiento conciliado correctamente');
      await loadData();
      await loadPotentialMatches();
    } catch (error) {
      console.error('Error reconciling:', error);
      toast.error('Error al conciliar el movimiento');
    }
  };

  const handleReconcileTreasuryRecord = async (
    recordType: 'ingreso' | 'gasto' | 'capex',
    recordId: number,
    movementId: number
  ) => {
    try {
      await reconcileTreasuryRecord(recordType, recordId, movementId);
      toast.success(`${recordType === 'ingreso' ? 'Ingreso' : recordType === 'gasto' ? 'Gasto' : 'CAPEX'} reconciliado correctamente`);
      await loadData();
      await loadPotentialMatches();
    } catch (error) {
      console.error('Error reconciling treasury record:', error);
      toast.error('Error al reconciliar el registro');
    }
  };
  
  const handleNavigateToImport = () => {
    navigate('/inbox', { state: { showBankStatements: true } });
    toast('Navega a Inbox para importar extractos bancarios', { icon: '📁' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'conciliado': return 'bg-green-100 text-green-800';
      case 'parcial': return 'bg-yellow-100 text-yellow-800';
      case 'no-documentado': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'conciliado': return <Check className="w-4 h-4" />;
      case 'no-documentado': return <AlertTriangle className="w-4 h-4" />;
      default: return <X className="w-4 h-4" />;
    }
  };

  const filteredMovements = movements.filter(movement => {
    // Account filter
    if (selectedAccount !== 'all' && movement.accountId.toString() !== selectedAccount) {
      return false;
    }
    
    // Status filter
    if (statusFilter !== 'all' && movement.status !== statusFilter) {
      return false;
    }
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        movement.description.toLowerCase().includes(searchLower) ||
        movement.counterparty?.toLowerCase().includes(searchLower) ||
        movement.reference?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES');
  };
  
  if (loading) {
    return (
      <PageLayout title="Movimientos" subtitle="Gestión de movimientos bancarios y conciliación.">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Movimientos" subtitle="Gestión de movimientos bancarios y conciliación.">
      <div className="space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleNavigateToImport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Upload className="w-4 h-4" />
              Importar Extractos
            </button>
            
            <button
              onClick={() => setShowReconciliation(!showReconciliation)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                showReconciliation 
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Link className="w-4 h-4" />
              {showReconciliation ? 'Ocultar' : 'Mostrar'} Conciliación
            </button>
          </div>
        </div>

        {/* Reconciliation Panel */}
        {showReconciliation && (
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Conciliación Automática</h3>
            {potentialMatches.length > 0 ? (
              <div className="space-y-4">
                {potentialMatches.map((match, index) => (
                  <div key={index} className="bg-white rounded-lg border border-blue-200 p-4">
                    {/* Legacy treasury events */}
                    {match.event && (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {match.event.description}
                              </div>
                              <div className="text-sm text-gray-500">
                                Evento previsto: {formatDate(match.event.predictedDate)} • {formatEuro(match.event.amount)}
                              </div>
                            </div>
                            <div className="text-center text-gray-400">↔</div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {match.movement.description}
                              </div>
                              <div className="text-sm text-gray-500">
                                Movimiento: {formatDate(match.movement.date)} • {formatEuro(Math.abs(match.movement.amount))}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-sm text-blue-600">
                            {match.reason}
                          </div>
                        </div>
                        <button
                          onClick={() => handleReconcile(match.event.id, match.movement.id)}
                          className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Conciliar
                        </button>
                      </div>
                    )}
                    
                    {/* New treasury records */}
                    {match.potentialMatches && (
                      <div className="space-y-3">
                        <div className="font-medium text-gray-900 mb-3">
                          Movimiento: {movements.find(m => m.id === match.movementId)?.description}
                          <span className="ml-2 text-sm text-gray-500">
                            ({formatDate(movements.find(m => m.id === match.movementId)?.date || '')} • 
                            {formatEuro(Math.abs(movements.find(m => m.id === match.movementId)?.amount || 0))})
                          </span>
                        </div>
                        {match.potentialMatches.map((recordMatch: any, recordIndex: number) => (
                          <div key={recordIndex} className="border-l-4 border-blue-300 pl-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                    recordMatch.type === 'ingreso' ? 'bg-green-100 text-green-800' :
                                    recordMatch.type === 'gasto' ? 'bg-red-100 text-red-800' :
                                    'bg-purple-100 text-purple-800'
                                  }`}>
                                    {recordMatch.type === 'ingreso' ? 'Ingreso' : 
                                     recordMatch.type === 'gasto' ? 'Gasto' : 'CAPEX'}
                                  </span>
                                  <span className="text-sm font-medium text-gray-900">
                                    Confianza: {Math.round(recordMatch.confidence * 100)}%
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {recordMatch.reason}
                                </div>
                              </div>
                              <button
                                onClick={() => handleReconcileTreasuryRecord(
                                  recordMatch.type,
                                  recordMatch.id,
                                  match.movementId
                                )}
                                className="ml-4 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                              >
                                Conciliar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-blue-600 py-4">
                <Check className="w-8 h-8 mx-auto mb-2" />
                <p>No hay movimientos pendientes de conciliación</p>
              </div>
            )}
          </div>
        )}

        {/* Movements Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-64">
                <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por descripción, contrapartida o referencia..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cuenta</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
                >
                  <option value="all">Todas las cuentas</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 focus:ring-opacity-50"
                >
                  <option value="all">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="conciliado">Conciliado</option>
                  <option value="no-documentado">No documentado</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cuenta</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contrapartida</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Importe</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMovements.map((movement) => {
                  const account = accounts.find(acc => acc.id === movement.accountId);
                  
                  return (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(movement.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {account?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={movement.description}>
                          {movement.description}
                        </div>
                        {movement.reference && (
                          <div className="text-xs text-gray-500 mt-1">
                            Ref: {movement.reference}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={movement.counterparty}>
                          {movement.counterparty || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={`font-medium ${
                          movement.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {movement.amount >= 0 ? '+' : ''}{formatEuro(movement.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(movement.status)}`}>
                          {getStatusIcon(movement.status)}
                          {movement.status === 'conciliado' ? 'Conciliado' : 
                           movement.status === 'no-documentado' ? 'Sin documentar' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredMovements.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">No se encontraron movimientos</div>
              <div className="text-sm text-gray-500">
                {movements.length === 0 
                  ? 'Importa extractos bancarios para ver movimientos'
                  : 'Intenta ajustar los filtros'
                }
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        {filteredMovements.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {filteredMovements.filter(m => m.amount > 0).length}
                </div>
                <div className="text-sm text-gray-500">Ingresos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {filteredMovements.filter(m => m.amount < 0).length}
                </div>
                <div className="text-sm text-gray-500">Gastos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {filteredMovements.filter(m => m.status === 'conciliado').length}
                </div>
                <div className="text-sm text-gray-500">Conciliados</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Movimientos;