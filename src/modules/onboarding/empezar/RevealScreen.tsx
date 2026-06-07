/**
 * Pantalla 10 · Reveal · año previsto. Placeholder · la composición real
 * (bootstrap + banda navy + SVG + honestidad) llega en el commit 7.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import OnboardingTopbar from './OnboardingTopbar';
import styles from './empezar.module.css';

const RevealScreen: React.FC = () => {
  const navigate = useNavigate();
  return (
    <>
      <OnboardingTopbar exit="volver" />
      <div className={styles.main}>
        <div className={styles.kick}>Tu foto está viva</div>
        <h1 className={styles.h1}>Este es tu año por adelantado</h1>
        <p className={styles.sub}>El cierre con tu año previsto se construye en el siguiente paso.</p>
        <div className={styles.stepNav}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/empezar/hub')}>
            <Icons.ChevronLeft size={14} strokeWidth={2.5} /> Volver al mapa
          </button>
        </div>
      </div>
    </>
  );
};

export default RevealScreen;
