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
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { initDB, Account, Movement, MovementType, MovementOrigin, MovementState } from '../../../../services/db';
import { formatEuro } from '../../../../services/aeatClassificationService';
import { showSuccess, showError } from '../../../../services/toastService';
import { treasuryAPI } from '../../../../services/treasuryApiService';
import ImportModal from './ImportModal';
import NewMovementModal from './NewMovementModal';
// FIX PACK v1.0: Import new utilities
import { 
  MovementFilters, 
  loadFiltersFromStorage, 
  saveFiltersToStorage, 
  resetFiltersToDefaults, 
  getDateRangeBounds,
  formatDateForDisplay,
  logFilterApplication
} from '../../../../utils/movementFilters';
import { 
  sortAccountsByTypeAndAlias, 
  getActiveAccounts, 
  getAccountDisplayName,
  logAccountLoading
} from '../../../../utils/accountUtils';
// FIX PACK v1.0: Import analytics utilities
import { 
  trackEmptyState, 
  trackFilterAction, 
  trackFilterUsage,
  trackCacheInvalidation
} from '../../../../utils/treasuryAnalytics';

// FIX PACK v1.0: Updated date filter options per requirements
const DATE_FILTERS = [
  { value: 'last90days', label: 'Últimos 90 días' },
  { value: 'thismonth', label: 'Este mes' },
  { value: 'last30days', label: 'Últimos 30 días' },
  { value: 'custom', label: 'Personalizado' }
];

