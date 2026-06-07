/**
 * Pantalla 01 · Welcome. Hero a pantalla completa · CTA al hub.
 * Fiel al mockup `atlas-onboarding-dia0-v4.html` (#page-welcome).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import styles from './empezar.module.css';

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.welcome}>
      <div className={styles.welcomeBrand}>
        <div className={styles.brandMark}>A</div>
        <div>
          <div className={styles.brandName}>ATLAS</div>
          <div className={styles.brandSub}>Patrimonio</div>
        </div>
      </div>
      <div className={styles.welcomeContent}>
        <h1 className={styles.welcomeTitle}>
          Cuéntale a Atlas tu <span className={styles.goldTxt}>foto actual</span>
        </h1>
        <p className={styles.welcomeText}>
          Lo que tienes hoy · quién te paga hoy · qué debes hoy. Con eso Atlas genera tu año entero por
          adelantado · tu caja prevista · tu IRPF estimado y tu camino hacia la libertad financiera.
        </p>
        <div className={styles.welcomePoints}>
          <div className={styles.welcomePoint}>
            <Icons.Clock size={15} strokeWidth={2} />
            30-45 min el caso típico
          </div>
          <div className={styles.welcomePoint}>
            <Icons.Archivo size={15} strokeWidth={2} />
            Tu progreso se guarda · vuelve cuando quieras
          </div>
          <div className={styles.welcomePoint}>
            <Icons.Zap size={15} strokeWidth={2} />
            Sube ficheros y Atlas rellena por ti
          </div>
        </div>
        <button type="button" className={`${styles.btnGold} ${styles.btnBig}`} onClick={() => navigate('/empezar/hub')}>
          Empezar mi foto actual
          <Icons.ChevronRight size={15} strokeWidth={2.5} />
        </button>
        <div className={styles.welcomeNote}>
          Sin documentos a mano también puedes empezar · todo tiene vía manual.
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
