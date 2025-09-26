import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { initDB, Account, TreasuryEvent } from '../../../../services/db';
import { getTreasuryProjections } from '../../../../services/treasuryForecastService';
import { formatEuro } from '../../../../services/aeatClassificationService';

// Event status types according to specification
type EventStatus = 'programado' | 'confirmado' | 'riesgo' | 'alerta';

// Event category types according to specification
type EventCategory = 'Renta' | 'Hipoteca' | 'Suministros' | 'IBI' | 'Comunidad' | 'Seguros' | 'Reparación y Conservación' | 'Mobiliario' | 'Mejora' | 'Otros';

// Event scope types according to specification  
type EventScope = 'Inmuebles' | 'Personal';

// Event source types according to specification
type EventSource = 'Presupuesto' | 'Contrato' | 'Préstamo' | 'Factura OCR' | 'Movimiento esperado' | 'Manual';

// Enhanced event interface for the timeline
interface RadarEvent {
  id: string;
  date: string; // dd/mm format
  concept: string;
  scope: EventScope;
  category: EventCategory;
  accountSource?: string; // cuenta de cargo/abono
  amount: number; // with sign
  balanceAfter: number; // running balance after this event
  source: EventSource;
  status: EventStatus;
  originalEvent: TreasuryEvent;
}

// Account data for Radar cards
interface RadarAccount {
  id: number;
  name: string;
  bank: string;
  ibanMasked: string; // **** **** **** 1234
  currentBalance: number;
  usage: 'Personal' | 'Inmuebles' | 'Mixta';
  upcomingIncome: number; // sum of income in period
  upcomingExpenses: number; // sum of expenses in period  
  projectedBalance: number; // balance at end of period
  events: RadarEvent[]; // timeline events for this account
  isExpanded: boolean; // UI state
}

// Helper functions moved outside component to avoid re-renders
const getAccountUsage = (account: Account): 'Personal' | 'Inmuebles' | 'Mixta' => {
  // Use the existing usage_scope field if available
  if (account.usage_scope) {
    switch (account.usage_scope) {
      case 'personal': return 'Personal';
      case 'inmuebles': return 'Inmuebles';
      case 'mixto': return 'Mixta';
      default: return 'Mixta';
    }
  }
  // Fallback logic based on destination
  if (account.destination === 'pulse') return 'Personal';
  if (account.destination === 'horizon') return 'Inmuebles';
  return 'Mixta';
};

const maskIban = (iban?: string): string => {
  if (!iban) return 'Sin IBAN';
  if (iban.length < 4) return iban;
  const lastFour = iban.slice(-4);
  return `**** **** **** ${lastFour}`;
};

const getEventStatus = (event: TreasuryEvent, balanceAfter: number): EventStatus => {
  const eventDate = new Date(event.predictedDate);
  const today = new Date();
  const daysDiff = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Check if confirmed (has actual movement)
  if (event.status === 'executed' || event.status === 'confirmed' || event.movementId) {
    return 'confirmado';
  }

  // Check for risk conditions
  if (event.type === 'income' && daysDiff <= 3 && event.status === 'predicted') {
    return 'riesgo';
  }

  // Check for alert (negative balance after event) - using balanceAfter parameter
  if (balanceAfter < 0) {
    return 'alerta';
  }

  // Check for risk (balance below minimum after event)
  const minimumBalance = 200; // Default minimum balance
  if (balanceAfter < minimumBalance) {
    return 'riesgo';
  }

  return 'programado';
};

const getStatusColor = (status: EventStatus): string => {
  switch (status) {
    case 'confirmado': return 'text-green-600';
    case 'riesgo': return 'text-yellow-600';
    case 'alerta': return 'text-red-600';
    case 'programado': return 'text-gray-500';
  }
};

