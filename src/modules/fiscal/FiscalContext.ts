// Context expuesto por `FiscalPage` al `<Outlet />`.
// Las sub-páginas (Dashboard, Ejercicios, Detalle, Calendario, Configuración)
// consumen los mismos datos para evitar fetches redundantes.

import type { EjercicioFiscal } from '../../types/fiscal';
import type { EjercicioRow } from './types';

export interface FiscalOutletContext {
  ejercicios: EjercicioFiscal[];
  rows: EjercicioRow[];
  reload: () => Promise<void>;
}
