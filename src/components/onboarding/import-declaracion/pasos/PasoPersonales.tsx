/**
 * PasoPersonales.tsx · Wizard import XML V2 · paso 9 (§ 4.12 · § 7.10).
 * Muestra los datos personales que se importan automáticamente del XML más
 * reciente. Cónyuge opt-in solo si tributación conjunta.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Lightbulb, X, Users } from 'lucide-react';
import type { WizardImportState } from '../useWizardImportState';
import { nombreCCAA } from '../../../../utils/ccaa';
import styles from '../WizardImportarDeclaracion.module.css';

const ESTADO_CIVIL: Record<string, string> = {
  soltero: 'Soltero',
  casado: 'Casado',
  viudo: 'Viudo',
  divorciado: 'Divorciado',
  separado: 'Separado',
};

const PasoPersonales: React.FC<{ s: WizardImportState }> = ({ s }) => {
  const [smartCerrado, setSmartCerrado] = useState(false);
  const principal = s.declaracionPrincipal;

  const laboral = useMemo(() => {
    const asalariado = s.declaraciones.some((d) => (d.trabajo?.retribucionesDinerarias ?? 0) > 0);
    const autonomo = s.declaraciones.some((d) => !!d.actividadEconomica);
    return { asalariado, autonomo };
  }, [s.declaraciones]);

  const conjunta = principal?.declarante.tributacion === 'conjunta';
  const [conyuge, setConyuge] = useState(false);

  useEffect(() => {
    s.setOpciones({ conyugeAnadirPersonal: conjunta && conyuge });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conjunta, conyuge]);

  if (!principal) {
    return (
      <>
        <div className={styles.stepTitle}>
          <span className={styles.stepTitleNum}>09</span> Datos personales
        </div>
        <div className={styles.skipEmpty}>
          <div className={styles.skipTitle}>Sin datos personales · sube un XML primero</div>
        </div>
      </>
    );
  }

  const d = principal.declarante;
  const laboralTxt = [laboral.asalariado ? 'asalariado' : null, laboral.autonomo ? 'autónomo' : null]
    .filter(Boolean)
    .join(' + ') || 'sin actividad detectada';

  return (
    <>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>09</span> Datos personales
      </div>
      <div className={styles.stepSub}>
        ATLAS importa automáticamente los datos personales del XML más reciente ({principal.meta.ejercicio}).
        {conjunta ? ' Tu tributación es conjunta · te preguntamos por el cónyuge.' : ''}
      </div>

      <div className={styles.persCard}>
        <div className={styles.persName}>{d.nombreCompleto}</div>
        <div className={styles.persNif}>NIF · {d.nif} · titular</div>
        <div className={styles.persDataGrid}>
          <div className={styles.persDataItem}>
            <div className={styles.persDataLab}>Sexo</div>
            <div className={styles.persDataVal}>{d.sexo === 'H' ? 'Hombre' : d.sexo === 'M' ? 'Mujer' : '—'}</div>
          </div>
          <div className={styles.persDataItem}>
            <div className={styles.persDataLab}>Fecha nacimiento</div>
            <div className={`${styles.persDataVal} ${styles.mono}`}>{d.fechaNacimiento || '—'}</div>
          </div>
          <div className={styles.persDataItem}>
            <div className={styles.persDataLab}>Estado civil</div>
            <div className={styles.persDataVal}>{d.estadoCivil ? ESTADO_CIVIL[d.estadoCivil] ?? d.estadoCivil : '—'}</div>
          </div>
          <div className={styles.persDataItem}>
            <div className={styles.persDataLab}>CCAA residencia</div>
            <div className={styles.persDataVal}>{nombreCCAA(d.nombreCCAA || d.codigoCCAA)}</div>
          </div>
          <div className={styles.persDataItem}>
            <div className={styles.persDataLab}>Tributación</div>
            <div className={styles.persDataVal}>{conjunta ? 'Conjunta' : 'Individual'}</div>
          </div>
          <div className={styles.persDataItem}>
            <div className={styles.persDataLab}>Situación laboral</div>
            <div className={styles.persDataVal}>{laboralTxt}</div>
          </div>
        </div>
      </div>

      {conjunta && (
        <div
          className={`${styles.toggleRow} ${conyuge ? styles.on : ''}`}
          onClick={() => setConyuge((v) => !v)}
          role="switch"
          aria-checked={conyuge}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setConyuge((v) => !v);
          }}
        >
          <div className={styles.toggleInfo}>
            <div className={styles.toggleLab}>Añadir cónyuge en Personal</div>
            <div className={styles.toggleSub}>Tu declaración es conjunta · puedes registrar al cónyuge ahora</div>
          </div>
          <div className={`${styles.toggleSwitch} ${conyuge ? styles.on : ''}`}>
            <div className={styles.toggleKnob} />
          </div>
        </div>
      )}

      {!smartCerrado && (
        <div className={styles.smart}>
          <Lightbulb className={styles.smartIcon} size={15} />
          <div>
            <strong>Situación laboral detectada · </strong>
            ATLAS la infiere de los rendimientos del XML ({laboralTxt}). Si en el futuro cesa una
            actividad, actualízalo desde Personal.
            {!conjunta && (
              <>
                {' '}
                <strong>Tributación individual · </strong>no preguntamos por cónyuge.
              </>
            )}
          </div>
          <button type="button" className={styles.smartClose} aria-label="Cerrar" onClick={() => setSmartCerrado(true)}>
            <X size={12} />
          </button>
        </div>
      )}

      <div className={styles.secTitle}>
        Descendientes / ascendientes detectados <span className={styles.count}>0</span>
      </div>
      <div className={styles.skipEmpty}>
        <div className={styles.skipIcon}>
          <Users size={32} strokeWidth={1.5} />
        </div>
        <div className={styles.skipTitle}>No se detectaron descendientes ni ascendientes</div>
        <div className={styles.skipSub}>
          Si necesitas añadirlos para deducción de mínimos personales, hazlo desde Personal · datos
          del titular.
        </div>
      </div>
    </>
  );
};

export default PasoPersonales;
