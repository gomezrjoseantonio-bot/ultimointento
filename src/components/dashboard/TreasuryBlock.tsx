import React, { useState, useEffect, useCallback } from 'react';
import { Banknote } from 'lucide-react';
import DashboardBlockBase, { DashboardBlockProps, DashboardBlockData } from './DashboardBlockBase';
import { TreasuryBlockOptions } from '../../services/dashboardService';
import { Tooltip } from '../common/Tooltip';

const TreasuryBlock: React.FC<DashboardBlockProps> = ({ config, onNavigate, className, excludePersonal }) => {
  const [data, setData] = useState<DashboardBlockData>({
    value: 0,
    formattedValue: '0,00 €',
    isLoading: true
  });

  const options = config.options as TreasuryBlockOptions;

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);

  const loadTreasuryData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: undefined }));

      // Mock treasury data calculation
      // In real implementation, this would fetch from treasury service
      const baseBalance = 15234.56;
      const personalBalanceShare = 3120.23;
      const baseProjection = options.horizon === 7 ? 2450.3 : 8765.2;
      const personalProjectionShare = options.horizon === 7 ? 620.45 : 2175.4;

      const effectiveBalance = excludePersonal ? baseBalance - personalBalanceShare : baseBalance;
      const effectiveProjection = excludePersonal
        ? baseProjection - personalProjectionShare
        : baseProjection;

      const trend = effectiveProjection >= 0 ? 'up' : 'down';

      const formattedBalance = formatCurrency(effectiveBalance);
      const formattedProjectionAbsolute = formatCurrency(Math.abs(effectiveProjection));
      const projectionLabel = `${effectiveProjection >= 0 ? '+' : '-'}${formattedProjectionAbsolute}`;

      setData({
        value: effectiveBalance,
        formattedValue: formattedBalance,
        trend,
        trendValue: projectionLabel,
        isLoading: false
      });

    } catch (error) {
      console.error('Error loading treasury data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Error al cargar datos de tesorería'
      }));
    }
  }, [options, excludePersonal]);

  useEffect(() => {
    loadTreasuryData();
  }, [loadTreasuryData]);

  const handleNavigate = () => {
    if (onNavigate) {
      // Navigate to treasury module with radar tab and filters
      onNavigate('/tesoreria#radar', {
        horizon: options.horizon,
        accounts: options.accountsIncluded
      });
    }
  };

  const getSubtitle = () => {
    return `Proyección +${options.horizon} días (${options.accountsIncluded === 'all' ? 'todas las cuentas' : 'cuentas seleccionadas'})`;
  };

  const filterLabel = excludePersonal ? 'Sin finanzas personales' : undefined;

  const balanceLabel = typeof data.value === 'number' ? formatCurrency(data.value) : data.formattedValue;
  const projectionLabel = data.trendValue ?? '--';

  return (
    <DashboardBlockBase
      title="Tesorería"
      subtitle={getSubtitle()}
      data={data}
      icon={<Banknote className="w-5 h-5" />}
      onNavigate={handleNavigate}
      className={className}
      filterLabel={filterLabel}
    >
      {/* Treasury specific content */}
      <div className="mt-3 text-xs text-neutral-500">
        <div className="flex justify-between">
          <Tooltip content="Saldo actual sumando todas las cuentas bancarias incluidas">
            <span>Saldo hoy</span>
          </Tooltip>
          <span className="font-medium">{balanceLabel}</span>
        </div>
        <div className="flex justify-between mt-1">
          <Tooltip content="Estimación de ingresos y gastos futuros basada en datos históricos y expectativas">
            <span>Proyección +{options.horizon}d</span>
          </Tooltip>
          <span className={`font-medium ${data.trend === 'up' ? 'text-success-600' : 'text-error-600'}`}>
            {projectionLabel}
          </span>
        </div>
      </div>
    </DashboardBlockBase>
  );
};

export default TreasuryBlock;