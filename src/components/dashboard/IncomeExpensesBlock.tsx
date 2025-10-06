import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';
import DashboardBlockBase, { DashboardBlockProps, DashboardBlockData } from './DashboardBlockBase';
import { IncomeExpensesBlockOptions } from '../../services/dashboardService';

const IncomeExpensesBlock: React.FC<DashboardBlockProps> = ({ config, onNavigate, className, excludePersonal }) => {
  const [data, setData] = useState<DashboardBlockData>({
    value: 0,
    formattedValue: '0,00 €',
    isLoading: true
  });

  const options = config.options as IncomeExpensesBlockOptions;
  const baseIncome = 4567.89;
  const baseExpenses = 1234.56;
  const personalIncomeShare = 680.12;
  const personalExpenseShare = 210.43;

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);

  const loadIncomeExpensesData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: undefined }));

      // Mock income vs expenses calculation
      // In real implementation, this would fetch from contracts and expenses
      const effectiveIncome = excludePersonal ? baseIncome - personalIncomeShare : baseIncome;
      const effectiveExpenses = excludePersonal ? baseExpenses - personalExpenseShare : baseExpenses;
      const netAmount = effectiveIncome - effectiveExpenses;
      const trend = netAmount >= 0 ? 'up' : 'down';

      // Apply Spanish formatting
      const formattedNet = formatCurrency(netAmount);

      // Calculate percentage change (mock)
      const mockPreviousPeriod: number = excludePersonal ? 3120.45 : 2890.45;
      const percentageChange = mockPreviousPeriod === 0 ? 0 : ((netAmount - mockPreviousPeriod) / mockPreviousPeriod) * 100;
      const formattedPercentage = new Intl.NumberFormat('es-ES', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(percentageChange / 100);

      setData({
        value: netAmount,
        formattedValue: formattedNet,
        trend,
        trendValue: formattedPercentage,
        isLoading: false
      });

    } catch (error) {
      console.error('Error loading income expenses data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Error al cargar datos de ingresos/gastos'
      }));
    }
  }, [excludePersonal]);

  useEffect(() => {
    loadIncomeExpensesData();
  }, [loadIncomeExpensesData]);

  const handleNavigate = () => {
    if (onNavigate) {
      // Navigate to treasury module with income/expenses filters
      const route = options.scope === 'portfolio' ? '/tesoreria#ingresos' : `/inmuebles/cartera/${options.selectedPropertyId}`;
      onNavigate(route, {
        period: options.period,
        scope: options.scope
      });
    }
  };

  const getSubtitle = () => {
    const scopeText = options.scope === 'portfolio' ? 'cartera completa' : 'inmueble seleccionado';
    const periodText = options.period === 'current-month' ? 'mes en curso' : 'últimos 30 días';
    return `${periodText} (${scopeText})`;
  };

  return (
    <DashboardBlockBase
      title="Ingresos vs Gastos"
      subtitle={getSubtitle()}
      data={data}
      icon={<TrendingUp className="w-5 h-5" />}
      onNavigate={handleNavigate}
      className={className}
      filterLabel={excludePersonal ? 'Sin finanzas personales' : undefined}
    >
      {/* Income vs Expenses specific content */}
      <div className="mt-3 text-xs text-neutral-500">
        <div className="flex justify-between">
          <span>Ingresos</span>
          <span className="font-medium text-success-600">
            {formatCurrency(excludePersonal ? baseIncome - personalIncomeShare : baseIncome)}
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Gastos</span>
          <span className="font-medium text-error-600">
            {formatCurrency(excludePersonal ? baseExpenses - personalExpenseShare : baseExpenses)}
          </span>
        </div>
        <div className="border-t border-neutral-200 mt-2 pt-2 flex justify-between font-medium">
          <span>Neto</span>
          <span className={data.trend === 'up' ? 'text-success-600' : 'text-error-600'}>
            {data.formattedValue}
          </span>
        </div>
      </div>
    </DashboardBlockBase>
  );
};

export default IncomeExpensesBlock;