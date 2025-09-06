import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpCircle, ArrowDownCircle, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import PageLayout from '../../../../components/common/PageLayout';
import { initDB, Account } from '../../../../services/db';
import { getTreasuryProjections, generateTreasuryRecommendations } from '../../../../services/treasuryForecastService';
import { formatEuro } from '../../../../services/aeatClassificationService';

interface TreasuryProjection {
  currentBalance: number;
  projectedBalance7d: number;
  projectedBalance30d: number;
  accountBalances: Map<number, { current: number; projected: number }>;
  upcomingEvents: Array<{
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
  }>;
  recommendations: Array<{
    id: string;
    type: 'transfer' | 'alert';
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    suggestedAmount?: number;
    fromAccountName?: string;
    toAccountName?: string;
  }>;
  accountsAtRisk: number;
}

const Radar: React.FC = () => {
  const [projection, setProjection] = useState<TreasuryProjection | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<'pulse' | 'horizon' | 'consolidado'>('consolidado');

  const loadTreasuryData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await initDB();
      
      // Load accounts filtered by module
      const allAccounts = await db.getAll('accounts');
      const filteredAccounts = selectedModule === 'consolidado' 
        ? allAccounts.filter(acc => acc.isActive)
        : allAccounts.filter(acc => acc.isActive && acc.destination === selectedModule);
      
      setAccounts(filteredAccounts);
      
      // Get treasury projections
      const accountIds = filteredAccounts.map(acc => acc.id!);
      const { accountBalances, totalInflow, totalOutflow, events } = await getTreasuryProjections(30, accountIds);
      
      // Calculate global balances
      const currentBalance = filteredAccounts.reduce((sum, acc) => sum + acc.balance, 0);
      
      const projections7d = await getTreasuryProjections(7, accountIds);
      const projectedBalance7d = currentBalance + projections7d.totalInflow - projections7d.totalOutflow;
      
      const projectedBalance30d = currentBalance + totalInflow - totalOutflow;
      
      // Get upcoming events (next 7 days)
      const upcomingEvents = events
        .filter(event => {
          const eventDate = new Date(event.predictedDate);
          const today = new Date();
          const weekFromNow = new Date();
          weekFromNow.setDate(today.getDate() + 7);
          return eventDate >= today && eventDate <= weekFromNow;
        })
        .sort((a, b) => new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime())
        .slice(0, 5)
        .map(event => ({
          date: event.predictedDate,
          description: event.description,
          amount: event.amount,
          type: event.type
        }));

      // Count accounts at risk (will go below minimum balance)
      const accountsAtRisk = filteredAccounts.filter(acc => {
        const balance = accountBalances.get(acc.id!);
        const minimumBalance = acc.minimumBalance || 200;
        return balance && balance.projected < minimumBalance;
      }).length;

      // Get recommendations
      await generateTreasuryRecommendations();
      const recommendations = await db.getAll('treasuryRecommendations');
      const activeRecommendations = recommendations
        .filter(rec => rec.status === 'active')
        .map(rec => ({
          id: rec.id!,
          type: rec.type,
          severity: rec.severity,
          title: rec.title,
          description: rec.description,
          suggestedAmount: rec.suggestedAmount,
          fromAccountName: rec.fromAccountId ? filteredAccounts.find(acc => acc.id === rec.fromAccountId)?.name : undefined,
          toAccountName: rec.toAccountId ? filteredAccounts.find(acc => acc.id === rec.toAccountId)?.name : undefined
        }));

      setProjection({
        currentBalance,
        projectedBalance7d,
        projectedBalance30d,
        accountBalances,
        upcomingEvents,
        recommendations: activeRecommendations,
        accountsAtRisk
      });

    } catch (error) {
      console.error('Error loading treasury data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedModule]);

  useEffect(() => {
    loadTreasuryData();
  }, [selectedModule, loadTreasuryData]);

  const getAccountProjectedBalance = (account: Account): number => {
    if (!projection) return account.balance;
    const balance = projection.accountBalances.get(account.id!);
    return balance?.projected || account.balance;
  };

  const getAccountStatus = (account: Account): 'healthy' | 'warning' | 'critical' => {
    const projectedBalance = getAccountProjectedBalance(account);
    const minimumBalance = account.minimumBalance || 200;
    
    if (projectedBalance < 0) return 'critical';
    if (projectedBalance < minimumBalance) return 'warning';
    return 'healthy';
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical'): string => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-orange-600 bg-orange-50';
      case 'healthy': return 'text-green-600 bg-green-50';
    }
  };

  const getSeverityIcon = (severity: 'info' | 'warning' | 'critical') => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-[#DC2626]" />; // Rojo error según guía
      case 'warning': return <AlertTriangle className="w-5 h-5 text-[#EAB308]" />; // Amarillo warning según guía  
      case 'info': return <CheckCircle className="w-5 h-5 text-[#16A34A]" />; // Verde OK según guía
    }
  };

  if (loading) {
    return (
      <PageLayout title="Radar Tesorería" subtitle="Vista general del estado financiero.">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Radar Tesorería" subtitle="Vista general del estado financiero y proyecciones.">
      <div className="space-y-6">
        {/* Module Toggle */}
        <div className="flex gap-2">
          {[
            { key: 'pulse' as const, label: 'Pulse' },
            { key: 'horizon' as const, label: 'Horizon' },
            { key: 'consolidado' as const, label: 'Consolidado' }
          ].map(module => (
            <button
              key={module.key}
              onClick={() => setSelectedModule(module.key)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedModule === module.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {module.label}
            </button>
          ))}
        </div>

        {/* Global Summary */}
        {projection && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Resumen Global</h3>
              <p className="text-sm text-gray-500">Fecha hoy: {new Date().toLocaleDateString('es-ES')} — Saldo global: {formatEuro(projection.currentBalance)}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{formatEuro(projection.projectedBalance7d)}</div>
                <div className="text-sm text-gray-500 flex items-center justify-center gap-1">
                  {projection.projectedBalance7d > projection.currentBalance ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  Proyección +7d
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{formatEuro(projection.projectedBalance30d)}</div>
                <div className="text-sm text-gray-500 flex items-center justify-center gap-1">
                  {projection.projectedBalance30d > projection.currentBalance ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  Proyección +30d
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{projection.accountsAtRisk}</div>
                <div className="text-sm text-gray-500 flex items-center justify-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Cuentas en riesgo
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Account Balances */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cuentas</h3>
            <div className="space-y-4">
              {accounts.map(account => {
                const status = getAccountStatus(account);
                const projectedBalance = getAccountProjectedBalance(account);
                
                return (
                  <div key={account.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{account.name}</div>
                      <div className="text-sm text-gray-500">{account.bank}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        Hoy: {formatEuro(account.balance)}
                      </div>
                      <div className={`text-sm px-2 py-1 rounded-full ${getStatusColor(status)}`}>
                        +30d: {formatEuro(projectedBalance)}
                        {status === 'critical' && ' ⚠️'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recomendaciones</h3>
            {projection && projection.recommendations.length > 0 ? (
              <div className="space-y-4">
                {projection.recommendations.map(rec => (
                  <div key={rec.id} className="p-4 rounded-lg border border-gray-100">
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(rec.severity)}
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{rec.title}</div>
                        <div className="text-sm text-gray-600 mt-1">{rec.description}</div>
                        {rec.type === 'transfer' && rec.suggestedAmount && (
                          <div className="text-sm text-blue-600 mt-2">
                            💡 Transferir {formatEuro(rec.suggestedAmount)} de {rec.fromAccountName} a {rec.toAccountName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p>No hay recomendaciones activas</p>
                <p className="text-sm">Todas las cuentas están en buen estado</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Events Calendar */}
        {projection && projection.upcomingEvents.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Calendario (próximos 7 días)
            </h3>
            <div className="space-y-3">
              {projection.upcomingEvents.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-3">
                    {event.type === 'income' ? (
                      <ArrowUpCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <ArrowDownCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{event.description}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(event.date).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                  </div>
                  <div className={`font-medium ${event.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {event.type === 'income' ? '+' : '-'}{formatEuro(event.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Radar;