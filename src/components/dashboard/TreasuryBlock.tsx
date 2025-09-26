import React, { useState, useEffect, useCallback } from 'react';
import { Banknote } from 'lucide-react';
import DashboardBlockBase, { DashboardBlockProps, DashboardBlockData } from './DashboardBlockBase';
import { TreasuryBlockOptions } from '../../services/dashboardService';

const TreasuryBlock: React.FC<DashboardBlockProps> = ({ config, onNavigate, className }) => {
  const [data, setData] = useState<DashboardBlockData>({
    value: 0,
    formattedValue: '0,00 €',
    isLoading: true
  });

  const options = config.options as TreasuryBlockOptions;

  const loadTreasuryData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: undefined }));

      // Mock treasury data calculation
      // In real implementation, this would fetch from treasury service
      const mockBalance = 15234.56;
      const mockProjection = options.horizon === 7 ? 2450.30 : 8765.20;
      const trend = mockProjection > 0 ? 'up' : 'down';

      // Apply Spanish formatting
      const formattedBalance = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
      }).format(mockBalance);

      const formattedProjection = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
      }).format(Math.abs(mockProjection));

      setData({
        value: mockBalance,
        formattedValue: formattedBalance,
        trend,
        trendValue: `${mockProjection > 0 ? '+' : ''}${formattedProjection}`,
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
  }, [options]);

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

  return (
    <DashboardBlockBase
      title="Tesorería"
      subtitle={getSubtitle()}
      data={data}
      icon={<Banknote className="w-5 h-5" />}
      onNavigate={handleNavigate}
      className={className}
    >
      {/* Treasury specific content */}
      <div className="mt-3 text-xs text-neutral-500">
        <div className="flex justify-between">
          <span>Saldo hoy</span>
          <span className="font-medium">{data.formattedValue}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Proyección +{options.horizon} d</span>
          <span className={`font-medium ${data.trend === 'up' ? 'text-success-600' : 'text-error-600'}`}>
            {data.trendValue}
          </span>
        </div>
      </div>
    </DashboardBlockBase>
  );
};

export default TreasuryBlock;