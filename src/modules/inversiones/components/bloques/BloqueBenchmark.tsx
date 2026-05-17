// BloqueBenchmark · P2 de la ficha de plan de pensiones (T-INVERSIONES-DETALLE-PP-v1 · §5.3).
// PR 1 · SHELL · barras horizontales · banner análisis · chips fuente · cableado PR 4.

import type { TipoActivoProyectable } from '../../../../services/proyeccionActivoService';
import styles from './bloques.module.css';

export interface BloqueBenchmarkProps {
  posicionId: string;
  tipoActivo: TipoActivoProyectable;
  /** Política de inversión declarada del activo (rf · rv · mixto · etc.). */
  politicaInversion?: string;
}

const BloqueBenchmark = ({ posicionId, tipoActivo, politicaInversion }: BloqueBenchmarkProps) => {
  return (
    <section
      className={styles.bloque}
      data-bloque="P2"
      data-posicion-id={posicionId}
      data-tipo-activo={tipoActivo}
      data-politica={politicaInversion ?? ''}
      aria-label="Benchmark"
    >
      <div className={styles.bloqueHd}>
        <div className={styles.bloqueHdLeft}>
          <div className={styles.bloqueSupertitle}>Benchmark</div>
          <div className={styles.bloqueMensaje}>
            Comparativa con índices de referencia
          </div>
          <div className={styles.bloqueSub}>
            shell del bloque P2 · datos reales en PR 4.
          </div>
        </div>
      </div>
      <div className={styles.bloquePlaceholder}>
        Barras horizontales centradas en 0 · banner análisis · chip fuente de datos · cableado en PR 4
      </div>
    </section>
  );
};

export default BloqueBenchmark;
