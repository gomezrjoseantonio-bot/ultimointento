import React from 'react';
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

const AccountsCompactSection: React.FC<AccountsCompactSectionProps> = ({ filters }) => {
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
  const accounts: Account[] = [
    {
      id: '1',
      name: 'Cuenta Principal',
      maskedIban: 'ES12***9012',
      currentBalance: 8500,
      projectedBalance: 7200,
      threshold: 1000,
      sparklineData: generateSparklineData(8500, 7200, 1000)
    },
    {
      id: '2',
      name: 'Cuenta Gastos',
      maskedIban: 'ES98***1098',
      currentBalance: 3200,
      projectedBalance: 2800,
      threshold: 500,
      sparklineData: generateSparklineData(3200, 2800, 500)
    },
    {
      id: '3',
      name: 'Cuenta Reserva',
      maskedIban: 'ES55***1100',
      currentBalance: 15000,
      projectedBalance: 14500,
      threshold: 5000,
      sparklineData: generateSparklineData(15000, 14500, 5000)
    },
    {
      id: '4',
      name: 'Cuenta Operativa',
      maskedIban: 'ES77***3344',
      currentBalance: 1200,
      projectedBalance: 800,
      threshold: 1000,
      sparklineData: generateSparklineData(1200, 800, 1000)
    }
  ];

  // Filter accounts based on personal exclusion
  const filteredAccounts = accounts.filter(account => {
    // In real implementation, would check account.usage property
    return true; // For demo, show all
  }).slice(0, 4); // Ensure exactly 4 accounts

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
        Cuentas destacadas (4)
      </h2>
      
      {/* 2x2 Grid of Account Cards */}
      <div className="flex-1 grid grid-cols-2 gap-2">
        {filteredAccounts.map((account) => (
          <div key={account.id} className="border border-hz-neutral-200 rounded p-2 flex flex-col">
            {/* Header with menu */}
            <div className="flex items-start justify-between mb-1">
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-medium text-hz-neutral-900 truncate">
                  {account.name}
                </h3>
                <p className="text-xs text-hz-neutral-500">
                  {account.maskedIban}
                </p>
              </div>
              <button className="p-0.5 text-hz-neutral-400 hover:text-hz-neutral-600 flex-shrink-0">
                <MoreHorizontal className="w-3 h-3" />
              </button>
            </div>
            
            {/* Balances */}
            <div className="mb-2">
              <div className="text-sm font-semibold text-hz-neutral-900">
                {formatBalance(account.currentBalance)}
              </div>
              <div className="text-xs text-hz-neutral-500">
                {formatBalance(account.projectedBalance)} {getDaysLabel()}
              </div>
            </div>
            
            {/* Sparkline */}
            <div className="flex-1">
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
};

export default AccountsCompactSection;