// ============================================================================
// Qué carencia tiene un préstamo · VOCABULARIO §6 bis · ter
// ============================================================================
//
// Una carencia es un periodo inicial en el que **no se amortiza capital**. Y
// hay dos, que no se parecen en lo que le pasa a tu deuda:
//
//   · **De capital** (o «solo intereses»). Pagas los intereses del mes y nada
//     más. El capital se queda quieto: al acabar debes lo mismo que el primer
//     día, ni más ni menos.
//   · **Total.** No pagas nada. Los intereses se siguen devengando y **se
//     capitalizan**: se suman al capital. Al acabar **debes MÁS de lo que
//     pediste**, y sobre esa deuda mayor se calcula la cuota del resto.
//
// La segunda es la que sorprende, y es justo la que la pantalla ya prometía:
// «Total · sin pagos durante N meses · los intereses se capitalizan». Lo decía
// el asistente desde el principio; lo que no hacía era cumplirlo.
//
// El plazo INCLUYE la carencia. Una hipoteca a 360 meses con 24 de carencia son
// 24 sin amortizar y 336 amortizando, no 384 en total.
//
// ── El descarajal que esto deshace ──────────────────────────────────────────
//
// Había CUATRO formas de decir lo mismo, y las dos que importaban no se
// hablaban entre sí:
//
//   1. `carencia` + `carenciaMeses` · se preguntaba en el alta, se guardaba, se
//      importaba y se exportaba. **Ningún cálculo la leía.**
//   2. `mesesSoloIntereses` · el motor la aplicaba y hacía exactamente una
//      carencia de capital. **Nadie la escribía.**
//   3. `esquemaPrimerRecibo: 'SOLO_INTERESES'` · un tercer nombre, y solo para
//      un mes. Lo escribía la importación desde plantilla.
//   4. `carenciaTecnica` · **NO es una carencia.** Son los días sueltos entre
//      la firma y el primer mes de cobro, que el banco liquida en un cargo
//      aparte. Comparte la palabra y no comparte nada más.
//
// Quien pedía doce meses de carencia veía un cuadro sin carencia, porque la
// mitad que se rellenaba y la mitad que se aplicaba eran campos distintos.
// ============================================================================

import type { Prestamo } from '../../types/prestamos';

export interface Carencia {
  tipo: 'NINGUNA' | 'CAPITAL' | 'TOTAL';
  /** Cuántos meses dura · siempre dentro del plazo, y nunca todos. */
  meses: number;
}

const SIN_CARENCIA: Carencia = { tipo: 'NINGUNA', meses: 0 };

/**
 * La carencia de un préstamo, ya normalizada.
 *
 * Devuelve `NINGUNA` con cero meses siempre que no haya una carencia que
 * aplicar, para que quien la use no tenga que repetir las comprobaciones.
 */
export function carenciaDe(prestamo: Prestamo): Carencia {
  const plazo = prestamo.plazoMesesTotal;

  // Siempre queda al menos una cuota que amortiza. Con tantos meses de carencia
  // como plazo —un dato mal tecleado, una importación torcida— el préstamo no
  // devolvería el capital nunca: el cuadro terminaría debiendo lo mismo que el
  // primer día (o más, si la carencia era total), y de ahí salen las
  // previsiones de tesorería y los intereses del ejercicio.
  const tope = Math.max(0, (Number.isFinite(plazo) ? plazo : 0) - 1);
  const acotar = (n: number): number =>
    Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), tope) : 0;

  if (prestamo.carencia === 'CAPITAL' || prestamo.carencia === 'TOTAL') {
    const meses = acotar(Number(prestamo.carenciaMeses));
    return meses > 0 ? { tipo: prestamo.carencia, meses } : SIN_CARENCIA;
  }

  // La importación desde plantilla escribe el esquema del primer recibo, y
  // «solo intereses» ahí significa un mes de carencia de capital. Es la misma
  // idea con otro nombre, así que se traduce en vez de mantener dos caminos.
  if (prestamo.esquemaPrimerRecibo === 'SOLO_INTERESES') {
    const meses = acotar(1);
    return meses > 0 ? { tipo: 'CAPITAL', meses } : SIN_CARENCIA;
  }

  return SIN_CARENCIA;
}
