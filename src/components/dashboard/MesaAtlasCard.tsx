import React from 'react';
import { ShieldAlert, ShieldCheck, TrendingUp } from 'lucide-react';
import type { MesaAtlasResult } from '../../services/mesaAtlasService';

interface MesaAtlasCardProps {
  data: MesaAtlasResult;
  onOpenPlan: () => void;
}

const getScoreTone = (score: number): 'critical' | 'warning' | 'healthy' => {
  if (score < 40) return 'critical';
  if (score < 70) return 'warning';
  return 'healthy';
};

const MesaAtlasCard: React.FC<MesaAtlasCardProps> = ({ data, onOpenPlan }) => {
  const tone = getScoreTone(data.score);

  return (
    <section className={`mesa-atlas-card mesa-atlas-card--${tone}`} aria-label="Índice Mesa Atlas">
      <div className="mesa-atlas-card__header">
        <div>
          <p className="mesa-atlas-card__title">Tu Mesa Atlas hoy</p>
          <p className="mesa-atlas-card__subtitle">{data.patasActivas}/4 patas activas</p>
        </div>
        <div className="mesa-atlas-card__score">{data.score}/100</div>
      </div>

      <div className="mesa-atlas-card__risk">
        {tone === 'healthy' ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
        <span>{data.principalRiesgo}</span>
      </div>

      <div className="mesa-atlas-card__footer">
        <span className="mesa-atlas-card__meta">
          <TrendingUp size={14} /> Concentración actual: {data.riesgoConcentracion}%
        </span>
        <button type="button" className="mesa-atlas-card__button" onClick={onOpenPlan}>
          Ver plan de estabilidad
        </button>
      </div>
    </section>
  );
};

export default MesaAtlasCard;
