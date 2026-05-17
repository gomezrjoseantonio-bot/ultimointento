// BloqueSandbox · P5 de la ficha de plan de pensiones (T-INVERSIONES-DETALLE-PP-v1 · §5.6).
// PR 1 · SHELL · 3 sliders · recálculo dinámico · topes por tipo · cableado PR 4.

import type { TipoActivoProyectable } from '../../../../services/proyeccionActivoService';
import type { TipoPlanCoste } from './BloqueCostes';
import styles from './bloques.module.css';

export interface BloqueSandboxProps {
  posicionId: string;
  tipoActivo: TipoActivoProyectable;
  /** Para topes de aportación según §5.6.1 (sólo aplica si plan de pensiones). */
  tipoPlan?: TipoPlanCoste;
  /** Usuario marcado como discapacitado (sube tope a 24 250 €). */
  discapacidad?: boolean;
}

const BloqueSandbox = ({
  posicionId,
  tipoActivo,
  tipoPlan,
  discapacidad,
}: BloqueSandboxProps) => {
  return (
    <section
      className={styles.bloque}
      data-bloque="P5"
      data-posicion-id={posicionId}
      data-tipo-activo={tipoActivo}
      data-tipo-plan={tipoPlan ?? ''}
      data-discapacidad={discapacidad ? '1' : '0'}
      aria-label="Sandbox · y si..."
    >
      <div className={styles.bloqueHd}>
        <div className={styles.bloqueHdLeft}>
          <div className={styles.bloqueSupertitle}>Sandbox · y si...</div>
          <div className={styles.bloqueMensaje}>
            Simula aportación, años y rentabilidad
          </div>
          <div className={styles.bloqueSub}>
            shell del bloque P5 · sliders + recálculo dinámico en PR 4.
          </div>
        </div>
      </div>
      <div className={styles.bloquePlaceholder}>
        3 sliders (aportación · años · TWR) · valor final + diferencia vs actual · cableado en PR 4
      </div>
    </section>
  );
};

export default BloqueSandbox;
