import React, { useState, useEffect } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { MoreHorizontal } from 'lucide-react';
import { PanelFilters } from './HorizonVisualPanel';

interface SparklineData {
  date: string;
  balance: number;
  belowThreshold: boolean;
}

interface Account {
  id: string;
  name: string;
  maskedIban: string;
  currentBalance: number;
  projectedBalance: number;
  threshold?: number;
  sparklineData: SparklineData[];
}

interface AccountsCompactSectionProps {
  filters: PanelFilters;
}

const AccountsCompactSection: React.FC<AccountsCompactSectionProps> = React.memo(({ filters }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Load real accounts from settings instead of mock data
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const { treasuryAPI } = await import('../../../../services/treasuryApiService');
        const allAccounts = await treasuryAPI.accounts.getAccounts(false); // Only active accounts
        const horizonAccounts = allAccounts.filter(acc => acc.destination === 'horizon');
        
        // Convert to Account format with real data
        const accountsWithData: Account[] = horizonAccounts.map(acc => {
          const currentBalance = acc.balance || 0;
          const projectedBalance = acc.balance || 0; // Simplified - no projection logic for now
          const threshold = acc.minimumBalance || 1000;
          
          // Enhanced IBAN masking for better UX
          const maskedIban = acc.iban ? 
            acc.iban.length > 8 ? 
              `${acc.iban.slice(0, 4)}***${acc.iban.slice(-4)}` : 
              `***${acc.iban.slice(-4)}`
            : '****';
          
          return {
            id: acc.id!.toString(),
            name: acc.name || `Cuenta ${acc.bank}`,
            maskedIban,
            currentBalance,
            projectedBalance,
            threshold,
            sparklineData: generateSparklineData(currentBalance, projectedBalance, threshold)
          };
        });
        
        setAccounts(accountsWithData);
      } catch (error) {
        console.error('Error loading accounts:', error);
        setAccounts([]); // Empty array instead of mock data
      } finally {
        setLoading(false);
      }
    };
    
    loadAccounts();
  }, [filters.dateRange]);

  // Generate sparkline data
  const generateSparklineData = (current: number, projected: number, threshold?: number): SparklineData[] => {
    const data: SparklineData[] = [];
    const points = 15; // 15 points as specified
    
    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      const balance = current + (projected - current) * progress;
      
      data.push({
        date: `Day ${i + 1}`,
        balance: Math.round(balance),
        belowThreshold: threshold ? balance < threshold : false
      });
    }
    
    return data;
  };

  // Mock data - 4 accounts (2x2 grid) selectable from Configure Panel
  // REMOVED: This mock data has been replaced with real data from the database

  // Filter accounts based on personal exclusion and ensure exactly 4 accounts for grid
  const filteredAccounts = accounts.filter(account => {
    // In real implementation, would check account.usage property
    return true; // For now, show all
  }).slice(0, 4); // Ensure exactly 4 accounts

  // If loading, show loading state
  if (loading) {
    return (
      <div className="h-full bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-3 flex flex-col">
        <h2 className="text-sm font-semibold text-hz-neutral-900 mb-3">
          Cuentas destacadas
        </h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-hz-neutral-500">Cargando cuentas...</div>
        </div>
      </div>
    );
  }

  // If no accounts, show empty state
  if (filteredAccounts.length === 0) {
    return (
      <div className="h-full bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-3 flex flex-col">
        <h2 className="text-sm font-semibold text-hz-neutral-900 mb-3">
          Cuentas destacadas (0)
        </h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm text-hz-neutral-500 mb-1">No hay cuentas disponibles</div>
            <div className="text-xs text-hz-neutral-400">Configura cuentas en Configuración &gt; Cuentas</div>
          </div>
        </div>
      </div>
    );
  }

  const formatBalance = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getDaysLabel = () => {
    switch (filters.dateRange) {
      case 'today': return 'fin de día';
      case '7days': return 'fin de rango';
      case '30days': return 'fin de rango';
    }
  };

  const CustomSparkline = ({ data, threshold }: { data: SparklineData[], threshold?: number }) => (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line 
          type="monotone" 
          dataKey="balance" 
          stroke="#0A84FF" 
          strokeWidth={1.5}
          dot={false}
        />
        {/* Red dots for points below threshold */}
        {threshold && data.some(d => d.belowThreshold) && (
          <Line 
            type="monotone" 
            dataKey={(entry) => entry.belowThreshold ? entry.balance : null}
            stroke="#EF4444" 
            strokeWidth={0}
            dot={{ fill: '#EF4444', strokeWidth: 0, r: 1.5 }}
            connectNulls={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <div className="h-full bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-3 flex flex-col">
      {/* Header */}
      <h2 className="text-sm font-semibold text-hz-neutral-900 mb-3">
        Cuentas destacadas ({filteredAccounts.length})
      </h2>
      
      {/* 2x2 Grid of Account Cards - Fixed height with overflow protection */}
      <div className="flex-1 grid grid-cols-2 gap-2 min-h-0 overflow-hidden">
        {filteredAccounts.map((account) => (
          <div key={account.id} className="border border-hz-neutral-200 rounded p-2 flex flex-col min-h-0 overflow-hidden">
            {/* Header with menu */}
            <div className="flex items-start justify-between mb-1 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-medium text-hz-neutral-900 truncate">
                  {account.name}
                </h3>
                <p className="text-xs text-hz-neutral-500 truncate">
                  {account.maskedIban}
                </p>
              </div>
              <button className="p-0.5 text-hz-neutral-400 hover:text-hz-neutral-600 flex-shrink-0">
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </div>
            
            {/* Balances */}
            <div className="mb-2 flex-shrink-0">
              <div className="text-sm font-semibold text-hz-neutral-900 truncate">
                {formatBalance(account.currentBalance)}
              </div>
              <div className="text-xs text-hz-neutral-500 truncate">
                {formatBalance(account.projectedBalance)} {getDaysLabel()}
              </div>
            </div>
            
            {/* Sparkline */}
            <div className="flex-1 min-h-0">
              <CustomSparkline 
                data={account.sparklineData} 
                threshold={account.threshold}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default AccountsCompactSection;