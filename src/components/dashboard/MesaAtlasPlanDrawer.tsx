import React from 'react';
import { X } from 'lucide-react';
import type { MesaAtlasRecommendation, ResilienceScenario } from '../../services/mesaAtlasService';

interface MesaAtlasPlanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: MesaAtlasRecommendation[];
  scenarios: ResilienceScenario[];
}

const MesaAtlasPlanDrawer: React.FC<MesaAtlasPlanDrawerProps> = ({
  isOpen,
  onClose,
  recommendations,
  scenarios
}) => {
  if (!isOpen) return null;

  return (
    <div className="mesa-atlas-overlay" role="dialog" aria-modal="true" aria-label="Plan de estabilidad Mesa Atlas">
      <div className="mesa-atlas-drawer">
        <header className="mesa-atlas-drawer__header">
          <div>
            <h3>Plan de estabilidad (90 días)</h3>
            <p>Prioriza acciones de alto impacto para reforzar tus patas más débiles.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar plan Mesa Atlas">
            <X size={18} />
          </button>
        </header>

        <section>
          <h4>Acciones recomendadas</h4>
          <ul className="mesa-atlas-list">
            {recommendations.map((recommendation) => (
              <li key={recommendation.id}>
                <strong>{recommendation.titulo}</strong>
                <p>{recommendation.descripcion}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4>Simulador básico de resiliencia</h4>
          <ul className="mesa-atlas-list mesa-atlas-list--scenarios">
            {scenarios.map((scenario) => (
              <li key={scenario.id}>
                <span>{scenario.nombre}</span>
                <strong>{scenario.mesesEstabilidad} meses</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default MesaAtlasPlanDrawer;
