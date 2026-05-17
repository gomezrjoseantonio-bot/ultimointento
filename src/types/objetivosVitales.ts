// Tipos · store `objetivosVitales` (V73 · PR 3).
// T-INVERSIONES-DETALLE-PP-v1 · §4.C Caso B.
//
// Convive con el store `objetivos` (T27.1 · discriminado por tipo
// acumular/amortizar/comprar/reducir · ligado a fondos/préstamos/categorías).
// Son DOS conceptos distintos:
//   - `objetivos`         · operativos financieros · acción mes a mes.
//   - `objetivosVitales`  · eventos de vida con fecha · usados por
//                           BloqueHitos en la ficha de inversiones (PR 4)
//                           para mostrar la timeline de hitos hasta rescate.

export type TipoObjetivoVital =
  | 'jubilacion'
  | 'salida_empresa'
  | 'compra_vivienda'
  | 'hijo_universidad'
  | 'herencia'
  | 'otro';

export interface ObjetivoVital {
  id: string;                           // UUID
  nombre: string;                       // "Salida de Orange España"
  fechaEstimada: string;                // ISO date · yyyy-mm-dd
  descripcion?: string;
  /**
   * FK a `planesPensiones.id` (o futura ficha de fondo · acción · etc.).
   * - null · objetivo global · afecta a todas las inversiones del usuario.
   * - string · objetivo asociado a una posición concreta.
   */
  planFinancieroAsociado: string | null;
  tipo: TipoObjetivoVital;
  fechaCreacion: string;                // ISO
  fechaModificacion: string;            // ISO
}
