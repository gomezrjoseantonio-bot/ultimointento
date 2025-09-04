import React, { useState, useEffect, useCallback } from 'react';
import { FileText } from 'lucide-react';
import DashboardBlockBase, { DashboardBlockProps, DashboardBlockData } from './DashboardBlockBase';
import { TaxBlockOptions } from '../../services/dashboardService';

const TaxBlock: React.FC<DashboardBlockProps> = ({ config, onNavigate, className }) => {
  const [data, setData] = useState<DashboardBlockData>({
    value: 0,
    formattedValue: '0,00 €',
    isLoading: true
  });

  const options = config.options as TaxBlockOptions;

  const loadTaxData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: undefined }));

      // Mock tax data calculation
      // In real implementation, this would fetch from fiscal summary service
      const mockDeductions = 3456.78;
      const mockAmortizations = 2890.45;
      const totalTaxBenefit = mockDeductions + (options.showAmortizations ? mockAmortizations : 0);

      // Apply Spanish formatting
      const formattedTotal = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
      }).format(totalTaxBenefit);

      // Mock trend calculation
      const mockPreviousYear = 5567.89;
      const trend = totalTaxBenefit > mockPreviousYear ? 'up' : 'down';
      const trendValue = new Intl.NumberFormat('es-ES', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format((totalTaxBenefit - mockPreviousYear) / mockPreviousYear);

      setData({
        value: totalTaxBenefit,
        formattedValue: formattedTotal,
        trend,
        trendValue,
        isLoading: false
      });

    } catch (error) {
      console.error('Error loading tax data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Error al cargar datos fiscales'
      }));
    }
  }, [options]);

  useEffect(() => {
    loadTaxData();
  }, [loadTaxData]);

  const handleNavigate = () => {
    if (onNavigate) {
      // Navigate to fiscal summary with filters
      onNavigate('/fiscalidad', {
        year: options.fiscalYear,
        showAmortizations: options.showAmortizations
      });
    }
  };

  const getSubtitle = () => {
    const year = options.fiscalYear;
    const components = ['deducciones'];
    if (options.showAmortizations) {
      components.push('amortizaciones');
    }
    return `Año ${year}: ${components.join(' + ')}`;
  };

  return (
    <DashboardBlockBase
      title="Fiscalidad"
      subtitle={getSubtitle()}
      data={data}
      icon={<FileText className="w-5 h-5" />}
      onNavigate={handleNavigate}
      className={className}
    >
      {/* Tax specific content */}
      <div className="mt-3 text-xs text-neutral-500">
        <div className="flex justify-between">
          <span>Deducciones aplicadas</span>
          <span className="font-medium text-green-600">
            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(3456.78)}
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Deducciones pendientes</span>
          <span className="font-medium text-amber-600">
            {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(789.12)}
          </span>
        </div>
        {options.showAmortizations && (
          <div className="flex justify-between mt-1">
            <span>Amortizaciones</span>
            <span className="font-medium text-blue-600">
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(2890.45)}
            </span>
          </div>
        )}
        <div className="border-t border-neutral-200 mt-2 pt-2 flex justify-between font-medium">
          <span>Total beneficio fiscal</span>
          <span className="text-green-700">
            {data.formattedValue}
          </span>
        </div>
      </div>
    </DashboardBlockBase>
  );
};

export default TaxBlock;