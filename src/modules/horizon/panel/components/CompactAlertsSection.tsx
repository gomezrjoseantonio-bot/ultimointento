import React from 'react';
import { AlertTriangle, AlertCircle, Info, ArrowRightLeft, FileText, Inbox } from 'lucide-react';
import { PanelFilters } from './HorizonVisualPanel';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  cta: 'simulate' | 'review_bonif' | 'open_inbox';
}

interface CompactAlertsSectionProps {
  filters: PanelFilters;
}

const CompactAlertsSection: React.FC<CompactAlertsSectionProps> = ({ filters }) => {
  // Mock data - max 3 alerts as per requirements
  const alerts: Alert[] = [
    {
      id: '1',
      type: 'critical' as const,
      title: 'Riesgo descubierto',
      description: 'ING próximo al límite mínimo establecido',
      cta: 'simulate' as const
    },
    {
      id: '2', 
      type: 'warning' as const,
      title: 'Bonificación hipoteca en riesgo',
      description: 'Próxima revisión de tipo variable en 15 días',
      cta: 'review_bonif' as const
    },
    {
      id: '3',
      type: 'info' as const,
      title: 'OCR pendiente crítico',
      description: 'Documentos requieren procesamiento inmediato',
      cta: 'open_inbox' as const
    }
  ].slice(0, 3); // Ensure max 3 alerts

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-hz-error" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-hz-warning" />;
      case 'info':
        return <Info className="w-4 h-4 text-hz-primary" />;
    }
  };

  const getAlertBadgeColor = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return 'bg-hz-error';
      case 'warning':
        return 'bg-hz-warning';
      case 'info':
        return 'bg-hz-success';
    }
  };

  const getCTAButton = (alert: Alert) => {
    switch (alert.cta) {
      case 'simulate':
        return (
          <button className="flex items-center gap-1 px-2 py-1 text-xs bg-hz-primary text-white rounded hover:bg-hz-primary-dark">
            <ArrowRightLeft className="w-3 h-3" />
            Simular transferencia
          </button>
        );
      case 'review_bonif':
        return (
          <button className="flex items-center gap-1 px-2 py-1 text-xs bg-hz-primary text-white rounded hover:bg-hz-primary-dark">
            <FileText className="w-3 h-3" />
            Revisar bonif.
          </button>
        );
      case 'open_inbox':
        return (
          <button className="flex items-center gap-1 px-2 py-1 text-xs bg-hz-primary text-white rounded hover:bg-hz-primary-dark">
            <Inbox className="w-3 h-3" />
            Abrir en Inbox
          </button>
        );
    }
  };

  const additionalCount = Math.max(0, 5 - alerts.length); // Mock additional alerts

  return (
    <div className="h-full bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-3 flex flex-col">
      {/* Header - Compact */}
      <h2 className="text-sm font-semibold text-hz-neutral-900 mb-2">Alertas</h2>
      
      {/* Alerts List - Compact, max 3 visible */}
      <div className="flex-1 space-y-2 overflow-hidden">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-start gap-2">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {getAlertIcon(alert.type)}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <h3 className="text-xs font-medium text-hz-neutral-900 truncate flex-1">
                  {alert.title}
                </h3>
                <div className={`w-2 h-2 rounded-full ${getAlertBadgeColor(alert.type)}`} />
              </div>
              <p className="text-xs text-hz-neutral-700 mb-1 truncate" title={alert.description}>
                {alert.description}
              </p>
              {getCTAButton(alert)}
            </div>
          </div>
        ))}
        
        {/* Show additional count if more than 3 */}
        {additionalCount > 0 && (
          <div className="text-xs text-hz-neutral-500 pt-1 border-t border-hz-neutral-200">
            +{additionalCount} más
          </div>
        )}
      </div>
    </div>
  );
};

export default CompactAlertsSection;