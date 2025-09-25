import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ExternalLink } from 'lucide-react';
import { PanelFilters } from './HorizonVisualPanel';

interface TimelineData {
  date: string;
  dateShort: string;
  income: number;
  expenses: number;
  net: number;
}

interface TimelineSectionProps {
  filters: PanelFilters;
}

const TimelineSection: React.FC<TimelineSectionProps> = React.memo(({ filters }) => {
  const navigate = useNavigate();

  const handleOpenRadar = () => {
    toast.loading('Abriendo vista Radar...', { id: 'radar-nav' });
    setTimeout(() => {
      toast.success('Redirigiendo a Personal', { id: 'radar-nav' });
      navigate('/personal/resumen', { state: { view: 'radar', dateRange: filters.dateRange } });
    }, 500);
  };
  // Generate timeline data based on filters
  const generateTimelineData = (): TimelineData[] => {
    const data: TimelineData[] = [];
    const today = new Date();
    
    let days = 7; // Default to 7 days
    if (filters.dateRange === 'today') days = 3; // Yesterday, today, tomorrow
    if (filters.dateRange === '30days') days = 7; // Still show 7 days for compact view
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - Math.floor(days/2) + i);
      
      // Mock data - in real implementation would come from treasury projections
      const income = Math.random() * 2000 + 500;
      const expenses = Math.random() * 1500 + 200;
      
      data.push({
        date: date.toLocaleDateString('es-ES'),
        dateShort: date.getDate() + '/' + (date.getMonth() + 1),
        income: Math.round(income),
        expenses: Math.round(expenses),
        net: Math.round(income - expenses)
      });
    }
    
    return data;
  };

  const timelineData = generateTimelineData();
  
  // Calculate totals
  const totalIncome = timelineData.reduce((sum, day) => sum + day.income, 0);
  const totalExpenses = timelineData.reduce((sum, day) => sum + day.expenses, 0);
  const totalNet = totalIncome - totalExpenses;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-hz-neutral-900 text-white p-2 rounded shadow-lg text-xs">
          <p className="font-medium mb-1">{data.date}</p>
          <p className="text-hz-success">+{data.income.toLocaleString()} €</p>
          <p className="text-hz-error">-{data.expenses.toLocaleString()} €</p>
          <p className="font-medium">Neto: {data.net > 0 ? '+' : ''}{data.net.toLocaleString()} €</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-3 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-hz-neutral-900">
            Timeline {filters.dateRange === 'today' ? '3 días' : '7 días'}
          </h2>
          {/* Summary chips */}
          <div className="flex gap-2 mt-1 text-xs">
            <span className="text-hz-success">+{totalIncome.toLocaleString()} €</span>
            <span className="text-hz-error">-{totalExpenses.toLocaleString()} €</span>
            <span className={`font-medium ${totalNet >= 0 ? 'text-hz-success' : 'text-hz-error'}`}>
              {totalNet >= 0 ? '+' : ''}{totalNet.toLocaleString()} €
            </span>
          </div>
        </div>
        <button 
          onClick={handleOpenRadar}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-hz-primary text-white rounded hover:bg-hz-primary- light "
        >
          <ExternalLink className="w-3 h-3" />
          Ver en Radar
        </button>
      </div>
      
      {/* Stacked Bar Chart - Ultra compact */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={timelineData}
            margin={{ top: 5, right: 5, left: 5, bottom: 20 }}
            onClick={(data) => {
              if (data && data.activeLabel) {
                handleOpenRadar();
              }
            }}
          >
            <XAxis 
              dataKey="dateShort"
              tick={{ fontSize: 10, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Income bars */}
            <Bar 
              dataKey="income" 
              stackId="a" 
              fill="#10B981" 
              radius={[0, 0, 0, 0]}
              className="cursor-pointer" />
            
            {/* Expense bars (negative values) */}
            <Bar 
              dataKey={(data) => -data.expenses} 
              stackId="b" 
              fill="#EF4444" 
              radius={[0, 0, 0, 0]}
              className="cursor-pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Net line representation - Simple dots */}
      <div className="flex justify-between items-center mt-2 px-2">
        {timelineData.map((day, index) => (
          <div key={index} className="flex flex-col items-center">
            <div 
              className={`w-1 h-1 rounded-full ${
                day.net >= 0 ? 'bg-hz-success' : 'bg-hz-error'
              }`}
              title={`${day.dateShort}: ${day.net >= 0 ? '+' : ''}${day.net} €`}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

export default TimelineSection;