// Context expuesto por `FinanciacionPage` al `<Outlet />`.
//
// Solo datos CRUDOS. Antes viajaba también un `rows` de presentación derivado
// de `helpers.ts` —con la cuota rehecha a mano y el banco adivinado del
// nombre—, y era la vía por la que ese cálculo llegaba a todas las pantallas.
// Ahora cada vista se genera su cuadro con `generarCuadro` y lee de él.
//
// Y por eso ya no viaja `planes`: el contenedor leía el plan persistido de cada
// préstamo en cada carga, lo metía aquí… y no lo leía nadie. Las dos pantallas
// derivan su cuadro, y la única función con esa forma —`upcomingCuotasFromPlanes`—
// no la llamaba nadie tampoco. Era media carga de la pantalla, gastada en un
// dato que se tiraba.

import type { Prestamo } from '../../types/prestamos';

export interface FinanciacionOutletContext {
  /** Préstamos crudos del store. */
  prestamos: Prestamo[];
  /** Recarga datos · usar tras crear/editar/eliminar/amortizar. */
  reload: () => Promise<void>;
}
