import React from 'react';
import { FiscalROI } from '../../../../../types/propertyAnalysis';
import { formatEuro, formatPercentage } from '../../../../../utils/formatUtils';
import { getTrafficLightEmoji } from '../../../../../utils/propertyAnalysisUtils';

interface FiscalROISectionProps {
  data: FiscalROI;
}

const FiscalROISection: React.FC<FiscalROISectionProps> = ({ data }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
        C. ROI fiscal y rendimiento real
      </h3>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Impuesto sobre rentas (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.impuestoRentas)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Cashflow neto tras impuestos (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.cashflowNetoTrasImpuestos)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            ROI fiscal neto (%)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatPercentage(data.roiFiscalNeto)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            ROI alternativo (coste de oportunidad)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatPercentage(data.roiAlternativo)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            ROI diferencial (%)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatPercentage(data.roiDiferencial)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Conclusión automática
          </label>
          <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            <span>{getTrafficLightEmoji(data.conclusion)}</span>
            <span>{data.conclusion}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FiscalROISection;
