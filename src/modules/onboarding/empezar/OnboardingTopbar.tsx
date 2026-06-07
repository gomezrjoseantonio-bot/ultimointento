/**
 * Topbar del flujo de onboarding (mockup · presente en pantallas 02-10).
 * Marca + barra de completitud (servicio único) + botón salir/volver.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../design-system/v5';
import { useOnboarding } from './OnboardingContext';
import styles from './empezar.module.css';

interface Props {
  /** Variante del botón derecho. 'salir' en el hub · 'volver' en bloques. */
  exit?: 'salir' | 'volver';
}

const OnboardingTopbar: React.FC<Props> = ({ exit = 'salir' }) => {
  const navigate = useNavigate();
  const { progress } = useOnboarding();

  const handleExit = () => {
    if (exit === 'volver') {
      navigate('/empezar/hub');
    } else {
      showToastV5('Progreso guardado · puedes volver desde el Panel', 'success');
      navigate('/panel');
    }
  };

  return (
    <div className={styles.topbar}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>A</div>
        <div>
          <div className={styles.brandName}>ATLAS</div>
          <div className={styles.brandSub}>Tu foto actual</div>
        </div>
      </div>
      <div className={styles.progress}>
        <span>Completitud</span>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress.pct}%` }} />
        </div>
        <span className={styles.progressPct}>{progress.pct}%</span>
      </div>
      <button type="button" className={styles.exit} onClick={handleExit}>
        {exit === 'volver' ? 'Volver al mapa' : 'Guardar y salir'}
        {exit === 'volver' ? <Icons.ChevronRight size={13} strokeWidth={2} /> : <Icons.Close size={13} strokeWidth={2} />}
      </button>
    </div>
  );
};

export default OnboardingTopbar;
