import React from 'react';
import { FiscalROI } from '../../../../../types/propertyAnalysis';
import { getTrafficLightEmoji } from '../../../../../utils/propertyAnalysisUtils';
import { formatPercentage } from '../../../../../utils/formatUtils';

interface PropertyHeaderProps {
  propertyAlias: string;
  location: string;
  purchaseDate: string;
  fiscalROI: FiscalROI;
}

const PropertyHeader: React.FC<PropertyHeaderProps> = ({
  propertyAlias,
  location,
  purchaseDate,
  fiscalROI,
}) => {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="flex items-center gap-6">
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Nombre del activo
          </span>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {propertyAlias}
          </div>
        </div>

        <div className="w-px h-10" style={{ backgroundColor: 'var(--border-color)' }} />

        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Ubicación
          </span>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {location}
          </div>
        </div>

        <div className="w-px h-10" style={{ backgroundColor: 'var(--border-color)' }} />

        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Fecha compra
          </span>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {purchaseDate}
          </div>
        </div>

        <div className="w-px h-10" style={{ backgroundColor: 'var(--border-color)' }} />

        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            ROI fiscal neto
          </span>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {formatPercentage(fiscalROI.roiFiscalNeto)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-2xl">{getTrafficLightEmoji(fiscalROI.conclusion)}</span>
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Recomendación automática
          </span>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {fiscalROI.conclusion}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyHeader;
