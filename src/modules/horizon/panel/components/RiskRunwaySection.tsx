import React from 'react';
import { PanelFilters } from './HorizonVisualPanel';

interface RiskRunwaySectionProps {
  filters: PanelFilters;
}

const RiskRunwaySection: React.FC<RiskRunwaySectionProps> = ({ filters }) => {
  // Mock data - in real implementation would aggregate from treasury services
  const runwayDays = 15; // Example: 15 days remaining
  const thresholdAmount = 5000; // Example threshold in EUR
  
  // Determine status based on runway days
  const getRunwayStatus = (days: number) => {
    if (days >= 30) return { color: 'hz-success', label: 'Bueno', bgColor: 'bg-hz-success' };
    if (days >= 7) return { color: 'hz-warning', label: 'Aviso', bgColor: 'bg-hz-warning' };
    return { color: 'hz-error', label: 'Crítico', bgColor: 'bg-hz-error' };
  };
  
  const status = getRunwayStatus(runwayDays);
  
  // Mock estimated date when threshold will be crossed
  const crossingDate = new Date();
  crossingDate.setDate(crossingDate.getDate() + runwayDays);
  
  // Calculate gauge percentage (0-100%)
  const maxDays = 60; // Consider 60 days as "full"
  const gaugePercent = Math.min((runwayDays / maxDays) * 100, 100);
  
  return (
    <div className="h-full bg-hz-card-bg rounded-lg border border-hz-neutral-300 p-3 flex flex-col">
      {/* Header */}
      <h2 className="text-sm font-semibold text-hz-neutral-900 mb-3">Riesgo & Runway</h2>
      
      {/* Mini Gauge */}
      <div className="flex-1 flex flex-col justify-center items-center">
        {/* Circular Progress */}
        <div className="relative w-16 h-16 mb-3">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              strokeWidth="8"
              fill="none"
              className="stroke-hz-neutral-200"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - gaugePercent / 100)}`}
              className={`stroke-current text-${status.color}`}
              strokeLinecap="round"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-bold text-hz-neutral-900">
                {runwayDays}
              </div>
              <div className="text-xs text-hz-neutral-500">días</div>
            </div>
          </div>
        </div>
        
        {/* Subtitle with status */}
        <div className="text-center">
          <div className="text-xs text-hz-neutral-700 mb-1">
            Runway: {runwayDays} días | Umbral: €{thresholdAmount.toLocaleString()}
          </div>
          
          {/* Status pill */}
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${status.bgColor}`}>
            {status.label}
          </div>
        </div>
      </div>
      
      {/* Tooltip info - visible on hover (mock implementation) */}
      <div className="mt-2 text-xs text-hz-neutral-500 text-center" title={`Fecha estimada: ${crossingDate.toLocaleDateString('es-ES')}`}>
        Cruce: {crossingDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
      </div>
    </div>
  );
};

export default RiskRunwaySection;