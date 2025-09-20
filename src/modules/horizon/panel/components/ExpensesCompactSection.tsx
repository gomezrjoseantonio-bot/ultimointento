import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { PanelFilters } from './HorizonVisualPanel';

interface ExpenseCategory {
  id: string;
  name: string;
  amount: number;
  budget?: number;
  deviation: 'over' | 'within' | 'none';
  deviationPercent: number;
}

interface ExpensesCompactSectionProps {
  filters: PanelFilters;
}

const ExpensesCompactSection: React.FC<ExpensesCompactSectionProps> = ({ filters }) => {
  const navigate = useNavigate();

  const handleOpenBudget = () => {
    toast.loading('Abriendo gestión de presupuesto...', { id: 'budget-nav' });
    setTimeout(() => {
      toast.success('Redirigiendo a Presupuesto', { id: 'budget-nav' });
      navigate('/proyeccion/presupuesto');
    }, 500);
  };
  // Mock data - Top 4 expense categories for the month
  const categories: ExpenseCategory[] = [
    {
      id: '1',
      name: 'Suministros',
      amount: 425,
      budget: 400,
      deviation: 'over',
      deviationPercent: 6.3
    },
    {
      id: '2',
      name: 'Comunidad',
      amount: 240,
      budget: 250,
      deviation: 'within',
      deviationPercent: -4.0
    },
    {
      id: '3',
      name: 'Seguros',
      amount: 180,
      budget: 180,
      deviation: 'within',
      deviationPercent: 0
    },
    {
      id: '4',
      name: 'Hipoteca',
      amount: 1600,
      budget: 1600,
      deviation: 'within',
      deviationPercent: 0
    }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getDeviationBadge = (category: ExpenseCategory) => {
    if (category.deviation === 'none' || !category.budget) {
      return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-hz-neutral-500 text-hz-neutral-500">
          Sin presup.
        </div>
      );
    }

    if (category.deviation === 'within') {
      return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-hz-success text-hz-success">
          ✓
        </div>
      );
    }

    // Over budget
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-hz-error text-hz-error">
        <TrendingUp className="w-2 h-2" />
        +{Math.abs(category.deviationPercent).toFixed(1)}%
      </div>
    );
  };

  const getBarWidth = (amount: number) => {
    const maxAmount = Math.max(...categories.map(c => c.amount));
    return (amount / maxAmount) * 100;
  };

  return (
    <div className="h-full bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-3 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-hz-neutral-900">
          Gasto por categorías Top-4
        </h2>
        <button 
          onClick={handleOpenBudget}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-hz-primary text-white rounded hover:bg-hz-primary- light "
        >
          <ExternalLink className="w-3 h-3" />
          Abrir Presupuesto
        </button>
      </div>
      
      {/* Horizontal bars - 4 rows max */}
      <div className="flex-1 space-y-3">
        {categories.map((category) => (
          <div key={category.id} className="space-y-1">
            {/* Category name and amount */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-hz-neutral-900">
                {category.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-hz-neutral-900">
                  {formatCurrency(category.amount)}
                </span>
                {getDeviationBadge(category)}
              </div>
            </div>
            
            {/* Horizontal bar */}
            <div className="relative h-2 bg-hz-neutral-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all rounded-full ${
                  category.deviation === 'over' 
                    ? 'bg-hz-error' 
                    : category.deviation === 'within'
                    ? 'bg-hz-success'
                    : 'bg-hz-neutral-500'
                }`}
                style={{ width: `${getBarWidth(category.amount)}%` }}
              />
              
              {/* Budget marker if exists */}
              {category.budget && (
                <div 
                  className="absolute top-0 w-0.5 h-full bg-hz-neutral-700"
                  >
                  style={{ left: `${getBarWidth(category.budget)}%` }}
                  title={`Presupuesto: ${formatCurrency(category.budget)}`}
                />
              )}
            </div>
            
            {/* Budget info if exists */}
            {category.budget && (
              <div className="flex justify-between text-xs text-hz-neutral-500">
                <span>Presupuesto: {formatCurrency(category.budget)}</span>
                {category.deviationPercent !== 0 && (
                  <span className={category.deviation === 'over' ? 'text-hz-error' : 'text-hz-success'}>
                    {category.deviationPercent > 0 ? '+' : ''}{category.deviationPercent.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExpensesCompactSection;