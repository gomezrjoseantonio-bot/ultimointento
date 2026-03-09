import React from 'react';
import { PropertyDecision, FiscalROI } from '../../../../../types/propertyAnalysis';
import { getRecommendationText, getTrafficLightEmoji } from '../../../../../utils/propertyAnalysisUtils';

interface RecommendationActionSectionProps {
  fiscalROI: FiscalROI;
  capitalNetoFinal: number;
  onDecision: (decision: PropertyDecision, targetDate?: string) => void;
  disabled?: boolean;
}

const RecommendationActionSection: React.FC<RecommendationActionSectionProps> = ({
  fiscalROI,
  capitalNetoFinal,
  onDecision,
  disabled = false,
}) => {
  const recommendationText = getRecommendationText(
    fiscalROI.conclusion,
    fiscalROI.roiFiscalNeto,
    fiscalROI.roiAlternativo,
    capitalNetoFinal
  );

  const handleRevisar = () => {
    const reviewDate = new Date();
    reviewDate.setMonth(reviewDate.getMonth() + 6);
    onDecision('REVISAR', reviewDate.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-hz-neutral-900">3.2 Recomendación automática</h3>
        <div className="flex items-start gap-2 p-3 rounded-md bg-hz-neutral-100">
          <span className="text-lg">{getTrafficLightEmoji(fiscalROI.conclusion)}</span>
          <p className="text-sm text-hz-neutral-800">{recommendationText}</p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-hz-neutral-900">3.3 Acciones (manuales)</h3>
        <div className="flex gap-3">
          <button
            onClick={() => onDecision('MANTENER')}
            disabled={disabled}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-success-500 hover:bg-success-600 text-white"
          >
            🟢 Mantener
          </button>

          <button
            onClick={handleRevisar}
            disabled={disabled}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-hz-neutral-500 hover:bg-hz-neutral-600 text-white"
          >
            ⚪ Revisar
          </button>

          <button
            onClick={() => onDecision('VENDER')}
            disabled={disabled}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-error-500 hover:bg-error-600 text-white"
          >
            🔴 Vender
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecommendationActionSection;
