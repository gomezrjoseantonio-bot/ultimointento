// ============================================================================
// Las piezas sueltas de la pantalla del plan · §6 bis · quater
// ============================================================================
//
// Tres ficheros se reparten esta pantalla —plantear, escribir las reglas y leer
// el resultado— y estas cuatro cosas las usan dos de ellos. Aquí, y no copiadas
// en cada uno: dos listas de meses que se separen es un idioma distinto en la
// misma pantalla, y dos clases de campo que se separen son dos formularios.
// ============================================================================

import type { ReglaDeAdelanto } from '../../../../services/prestamos/planDeAdelantos';

/** Cómo se teclea el «hasta cuándo» · lo guardado es una fecha o unas veces. */
export type Fin = 'FINAL' | 'FECHA' | 'VECES';

/** Una regla en la pantalla · con el desplegable que no se guarda. */
export interface ReglaEditable extends ReglaDeAdelanto {
  fin: Fin;
}

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const campo = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';
export const etiqueta = 'block text-xs font-medium text-gray-600 mb-1';
