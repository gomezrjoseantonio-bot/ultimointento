// Context expuesto por `FinanciacionPage` al `<Outlet />`.
// Las 4 sub-páginas (Dashboard · Listado · Snowball · Calendario) y la página
// Detalle consumen los mismos datos para evitar fetches redundantes.

import type { Prestamo, PlanPagos } from '../../types/prestamos';
import type { LoanRow } from './types';

export interface FinanciacionOutletContext {
  /** Préstamos crudos del store. */
  prestamos: Prestamo[];
  /** Filas de presentación (alias, banco, KPIs derivados). */
  rows: LoanRow[];
  /** Plan de pagos por préstamo · `null` si no se ha generado aún. */
  planes: Map<string, PlanPagos | null>;
  /** Recarga datos · usar tras crear/editar/eliminar/amortizar. */
  reload: () => Promise<void>;
}
