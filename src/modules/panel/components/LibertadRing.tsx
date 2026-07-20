// Panel · anillo de libertad financiera dentro del héroe navy.
// Solo muestra el % cuando existe un objetivo de gasto REAL fijado en Mi Plan
// (el motor resuelve un default 2500 · informe FASE A §2.2). En otro caso, CTA.

import React from 'react';
import { fmtEur } from './format';
import type { AnilloState } from './types';
import styles from './LibertadRing.module.css';

export interface LibertadRingProps {
  anillo: AnilloState;
  /** Navega a Mi Plan para fijar el objetivo de gasto. */
  onDefinirObjetivo: () => void;
}

const R = 26;
const C = 2 * Math.PI * R;

const LibertadRing: React.FC<LibertadRingProps> = ({ anillo, onDefinirObjetivo }) => {
  const pct = anillo.estado === 'ok' ? anillo.pct : 0;
  const dash = (pct / 100) * C;

  return (
    <div className={styles.ring}>
      <div className={styles.wrap}>
        <svg width="62" height="62" viewBox="0 0 62 62" className={styles.svg}>
          <circle cx="31" cy="31" r={R} fill="none" className={styles.track} strokeWidth="6" />
          {anillo.estado === 'ok' && (
            <circle
              cx="31"
              cy="31"
              r={R}
              fill="none"
              className={styles.arc}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C}`}
            />
          )}
        </svg>
        <div className={`${styles.txt} mono`}>
          {anillo.estado === 'ok' ? `${anillo.pct}%` : '·'}
        </div>
      </div>
      <div>
        <div className={styles.lab}>Libertad financiera</div>
        {anillo.estado === 'ok' ? (
          <>
            <div className={`${styles.val} mono`}>
              {fmtEur(anillo.rentaActual)} de {fmtEur(anillo.objetivo)}
            </div>
            <div className={`${styles.sub} mono`}>
              {anillo.anioLibertad != null
                ? `${anillo.anioLibertad} · en ${anillo.añosRestantes} años`
                : 'sin cruce en el horizonte'}
            </div>
          </>
        ) : anillo.estado === 'sin-objetivo' ? (
          <button className={styles.cta} onClick={onDefinirObjetivo}>
            define tu gasto objetivo en Mi Plan
          </button>
        ) : anillo.estado === 'cargando' ? (
          <div className={styles.sub}>calculando…</div>
        ) : (
          <div className={styles.sub}>proyección no disponible</div>
        )}
      </div>
    </div>
  );
};

export default LibertadRing;
