import React from 'react';
import { CreditCard, Plus, RefreshCcw } from 'lucide-react';

interface ConciliacionHeaderProps {
  onAddMovement?: () => void;
  onRegeneratePredictions?: () => void;
  regenerating?: boolean;
}

const ConciliacionHeader: React.FC<ConciliacionHeaderProps> = ({
  onAddMovement,
  onRegeneratePredictions,
  regenerating,
}) => (
  <div className="cv2-header">
    <CreditCard className="cv2-header-icon" size={20} />
    <div className="cv2-header-title-block">
      <div className="cv2-header-title">Conciliación</div>
      <div className="cv2-header-subtitle">Previsto y confirmado del mes</div>
    </div>
    <div className="cv2-header-actions">
      {onRegeneratePredictions && (
        <button
          type="button"
          className="cv2-btn cv2-btn-secondary"
          onClick={onRegeneratePredictions}
          disabled={regenerating}
        >
          <RefreshCcw size={14} />
          {regenerating ? 'Regenerando…' : 'Regenerar previsiones'}
        </button>
      )}
      {onAddMovement && (
        <button type="button" className="cv2-btn cv2-btn-primary" onClick={onAddMovement}>
          <Plus size={14} />
          Añadir movimiento
        </button>
      )}
    </div>
  </div>
);

export default ConciliacionHeader;
