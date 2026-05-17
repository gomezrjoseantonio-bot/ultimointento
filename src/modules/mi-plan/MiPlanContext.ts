import type { Objetivo, FondoAhorro, Reto, Escenario } from '../../types/miPlan';
import type { ObjetivoVital } from '../../types/objetivosVitales';

export interface MiPlanOutletContext {
  escenario: Escenario | null;
  objetivos: Objetivo[];
  fondos: FondoAhorro[];
  retos: Reto[];
  retoActivo: Reto | null;
  retosUltimos12: Reto[];
  /** T-INVERSIONES-DETALLE-PP-v1 PR 3 · hitos vitales del usuario. */
  hitosVitales: ObjetivoVital[];
  reload: () => void;
}