const convertToRadarEvent = (event: TreasuryEvent, account: RadarAccount, balanceAfter: number): RadarEvent => {
  const eventDate = new Date(event.predictedDate);
  
  return {
    id: `${event.id}-${account.id}`,
    date: eventDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
    concept: event.description,
    scope: event.sourceType === 'contract' ? 'Inmuebles' : 'Personal', // Simplified logic
    category: 'Otros', // Simplified - would need more logic to determine category
    accountSource: event.accountId === account.id ? 'esta cuenta' : undefined,
    amount: event.type === 'income' ? event.amount : -event.amount,
    balanceAfter,
    source: event.sourceType === 'document' ? 'Factura OCR' : 
            event.sourceType === 'contract' ? 'Contrato' : 'Manual',
    status: getEventStatus(event, balanceAfter),
    originalEvent: event
  };
};

const Radar: React.FC = () => {
  const [radarAccounts, setRadarAccounts] = useState<RadarAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'hoy' | '30dias'>('hoy');
  const [excludePersonal, setExcludePersonal] = useState(() => {
    return localStorage.getItem('radar-exclude-personal') === 'true';
  });

  const loadRadarData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await initDB();
      
      // Load all active accounts
      const allAccounts = await db.getAll('accounts');
      const activeAccounts = allAccounts.filter(acc => acc.isActive);
      
      // Calculate period in days
      const periodDays = selectedPeriod === 'hoy' ? 1 : 30;
      
      // Get treasury events for the period
      const accountIds = activeAccounts.map(acc => acc.id!);
      const { events, accountBalances } = await getTreasuryProjections(periodDays, accountIds);
      
      // Process each account
      const processedAccounts: RadarAccount[] = [];
      
      for (const account of activeAccounts) {
        const accountEvents = events.filter(event => event.accountId === account.id);
        
        // Sort events by date
        accountEvents.sort((a, b) => new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime());
        
        // Calculate running balance
        let runningBalance = account.balance;
        const radarEvents: RadarEvent[] = [];
        
        for (const event of accountEvents) {
          runningBalance += event.type === 'income' ? event.amount : -event.amount;
          const radarEvent = convertToRadarEvent(event, {
            id: account.id!,
            name: account.name,
            bank: account.bank,
            ibanMasked: maskIban(account.iban),
            currentBalance: account.balance,
            usage: getAccountUsage(account),
            upcomingIncome: 0,
            upcomingExpenses: 0,
            projectedBalance: runningBalance,
            events: [],
            isExpanded: accountEvents.length > 0
          }, runningBalance);
          
          radarEvents.push(radarEvent);
        }
        
        // Calculate totals
        const upcomingIncome = accountEvents
          .filter(e => e.type === 'income')
          .reduce((sum, e) => sum + e.amount, 0);
        
        const upcomingExpenses = accountEvents
          .filter(e => e.type === 'expense')
          .reduce((sum, e) => sum + e.amount, 0);
        
        const projectedBalance = accountBalances.get(account.id!)?.projected || account.balance;
        
        const radarAccount: RadarAccount = {
          id: account.id!,
          name: account.name,
          bank: account.bank,
          ibanMasked: maskIban(account.iban),
          currentBalance: account.balance,
          usage: getAccountUsage(account),
          upcomingIncome,
          upcomingExpenses,
          projectedBalance,
          events: radarEvents,
          isExpanded: radarEvents.length > 0
        };
        
        processedAccounts.push(radarAccount);
      }
      
      setRadarAccounts(processedAccounts);
      
    } catch (error) {
      console.error('Error loading radar data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadRadarData();
  }, [selectedPeriod, loadRadarData]);

  // Handle personal accounts toggle
  const handleExcludePersonalToggle = useCallback(() => {
    const newValue = !excludePersonal;
    setExcludePersonal(newValue);
    localStorage.setItem('radar-exclude-personal', newValue.toString());
  }, [excludePersonal]);

  // Filter accounts based on personal exclusion setting
  const filteredAccounts = radarAccounts.filter(account => {
    if (!excludePersonal) return true;
    return account.usage !== 'Personal';
  });

  // Toggle account expansion
  const toggleAccountExpansion = (accountId: number) => {
    setRadarAccounts(prev => prev.map(acc => 
      acc.id === accountId 
        ? { ...acc, isExpanded: !acc.isExpanded }
        : acc
    ));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-16 bg-gray-200 rounded-lg"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-6">
        {/* Header with period selection and personal accounts toggle */}
        <div className="flex items-center justify-between">
          {/* Period Selection - Segmented Control */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Período:</span>
            <div className="inline-flex rounded-md border border-gray-300 bg-white">
              {[
                { key: 'hoy' as const, label: 'Hoy' },
                { key: '30dias' as const, label: '30 días' }
              ].map((period, index) => (
                <button
                  key={period.key}
                  onClick={() => setSelectedPeriod(period.key)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    index === 0 ? 'rounded-l-md' : 'rounded-r-md border-l border-gray-300'
                  } ${
                    selectedPeriod === period.key
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* Exclude Personal Accounts Switch */}
          <div className="flex items-center gap-3">
            <label htmlFor="exclude-personal" className="text-sm font-medium text-gray-700" Excluir cuentas personales </label> <input id="exclude-personal" type="checkbox" checked={excludePersonal} onChange={handleExcludePersonalToggle} className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2" />
          </div>
        </div>

        {/* Account Cards */}
        {filteredAccounts.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">
              {excludePersonal 
                ? "Estás excluyendo las cuentas personales. Desactiva el filtro para verlas."
                : "No hay cuentas para mostrar."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAccounts.map(account => (
              <div key={account.id} className="bg-white rounded-lg border border-gray-200">
                {/* Account Card Header */}
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {/* Account Name and Details */}
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {account.name}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {account.bank}
                        </span>
                        <span className="text-sm text-gray-400">
                          {account.ibanMasked}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          account.usage === 'Personal' ? 'bg-blue-100 text-blue-800' :
                          account.usage === 'Inmuebles' ? 'bg-primary-100 text-primary-800' :
                          'bg-info-100 text-info-800'
                        }`}>
                          {account.usage}
                        </span>
                      </div>
                      
                      {/* Current Balance */}
                      <div className="text-2xl font-bold text-gray-900 mb-2">
                        {formatEuro(account.currentBalance)}
                      </div>
                    </div>

                    {/* Mini KPIs */}
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-500">Entradas</div>
                        <div className="text-lg font-semibold text-green-600">
                          +{formatEuro(account.upcomingIncome)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-500">Salidas</div>
                        <div className="text-lg font-semibold text-red-600">
                          -{formatEuro(account.upcomingExpenses)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-500">Saldo final</div>
                        <div className={`text-lg font-semibold ${
                          account.projectedBalance < 0 ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {formatEuro(account.projectedBalance)}
                        </div>
                      </div>
                      
                      {/* Expand/Collapse Button */}
                      <button
                        onClick={() => toggleAccountExpansion(account.id)}
                        className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900"
                      >
                        {account.isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4" / Contraer </> ) : ( <> <ChevronDown className="w-4 h-4" />
                            Expandir
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable Timeline */}
                {account.isExpanded && (
                  <div className="border-t border-gray-200">
                    {account.events.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        Sin movimientos previstos
                      </div>
                    ) : (
                      <div className="p-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-4">
                          Cronología de eventos
                        </h4>
                        <div className="space-y-3">
                          {account.events.map(event => (
                            <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="text-sm font-medium text-gray-600 w-16">
                                  {event.date}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">{event.concept}</div>
                                  <div className="text-sm text-gray-500 flex items-center gap-2">
                                    <span>{event.scope}</span>
                                    <span>•</span>
                                    <span>{event.category}</span>
                                    {event.accountSource && (
                                      <>
                                        <span>•</span>
                                        <span>{event.accountSource}</span>
                                      </>
                                    )}
                                    <span>•</span>
                                    <span>{event.source}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className={`font-medium ${event.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {event.amount >= 0 ? '+' : ''}{formatEuro(event.amount)}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {formatEuro(event.balanceAfter)}
                                </div>
                                <div className={`text-xs px-2 py-1 rounded-full ${getStatusColor(event.status)}`}>
                                  {event.status}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Account Footer */}
                <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 rounded-b-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      Saldo hoy: <span className="font-medium">{formatEuro(account.currentBalance)}</span>
                    </span>
                    <span className="text-gray-600">
                      Saldo al final del periodo: <span className={`font-medium ${
                        account.projectedBalance < 0 ? 'text-red-600' : 'text-gray-900'
                      }`}>{formatEuro(account.projectedBalance)}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Radar;