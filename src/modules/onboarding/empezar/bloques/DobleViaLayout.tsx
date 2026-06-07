/**
 * Layout común de los bloques de doble vía (pantallas 03-09): topbar · kick ·
 * título · subtítulo · grid de dos vías · contenido extra · navegación de paso.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, showToastV5 } from '../../../../design-system/v5';
import OnboardingTopbar from '../OnboardingTopbar';
import styles from '../empezar.module.css';

interface Props {
  kick: string;
  title: string;
  subtitle: string;
  children: React.ReactNode; // via-grid + extras
  /** Texto del botón "lo haré después" (toast). */
  skipNote?: string;
}

const DobleViaLayout: React.FC<Props> = ({ kick, title, subtitle, children, skipNote }) => {
  const navigate = useNavigate();
  return (
    <>
      <OnboardingTopbar exit="volver" />
      <div className={styles.main}>
        <div className={styles.kick}>{kick}</div>
        <h1 className={styles.h1}>{title}</h1>
        <p className={styles.sub}>{subtitle}</p>
        {children}
        <div className={styles.stepNav}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/empezar/hub')}>
            <Icons.ChevronLeft size={14} strokeWidth={2.5} /> Volver al mapa
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => {
              showToastV5(skipNote ?? 'Bloque saltado · queda en el semáforo del Panel', 'info');
              navigate('/empezar/hub');
            }}
          >
            Lo haré después
          </button>
        </div>
      </div>
    </>
  );
};

export default DobleViaLayout;
