// BloqueProyeccion · P1 de la ficha de plan de pensiones (T-INVERSIONES-DETALLE-PP-v1 · §5.2).
//
// PR 1 · SHELL · estructura mínima + toggle funcional para escenarios.
// La integración con `proyeccionActivoService` · chips fuente · SVG real ·
// se cablea en PR 4.
//
// Componente GENÉRICO · agnóstico del tipo de activo (checklist §12 ✔).

import { useState } from 'react';
import type { TipoActivoProyectable } from '../../../../services/proyeccionActivoService';
import styles from './bloques.module.css';

export type EscenarioProyeccion = 'actual' | 'benchmark' | 'maxAportacion';

export interface BloqueProyeccionProps {
  posicionId: string;
  tipoActivo: TipoActivoProyectable;
  /** Mensaje principal (override). Default · texto provisional shell. */
  mensaje?: string;
}

const BloqueProyeccion = ({ posicionId, tipoActivo, mensaje }: BloqueProyeccionProps) => {
  const [escenario, setEscenario] = useState<EscenarioProyeccion>('actual');

  return (
    <section
      className={styles.bloque}
      data-bloque="P1"
      data-posicion-id={posicionId}
      data-tipo-activo={tipoActivo}
      aria-label="Proyección"
    >
      <div className={styles.bloqueHd}>
        <div className={styles.bloqueHdLeft}>
          <div className={styles.bloqueSupertitle}>Proyección</div>
          <div className={styles.bloqueMensaje}>
            {mensaje ?? 'Proyección · pendiente de cablear (PR 4)'}
          </div>
          <div className={styles.bloqueSub}>
            shell del bloque P1 · datos reales en PR 4.
          </div>
        </div>
        <div
          className={styles.toggle}
          role="group"
          aria-label="Cambiar escenario de proyección"
        >
          <button
            type="button"
            className={escenario === 'actual' ? styles.active : ''}
            onClick={() => setEscenario('actual')}
          >
            Escenario actual
          </button>
          <button
            type="button"
            className={escenario === 'benchmark' ? styles.active : ''}
            onClick={() => setEscenario('benchmark')}
          >
            Si cambias gestora
          </button>
          <button
            type="button"
            className={escenario === 'maxAportacion' ? styles.active : ''}
            onClick={() => setEscenario('maxAportacion')}
          >
            Si aportas el máximo
          </button>
        </div>
      </div>
      <div className={styles.bloquePlaceholder}>
        Gráfica de proyección · cono ±2 pp · chips fuente · 3 minis · cableado en PR 4
      </div>
    </section>
  );
};

export default BloqueProyeccion;
