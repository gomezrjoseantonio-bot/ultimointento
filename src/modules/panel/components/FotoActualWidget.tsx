/**
 * Pantalla 11 · Widget "Tu foto actual" en el Panel · semáforo permanente del
 * onboarding. % + barra + pendientes con deep-link a cada bloque de /empezar.
 * Visible mientras la completitud < 100% · desaparece al 100% (§2.7).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import {
  computeProgress,
  getOnboardingState,
  NUCLEO_BLOQUES,
  type OnboardingProgress,
} from '../../../services/onboardingProgressService';
import { syncNucleoFromData } from '../../../services/onboardingSyncService';
import { getAvisosOnboarding, type AvisoOnboarding } from '../../../services/onboardingAvisosService';
import { BLOQUES_META } from '../../onboarding/empezar/bloquesConfig';
import styles from './FotoActualWidget.module.css';

const FotoActualWidget: React.FC = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [avisos, setAvisos] = useState<AvisoOnboarding[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await syncNucleoFromData().catch(() => undefined);
      const [state, av] = await Promise.all([getOnboardingState(), getAvisosOnboarding()]);
      if (alive) {
        setProgress(computeProgress(state));
        setAvisos(av);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Oculto mientras carga · o al 100% sin avisos pendientes (§2.7). Si queda un
  // aviso (p.ej. financiado sin préstamo) seguimos mostrándolo.
  if (!progress || (progress.pct >= 100 && avisos.length === 0)) return null;

  const nucleoHechos = NUCLEO_BLOQUES.filter((b) => !progress.pendientes.includes(b));

  return (
    <div className={styles.widget}>
      <div className={styles.head}>
        <div className={styles.title}>Tu foto actual</div>
        <div className={styles.pct}>{progress.pct}%</div>
      </div>
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${progress.pct}%` }} />
      </div>
      <ul className={styles.items}>
        {nucleoHechos.length > 0 && (
          <li>
            <Icons.Check className={styles.icDone} size={14} strokeWidth={2.5} />
            {nucleoHechos.map((b) => BLOQUES_META[b].titulo.toLowerCase()).join(' · ')}
          </li>
        )}
        {progress.pendientes.map((id) => (
          <li key={id} className={styles.todo}>
            <Icons.Alert className={styles.icTodo} size={14} strokeWidth={2.5} />
            {BLOQUES_META[id].titulo}
            <button type="button" className={styles.link} onClick={() => navigate(`/empezar/${id}`)}>
              Completar →
            </button>
          </li>
        ))}
        {avisos.map((a) => (
          <li key={a.clave} className={styles.todo}>
            <Icons.Alert className={styles.icTodo} size={14} strokeWidth={2.5} />
            {a.label}
            <button type="button" className={styles.link} onClick={() => navigate(a.deepLink)}>
              Vincular →
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FotoActualWidget;
