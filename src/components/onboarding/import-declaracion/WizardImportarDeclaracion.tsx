/**
 * WizardImportarDeclaracion.tsx · Wizard import XML V2 · § 4.
 *
 * Componente raíz · modal fullscreen · grid 1fr/360px · header con stepper de
 * 10 píldoras · body del paso actual · footer sticky · aside navy con resumen
 * vivo. Réplica del mockup canónico atlas-wizard-import-mockup-completo-v1.html.
 *
 * Commit 4 implementa la estructura + pasos 1·2·3. Los pasos 4-10 muestran un
 * placeholder navegable (se implementan en commits 5·6·7).
 */

import React, { useEffect } from 'react';
import { FileText, X, Check, ArrowRight, Info, AlertCircle } from 'lucide-react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { useWizardImportState, PASOS, type PasoNum } from './useWizardImportState';
import AsideResumen from './AsideResumen';
import PasoFuente from './pasos/PasoFuente';
import PasoInmuebles from './pasos/PasoInmuebles';
import PasoIBAN from './pasos/PasoIBAN';
import styles from './WizardImportarDeclaracion.module.css';

export interface WizardImportarDeclaracionProps {
  open: boolean;
  onClose: () => void;
}

const WizardImportarDeclaracion: React.FC<WizardImportarDeclaracionProps> = ({ open, onClose }) => {
  const s = useWizardImportState();
  const containerRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const aplicables = s.pasosAplicables;
  const hayPosterior = aplicables.some((n) => n > s.pasoActual);

  const cuerpo = () => {
    switch (s.pasoActual) {
      case 1:
        return <PasoFuente s={s} />;
      case 2:
        return <PasoInmuebles s={s} />;
      case 3:
        return <PasoIBAN s={s} />;
      default: {
        const def = PASOS.find((p) => p.num === s.pasoActual);
        return (
          <>
            <div className={styles.stepTitle}>
              <span className={styles.stepTitleNum}>{String(s.pasoActual).padStart(2, '0')}</span>{' '}
              {def?.label}
            </div>
            <div className={styles.skipEmpty} style={{ marginTop: 16 }}>
              <div className={styles.skipIcon}>
                <Info size={26} />
              </div>
              <div className={styles.skipTitle}>Paso disponible próximamente</div>
              <div className={styles.skipSub}>Este paso se implementa en un commit posterior de esta serie.</div>
            </div>
          </>
        );
      }
    }
  };

  // Meta del footer según paso.
  const footerMeta = () => {
    if (s.pasoActual === 1) {
      const validos = s.archivos.filter((a) => a.estado === 'validado').length;
      return validos > 0 ? (
        <div className={`${styles.wizFootMeta} ${styles.ok}`}>
          <Check size={12} /> {validos} archivos válidos · listos para procesar
        </div>
      ) : (
        <div className={styles.wizFootMeta}>
          <AlertCircle size={12} /> Sube al menos un XML válido
        </div>
      );
    }
    if (s.pasoActual === 2) {
      const prefills = s.opciones.inmueblesPrefill ?? [];
      const incompletos = prefills.filter((p) => p.bedrooms == null).length;
      return incompletos > 0 ? (
        <div className={styles.wizFootMeta}>
          <AlertCircle size={12} /> {incompletos} inmuebles incompletos
        </div>
      ) : (
        <div className={`${styles.wizFootMeta} ${styles.ok}`}>
          <Check size={12} /> Inmuebles configurados
        </div>
      );
    }
    if (s.pasoActual === 3) {
      const n = (s.opciones.ibanAcciones ?? []).length;
      return (
        <div className={`${styles.wizFootMeta} ${styles.ok}`}>
          <Check size={12} /> {n} decisiones tomadas
        </div>
      );
    }
    return <div className={styles.wizFootMeta} />;
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.wiz} ref={containerRef} role="dialog" aria-modal="true" aria-label="Importar declaración IRPF">
        {/* HEADER */}
        <div className={styles.wizHead}>
          <div className={styles.wizTitleWrap}>
            <div className={styles.wizTitleIcon}>
              <FileText size={15} />
            </div>
            <div>
              <div className={styles.wizTitle}>Importar declaración IRPF</div>
              <div className={styles.wizSub}>
                {s.pasoActual === 1 ? '10 pasos · ~5 min' : `paso ${s.pasoActual} de 10`}
              </div>
            </div>
          </div>

          <div className={styles.wizSteps}>
            {PASOS.map((p, idx) => {
              const estado = s.estadoPaso(p.num as PasoNum);
              const cls = [styles.stepInd, estado === 'done' ? styles.done : '', estado === 'active' ? styles.active : '', estado === 'skipped' ? styles.skipped : '']
                .filter(Boolean)
                .join(' ');
              return (
                <React.Fragment key={p.num}>
                  <button
                    type="button"
                    className={cls}
                    onClick={() => s.irA(p.num as PasoNum)}
                    aria-current={estado === 'active'}
                  >
                    <span className={styles.stepNum}>
                      {estado === 'done' ? <Check size={9} strokeWidth={3} /> : p.num}
                    </span>
                    {p.label}
                  </button>
                  {idx < PASOS.length - 1 && <span className={styles.stepSep} />}
                </React.Fragment>
              );
            })}
          </div>

          <button type="button" className={styles.wizClose} aria-label="Cerrar" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* BODY */}
        <div className={styles.wizBody}>{cuerpo()}</div>

        {/* ASIDE */}
        <AsideResumen s={s} />

        {/* FOOTER */}
        <div className={styles.wizFooter}>
          {footerMeta()}
          <div className={styles.wizFootActions}>
            {s.pasoActual > 1 && (
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={s.anterior}>
                Anterior
              </button>
            )}
            {s.pasoActual === 2 && hayPosterior && (
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={s.siguiente}>
                Completar luego
              </button>
            )}
            {hayPosterior && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPos}`}
                onClick={s.siguiente}
                disabled={!s.puedeContinuar}
              >
                Continuar <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WizardImportarDeclaracion;
