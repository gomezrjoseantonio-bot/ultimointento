// ============================================================================
// Clasificar varias líneas con un solo concepto
// ============================================================================
//
// «quiero clasificarlo como gasto personal agua y solo me deja ignorar» — con
// cinco «Adeudo de canal isabel ii» marcados. La barra de bloque ofrecía
// ignorar y traspasar, que es justo lo que NO se hace con cinco recibos del
// agua, y clasificar —lo único que resuelve una línea de verdad— seguía siendo
// de una en una: cinco veces la misma ficha para el mismo concepto.
//
// Lo que de verdad se comparte entre esas cinco líneas es el CONCEPTO: de quién
// es (tuyo o de un piso), qué es (agua), y con qué casilla se declara. Lo que
// NO se puede compartir es el importe y la fecha — cada recibo trae los suyos.
//
// Copiar los del primero a los otros cuatro no sería un detalle: en el ejemplo
// de arriba metería 18,44 € de gasto que nunca salió de la cuenta, con fechas
// falsas, y encima en la declaración. Por eso esta regla vive aparte del
// formulario y con sus propios tests: es lo que hay que no equivocar.
// ============================================================================

import type { GuardadoFicha } from './FichaMovimiento';
import type { LineaExtracto } from './extractoSesion';

/**
 * Un juego de valores de ficha por línea · el concepto de la ficha, el dinero
 * de cada una.
 *
 * `tipo` también sale de la línea y no de la ficha: si entre lo elegido se cuela
 * un abono, clasificarlo como gasto sería apuntar una salida de dinero que fue
 * una entrada.
 */
export function valoresPorLinea(
  ficha: GuardadoFicha,
  lineas: LineaExtracto[],
): GuardadoFicha[] {
  return lineas.map((l) => ({
    ...ficha,
    tipo: l.importe >= 0 ? 'ingreso' : 'gasto',
    importe: l.importe,
    fecha: l.fecha,
  })) as GuardadoFicha[];
}
