// BloqueCostes · P3 de la ficha de plan de pensiones (T-INVERSIONES-DETALLE-PP-v1 · §5.4).
// PR 1 · SHELL · copy tipo-aware en PR 4. La función `getCopyPorTipo` se añade
// junto al cableado real para evitar lógica muerta en PR 1.

import type { TipoActivoProyectable } from '../../../../services/proyeccionActivoService';
import styles from './bloques.module.css';

/** Subtipos del plan a efectos de copy (§5.4). */
export type TipoPlanCoste = 'PPI' | 'PPE' | 'PPES' | 'PPA';

export interface BloqueCostesProps {
  posicionId: string;
  tipoActivo: TipoActivoProyectable;
  /** Tipo administrativo del plan · gobierna el copy y el accionable. */
  tipoPlan?: TipoPlanCoste;
}

const BloqueCostes = ({ posicionId, tipoActivo, tipoPlan }: BloqueCostesProps) => {
  return (
    <section
      className={styles.bloque}
      data-bloque="P3"
      data-posicion-id={posicionId}
      data-tipo-activo={tipoActivo}
      data-tipo-plan={tipoPlan ?? ''}
      aria-label="Coste de comisiones"
    >
      <div className={styles.bloqueHd}>
        <div className={styles.bloqueHdLeft}>
          <div className={styles.bloqueSupertitle}>Comisiones</div>
          <div className={styles.bloqueMensaje}>
            Coste acumulado y proyectado
          </div>
          <div className={styles.bloqueSub}>
            shell del bloque P3 · copy tipo-aware (PPI · PPE · PPES · PPA) en PR 4.
          </div>
        </div>
      </div>
      <div className={styles.bloquePlaceholder}>
        Comisiones acumuladas + proyectadas + ahorro hipotético · cableado en PR 4
      </div>
    </section>
  );
};

export default BloqueCostes;
