// Context expuesto por `FinanciacionPage` al `<Outlet />`.
//
// Solo datos CRUDOS. Antes viajaba también un `rows` de presentación derivado
// de `helpers.ts` —con la cuota rehecha a mano y el banco adivinado del
// nombre—, y era la vía por la que ese cálculo llegaba a todas las pantallas.
// Ahora cada vista se genera su cuadro con `generarCuadro` y lee de él.

import type { Prestamo, PlanPagos } from '../../types/prestamos';

export interface FinanciacionOutletContext {
  /** Préstamos crudos del store. */
  prestamos: Prestamo[];
  /**
   * Plan de pagos GUARDADO por préstamo · `null` si no se ha generado aún.
   *
   * No es la fuente de las cifras de pantalla: para eso está `generarCuadro`,
   * que es función pura del préstamo. Esto es el plan persistido, que puede
   * traer punteo de tesorería.
   */
  planes: Map<string, PlanPagos | null>;
  /** Recarga datos · usar tras crear/editar/eliminar/amortizar. */
  reload: () => Promise<void>;
}
