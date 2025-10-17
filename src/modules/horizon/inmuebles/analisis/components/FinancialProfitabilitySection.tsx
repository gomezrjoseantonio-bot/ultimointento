import React from 'react';
import { FinancialProfitability } from '../../../../../types/propertyAnalysis';
import { formatEuro, formatPercentage } from '../../../../../utils/formatUtils';

interface FinancialProfitabilitySectionProps {
  data: FinancialProfitability;
}

const FinancialProfitabilitySection: React.FC<FinancialProfitabilitySectionProps> = ({ data }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
        B. Rentabilidad financiera
      </h3>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Valor actual del activo (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.valorActualActivo)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Deuda pendiente (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.deudaPendiente)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Equity actual (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.equityActual)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Rentabilidad bruta (%)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatPercentage(data.rentabilidadBruta)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Rentabilidad neta (%)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatPercentage(data.rentabilidadNeta)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            ROI equity real (%)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatPercentage(data.roiEquityReal)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            ROI total (%)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatPercentage(data.roiTotal)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialProfitabilitySection;
