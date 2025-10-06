import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3 } from 'lucide-react';
import DashboardBlockBase, { DashboardBlockProps, DashboardBlockData } from './DashboardBlockBase';
import { KPIsBlockOptions } from '../../services/dashboardService';
import { kpiService } from '../../services/kpiService';
import { useTheme } from '../../contexts/ThemeContext';

const KPIsBlock: React.FC<DashboardBlockProps> = ({ config, onNavigate, className, excludePersonal }) => {
  const { currentModule } = useTheme();
  const [data, setData] = useState<DashboardBlockData>({
    value: 0,
    formattedValue: '--',
    isLoading: true
  });
  const [kpiValues, setKpiValues] = useState<Array<{ name: string; value: string; trend?: 'up' | 'down' | 'neutral' }>>([]);

  const options = config.options as KPIsBlockOptions;

  const getMetricDisplayName = useCallback((metricId: string): string => {
    const nameMap: Record<string, string> = {
      'rentabilidad-neta': 'Rentabilidad neta',
      'beneficio-neto-mes': 'Cashflow mensual',
      'ocupacion': 'Ocupación',
      'rentabilidad-bruta': 'Rentabilidad bruta',
      'cap-rate': 'Cap Rate',
      'cash-on-cash': 'Cash-on-Cash'
    };
    return nameMap[metricId] || metricId;
  }, []);

  const getMockValueForMetric = useCallback(
    (metricId: string): string => {
      const baseMap: Record<string, string> = {
        'rentabilidad-neta': excludePersonal ? '3,98%' : '4,25%',
        'beneficio-neto-mes': excludePersonal ? '1.986,40 €' : '2.456,78 €',
        'ocupacion': excludePersonal ? '92,1%' : '87,5%',
        'rentabilidad-bruta': excludePersonal ? '6,12%' : '6,85%',
        'cap-rate': excludePersonal ? '4,9%' : '5,2%',
        'cash-on-cash': excludePersonal ? '3,4%' : '3,8%'
      };
      return baseMap[metricId] || '--';
    },
    [excludePersonal]
  );

  const loadKPIData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: undefined }));

      if (options.source === 'fixed-preset') {
        // Fixed KPIs for Preset B
        const fixedKPIs = excludePersonal
          ? [
              {
                name: 'Rentabilidad neta',
                value: '3,98%',
                trend: 'up' as const,
                rawValue: 3.98
              },
              {
                name: 'Cashflow mensual',
                value: '1.986,40 €',
                trend: 'up' as const,
                rawValue: 1986.4
              },
              {
                name: 'Ocupación',
                value: '92,1%',
                trend: 'up' as const,
                rawValue: 92.1
              }
            ]
          : [
              {
                name: 'Rentabilidad neta',
                value: '4,25%',
                trend: 'up' as const,
                rawValue: 4.25
              },
              {
                name: 'Cashflow mensual',
                value: '2.456,78 €',
                trend: 'up' as const,
                rawValue: 2456.78
              },
              {
                name: 'Ocupación',
                value: '87,5%',
                trend: 'neutral' as const,
                rawValue: 87.5
              }
            ];

        setKpiValues(fixedKPIs);

        // Use the first KPI as the main display value
        setData({
          value: fixedKPIs[0].rawValue,
          formattedValue: fixedKPIs[0].value,
          trend: fixedKPIs[0].trend,
          isLoading: false
        });

      } else {
        // Load from KPI Builder configuration
        try {
          const kpiConfig = await kpiService.getConfiguration(currentModule);
          const activeMetrics = kpiConfig.activeMetrics.slice(0, 3); // Limit to 3 for dashboard

          if (activeMetrics.length === 0) {
            setData(prev => ({
              ...prev,
              isLoading: false,
              error: 'No hay KPIs configurados'
            }));
            return;
          }

          // Mock KPI values - in real implementation, calculate from property data
          const mockKPIs = activeMetrics.map(metricId => ({
            name: getMetricDisplayName(metricId),
            value: getMockValueForMetric(metricId),
            trend: Math.random() > 0.5 ? 'up' as const : 'down' as const,
            rawValue: Math.random() * 100
          }));

          setKpiValues(mockKPIs);
          
          if (mockKPIs.length > 0) {
            setData({
              value: mockKPIs[0].rawValue,
              formattedValue: mockKPIs[0].value,
              trend: mockKPIs[0].trend,
              isLoading: false
            });
          }

        } catch (error) {
          console.error('Error loading KPI configuration:', error);
          setData(prev => ({
            ...prev,
            isLoading: false,
            error: 'Error al cargar configuración de KPIs'
          }));
        }
      }

    } catch (error) {
      console.error('Error loading KPI data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Error al cargar datos de KPIs'
      }));
    }
  }, [
    options,
    currentModule,
    excludePersonal,
    getMetricDisplayName,
    getMockValueForMetric
  ]);

  useEffect(() => {
    loadKPIData();
  }, [loadKPIData]);

  const handleNavigate = () => {
    if (onNavigate) {
      // Navigate to configuration page with KPI Builder
      onNavigate('/configuracion/preferencias-datos#kpis', {
        source: options.source
      });
    }
  };

  const getSubtitle = () => {
    if (options.source === 'fixed-preset') {
      return 'Métricas fijas: Rentabilidad, Cashflow, Ocupación';
    }
    return `${kpiValues.length} métricas activas del KPI Builder`;
  };

  return (
    <DashboardBlockBase
      title="KPIs"
      subtitle={getSubtitle()}
      data={data}
      icon={<BarChart3 className="w-5 h-5" />}
      onNavigate={handleNavigate}
      className={className}
      filterLabel={excludePersonal ? 'Sin finanzas personales' : undefined}
    >
      {/* KPI specific content */}
      <div className="mt-3 space-y-2">
        {kpiValues.slice(0, 3).map((kpi, index) => (
          <div key={index} className="flex justify-between items-center text-xs">
            <span className="text-neutral-500 truncate">{kpi.name}</span>
            <div className="flex items-center space-x-1">
              <span className="font-medium text-neutral-900">{kpi.value}</span>
              {kpi.trend && kpi.trend !== 'neutral' && (
                <span className={`text-${kpi.trend === 'up' ? 'green' : 'red'}-500`}>
                  {kpi.trend === 'up' ? '↗' : '↘'}
                </span>
              )}
            </div>
          </div>
        ))}
        
        {options.source !== 'fixed-preset' && kpiValues.length === 0 && !data.isLoading && (
          <div className="text-xs text-neutral-400 italic">
            Configure KPIs en Preferencias → KPIs
          </div>
        )}
      </div>
    </DashboardBlockBase>
  );
};

export default KPIsBlock;