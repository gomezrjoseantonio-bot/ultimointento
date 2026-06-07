/**
 * Placeholder de bloque · se reemplaza por la pantalla real en los commits
 * 4-6. Mantiene el flujo navegable (topbar · volver al mapa) entre tanto.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../../design-system/v5';
import OnboardingTopbar from '../OnboardingTopbar';
import { BLOQUES_META } from '../bloquesConfig';
import styles from '../empezar.module.css';
import type { BloqueId } from '../../../../services/onboardingProgressService';

const BloquePlaceholder: React.FC<{ bloqueId: BloqueId }> = ({ bloqueId }) => {
  const navigate = useNavigate();
  const meta = BLOQUES_META[bloqueId];
  return (
    <>
      <OnboardingTopbar exit="volver" />
      <div className={styles.main}>
        <div className={styles.kick}>{meta.nucleo ? 'Bloque núcleo' : 'Bloque'}</div>
        <h1 className={styles.h1}>{meta.titulo}</h1>
        <p className={styles.sub}>Este bloque se está construyendo.</p>
        <div className={styles.stepNav}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/empezar/hub')}>
            <Icons.ChevronLeft size={14} strokeWidth={2.5} /> Volver al mapa
          </button>
        </div>
      </div>
    </>
  );
};

export default BloquePlaceholder;
