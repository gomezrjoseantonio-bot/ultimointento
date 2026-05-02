import React from 'react';
import styles from '../WizardNuevoObjetivo.module.css';
import type { ObjetivoDraft } from '../types';
import type { RitmoResult } from '../utils/calcularRitmo';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const fmtEur = (n: number): string =>
  `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

const parseFecha = (iso: string): { mes: number; anio: number } => {
  if (!iso) {
    const d = new Date();
    return { mes: d.getMonth() + 1, anio: d.getFullYear() + 1 };
  }
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    const t = new Date();
    return { mes: t.getMonth() + 1, anio: t.getFullYear() + 1 };
  }
  return { mes: d.getMonth() + 1, anio: d.getFullYear() };
};

const buildIso = (mes: number, anio: number): string =>
  `${anio}-${String(mes).padStart(2, '0')}-01`;

interface Props {
  draft: ObjetivoDraft;
  ritmo: RitmoResult;
  onPatch: (patch: Partial<ObjetivoDraft>) => void;
  /** Si false oculta el input · ej. para tipo='reducir' donde el ritmo no aplica. */
  showRitmo: boolean;
}

const Step3Plazo: React.FC<Props> = ({ draft, ritmo, onPatch, showRitmo }) => {
  const { mes, anio } = parseFecha(draft.fechaCierre);
  const today = new Date();
  const minYear = today.getFullYear();
  const years: number[] = [];
  for (let y = minYear; y <= minYear + 15; y++) years.push(y);

  const onMesChange = (m: number) => onPatch({ fechaCierre: buildIso(m, anio) });
  const onAnioChange = (y: number) => onPatch({ fechaCierre: buildIso(mes, y) });

  let ritmoBoxClass = styles.ritmoBox;
  let ritmoTitText = 'En ruta · indica capacidad';
  if (ritmo.estado === 'ok') {
    ritmoBoxClass = `${styles.ritmoBox} ${styles.ritmoBoxOk}`;
    ritmoTitText = 'En ruta · sí';
  } else if (ritmo.estado === 'tight') {
    ritmoBoxClass = `${styles.ritmoBox} ${styles.ritmoBoxTight}`;
    ritmoTitText = 'En ruta · ajustado';
  } else if (ritmo.estado === 'no') {
    ritmoBoxClass = `${styles.ritmoBox} ${styles.ritmoBoxNo}`;
    ritmoTitText = 'En ruta · no';
  }

  return (
    <div>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>03</span> ¿Para cuándo?
      </div>
      <div className={styles.stepSubText}>
        Elige una fecha objetivo. ATLAS calcula el ritmo necesario para llegar a tiempo y te
        dice si vas en ruta con tu capacidad de ahorro actual.
      </div>

      <div className={styles.formSection}>
        <div className={styles.formSectionTit}>Fecha objetivo</div>
        <div className={styles.formRow}>
          <div className={styles.formField}>
            <span className={styles.formLab}>Mes / año</span>
            <div className={styles.formRow} style={{ margin: 0, gap: 8 }}>
              <select
                className={styles.formSelect}
                value={mes}
                onChange={(e) => onMesChange(Number(e.target.value))}
                aria-label="Mes objetivo"
              >
                {MESES.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                className={styles.formSelect}
                value={anio}
                onChange={(e) => onAnioChange(Number(e.target.value))}
                aria-label="Año objetivo"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLab} htmlFor="obj-capacidad">
              Capacidad de ahorro mensual estimada
            </label>
            <div className={styles.formInputGroup}>
              <input
                id="obj-capacidad"
                className={`${styles.formInput} ${styles.formInputMono}`}
                type="text"
                inputMode="decimal"
                value={draft.capacidadAhorroMensual}
                placeholder="0"
                onChange={(e) => onPatch({ capacidadAhorroMensual: e.target.value })}
              />
              <span className={styles.formInputSuf}>€/mes</span>
            </div>
            <div className={styles.formHelp}>
              ¿Cuánto puedes apartar al mes? ATLAS calculará esto automáticamente cuando T8
              cierre.
            </div>
          </div>
        </div>
      </div>

      {showRitmo && (
        <>
          <div className={ritmoBoxClass}>
            <div className={styles.ritmoTit}>{ritmoTitText}</div>
            <div className={styles.ritmoVal}>
              {ritmo.ritmoNecesarioMensual > 0
                ? `+${fmtEur(ritmo.ritmoNecesarioMensual)}/mes`
                : '— €/mes'}
            </div>
            <div className={styles.ritmoMsg}>{ritmo.mensaje}</div>
          </div>

          <div className={styles.ritmoLeyenda}>
            <strong>Variantes de ritmo</strong>
            <span className={styles.ritmoLeyendaPos}>En ruta sí</span> · si tu capacidad
            &gt; ritmo necesario ·{' '}
            <span className={styles.ritmoLeyendaWarn}>ajustado</span> · si capacidad ≈ ritmo
            (margen &lt; 10%) ·{' '}
            <span className={styles.ritmoLeyendaNeg}>no</span> · si capacidad &lt; ritmo ·
            ATLAS sugiere alargar fecha o subir aportación.
          </div>
        </>
      )}

      {!showRitmo && (
        <div className={styles.ritmoLeyenda}>
          Para objetivos de tipo <strong>Reducir</strong> el progreso se mide comparando el
          gasto mensual actual con la meta indicada · no se calcula ritmo de aportación.
        </div>
      )}
    </div>
  );
};

export default Step3Plazo;
