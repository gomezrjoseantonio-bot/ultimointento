import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Search, 
  Filter,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/common/PageHeader';
import ImportStatementModal from './components/ImportStatementModal';
import NewTransferModal from './components/NewTransferModal';
import { 
  UnifiedAccount, 
  UnifiedMovement, 
  TreasuryFilters, 
  AccountTimeline,
  TimelineDay,
  Transfer,
  QuickAction,
  ImportResult
} from '../../../types/unifiedTreasury';
import { formatEuro } from '../../../services/aeatClassificationService';

const UnifiedTreasury: React.FC = () => {
  // State management
  const [accounts, setAccounts] = useState<UnifiedAccount[]>([]);
  const [expandedAccount, setExpandedAccount] = useState<number | null>(null);
  const [accountTimeline, setAccountTimeline] = useState<AccountTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [filters, setFilters] = useState<TreasuryFilters>({
    monthYear: new Date().toISOString().slice(0, 7), // Current month YYYY-MM
    excludePersonal: false,
    status: 'todos',
    search: ''
  });

  // Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Load accounts and apply filters
  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      // Import the treasury API service
      const { treasuryAPI } = await import('../../../services/treasuryApiService');
      
      // Load real accounts from database using the same API as Configuration module
      const dbAccounts = await treasuryAPI.accounts.getAccounts(false); // Only active accounts
      const horizonAccounts = dbAccounts.filter(acc => acc.destination === 'horizon');
      
      // Convert DB accounts to UnifiedAccount format
      const unifiedAccounts: UnifiedAccount[] = horizonAccounts.map(acc => ({
        id: acc.id!,
        name: acc.name || `Cuenta ${acc.bank}`,
        bank: acc.bank,
        iban: acc.iban,
        balance: acc.balance,
        openingBalance: acc.openingBalance,
        currency: acc.currency,
        destination: acc.destination,
        usage_scope: acc.usage_scope || 'mixto',
        status: acc.isActive ? 'activa' : 'desactivada',
        currentBalance: acc.balance,
        nextEvent: undefined, // Will be populated by separate logic
        riskLevel: acc.balance < (acc.minimumBalance || 0) ? 'rojo' : 'verde',
        projectedBalance: acc.balance, // Simplified for now
        monthlyMinBalance: acc.minimumBalance || 0,
        includeInConsolidated: acc.includeInConsolidated ?? true,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt
      }));
      
      setAccounts(unifiedAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Error al cargar las cuentas');
      // Fallback to empty array instead of mock data
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Handle account expansion
  const handleAccountClick = async (accountId: number) => {
    if (expandedAccount === accountId) {
      setExpandedAccount(null);
      setAccountTimeline(null);
      return;
    }

    setExpandedAccount(accountId);
    
    // Load timeline for the account
    try {
      // TODO: Replace with actual API call
      const mockTimeline: AccountTimeline = {
        account: accounts.find(a => a.id === accountId)!,
        days: generateMockTimelineDays(),
        monthProjection: {
          projectedBalance: 16270.50,
          minBalance: 12100.00,
          needsTransfer: false,
          transferRecommendation: undefined
        }
      };
      
      setAccountTimeline(mockTimeline);
    } catch (error) {
      console.error('Error loading account timeline:', error);
    }
  };

  // Generate mock timeline data
  const generateMockTimelineDays = (): TimelineDay[] => {
    const days: TimelineDay[] = [];
    const currentDate = new Date();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateStr = date.toISOString().split('T')[0];
      
      days.push({
        date: dateStr,
        movements: generateMockMovements(date),
        dailyBalance: 15000 + (Math.random() - 0.5) * 2000,
        isToday: day === currentDate.getDate(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      });
    }
    
    return days;
  };

  // Generate mock movements for a day
  const generateMockMovements = (date: Date): UnifiedMovement[] => {
    if (Math.random() > 0.3) return []; // 70% chance of no movements
    
    const movements: UnifiedMovement[] = [];
    const numMovements = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numMovements; i++) {
      const isIncome = Math.random() > 0.6;
      const amount = Math.random() * 500 + 50;
      
      movements.push({
        id: Math.floor(Math.random() * 10000),
        accountId: 1,
        date: date.toISOString().split('T')[0],
        amount: isIncome ? amount : -amount,
        description: isIncome ? 'Ingreso alquiler' : 'Gasto suministros',
        counterparty: isIncome ? 'Inquilino H1' : 'Iberdrola',
        status: 'pendiente',
        type: isIncome ? 'Ingreso' : 'Gasto',
        origin: 'Manual',
        movementState: Math.random() > 0.5 ? 'Previsto' : 'Confirmado',
        unifiedStatus: Math.random() > 0.5 ? 'previsto' : 'confirmado',
        sign: isIncome ? '+' : '-',
        canConfirm: Math.random() > 0.5,
        canEdit: true,
        canDelete: true,
        canReclassify: Math.random() > 0.7,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    return movements;
  };

  // Render movement chip with appropriate styling
  const renderMovementChip = (movement: UnifiedMovement) => {
    const getChipStyle = () => {
      switch (movement.unifiedStatus) {
        case 'previsto':
          return movement.sign === '+' 
            ? 'bg-success-100 text-success-800 border-success-200' // Green for forecast income
            : 'bg-error-100 text-error-800 border-error-200';      // Red for forecast expense
        case 'confirmado':
          return 'bg-hz-info/10 text-hz-info border-hz-info/20';   // Blue for confirmed
        case 'vencido':
          return 'bg-warning-100 text-warning-800 border-warning-200'; // Amber for overdue
        case 'no_planificado':
          return 'bg-gray-100 text-gray-700 border-gray-200';     // Gray for unplanned
        default:
          return 'bg-gray-100 text-gray-700 border-gray-200';
      }
    };

    const getChipIcon = () => {
      switch (movement.unifiedStatus) {
        case 'previsto':
          return <Clock className="h-3 w-3" />;
        case 'confirmado':
          return <CheckCircle className="h-3 w-3" />;
        case 'vencido':
          return <AlertTriangle className="h-3 w-3" />;
        case 'no_planificado':
          return <AlertCircle className="h-3 w-3" />;
        default:
          return null;
      }
    };

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${getChipStyle()}`}>
        {getChipIcon()}
        <span className="truncate max-w-32">
          {movement.counterparty || movement.description}
        </span>
        <span className="font-semibold">
          {movement.sign}{formatEuro(Math.abs(movement.amount))}
        </span>
        
        {/* Quick action buttons */}
        <div className="flex items-center gap-1 ml-2">
          {movement.canConfirm && movement.unifiedStatus === 'previsto' && (
            <button 
              className="text-success-600 hover:text-success-800"
              onClick={() => handleQuickAction('confirm', movement)}
              title="Confirmar"
            >
              <CheckCircle className="h-3 w-3" />
            </button>
          )}
          {movement.canReclassify && (
            <button 
              className="text-gray-500 hover:text-gray-700"
              onClick={() => handleQuickAction('reclassify', movement)}
              title="Reclasificar"
            >
              <Filter className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Handle quick actions on movement chips
  const handleQuickAction = (action: QuickAction, movement: UnifiedMovement) => {
    console.log(`Quick action: ${action} on movement ${movement.id}`);
    // TODO: Implement actual quick action logic
    
    switch (action) {
      case 'confirm':
        toast.success('Movimiento confirmado');
        break;
      case 'reclassify':
        toast.success('Clasificación actualizada');
        break;
      case 'edit':
        toast.success('Movimiento editado');
        break;
      case 'delete':
        toast.success('Movimiento eliminado');
        break;
    }
  };

  // Handle import completion
  const handleImportComplete = (result: ImportResult) => {
    toast.success(
      `Importados ${result.totalLines} movimientos (${result.confirmedMovements} confirmados, ${result.unplannedMovements} no planificados, ${result.detectedTransfers} transferencias detectadas)`
    );
    loadAccounts(); // Reload accounts after import
  };

  // Handle transfer creation
  const handleTransferCreated = (transfer: Transfer) => {
    toast.success(`Transferencia de ${formatEuro(transfer.amount)} creada correctamente`);
    loadAccounts(); // Reload accounts after transfer creation
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--hz-bg)' }}>
      {/* Page Header */}
      <PageHeader
        title="Tesorería"
        subtitle="Vista unificada de cuentas, movimientos y previsiones"
        primaryAction={{
          label: "Importar extracto",
          onClick: () => setShowImportModal(true)
        }}
        secondaryActions={[
          {
            label: "Nueva transferencia",
            onClick: () => setShowTransferModal(true)
          }
        ]}
      />

      {/* Filter Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Month/Year Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input
                type="month"
                value={filters.monthYear}
                onChange={(e) => setFilters(prev => ({ ...prev, monthYear: e.target.value }))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-hz-primary focus:border-transparent"
              />
            </div>

            {/* Exclude Personal Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.excludePersonal}
                onChange={(e) => setFilters(prev => ({ ...prev, excludePersonal: e.target.checked }))}
                className="w-4 h-4 text-hz-primary bg-gray-100 border-gray-300 rounded focus:ring-hz-primary focus:ring-2"
              />
              <span className="text-sm text-gray-700">Excluir personal</span>
              {filters.excludePersonal ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
            </label>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-hz-primary focus:border-transparent"
            >
              <option value="todos">Todos los estados</option>
              <option value="previsto">Previsto</option>
              <option value="confirmado">Confirmado</option>
              <option value="vencido">Vencido</option>
              <option value="no_planificado">No planificado</option>
            </select>

            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar cuenta, proveedor, concepto..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-hz-primary focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="p-6">
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-hz-primary border-t-transparent"></div>
              <span className="ml-2 text-gray-600">Cargando cuentas...</span>
            </div>
          ) : (
            accounts.map((account) => (
              <div key={account.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Account Card Header */}
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleAccountClick(account.id!)}
                >
                  <div className="flex items-center justify-between">
                    {/* Account Info */}
                    <div className="flex items-center gap-4">
                      {/* Bank Logo Placeholder */}
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">{account.bank}</span>
                      </div>
                      
                      {/* Account Details */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{account.name}</h3>
                          {expandedAccount === account.id ? 
                            <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          }
                        </div>
                        <p className="text-sm text-gray-500">
                          {account.iban ? `***${account.iban.slice(-4)}` : 'Sin IBAN'}
                        </p>
                      </div>
                    </div>

                    {/* Current Balance */}
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatEuro(account.currentBalance)}
                      </div>
                      {account.nextEvent && (
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          {account.nextEvent.type === 'income' ? 
                            <TrendingUp className="h-3 w-3 text-success-500" /> : 
                            <TrendingDown className="h-3 w-3 text-error-500" />
                          }
                          <span>{account.nextEvent.concept}</span>
                          <span className="font-medium">
                            {account.nextEvent.type === 'income' ? '+' : ''}
                            {formatEuro(account.nextEvent.amount)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Risk Semaphore */}
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        account.riskLevel === 'verde' ? 'bg-success-500' :
                        account.riskLevel === 'ambar' ? 'bg-warning-500' : 'bg-error-500'
                      }`}></div>
                      
                      {/* Three-dot menu */}
                      <button 
                        className="p-1 text-gray-400 hover:text-gray-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Show dropdown menu
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Timeline */}
                {expandedAccount === account.id && accountTimeline && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="space-y-4">
                      {/* Timeline Days */}
                      {accountTimeline.days.map((day) => (
                        <div key={day.date} className={`p-4 rounded-lg ${
                          day.isToday ? 'bg-hz-primary/5 border border-hz-primary/20' : 'bg-white'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {new Date(day.date).toLocaleDateString('es-ES', { 
                                  weekday: 'short', 
                                  day: 'numeric',
                                  month: 'short' 
                                })}
                              </span>
                              {day.isToday && (
                                <span className="px-2 py-0.5 bg-hz-primary text-white text-xs rounded-full">
                                  Hoy
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-600">
                              Saldo: {formatEuro(day.dailyBalance)}
                            </span>
                          </div>
                          
                          {/* Movement Chips */}
                          {day.movements.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {day.movements.map((movement) => renderMovementChip(movement))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">Sin movimientos</p>
                          )}
                        </div>
                      ))}

                      {/* Month Projection Summary */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">Proyección del mes</h4>
                            <p className="text-sm text-gray-600">
                              Saldo proyectado: <span className="font-medium">{formatEuro(accountTimeline.monthProjection.projectedBalance)}</span>
                              {' · '}
                              Mínimo: <span className="font-medium">{formatEuro(accountTimeline.monthProjection.minBalance)}</span>
                            </p>
                          </div>
                          
                          {accountTimeline.monthProjection.needsTransfer && accountTimeline.monthProjection.transferRecommendation && (
                            <div className="text-right">
                              <div className="text-sm text-warning-700 mb-1">
                                ↔ Transferir {formatEuro(accountTimeline.monthProjection.transferRecommendation.amount)}
                              </div>
                              <div className="text-xs text-gray-600">
                                desde {accountTimeline.monthProjection.transferRecommendation.fromAccount} antes del{' '}
                                {new Date(accountTimeline.monthProjection.transferRecommendation.beforeDate).toLocaleDateString('es-ES')}
                              </div>
                              <button className="mt-1 px-3 py-1 bg-hz-primary text-white text-xs rounded-lg hover:bg-hz-primary-dark">
                                Crear transferencia
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <ImportStatementModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
      />
      
      <NewTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onTransferCreated={handleTransferCreated}
      />

      {/* TODO: Add NewMovementModal when implemented */}
    </div>
  );
};

export default UnifiedTreasury;