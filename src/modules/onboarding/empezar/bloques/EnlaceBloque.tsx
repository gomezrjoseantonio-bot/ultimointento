/**
 * Bloque de enlace directo a un formulario existente (persona · cuentas).
 * No tienen pantalla de doble vía en el mockup · son tarjetas del hub que
 * llevan al alta de siempre. Reutiliza · no duplica.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../../design-system/v5';
import OnboardingTopbar from '../OnboardingTopbar';
import styles from '../empezar.module.css';

interface Props {
  kick: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaTo: string;
  note?: string;
}

const EnlaceBloque: React.FC<Props> = ({ kick, title, subtitle, ctaLabel, ctaTo, note }) => {
  const navigate = useNavigate();
  return (
    <>
      <OnboardingTopbar exit="volver" />
      <div className={styles.main}>
        <div className={styles.kick}>{kick}</div>
        <h1 className={styles.h1}>{title}</h1>
        <p className={styles.sub}>{subtitle}</p>
        <div style={{ marginTop: 26, display: 'flex', gap: 12 }}>
          <button type="button" className={styles.btnGold} onClick={() => navigate(ctaTo)}>
            {ctaLabel}
            <Icons.ChevronRight size={14} strokeWidth={2.5} />
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/empezar/hub')}>
            <Icons.ChevronLeft size={14} strokeWidth={2.5} /> Volver al mapa
          </button>
        </div>
        {note && <div className={styles.sugEmptyNote} style={{ marginTop: 16 }}>{note}</div>}
      </div>
    </>
  );
};

export default EnlaceBloque;