const MovimientosV1: React.FC = () => {
  // Core state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // FIX PACK v1.0: Use centralized filter state with localStorage persistence
  const [filters, setFilters] = useState<MovementFilters>(() => loadFiltersFromStorage());
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [showNewMovementModal, setShowNewMovementModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedMovements, setSelectedMovements] = useState<number[]>([]);
  
  const ITEMS_PER_PAGE = 50;

  // FIX PACK v1.0: Save filters to localStorage whenever they change
  useEffect(() => {
    saveFiltersToStorage(filters);
  }, [filters]);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // FIX PACK v1.0: Track cache invalidation
      trackCacheInvalidation('manual_refresh');
      
      // FIX PACK v1.0: Load only active accounts from treasury API
      const allAccounts = await treasuryAPI.accounts.getAccounts(false); // Only active accounts
      const horizonAccounts = allAccounts.filter(acc => acc.destination === 'horizon');
      
      // FIX PACK v1.0: Sort accounts by type and alias
      const sortedAccounts = sortAccountsByTypeAndAlias(getActiveAccounts(horizonAccounts));
      setAccounts(sortedAccounts);
      
      // FIX PACK v1.0: Log account loading for debugging
      logAccountLoading(sortedAccounts, false);
      
      // Load movements for Horizon accounts
      const db = await initDB();
      const allMovements = await db.getAll('movements');
      const horizonMovements = allMovements.filter(mov => 
        sortedAccounts.some(acc => acc.id === mov.accountId)
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
      setLastUpdated(new Date()); // Set timestamp after data is loaded
    }
  }, []); // Remove includeInactive dependency

  useEffect(() => {
    loadData();
  }, [loadData]);

  // FIX PACK v1.0: Filter movements using centralized filter logic with UTC date handling
  const filteredMovements = useCallback(() => {
    let filtered = movements;

    // Account filter - FIX PACK v1.0: Handle "all" option
    if (filters.accountId !== 'all') {
      filtered = filtered.filter(mov => mov.accountId === filters.accountId);
    }

    // Exclude personal accounts
    if (filters.excludePersonal) {
      const personalAccountIds = accounts
        .filter(acc => acc.usage_scope === 'personal')
        .map(acc => acc.id!);
      filtered = filtered.filter(mov => !personalAccountIds.includes(mov.accountId));
    }

    // FIX PACK v1.0: Date filter with UTC handling
    const { fromDate, toDate } = getDateRangeBounds(
      filters.dateRange, 
      filters.customDateFrom, 
      filters.customDateTo
    );

    if (fromDate) {
      filtered = filtered.filter(mov => {
        const movDate = new Date(mov.date);
        return movDate >= fromDate;
      });
    }

    if (toDate) {
      filtered = filtered.filter(mov => {
        const movDate = new Date(mov.date);
        return movDate <= toDate;
      });
    }

    // Status filter
    if (filters.status !== 'Todos') {
      filtered = filtered.filter(mov => mov.movementState === filters.status);
    }

    // Source filter (new for extracto imports)
    if (filters.source && filters.source !== 'Todos') {
      filtered = filtered.filter(mov => mov.origin === filters.source);
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

    // FIX PACK v1.0: Log filter application for debugging
    logFilterApplication(filters, filtered.length);
    
    // FIX PACK v1.0: Track filter usage analytics
    trackFilterUsage(filters, filtered.length);

    return filtered;
  }, [movements, filters, searchTerm, accounts]);

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
        
        // Optimistic update - update state directly instead of full reload
        setMovements(prev => prev.map(m => 
          m.id === movement.id ? updatedMovement : m
        ));
        
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
      const updatedMovements: Movement[] = [];
      
      for (const movement of pendingMovements) {
        if (movement) {
          const updatedMovement = {
            ...movement,
            movementState: 'Confirmado' as MovementState,
            changeReason: 'bulk_ok' as const,
            updatedAt: new Date().toISOString()
          };
          await db.put('movements', updatedMovement);
          updatedMovements.push(updatedMovement);
        }
      }
      
      // Optimistic update - update all affected movements in state
      setMovements(prev => prev.map(m => {
        const updated = updatedMovements.find(um => um.id === m.id);
        return updated || m;
      }));
      
      setSelectedMovements([]);
      showSuccess(`${pendingMovements.length} movimientos marcados como confirmados`);
    } catch (error) {
      showError('Error al actualizar los movimientos');
    }
  };

  // Delete movement handler
  const handleDeleteMovement = async (movement: Movement) => {
    try {
      const db = await initDB();
      await db.delete('movements', movement.id!);
      
      // Optimistic update - remove from state instead of full reload
      setMovements(prev => prev.filter(m => m.id !== movement.id));
      
      showSuccess('Movimiento eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting movement:', error);
      showError('Error al eliminar el movimiento');
    }
  };

  // Account selection helpers
  const getAccountInfo = (accountId: number) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? {
      name: account.name,
      bank: account.bank,
      logo: account.logo_url || '/placeholder-bank.png',
      isActive: account.isActive // FIX PACK v2.0: Include active status
    } : { name: 'Cuenta desconocida', bank: '', logo: '/placeholder-bank.png', isActive: false };
  };

  // FIX PACK v1.0: Helper to update individual filter properties with analytics
  const updateFilter = useCallback((key: keyof MovementFilters, value: any, ctaType?: string) => {
    const previousFilters = { ...filters };
    const newFilters = { ...filters, [key]: value };
    
    setFilters(newFilters);
    
    // Track analytics for CTA clicks
    if (ctaType) {
      trackFilterAction({
        action: 'cta_click',
        ctaType: ctaType as any,
        previousFilters,
        newFilters
      });
    } else {
      trackFilterAction({
        action: 'filter_change',
        previousFilters,
        newFilters
      });
    }
  }, [filters]);

  // Handle URL query parameters for Inbox integration
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sourceParam = urlParams.get('source');
    const uploadedAtParam = urlParams.get('uploaded_at');
    
    if (sourceParam === 'extracto') {
      // Set filter to show only CSV (extracto) imports
      updateFilter('source', 'CSV');
      
      if (uploadedAtParam === 'today') {
        // Set date filter to today
        const today = new Date().toISOString().split('T')[0];
        updateFilter('dateRange', 'custom');
        updateFilter('customDateFrom', today);
        updateFilter('customDateTo', today);
      }
      
      // Clear URL parameters after applying filters
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [updateFilter]);

  // FIX PACK v1.0: Reset filters to defaults with analytics
  const handleResetFilters = () => {
    const previousFilters = { ...filters };
    const defaultFilters = resetFiltersToDefaults();
    
    setFilters(defaultFilters);
    setSearchTerm('');
    setCurrentPage(1);
    
    // Track analytics
    trackFilterAction({
      action: 'filter_reset',
      ctaType: 'reset_filters',
      previousFilters
    });
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-hz-primary-dark">Movimientos</h1>
              {lastUpdated && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  Datos actualizados {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
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

          {/* FIX PACK v1.0: Updated Filters - Using chip/selector approach */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Account Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-hz-text">Cuenta:</label>
              <select
                value={filters.accountId}
                onChange={(e) => {
                  const value = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  updateFilter('accountId', value);
                }}
                className="text-sm border border-hz-neutral-300 rounded px-2 py-1 min-w-[200px]"
              >
                <option value="all">Todas las cuentas</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {getAccountDisplayName(account)}
                  </option>
                ))}
              </select>
            </div>

            {/* Exclude Personal Toggle */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.excludePersonal}
                onChange={(e) => updateFilter('excludePersonal', e.target.checked)}
                className="rounded border-hz-neutral-300"
              />
              Excluir personal
            </label>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-hz-text">Fecha:</label>
              <select
                value={filters.dateRange}
                onChange={(e) => updateFilter('dateRange', e.target.value)}
                className="text-sm border border-hz-neutral-300 rounded px-2 py-1"
              >
                {DATE_FILTERS.map(filter => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
              {filters.dateRange === 'custom' && (
                <>
                  <input
                    type="date"
                    value={filters.customDateFrom}
                    onChange={(e) => updateFilter('customDateFrom', e.target.value)}
                    className="text-sm border border-hz-neutral-300 rounded px-2 py-1"
                  />
                  <input
                    type="date"
                    value={filters.customDateTo}
                    onChange={(e) => updateFilter('customDateTo', e.target.value)}
                    className="text-sm border border-hz-neutral-300 rounded px-2 py-1"
                  />
                </>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-hz-text">Estado:</label>
              <select
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value as MovementState | 'Todos')}
                className="text-sm border border-hz-neutral-300 rounded px-2 py-1"
              >
                <option value="Todos">Todos</option>
                <option value="Previsto">Previsto</option>
                <option value="Confirmado">Confirmado</option>
                <option value="Conciliado">Conciliado</option>
                <option value="Revisar">Revisar</option>
              </select>
            </div>

            {/* Source Filter - NEW for extracto imports */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-hz-text">Origen:</label>
              <select
                value={filters.source || 'Todos'}
                onChange={(e) => updateFilter('source', e.target.value as MovementOrigin | 'Todos')}
                className="text-sm border border-hz-neutral-300 rounded px-2 py-1"
              >
                <option value="Todos">Todos</option>
                <option value="OCR">OCR</option>
                <option value="CSV">Extracto</option>
                <option value="Manual">Manual</option>
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

            {/* Reset Filters Button */}
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-2 px-3 py-1 text-sm border border-hz-neutral-300 rounded hover:bg-hz-neutral-50 transition-colors"
              title="Restablecer filtros"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* FIX PACK v1.0: Remove banner for inactive accounts - we only show active accounts now */}

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
                        {formatDateForDisplay(movement.date)}
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
                                handleDeleteMovement(movement);
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

        {/* FIX PACK v1.0: Smart Empty State with detected causes and CTAs */}
        {filteredMovs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-hz-neutral-500 mb-6">
              No se encontraron movimientos con los filtros aplicados
            </div>
            
            {/* FIX PACK v1.0: Track empty state analytics */}
            {(() => {
              trackEmptyState({
                filters,
                searchTerm,
                totalMovements: movements.length,
                filteredMovements: 0,
                activeAccounts: accounts.length,
                timestamp: new Date().toISOString()
              });
              return null;
            })()}
            
            {/* Smart CTAs based on current filters */}
            <div className="space-y-3">
              {filters.accountId !== 'all' && (
                <button
                  onClick={() => updateFilter('accountId', 'all', 'show_all_accounts')}
                  className="block mx-auto px-4 py-2 bg-hz-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
                >
                  Cambiar a 'Todas las cuentas'
                </button>
              )}
              
              {filters.dateRange !== 'last90days' && (
                <button
                  onClick={() => updateFilter('dateRange', 'last90days', 'show_last_90_days')}
                  className="block mx-auto px-4 py-2 bg-hz-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
                >
                  Mostrar 'Últimos 90 días'
                </button>
              )}
              
              {filters.status !== 'Todos' && (
                <button
                  onClick={() => updateFilter('status', 'Todos', 'show_all_states')}
                  className="block mx-auto px-4 py-2 bg-hz-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
                >
                  Mostrar 'Todos' los estados
                </button>
              )}
              
              <button
                onClick={handleResetFilters}
                className="block mx-auto px-4 py-2 border border-hz-primary text-hz-primary rounded-lg hover:bg-hz-primary hover:text-white transition-colors"
              >
                Restablecer filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewMovementModal
        isOpen={showNewMovementModal}
        onClose={() => setShowNewMovementModal(false)}
        accounts={accounts}
        onMovementCreated={(newMovement) => {
          // Optimistic update - add new movement to state without full reload
          if (newMovement) {
            // Ensure the movement has required V1.0 fields
            const enhancedMovement = {
              ...newMovement,
              type: newMovement.type || (newMovement.amount > 0 ? 'Ingreso' : 'Gasto') as MovementType,
              origin: newMovement.origin || 'Manual' as MovementOrigin,
              movementState: newMovement.movementState || 'Previsto' as MovementState,
              category: newMovement.category || '',
              tags: newMovement.tags || [],
              isAutoTagged: newMovement.isAutoTagged || false
            };
            
            // Add to movements state and re-sort
            setMovements(prev => {
              const updated = [...prev, enhancedMovement];
              return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });
          } else {
            // Fallback to full reload if no movement provided
            loadData();
          }
          setShowNewMovementModal(false);
        }}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        accounts={accounts}
        onImportComplete={() => {
          // FIX PACK v1.0: Track cache invalidation and optimistic insertion
          trackCacheInvalidation('import_complete');
          loadData();
        }}
      />
    </div>
  );
};

export default MovimientosV1;