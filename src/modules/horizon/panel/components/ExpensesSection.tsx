import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ExternalLink, Calculator, TrendingUp, TrendingDown } from 'lucide-react';
import { PanelFilters } from './HorizonVisualPanel';

interface ExpenseCategory {
  name: string;
  amount: number;
  budget: number;
  deviation: number;
  deviationPercent: number;
  color: string;
}

interface ExpensesSectionProps {
  filters: PanelFilters;
}

const ExpensesSection: React.FC<ExpensesSectionProps> = ({ filters }) => {
  const navigate = useNavigate();
  
  // Mock data - in real implementation would come from movements categorization and budget
  const currentMonth = new Date().toLocaleDateString('es-ES', { month: 'long' });

  const handleOpenBudget = () => {
    // Show loading toast and navigate to the budget section
    toast.loading('Abriendo gestión de presupuesto...', { id: 'budget-nav' });
    setTimeout(() => {
      toast.success('Redirigiendo a Presupuesto', { id: 'budget-nav' });
      navigate('/proyeccion/presupuesto');
    }, 500);
  };
  
  const expenseCategories: ExpenseCategory[] = [
    {
      name: 'Suministros',
      amount: 425,
      budget: 400,
      deviation: 25,
      deviationPercent: 6.25,
      color: '#0A84FF'
    },
    {
      name: 'Comunidad',
      amount: 240,
      budget: 250,
      deviation: -10,
      deviationPercent: -4.0,
      color: '#0A3D62'
    },
    {
      name: 'Seguros',
      amount: 180,
      budget: 180,
      deviation: 0,
      deviationPercent: 0,
      color: '#6B7280'
    },
    {
      name: 'Hipoteca',
      amount: 1600,
      budget: 1600,
      deviation: 0,
      deviationPercent: 0,
      color: '#374151'
    },
    {
      name: 'Otros',
      amount: 320,
      budget: 200,
      deviation: 120,
      deviationPercent: 60,
      color: '#D1D5DB'
    }
  ];

  const totalExpenses = expenseCategories.reduce((sum, cat) => sum + cat.amount, 0);
  const totalBudget = expenseCategories.reduce((sum, cat) => sum + cat.budget, 0);
  const totalDeviation = totalExpenses - totalBudget;
  const budgetUsage = ((totalExpenses / totalBudget) * 100).toFixed(1);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(amount));
  };

  const doughnutData = expenseCategories.map(cat => ({
    name: cat.name,
    value: cat.amount,
    color: cat.color
  }));

  if (totalExpenses === 0) {
    return (
      <div className="bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-6">
        <h2 className="text-lg font-semibold text-hz-neutral-900 mb-4">Gastos clave del mes</h2>
        <div className="text-center py-8 text-hz-neutral-500">
          <Calculator className="w-12 h-12 mx-auto mb-4 text-hz-neutral-300" />
          <p>Sin datos de gastos para este mes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-hz-neutral-900">Gastos clave del mes</h2>
          <p className="text-sm text-hz-neutral-600 mt-1">
            Distribución de gastos de {currentMonth}
          </p>
        </div>
        <button 
          onClick={handleOpenBudget}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-hz-primary text-white rounded-lg hover:bg-hz-primary-dark transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Abrir Presupuesto
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doughnut Chart - Mix de gastos */}
        <div>
          <h3 className="text-sm font-medium text-hz-neutral-700 mb-4">
            Mix de gastos
          </h3>
          
          <div className="relative">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={doughnutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    startAngle={90}
                    endAngle={450}
                    dataKey="value"
                  >
                    {doughnutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const percentage = ((payload[0].value as number / totalExpenses) * 100).toFixed(1);
                        return (
                          <div className="bg-hz-neutral-900 text-white px-3 py-2 rounded-lg">
                            <p className="font-medium">{payload[0].name}</p>
                            <p>{formatCurrency(payload[0].value as number)} ({percentage}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xl font-bold text-hz-neutral-900">
                  {formatCurrency(totalExpenses)}
                </div>
                <div className="text-xs text-hz-neutral-500">
                  total gastado
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {doughnutData.map((item, index) => {
              const percentage = ((item.value / totalExpenses) * 100).toFixed(0);
              return (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-hz-neutral-600 truncate">
                    {item.name} ({percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Horizontal Bars - Budget vs Actual */}
        <div>
          <h3 className="text-sm font-medium text-hz-neutral-700 mb-4">
            Presupuesto vs Real
          </h3>
          
          <div className="space-y-3">
            {expenseCategories.map((category, index) => {
              const maxValue = Math.max(category.amount, category.budget);
              const actualPercent = (category.amount / maxValue) * 100;
              const budgetPercent = (category.budget / maxValue) * 100;
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-hz-neutral-700 font-medium">
                      {category.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-hz-neutral-500">
                        {formatCurrency(category.amount)} / {formatCurrency(category.budget)}
                      </span>
                      {category.deviation !== 0 && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          category.deviation > 0 
                            ? 'bg-hz-error text-white'
                            : 'bg-hz-success text-white'
                        }`}>
                          {category.deviation > 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {category.deviation > 0 ? '+' : ''}{category.deviationPercent.toFixed(1)}%
                        </div>
                      )}
                      {category.deviation === 0 && (
                        <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-hz-success text-white">
                          ✓
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="relative h-6 bg-hz-neutral-100 rounded-full overflow-hidden">
                    {/* Budget bar (background) */}
                    <div 
                      className="absolute top-0 left-0 h-full bg-hz-neutral-300 rounded-full"
                      style={{ width: `${budgetPercent}%` }}
                    />
                    
                    {/* Actual spending bar */}
                    <div 
                      className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                        category.deviation > 0 
                          ? 'bg-hz-error' 
                          : category.deviation < 0 
                            ? 'bg-hz-success'
                            : 'bg-hz-primary'
                      }`}
                      style={{ width: `${actualPercent}%` }}
                    />
                    
                    {/* Amount label */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-white">
                        {formatCurrency(category.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-hz-neutral-200">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-hz-neutral-900">
              {formatCurrency(totalBudget)}
            </div>
            <div className="text-xs text-hz-neutral-500">Presupuestado</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-hz-neutral-900">
              {formatCurrency(totalExpenses)}
            </div>
            <div className="text-xs text-hz-neutral-500">Gastado</div>
          </div>
          <div>
            <div className={`text-lg font-semibold ${
              totalDeviation > 0 ? 'text-hz-error' : totalDeviation < 0 ? 'text-hz-success' : 'text-hz-neutral-900'
            }`}>
              {totalDeviation > 0 ? '+' : ''}{formatCurrency(totalDeviation)}
            </div>
            <div className="text-xs text-hz-neutral-500">Desviación</div>
          </div>
          <div>
            <div className={`text-lg font-semibold ${
              parseFloat(budgetUsage) > 100 ? 'text-hz-error' : 'text-hz-success'
            }`}>
              {budgetUsage}%
            </div>
            <div className="text-xs text-hz-neutral-500">Uso presupuesto</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpensesSection;