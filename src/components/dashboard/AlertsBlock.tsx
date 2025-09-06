import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import DashboardBlockBase, { DashboardBlockProps, DashboardBlockData } from './DashboardBlockBase';
import { AlertsBlockOptions } from '../../services/dashboardService';

interface Alert {
  id: string;
  type: 'reconciliation' | 'ocr' | 'due-dates';
  title: string;
  priority: 'high' | 'medium' | 'low';
  date?: string;
}

const AlertsBlock: React.FC<DashboardBlockProps> = ({ config, onNavigate, className }) => {
  const [data, setData] = useState<DashboardBlockData>({
    value: 0,
    formattedValue: '0',
    isLoading: true
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const options = config.options as AlertsBlockOptions;

  const loadAlertsData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: undefined }));

      // Mock alerts data
      // In real implementation, this would fetch from various services
      const mockAlerts: Alert[] = [
        {
          id: '1',
          type: 'reconciliation',
          title: 'Conciliar movimientos bancarios',
          priority: 'high',
          date: '2024-01-15'
        },
        {
          id: '2',
          type: 'ocr',
          title: 'Revisar facturas OCR',
          priority: 'medium'
        },
        {
          id: '3',
          type: 'due-dates',
          title: 'Pago vencimiento contrato',
          priority: 'high',
          date: '2024-01-20'
        },
        {
          id: '4',
          type: 'reconciliation',
          title: 'Confirmar transferencias',
          priority: 'low'
        },
        {
          id: '5',
          type: 'due-dates',
          title: 'Renovación seguro',
          priority: 'medium',
          date: '2024-01-25'
        }
      ];

      // Filter by configured types
      const filteredAlerts = mockAlerts.filter(alert => 
        options.types.includes(alert.type)
      );

      // Limit by max count
      const limitedAlerts = filteredAlerts.slice(0, options.maxLimit);

      setAlerts(limitedAlerts);

      // Count high priority alerts for main display
      const highPriorityCount = limitedAlerts.filter(alert => alert.priority === 'high').length;
      const totalCount = limitedAlerts.length;

      setData({
        value: totalCount,
        formattedValue: totalCount.toString(),
        trend: highPriorityCount > 0 ? 'down' : 'neutral',
        trendValue: highPriorityCount > 0 ? `${highPriorityCount} críticas` : undefined,
        isLoading: false
      });

    } catch (error) {
      console.error('Error loading alerts data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Error al cargar alertas'
      }));
    }
  }, [options]);

  useEffect(() => {
    loadAlertsData();
  }, [loadAlertsData]);

  const handleNavigate = () => {
    if (onNavigate) {
      // Navigate to alerts center with filters
      onNavigate('/inbox', {
        types: options.types,
        limit: options.maxLimit
      });
    }
  };

  const getSubtitle = () => {
    const typeNames: Record<string, string> = {
      'reconciliation': 'conciliación',
      'ocr': 'OCR',
      'due-dates': 'vencimientos'
    };
    
    const typesList = options.types.map(type => typeNames[type]).join(', ');
    return `${typesList} (máx. ${options.maxLimit})`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-error-600 bg-error-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'low': return 'text-success-600 bg-success-50';
      default: return 'text-neutral-600 bg-neutral-50';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reconciliation': return '🔄';
      case 'ocr': return '📄';
      case 'due-dates': return '⏰';
      default: return '📋';
    }
  };

  return (
    <DashboardBlockBase
      title="Alertas"
      subtitle={getSubtitle()}
      data={data}
      icon={<AlertTriangle className="w-5 h-5" />}
      onNavigate={handleNavigate}
      className={className}
    >
      {/* Alerts specific content */}
      <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
        {alerts.length === 0 && !data.isLoading ? (
          <div className="text-xs text-neutral-400 italic text-center py-2">
            No hay alertas pendientes
          </div>
        ) : (
          alerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`flex items-center justify-between text-xs p-2 rounded border ${getPriorityColor(alert.priority)}`}
            >
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <span>{getTypeIcon(alert.type)}</span>
                <span className="truncate font-medium">{alert.title}</span>
              </div>
              <div className="flex items-center space-x-1 flex-shrink-0">
                {alert.date && (
                  <span className="text-xs opacity-75">
                    {new Intl.DateTimeFormat('es-ES', { 
                      month: 'short', 
                      day: 'numeric' 
                    }).format(new Date(alert.date))}
                  </span>
                )}
                <span>{getPriorityIcon(alert.priority)}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      {alerts.length >= options.maxLimit && (
        <div className="mt-2 text-xs text-neutral-500 text-center">
          Mostrando {options.maxLimit} de {options.maxLimit}+ alertas
        </div>
      )}
    </DashboardBlockBase>
  );
};

export default AlertsBlock;