import React, { useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { formatCompact } from '../../utils/formatUtils';
import './treasury-reconciliation.css';

interface DetailItem {
  icon: LucideIcon;
  label: string;
  previsto: number;
  real: number;
}

interface SummaryFlipCardProps {
  title: string;
  icon: LucideIcon;
  previsto: number;
  real: number;
  detalles?: DetailItem[];
}

/**
 * ATLAS HORIZON - Summary Flip Card
 * 
 * Tarjeta resumen con animación flip (click para ver desglose).
 * - FRENTE: Icono + Título + "Previsto / Real" + label "PREV. / REAL"
 * - DORSO (flip): Desglose detallado con iconos, labels en NEGRITA y valores prev/real
 * - Click → rota 180° en Y
 * - Altura fija: 80px
 * - Iconos SIEMPRE en azul ATLAS
 * - Valores en negro/navy (NO verde/rojo)
 */
const SummaryFlipCard: React.FC<SummaryFlipCardProps> = ({
  title,
  icon: Icon,
  previsto,
  real,
  detalles
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const hasDetails = detalles && detalles.length > 0;

  const handleClick = () => {
    if (hasDetails) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (hasDetails && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setIsFlipped(!isFlipped);
    }
  };

  return (
    <div 
      className={`summary-flip-card-decision ${isFlipped ? 'summary-flip-card--flipped' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={hasDetails ? 0 : undefined}
      aria-label={hasDetails ? `${title}: ${formatCompact(previsto)} / ${formatCompact(real)}. Click para ver desglose` : `${title}: ${formatCompact(previsto)} / ${formatCompact(real)}`}
      aria-expanded={hasDetails ? isFlipped : undefined}
    >
      <div className="summary-flip-card__inner">
        {/* FRENTE */}
        <div className="summary-flip-card__front">
          <div className="summary-flip-card__header">
            <Icon className="summary-flip-card__icon" size={24} />
            <span className="summary-flip-card__title">{title}</span>
          </div>
          <div className="summary-flip-card__value-decision">
            {formatCompact(previsto)} / {formatCompact(real)}
          </div>
          <div className="summary-flip-card__label">PREV. / REAL</div>
        </div>

        {/* DORSO */}
        <div className="summary-flip-card__back">
          <div className="summary-flip-card__header">
            <Icon className="summary-flip-card__icon" size={20} />
            <span className="summary-flip-card__title-back">{title}</span>
          </div>
          {detalles && detalles.length > 0 ? (
            <div className="summary-flip-card__detail-list-decision">
              {detalles.map((detalle) => {
                const DetailIcon = detalle.icon;
                return (
                  <div key={detalle.label} className="summary-flip-card__detail-item-decision">
                    <DetailIcon size={16} className="summary-flip-card__detail-icon" />
                    <span className="summary-flip-card__detail-label">{detalle.label}</span>
                    <span className="summary-flip-card__detail-value">
                      {formatCompact(detalle.previsto)} / {formatCompact(detalle.real)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="summary-flip-card__label">Sin desglose</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SummaryFlipCard;
