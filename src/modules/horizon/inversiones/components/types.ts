// types.ts
// ATLAS HORIZON: Shared types for Inversiones module

import { PosicionInversion } from '../../../../types/inversiones';

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

export type Tab = 'resumen' | 'cartera' | 'rendimientos' | 'individual';

export interface TabResumenProps {
  positions: PositionRow[];
  planesPension: any[]; // PlanPensionInversion
}

export interface TabCarteraProps {
  positions: PositionRow[];
  closedPositions: PosicionInversion[];
  planesPension: any[]; // PlanPensionInversion
  onSelectPosition: (id: string) => void;
  onViewAportaciones: (id: string) => void;
}

export interface TabRendimientosProps {
  positions: PositionRow[];
}

export interface TabIndividualProps {
  selectedId: string;
  positions: PositionRow[];
}
