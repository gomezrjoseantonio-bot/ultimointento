// Context expuesto por `InversionesPage` al `<Outlet />`.
// Las 4 sub-páginas (Resumen · Cartera · Rendimientos · Individual) consumen
// los mismos datos para evitar fetches redundantes.

import type { PosicionInversion } from '../../types/inversiones';
import type { PositionRow, Plan } from './types';

export interface InversionesOutletContext {
  /** Filas en formato presentación (incluye planes pensión). */
  positions: PositionRow[];
  /** Posiciones cerradas (declaradas) tal cual vienen del store. */
  closedPositions: PosicionInversion[];
  /** Planes de pensión raw · necesarios para algunos cálculos legacy. */
  planesPension: Plan[];
  /** ID seleccionada para Individual (string · plan-NN o número en string). */
  selectedPositionId: string;
  setSelectedPositionId: (id: string) => void;
  /** Recarga datos · usa después de crear/editar/eliminar. */
  reload: () => Promise<void>;
  /** Abrir formulario de posición · si recibe `posicion`, modo edición. */
  onOpenPosicionForm: (posicion?: PosicionInversion) => void;
  /** Abrir detalle de posición (modal con histórico aportaciones). */
  onOpenPosicionDetail: (id: string) => void;
}
