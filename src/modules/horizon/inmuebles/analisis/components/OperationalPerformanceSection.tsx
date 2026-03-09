import React from 'react';
import { OperationalPerformance } from '../../../../../types/propertyAnalysis';
import { formatEuro } from '../../../../../utils/formatUtils';

interface OperationalPerformanceSectionProps {
  data: OperationalPerformance;
}

const OperationalPerformanceSection: React.FC<OperationalPerformanceSectionProps> = ({ data }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
        A. Rendimiento operativo (base real)
      </h3>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Ingresos mensuales (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.ingresosMensuales)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Gastos operativos (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.gastosOperativos)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Cuota hipoteca (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.cuotaHipoteca)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Cashflow neto mensual (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.cashflowNetoMensual)}
          </div>
        </div>

        <div>
          <label className="block text-sm" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Cashflow anual (€)
          </label>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatEuro(data.cashflowAnual)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationalPerformanceSection;
