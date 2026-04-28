// Tipos compartidos del módulo Inversiones (v5).
// Reflejan la fila de presentación que consumen tabs y subpáginas.

import type { PosicionInversion } from '../../types/inversiones';
import type { PlanPensionInversion } from '../../types/personal';

export type PositionRow = {
  id: string;
  alias: string;
  broker: string;
  tipo: string;
  aportado: number;
  valor: number;
  rentPct: number;
  rentAnual: number;
  peso: number;
  color: string;
  tag: string | null;
  fechaCompra: string | null;
  duracionMeses: number | null;
};

export type ClosedPosicion = PosicionInversion;

export type Plan = PlanPensionInversion;
