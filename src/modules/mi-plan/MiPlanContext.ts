import type { Objetivo, FondoAhorro, Reto, Escenario } from '../../types/miPlan';

export interface MiPlanOutletContext {
  escenario: Escenario | null;
  objetivos: Objetivo[];
  fondos: FondoAhorro[];
  retos: Reto[];
  retoActivo: Reto | null;
  retosUltimos12: Reto[];
  reload: () => void;
}
