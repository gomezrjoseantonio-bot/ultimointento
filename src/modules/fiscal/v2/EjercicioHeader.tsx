/**
 * EjercicioHeader · breadcrumb + título + pill estado + meta-line + link.
 * SPEC-CC-FISCAL-UI-REPLACE-v1 sub-tarea 3 §5.2.
 */

import React from 'react';
import type { DatosFiscalesEjercicio } from '../../../services/fiscalResolverService';
import styles from './FiscalEjercicioPage.module.css';

export interface EjercicioHeaderProps {
  año: number;
  datos: DatosFiscalesEjercicio;
  tieneParalela: boolean;
  fechaPresentacion?: string;
  justificante?: string;
  prescribe: string | null;
  esPrescrito: boolean;
  onBack: () => void;
  onGoDashboard: () => void;
  onGoAcciones: () => void;
}

function pillFor(estado: DatosFiscalesEjercicio['estado'], esPrescrito: boolean): {
  label: string;
  cls: string;
} {
  if (esPrescrito) return { label: 'Prescrito', cls: styles.pillPrescrito };
  if (estado === 'en_curso') return { label: 'En curso', cls: styles.pillCurso };
  if (estado === 'pendiente') return { label: 'Pendiente declarar', cls: styles.pillPendiente };
  return { label: 'Declarado', cls: styles.pillDeclarado };
}

function fuenteLabel(fuente: DatosFiscalesEjercicio['fuente']): string | null {
  if (fuente === 'xml_aeat') return 'importado del XML AEAT';
  if (fuente === 'pdf_aeat') return 'importado del PDF AEAT';
  if (fuente === 'atlas') return 'calculado por Atlas';
  return null;
}

function formatIsoDateAsEs(iso?: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

const EjercicioHeader: React.FC<EjercicioHeaderProps> = ({
  año,
  datos,
  tieneParalela,
  fechaPresentacion,
  justificante,
  prescribe,
  esPrescrito,
  onBack,
  onGoDashboard,
  onGoAcciones,
}) => {
  const pill = pillFor(datos.estado, esPrescrito);
  const fechaPres = formatIsoDateAsEs(fechaPresentacion);
  const prescribeFmt = formatIsoDateAsEs(prescribe);
  const fuente = fuenteLabel(datos.fuente);

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="breadcrumb">
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ‹ Volver
        </button>
        <button type="button" onClick={onGoDashboard}>Fiscal</button>
        <span className={styles.breadcrumbSep}>›</span>
        <span className={styles.breadcrumbCurrent}>Ejercicio {año}</span>
      </nav>

      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.pageHeadTitle}>
            Ejercicio {año}
            <span className={`${styles.pill} ${pill.cls}`}>{pill.label}</span>
            {tieneParalela && (
              <span className={`${styles.pill} ${styles.pillParalela}`}>v2</span>
            )}
          </h1>
          <div className={styles.metaLine}>
            {fechaPres && (
              <span>
                presentado{' '}
                <strong className={styles.mono}>{fechaPres}</strong>
              </span>
            )}
            {justificante && (
              <>
                <span className={styles.metaDot} />
                <span>
                  justificante{' '}
                  <strong className={styles.mono}>{justificante}</strong>
                </span>
              </>
            )}
            {fuente && (
              <>
                {(fechaPres || justificante) && <span className={styles.metaDot} />}
                <span>{fuente}</span>
              </>
            )}
            {prescribeFmt && !esPrescrito && (
              <>
                <span className={styles.metaDot} />
                <span>prescribe <strong className={styles.mono}>{prescribeFmt}</strong></span>
              </>
            )}
            {esPrescrito && (
              <>
                {(fechaPres || justificante || fuente) && <span className={styles.metaDot} />}
                <span>consultable · intocable</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className={styles.pageActionLink}
          onClick={onGoAcciones}
        >
          Acciones fiscales →
        </button>
      </header>
    </>
  );
};

export default EjercicioHeader;
