import React, { useState, useEffect } from 'react';
import { Upload, Search, Link, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { initDB, Account, Movement } from '../../../../services/db';
import { findReconciliationMatches, reconcileTreasuryRecord } from '../../../../services/treasuryCreationService';
import { formatEuro } from '../../../../services/aeatClassificationService';
import toast from 'react-hot-toast';

const MovimientosPanel: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [potentialMatches, setPotentialMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [newMovement, setNewMovement] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    accountId: '',
    counterparty: ''
  });
  
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
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadPotentialMatches = async () => {
    try {
      const matches = await findReconciliationMatches();
      setPotentialMatches(matches);
    } catch (error) {
      console.error('Error loading reconciliation matches:', error);
      toast.error('Error al cargar sugerencias de conciliación');
    }
  };

  const handleNavigateToImport = () => {
    navigate('/documentos?category=bankStatement&action=new');
  };

  const handleReconcile = async (movementId: number, recordType: 'ingreso' | 'gasto' | 'capex', recordId: number) => {
    try {
      await reconcileTreasuryRecord(recordType, recordId, movementId);
      await loadData();
      await loadPotentialMatches();
    } catch (error) {
      console.error('Error reconciling:', error);
    }
  };

  const handleCreateManualMovement = async () => {
    try {
      if (!newMovement.date || !newMovement.description || !newMovement.amount || !newMovement.accountId) {
        toast.error('Por favor, completa todos los campos obligatorios');
        return;
      }

      const db = await initDB();
      
      // Create movement
      const movement: Omit<Movement, 'id'> = {
        accountId: parseInt(newMovement.accountId),
        date: newMovement.date,
        description: newMovement.description,
        amount: parseFloat(newMovement.amount),
        counterparty: newMovement.counterparty || undefined,
        estado_conciliacion: 'sin_conciliar',
        status: 'pendiente',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.add('movements', movement);
      
      toast.success('Movimiento creado exitosamente');
      setShowManualEntry(false);
      setNewMovement({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        accountId: '',
        counterparty: ''
      });
      
      await loadData();
    } catch (error) {
      console.error('Error creating movement:', error);
      toast.error('Error al crear el movimiento');
    }
  };

  // Filter movements
  const filteredMovements = movements.filter(movement => {
    const matchesAccount = selectedAccount === 'all' || movement.accountId.toString() === selectedAccount;
    const matchesStatus = statusFilter === 'all' || movement.estado_conciliacion === statusFilter;
    const matchesSearch = searchTerm === '' || 
      movement.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.counterparty?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesAccount && matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'conciliado':
        return 'bg-green-100 text-green-800';
      case 'sin_conciliar':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-gray-200 rounded-lg"></div>
        <div className="h-64 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={handleNavigateToImport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Importar Extractos
          </button>
          
          <button
            onClick={() => setShowManualEntry(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Entrada Manual
          </button>
          
          <button
            onClick={() => setShowReconciliation(!showReconciliation)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showReconciliation 
                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Link className="w-4 h-4" />
            Conciliación
            {potentialMatches.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {potentialMatches.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las cuentas</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id?.toString()}>
                  {account.name} - {account.iban?.slice(-4)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="sin_conciliar">Sin conciliar</option>
              <option value="conciliado">Conciliado</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por descripción o contraparte..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Reconciliation Panel */}
      {showReconciliation && potentialMatches.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Sugerencias de conciliación</h3>
          <div className="space-y-4">
            {potentialMatches.map((match, index) => (
              <div key={index} className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      Movimiento: {formatEuro(match.movement.amount)} - {match.movement.description}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {new Date(match.movement.date).toLocaleDateString('es-ES')} - {match.movement.counterparty}
                    </div>
                  </div>
                  <div className="ml-4">
                    {match.potentialMatches.map((potentialMatch: any, matchIndex: number) => (
                      <button
                        key={matchIndex}
                        onClick={() => handleReconcile(match.movementId, potentialMatch.type, potentialMatch.id)}
                        className="ml-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                      >
                        Conciliar con {potentialMatch.type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Crear Movimiento Manual</h3>
              <button
                onClick={() => setShowManualEntry(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={newMovement.date}
                  onChange={(e) => setNewMovement(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cuenta *
                </label>
                <select
                  value={newMovement.accountId}
                  onChange={(e) => setNewMovement(prev => ({ ...prev, accountId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                >
                  <option value="">Seleccionar cuenta</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id?.toString()}>
                      {account.name} - {account.iban?.slice(-4)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Concepto *
                </label>
                <input
                  type="text"
                  value={newMovement.description}
                  onChange={(e) => setNewMovement(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del movimiento"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Importe * (positivo para ingresos, negativo para gastos)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newMovement.amount}
                  onChange={(e) => setNewMovement(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraparte (opcional)
                </label>
                <input
                  type="text"
                  value={newMovement.counterparty}
                  onChange={(e) => setNewMovement(prev => ({ ...prev, counterparty: e.target.value }))}
                  placeholder="Nombre de la entidad o persona"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowManualEntry(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateManualMovement}
                className="flex-1 px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 transition-colors"
              >
                Crear Movimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movements Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cuenta
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMovements.map((movement) => {
                const account = accounts.find(acc => acc.id === movement.accountId);
                
                return (
                  <tr key={movement.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(movement.date).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {account?.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {movement.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {movement.counterparty || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className={`text-sm font-medium ${
                        movement.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatEuro(movement.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {movement.saldo ? formatEuro(movement.saldo) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        getStatusColor(movement.estado_conciliacion)
                      }`}>
                        {movement.estado_conciliacion === 'conciliado' ? 'Conciliado' : 'Sin conciliar'}
                      </span>
                      {movement.linked_registro && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            <Link className="w-3 h-3 mr-1" />
                            {movement.linked_registro.type}
                          </span>
                        </div>
                      )}
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
  );
};

export default MovimientosPanel;