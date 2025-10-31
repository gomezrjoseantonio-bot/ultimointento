import React, { useState } from 'react';
import { PropertyDecision, FiscalROI } from '../../../../../types/propertyAnalysis';
import { getRecommendationText, getTrafficLightEmoji } from '../../../../../utils/propertyAnalysisUtils';

interface RecommendationActionSectionProps {
  fiscalROI: FiscalROI;
  capitalNetoFinal: number;
  onDecision: (decision: PropertyDecision, targetDate?: string) => void;
}

const RecommendationActionSection: React.FC<RecommendationActionSectionProps> = ({ 
  fiscalROI, 
  capitalNetoFinal,
  onDecision 
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [targetDate, setTargetDate] = useState('');

  const recommendationText = getRecommendationText(
    fiscalROI.conclusion,
    fiscalROI.roiFiscalNeto,
    fiscalROI.roiAlternativo,
    capitalNetoFinal
  );

  const handleMantener = () => {
    onDecision('MANTENER');
  };

  const handleRevisar = () => {
    // Schedule review for 6 months from now
    const reviewDate = new Date();
    reviewDate.setMonth(reviewDate.getMonth() + 6);
    onDecision('REVISAR', reviewDate.toISOString().split('T')[0]);
  };

  const handleVender = () => {
    setShowDatePicker(true);
  };

  const confirmVender = () => {
    if (targetDate) {
      onDecision('VENDER', targetDate);
      setShowDatePicker(false);
      setTargetDate('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Automatic Recommendation */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-hz-neutral-900">
          3.2 Recomendación automática
        </h3>
        <div className="flex items-start gap-2 p-3 rounded-md bg-hz-neutral-100">
          <span className="text-lg">{getTrafficLightEmoji(fiscalROI.conclusion)}</span>
          <p className="text-sm text-hz-neutral-800">
            {recommendationText}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-hz-neutral-900">
          3.3 Acciones (manuales)
        </h3>
        
        {!showDatePicker ? (
          <div className="flex gap-3">
            <button
              onClick={handleMantener}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-success-500 hover:bg-success-600 text-white"
            >
              🟢 Mantener
            </button>

            <button
              onClick={handleRevisar}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-hz-neutral-500 hover:bg-hz-neutral-600 text-white"
            >
              ⚪ Revisar
            </button>

            <button
              onClick={handleVender}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-error-500 hover:bg-error-600 text-white"
            >
              🔴 Vender
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1 text-hz-neutral-600">
                Fecha de venta objetivo
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="px-3 py-2 border border-hz-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-hz-primary focus:border-hz-primary"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmVender}
                disabled={!targetDate}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-error-500 hover:bg-error-600 text-white disabled:opacity-50"
              >
                Confirmar venta
              </button>
              <button
                onClick={() => {
                  setShowDatePicker(false);
                  setTargetDate('');
                }}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors bg-hz-neutral-200 hover:bg-hz-neutral-300 text-hz-neutral-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationActionSection;
