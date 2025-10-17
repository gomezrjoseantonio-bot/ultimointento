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
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
          3.2 Recomendación automática
        </h3>
        <div className="flex items-start gap-2 p-3 rounded-md" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <span className="text-lg">{getTrafficLightEmoji(fiscalROI.conclusion)}</span>
          <p className="text-sm" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {recommendationText}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
          3.3 Acciones (manuales)
        </h3>
        
        {!showDatePicker ? (
          <div className="flex gap-3">
            <button
              onClick={handleMantener}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: '#10B981',
                color: '#FFFFFF',
                fontSize: '14px',
              }}
            >
              🟢 Mantener
            </button>

            <button
              onClick={handleRevisar}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: '#9CA3AF',
                color: '#FFFFFF',
                fontSize: '14px',
              }}
            >
              ⚪ Revisar
            </button>

            <button
              onClick={handleVender}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                fontSize: '14px',
              }}
            >
              🔴 Vender
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Fecha de venta objetivo
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
                style={{ fontSize: '14px' }}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmVender}
                disabled={!targetDate}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '14px',
                }}
              >
                Confirmar venta
              </button>
              <button
                onClick={() => {
                  setShowDatePicker(false);
                  setTargetDate('');
                }}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={{
                  backgroundColor: '#E5E7EB',
                  color: '#374151',
                  fontSize: '14px',
                }}
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
