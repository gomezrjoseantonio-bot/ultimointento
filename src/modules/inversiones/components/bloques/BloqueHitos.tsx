// BloqueHitos · P4 de la ficha de plan de pensiones (T-INVERSIONES-DETALLE-PP-v1 · §5.5).
// PR 1 · SHELL · timeline horizontal · derivación de hitos del sistema +
// objetivos vitales del usuario · cableado en PR 4 (depende del store
// `objetivosVitales` que entra en PR 3).

import type { TipoActivoProyectable } from '../../../../services/proyeccionActivoService';
import styles from './bloques.module.css';

export interface BloqueHitosProps {
  posicionId: string;
  tipoActivo: TipoActivoProyectable;
  /** Fecha de apertura del activo · necesaria para "+10 años" y "+15 años". */
  fechaApertura?: string;
}

const BloqueHitos = ({ posicionId, tipoActivo, fechaApertura }: BloqueHitosProps) => {
  return (
    <section
      className={styles.bloque}
      data-bloque="P4"
      data-posicion-id={posicionId}
      data-tipo-activo={tipoActivo}
      data-fecha-apertura={fechaApertura ?? ''}
      aria-label="Hitos"
    >
      <div className={styles.bloqueHd}>
        <div className={styles.bloqueHdLeft}>
          <div className={styles.bloqueSupertitle}>Hitos vivos</div>
          <div className={styles.bloqueMensaje}>
            Eventos relevantes hasta el rescate
          </div>
          <div className={styles.bloqueSub}>
            shell del bloque P4 · derivación de hitos + objetivos vitales en PR 4.
          </div>
        </div>
      </div>
      <div className={styles.bloquePlaceholder}>
        Timeline horizontal · apertura+10/+15 · jubilación · objetivos vitales · cableado en PR 4
      </div>
    </section>
  );
};

export default BloqueHitos;
