import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Upload, 
  Search, 
  Edit2, 
  Trash2, 
  Paperclip,
  Check,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { initDB, Account, Movement, MovementType, MovementOrigin, MovementState } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';
import { showSuccess, showError } from '../../../../services/toastService';
import ImportModal from './ImportModal';
import NewMovementModal from './NewMovementModal';

// Date filter options
const DATE_FILTERS = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'custom', label: 'Personalizado' }
];

const MovimientosV1: React.FC = () => {
  // Core state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters state
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [excludePersonal, setExcludePersonal] = useState(false);
  const [dateFilter, setDateFilter] = useState('30d');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<MovementState | 'Todos'>('Todos');
  const [typeFilter, setTypeFilter] = useState<MovementType | 'Todos'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [showNewMovementModal, setShowNewMovementModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedMovements, setSelectedMovements] = useState<number[]>([]);
  
  const ITEMS_PER_PAGE = 50;

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
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
      
      // Ensure movements have required V1.0 fields with defaults
      const enhancedMovements = horizonMovements.map(mov => ({
        ...mov,
        type: mov.type || (mov.amount > 0 ? 'Ingreso' : 'Gasto') as MovementType,
        origin: mov.origin || 'Manual' as MovementOrigin,
        movementState: mov.movementState || 'Confirmado' as MovementState,
        category: mov.category || '',
        tags: mov.tags || [],
        isAutoTagged: mov.isAutoTagged || false
      }));
      
      setMovements(enhancedMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      
    } catch (error) {
      console.error('Error loading treasury data:', error);
      showError('Error al cargar los datos de tesorería');
    } finally {
      setLoading(false);
    }
  };

  // Filter movements
  const filteredMovements = useCallback(() => {
    let filtered = movements;

    // Account filter
    if (selectedAccounts.length > 0) {
      filtered = filtered.filter(mov => selectedAccounts.includes(mov.accountId));
    }

    // Exclude personal accounts
    if (excludePersonal) {
      const personalAccountIds = accounts
        .filter(acc => acc.usage_scope === 'personal')
        .map(acc => acc.id!);
      filtered = filtered.filter(mov => !personalAccountIds.includes(mov.accountId));
    }

    // Date filter
    const now = new Date();
    let dateFrom: Date | null = null;
    
    switch (dateFilter) {
      case 'today':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case '7d':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (customDateFrom) dateFrom = new Date(customDateFrom);
        break;
    }

    if (dateFrom) {
      filtered = filtered.filter(mov => new Date(mov.date) >= dateFrom!);
    }

    if (dateFilter === 'custom' && customDateTo) {
      const dateTo = new Date(customDateTo);
      filtered = filtered.filter(mov => new Date(mov.date) <= dateTo);
    }

    // Status filter
    if (statusFilter !== 'Todos') {
      filtered = filtered.filter(mov => mov.movementState === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'Todos') {
      filtered = filtered.filter(mov => mov.type === typeFilter);
    }

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(mov => 
        mov.description.toLowerCase().includes(search) ||
        mov.counterparty?.toLowerCase().includes(search) ||
        mov.category?.toLowerCase().includes(search) ||
        mov.tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }

    return filtered;
  }, [movements, selectedAccounts, excludePersonal, dateFilter, customDateFrom, customDateTo, statusFilter, typeFilter, searchTerm, accounts]);

  const filteredMovs = filteredMovements();
  const totalPages = Math.ceil(filteredMovs.length / ITEMS_PER_PAGE);
  const paginatedMovements = filteredMovs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Quick actions handlers
  const handleQuickOK = async (movement: Movement) => {
    if (movement.movementState === 'Previsto') {
      try {
        const db = await initDB();
        const updatedMovement = {
          ...movement,
          movementState: 'Confirmado' as MovementState,
          date: movement.date, // Keep original date or set to today if future
          changeReason: 'user_ok' as const,
          updatedAt: new Date().toISOString()
        };
        
        await db.put('movements', updatedMovement);
        await loadData();
        showSuccess('Movimiento marcado como confirmado');
      } catch (error) {
        showError('Error al actualizar el movimiento');
      }
    }
  };

  const handleBulkOK = async () => {
    const pendingMovements = selectedMovements
      .map(id => movements.find(m => m.id === id))
      .filter(m => m && m.movementState === 'Previsto');

    if (pendingMovements.length === 0) {
      showError('No hay movimientos previstos seleccionados');
      return;
    }

    try {
      const db = await initDB();
      for (const movement of pendingMovements) {
        if (movement) {
          const updatedMovement = {
            ...movement,
            movementState: 'Confirmado' as MovementState,
            changeReason: 'bulk_ok' as const,
            updatedAt: new Date().toISOString()
          };
          await db.put('movements', updatedMovement);
        }
      }
      
      setSelectedMovements([]);
      await loadData();
      showSuccess(`${pendingMovements.length} movimientos marcados como confirmados`);
    } catch (error) {
      showError('Error al actualizar los movimientos');
    }
  };

  // Account selection helpers
  const getAccountInfo = (accountId: number) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? {
      name: account.name,
      bank: account.bank,
      logo: account.logo_url || '/placeholder-bank.png'
    } : { name: 'Cuenta desconocida', bank: '', logo: '/placeholder-bank.png' };
  };

  // Totals calculation
  const totals = {
    ingresos: filteredMovs.filter(m => m.amount > 0).reduce((sum, m) => sum + m.amount, 0),
    gastos: filteredMovs.filter(m => m.amount < 0).reduce((sum, m) => sum + Math.abs(m.amount), 0),
    neto: filteredMovs.reduce((sum, m) => sum + m.amount, 0)
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-hz-bg">
        <div className="flex items-center justify-center h-64">
          <div className="text-hz-text">Cargando movimientos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hz-bg">
      {/* Fixed Header */}
      <div className="bg-white border-b border-hz-neutral-300 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-hz-primary-dark">Movimientos</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowNewMovementModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-hz-primary-dark text-white rounded-lg hover:bg-opacity-90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nuevo movimiento
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-hz-primary-dark text-hz-primary-dark rounded-lg hover:bg-hz-primary-dark hover:text-white transition-colors"
              >
                <Upload className="w-4 h-4" />
                Importar extracto
              </button>
            </div>
          </div>

          {/* Compact Filters - Single Line */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Account Multi-Select */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-hz-text">Cuenta:</label>
              <select
                multiple
                value={selectedAccounts.map(String)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map(option => Number(option.value));
                  setSelectedAccounts(selected);
                }}
                className="text-sm border border-hz-neutral-300 rounded px-2 py-1"
              >
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.bank})
                  </option>
                ))}
              </select>
            </div>

            {/* Exclude Personal Toggle */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={excludePersonal}
                onChange={(e) => setExcludePersonal(e.target.checked)}
                className="rounded border-hz-neutral-300"
              />
              Excluir personal
            </label>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-hz-text">Fecha:</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="text-sm border border-hz-neutral-300 rounded px-2 py-1"
              >
                {DATE_FILTERS.map(filter => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
              {dateFilter === 'custom' && (
                <>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="text-sm border border-hz-neutral-300 rounded px-2 py-1"
                  />
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="text-sm border border-hz-neutral-300 rounded px-2 py-1"
                  />
                </>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-hz-text">Estado:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as MovementState | 'Todos')}
                className="text-sm border border-hz-neutral-300 rounded px-2 py-1"
              >
                <option value="Todos">Todos</option>
                <option value="Previsto">Previsto</option>
                <option value="Confirmado">Confirmado</option>
                <option value="Conciliado">Conciliado</option>
                <option value="Revisar">Revisar</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-hz-text">Tipo:</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MovementType | 'Todos')}
                className="text-sm border border-hz-neutral-300 rounded px-2 py-1"
              >
                <option value="Todos">Todos</option>
                <option value="Ingreso">Ingreso</option>
                <option value="Gasto">Gasto</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Ajuste">Ajuste</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search className="w-4 h-4 text-hz-neutral-500" />
              <input
                type="text"
                placeholder="Buscar en descripción, contrapartida, categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 text-sm border border-hz-neutral-300 rounded px-3 py-1 min-w-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedMovements.length > 0 && (
        <div className="bg-hz-primary-dark text-white px-6 py-3 flex items-center justify-between">
          <span className="text-sm">
            {selectedMovements.length} movimiento(s) seleccionado(s)
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBulkOK}
              className="flex items-center gap-2 px-3 py-1 bg-white text-hz-primary-dark rounded hover:bg-gray-100 transition-colors"
            >
              <Check className="w-4 h-4" />
              Marcar como OK
            </button>
            <button
              onClick={() => setSelectedMovements([])}
              className="flex items-center gap-2 px-3 py-1 border border-white rounded hover:bg-white hover:text-hz-primary-dark transition-colors"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-6">
        {/* Movements Table */}
        <div className="bg-white rounded-lg border border-hz-neutral-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hz-neutral-100 border-b border-hz-neutral-300">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedMovements.length === paginatedMovements.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMovements(paginatedMovements.map(m => m.id!));
                        } else {
                          setSelectedMovements([]);
                        }
                      }}
                      className="rounded border-hz-neutral-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-hz-text">OK</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-hz-text">Fecha valor</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-hz-text">Cuenta</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-hz-text">Descripción</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-hz-text">Importe</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-hz-text">Tipo</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-hz-text">Categoría</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-hz-text">Origen</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-hz-text">Estado</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-hz-text">Doc</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-hz-text">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hz-neutral-200">
                {paginatedMovements.map((movement) => {
                  const accountInfo = getAccountInfo(movement.accountId);
                  const isSelected = selectedMovements.includes(movement.id!);
                  
                  return (
                    <tr 
                      key={movement.id}
                      className={`hover:bg-hz-neutral-50 ${isSelected ? 'bg-hz-primary-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMovements(prev => [...prev, movement.id!]);
                            } else {
                              setSelectedMovements(prev => prev.filter(id => id !== movement.id));
                            }
                          }}
                          className="rounded border-hz-neutral-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {movement.movementState === 'Previsto' ? (
                          <button
                            onClick={() => handleQuickOK(movement)}
                            className="flex items-center justify-center w-6 h-6 border-2 border-hz-success rounded hover:bg-hz-success hover:text-white transition-colors"
                            title="Marcar como realizado"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="flex items-center justify-center w-6 h-6">
                            <Check className="w-4 h-4 text-hz-success" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-hz-text">
                        {new Date(movement.date).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <img 
                            src={accountInfo.logo} 
                            alt={accountInfo.bank}
                            className="w-6 h-6 rounded"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder-bank.png';
                            }}
                          />
                          <span className="text-sm text-hz-text truncate">
                            {accountInfo.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-hz-text">
                          {movement.description}
                          {movement.tags && movement.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {movement.tags.map((tag, index) => (
                                <span 
                                  key={index}
                                  className="inline-block px-2 py-0.5 text-xs bg-hz-neutral-100 text-hz-neutral-700 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                              {movement.isAutoTagged && (
                                <span className="inline-block px-2 py-0.5 text-xs bg-hz-info text-white rounded">
                                  auto
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${
                          movement.amount >= 0 ? 'text-hz-success' : 'text-hz-error'
                        }`}>
                          {formatEuro(movement.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-hz-text">
                        {movement.type}
                      </td>
                      <td className="px-4 py-3 text-sm text-hz-text">
                        {movement.category || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-hz-text">
                        {movement.origin}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          movement.movementState === 'Conciliado' ? 'bg-hz-success text-white' :
                          movement.movementState === 'Confirmado' ? 'bg-hz-info text-white' :
                          movement.movementState === 'Previsto' ? 'bg-hz-warning text-white' :
                          'bg-hz-error text-white'
                        }`}>
                          {movement.movementState}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {movement.attachedDocumentId ? (
                          <button
                            onClick={() => {
                              // TODO: Implement document preview
                              console.log('Preview document:', movement.attachedDocumentId);
                            }}
                            className="text-hz-primary hover:text-hz-primary-dark"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              // TODO: Implement edit functionality
                              console.log('Edit movement:', movement);
                            }}
                            className="text-hz-primary hover:text-hz-primary-dark"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('¿Estás seguro de que quieres eliminar este movimiento?')) {
                                // TODO: Implement delete
                              }
                            }}
                            className="text-hz-error hover:text-red-700"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-hz-neutral-300 flex items-center justify-between">
              <div className="text-sm text-hz-neutral-500">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredMovs.length)} de {filteredMovs.length} movimientos
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-hz-neutral-300 rounded hover:bg-hz-neutral-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm text-hz-text">
                  {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-hz-neutral-300 rounded hover:bg-hz-neutral-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary Totals */}
        {filteredMovs.length > 0 && (
          <div className="mt-6 bg-hz-neutral-100 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-hz-success">
                  {formatEuro(totals.ingresos)}
                </div>
                <div className="text-sm text-hz-neutral-700">Ingresos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-hz-error">
                  {formatEuro(totals.gastos)}
                </div>
                <div className="text-sm text-hz-neutral-700">Gastos</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${
                  totals.neto >= 0 ? 'text-hz-success' : 'text-hz-error'
                }`}>
                  {formatEuro(totals.neto)}
                </div>
                <div className="text-sm text-hz-neutral-700">Neto</div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredMovs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-hz-neutral-500 mb-4">
              No se encontraron movimientos con los filtros aplicados
            </div>
            <button
              onClick={() => {
                setSelectedAccounts([]);
                setExcludePersonal(false);
                setDateFilter('30d');
                setStatusFilter('Todos');
                setTypeFilter('Todos');
                setSearchTerm('');
              }}
              className="text-hz-primary hover:text-hz-primary-dark"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewMovementModal
        isOpen={showNewMovementModal}
        onClose={() => setShowNewMovementModal(false)}
        accounts={accounts}
        onMovementCreated={loadData}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        accounts={accounts}
        onImportComplete={loadData}
      />
    </div>
  );
};

export default MovimientosV1;