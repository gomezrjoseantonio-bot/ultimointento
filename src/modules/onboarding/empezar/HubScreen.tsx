/**
 * Pantalla 02 · Hub de bloques + semáforo. Fiel al mockup (#page-hub).
 * Cada tarjeta refleja el estado real del bloque (servicio único) y navega a
 * su bloque. Banda navy SOLO con núcleo completo. Guardado continuo.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../design-system/v5';
import { useOnboarding } from './OnboardingContext';
import { BLOQUES_META_LIST } from './bloquesConfig';
import OnboardingTopbar from './OnboardingTopbar';
import styles from './empezar.module.css';
import type { BloqueEstado } from '../../../services/onboardingProgressService';

function ctaLabel(estado: BloqueEstado): string {
  if (estado === 'completado') return 'Revisar';
  if (estado === 'parcial') return 'Continuar';
  return 'Empezar';
}

const HubScreen: React.FC = () => {
  const navigate = useNavigate();
  const { state, progress, refresh } = useOnboarding();

  // Reentrante · refrescar al volver al hub (p.ej. tras completar un bloque).
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <>
      <OnboardingTopbar exit="salir" />
      <div className={styles.main}>
        <div className={styles.kick}>Tu foto actual · 8 bloques</div>
        <h1 className={styles.h1}>¿Por dónde seguimos?</h1>
        <p className={styles.sub}>
          Los 4 bloques núcleo encienden Atlas. El resto lo completas cuando quieras · cada uno mejora una
          pieza de tu foto.
        </p>

        <div className={styles.hubGrid}>
          {BLOQUES_META_LIST.map((meta) => {
            const bloque = state.bloques[meta.id];
            const estado = bloque?.estado ?? 'pendiente';
            const statusText =
              bloque?.detalle ??
              (estado === 'completado'
                ? 'Completado'
                : estado === 'parcial'
                  ? 'En progreso'
                  : meta.pendienteText);
            const stateClass =
              estado === 'completado' ? styles.done : estado === 'parcial' ? styles.partial : styles.pending;
            const { Icon } = meta;
            return (
              <button
                key={meta.id}
                type="button"
                className={`${styles.blk} ${stateClass} ${meta.nucleo ? styles.core : ''}`}
                onClick={() => navigate(`/empezar/${meta.id}`)}
              >
                <div className={styles.blkHead}>
                  <div className={styles.blkIcon}>
                    <Icon size={17} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className={styles.blkTitle}>{meta.titulo}</div>
                    <div className={styles.blkStatus}>{statusText}</div>
                  </div>
                </div>
                <div className={styles.blkFoot}>
                  <span className={styles.blkTime}>{meta.pie}</span>
                  <span className={styles.blkCta}>
                    {ctaLabel(estado)}
                    <Icons.ChevronRight size={13} strokeWidth={2.2} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {progress.nucleoCompleto && (
          <div className={styles.hubBottom}>
            <div>
              <div className={styles.hubBottomTxt}>Núcleo completo · Atlas ya está vivo</div>
              <div className={styles.hubBottomSub}>
                Tu año previsto te espera · lo pendiente lo completas desde el Panel
              </div>
            </div>
            <button type="button" className={styles.btnGold} onClick={() => navigate('/empezar/reveal')}>
              Ver mi año previsto
              <Icons.ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>
        )}

        <div className={styles.hubSaveNote}>
          <Icons.Archivo size={13} strokeWidth={2} />
          Todo se guarda solo · puedes salir y volver desde el Panel cuando quieras.
        </div>
      </div>
    </>
  );
};

export default HubScreen;
