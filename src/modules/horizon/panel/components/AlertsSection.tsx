import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, AlertCircle, Info, Clock, ArrowRightLeft, Plus, CheckCircle } from 'lucide-react';
import { PanelFilters } from './HorizonVisualPanel';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  account?: string;
  currentBalance?: number;
  threshold?: number;
  projectedBalance?: number;
}

interface AlertsSectionProps {
  filters: PanelFilters;
}

const AlertsSection: React.FC<AlertsSectionProps> = ({ filters }) => {
  const navigate = useNavigate();
  
  // Mock data - in real implementation would come from services
  const alerts: Alert[] = [
    {
      id: '1',
      type: 'critical',
      title: 'Riesgo de descubierto',
      description: 'Cuenta Santander proyectada en negativo en 5 días',
      account: 'Santander · 1234',
      currentBalance: 850,
      threshold: 500,
      projectedBalance: -200
    },
    {
      id: '2', 
      type: 'warning',
      title: 'Umbral de seguridad',
      description: 'ING próximo al límite mínimo establecido',
      account: 'ING · 5678',
      currentBalance: 750,
      threshold: 500,
      projectedBalance: 400
    },
    {
      id: '3',
      type: 'info',
      title: 'Revisión hipoteca',
      description: 'Próxima revisión de tipo variable en 15 días',
      account: 'BBVA · 9012'
    }
  ];

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-hz-error" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-hz-warning" />;
      case 'info':
        return <Info className="w-5 h-5 text-hz-primary" />;
    }
  };

  const getAlertBadgeColor = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return 'bg-hz-error text-white';
      case 'warning':
        return 'bg-hz-warning text-white';
      case 'info':
        return 'bg-hz-success text-white';
    }
  };

  const renderMicroGauge = (current: number, threshold: number, projected: number) => {
    const max = Math.max(current, threshold * 1.5, Math.abs(projected) * 1.2);
    const thresholdPercent = (threshold / max) * 100;
    const projectedPercent = projected >= 0 ? (projected / max) * 100 : 0;

    return (
      <div className="mt-3">
        <div className="flex justify-between text-xs text-hz-neutral-500 mb-1">
          <span>Saldo proyectado</span>
          <span className={projected < threshold ? 'text-hz-error' : 'text-hz-success'}>
            {projected < 0 ? '-' : ''}€{Math.abs(projected).toLocaleString()}
          </span>
        </div>
        <div className="relative h-2 bg-hz-neutral-100 rounded-full overflow-hidden">
          {/* Background bar */}
          <div className="absolute inset-0 bg-hz-neutral-100" />
          
          {/* Threshold marker */}
          <div 
            className="absolute top-0 w-0.5 h-full bg-hz-neutral-500"
            style={{ left: `${thresholdPercent}%` }}
          />
          
          {/* Projected balance bar */}
          <div 
            className={`absolute top-0 h-full transition-all ${
              projected < threshold ? 'bg-hz-error' : 'bg-hz-success'
            }`}
            style={{ width: `${Math.max(projectedPercent, 2)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-hz-neutral-500 mt-1">
          <span>€0</span>
          <span>Umbral: €{threshold.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  const handleSimulateTransfer = (alertId: string, account?: string) => {
    // Show loading toast and navigate to treasury section
    toast.loading('Abriendo simulador de transferencias...', { id: 'simulate-transfer' });
    setTimeout(() => {
      toast.success('Redirigiendo a Tesorería', { id: 'simulate-transfer' });
      navigate('/tesoreria', { state: { action: 'simulate', alertId, account } });
    }, 500);
  };

  const handleRegisterTransfer = (alertId: string, account?: string) => {
    // Show loading toast and navigate to treasury section
    toast.loading('Abriendo registro de transferencias...', { id: 'register-transfer' });
    setTimeout(() => {
      toast.success('Redirigiendo a Tesorería', { id: 'register-transfer' });
      navigate('/tesoreria', { state: { action: 'register', alertId, account } });
    }, 500);
  };

  const handlePostpone = (alertId: string) => {
    // Show success toast for postponing
    toast.success('Alerta pospuesta por 24 horas', {
      icon: '⏰',
      duration: 3000,
    });
  };

  const handleMarkDone = (alertId: string) => {
    // Show success toast for marking as done
    toast.success('Alerta marcada como completada', {
      icon: '✅',
      duration: 3000,
    });
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-6">
        <h2 className="text-lg font-semibold text-hz-neutral-900 mb-4">Alertas</h2>
        <div className="text-center py-8 text-hz-neutral-500">
          <Info className="w-12 h-12 mx-auto mb-4 text-hz-neutral-300" />
          <p>No hay alertas activas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-6">
      <h2 className="text-lg font-semibold text-hz-neutral-900 mb-4">Alertas</h2>
      
      <div className="space-y-4">
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            className="border border-hz-neutral-200 rounded-lg p-4 bg-hz-card-bg"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {getAlertIcon(alert.type)}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-hz-neutral-900">{alert.title}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getAlertBadgeColor(alert.type)}`}>
                        {alert.type === 'critical' ? 'Crítico' : alert.type === 'warning' ? 'Advertencia' : 'Info'}
                      </span>
                    </div>
                    <p className="text-sm text-hz-neutral-700 mb-2">{alert.description}</p>
                    {alert.account && (
                      <p className="text-xs text-hz-neutral-500">{alert.account}</p>
                    )}
                  </div>
                </div>

                {/* Micro-gauge for balance alerts */}
                {alert.threshold && alert.projectedBalance !== undefined && (
                  renderMicroGauge(alert.currentBalance!, alert.threshold, alert.projectedBalance)
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-4">
                  <button 
                    onClick={() => handleSimulateTransfer(alert.id, alert.account)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-hz-primary text-white rounded-md hover:bg-hz-primary-dark transition-colors"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    Simular transferencia
                  </button>
                  <button 
                    onClick={() => handleRegisterTransfer(alert.id, alert.account)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-hz-success text-white rounded-md hover:bg-opacity-90 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Registrar transferencia
                  </button>
                  <button 
                    onClick={() => handlePostpone(alert.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-hz-neutral-100 text-hz-neutral-700 rounded-md hover:bg-hz-neutral-200 transition-colors"
                  >
                    <Clock className="w-3 h-3" />
                    Posponer 24h
                  </button>
                  <button 
                    onClick={() => handleMarkDone(alert.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-hz-neutral-100 text-hz-neutral-700 rounded-md hover:bg-hz-neutral-200 transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Hecho
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertsSection;