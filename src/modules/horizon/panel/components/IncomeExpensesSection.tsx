import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ResponsiveContainer, Tooltip, ComposedChart, Bar, XAxis, YAxis, Line } from 'recharts';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { PanelFilters } from './HorizonVisualPanel';

interface DailyData {
  date: string;
  dateShort: string;
  income: number;
  expenses: number;
  netBalance: number;
  items: Array<{
    description: string;
    amount: number;
    type: 'income' | 'expense';
    account: string;
  }>;
}

interface IncomeExpensesSectionProps {
  filters: PanelFilters;
}

const IncomeExpensesSection: React.FC<IncomeExpensesSectionProps> = ({ filters }) => {
  const navigate = useNavigate();
  
  // Mock data - in real implementation would come from treasury projections
  const timelineData: DailyData[] = generateTimelineData(filters.dateRange);

  const handleViewInRadar = () => {
    // Show loading toast and navigate to the treasury cash flow section
    toast.loading('Abriendo Radar de Tesorería...', { id: 'radar-nav' });
    setTimeout(() => {
      toast.success('Redirigiendo a Radar', { id: 'radar-nav' });
      navigate('/tesoreria', { state: { section: 'radar' } });
    }, 500);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  const totalIncome = timelineData.reduce((sum, day) => sum + day.income, 0);
  const totalExpenses = timelineData.reduce((sum, day) => sum + day.expenses, 0);
  const netAmount = totalIncome - totalExpenses;

  if (timelineData.length === 0) {
    return (
      <div className="bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-6">
        <h2 className="text-lg font-semibold text-hz-neutral-900 mb-4">Ingresos & gastos próximos</h2>
        <div className="text-center py-8 text-hz-neutral-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-hz-neutral-300" />
          <p>Sin datos todavía</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-hz-neutral-900">Ingresos & gastos próximos</h2>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-hz-success rounded"></div>
              <span className="text-sm text-hz-neutral-600">Ingresos: {formatCurrency(totalIncome)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-hz-error rounded"></div>
              <span className="text-sm text-hz-neutral-600">Gastos: {formatCurrency(totalExpenses)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-hz-primary-dark rounded"></div>
              <span className={`text-sm font-medium ${netAmount >= 0 ? 'text-hz-success' : 'text-hz-error'}`}>
                Neto: {netAmount >= 0 ? '+' : ''}{formatCurrency(netAmount)}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={handleViewInRadar}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-hz-primary text-white rounded-lg hover:bg-hz-primary-dark transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Ver en Radar
        </button>
      </div>

      {/* Stacked Bar Chart */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis 
              dataKey="dateShort" 
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `€${Math.abs(value) / 1000}k`}
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as DailyData;
                  return (
                    <div className="bg-hz-neutral-900 text-white p-3 rounded-lg shadow-lg">
                      <p className="font-medium mb-2">{formatDate(data.date)}</p>
                      <div className="space-y-1">
                        <p className="text-hz-success">Ingresos: {formatCurrency(data.income)}</p>
                        <p className="text-hz-error">Gastos: {formatCurrency(data.expenses)}</p>
                        <p className="border-t border-hz-neutral-700 pt-1 mt-1">
                          Neto: {formatCurrency(data.income - data.expenses)}
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="income" fill="#10B981" radius={[2, 2, 0, 0]} />
            <Bar dataKey="expenses" fill="#EF4444" radius={[2, 2, 0, 0]} />
            <Line 
              type="monotone" 
              dataKey="netBalance" 
              stroke="#0A3D62" 
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Items Chips */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-hz-neutral-700">Próximos movimientos</h3>
        <div className="space-y-2">
          {timelineData.slice(0, 7).map((day) => (
            day.items.length > 0 && (
              <div key={day.date} className="flex flex-wrap gap-2">
                <span className="text-xs text-hz-neutral-500 min-w-16">
                  {formatDate(day.date)}
                </span>
                <div className="flex flex-wrap gap-1">
                  {day.items.map((item, index) => (
                    <div 
                      key={index}
                      className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                        item.type === 'income' 
                          ? 'bg-hz-success bg-opacity-10 text-hz-success border border-hz-success border-opacity-20'
                          : 'bg-hz-error bg-opacity-10 text-hz-error border border-hz-error border-opacity-20'
                      }`}
                    >
                      <span className="font-medium">
                        {item.description}
                      </span>
                      <span className="ml-1">
                        {item.type === 'income' ? '+' : '−'}{formatCurrency(item.amount)}
                      </span>
                      <span className="ml-1 text-hz-neutral-500">
                        ({item.account})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper function to generate timeline data
function generateTimelineData(dateRange: string): DailyData[] {
  const days = dateRange === 'today' ? 1 : dateRange === '7days' ? 7 : 30;
  const data: DailyData[] = [];
  
  // Sample recurring items
  const recurringItems = [
    { description: 'Nómina', amount: 3500, type: 'income' as const, account: 'Santander', dayOfMonth: 1 },
    { description: 'Alquiler Piso A', amount: 1200, type: 'income' as const, account: 'Santander', dayOfMonth: 5 },
    { description: 'Alquiler Piso B', amount: 950, type: 'income' as const, account: 'ING', dayOfMonth: 7 },
    { description: 'IBI', amount: 150, type: 'expense' as const, account: 'Santander', dayOfMonth: 10 },
    { description: 'Hipoteca', amount: 800, type: 'expense' as const, account: 'BBVA', dayOfMonth: 15 },
    { description: 'Comunidad Piso A', amount: 120, type: 'expense' as const, account: 'Santander', dayOfMonth: 20 },
    { description: 'Seguro', amount: 85, type: 'expense' as const, account: 'ING', dayOfMonth: 25 }
  ];

  let cumulativeBalance = 0;

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    const dayOfMonth = date.getDate();
    const dayItems = recurringItems.filter(item => item.dayOfMonth === dayOfMonth);
    
    const dayIncome = dayItems
      .filter(item => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0);
    
    const dayExpenses = dayItems
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);

    cumulativeBalance += dayIncome - dayExpenses;

    data.push({
      date: date.toISOString(),
      dateShort: date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      income: dayIncome,
      expenses: dayExpenses,
      netBalance: cumulativeBalance,
      items: dayItems
    });
  }
  
  return data;
}

export default IncomeExpensesSection;