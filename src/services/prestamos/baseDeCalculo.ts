// ============================================================================
// Cómo cuenta los días el banco · VOCABULARIO §6 bis · bis
// ============================================================================
//
// La cuota de un préstamo francés se calcula siempre igual, con el tipo entre
// doce. Pero **el interés que el banco liquida cada mes no sale de ahí**: sale
// de contar días.
//
//   interés = capital × TIN × días ÷ base
//
// Y la BASE es una cláusula de la escritura, no una constante:
//
//   · **365/360** · días reales sobre un año de 360. La clásica de las
//     hipotecas españolas, y la que **más interés cobra**: 365/360 = 1,0139, o
//     sea un **1,39 % más** que contando sobre 365.
//   · **365/365** · días reales sobre 365. Lo que muchos bancos usan hoy.
//   · **30/360** · todos los meses valen 30 y el año 360. Equivale a dividir
//     entre doce, y es lo único que ATLAS sabía hacer.
//
// Mientras la base no se pregunte, el desglose interés/capital de cada recibo
// **no puede cuadrar con el del banco**, aunque la cuota coincida al céntimo.
// Es la última pieza de «que el cuadro cuadre con el banco».
//
// **Ausente = 30/360**, que es lo que ATLAS venía haciendo. No se presume la
// clásica 365/360 aunque sea la más habitual: eso movería el cuadro de todos
// los préstamos ya guardados sin que nadie lo haya pedido, y presumir una
// cláusula que nadie ha leído es inventarse un dato — la misma regla que la
// fecha de revisión y el valor del índice.
// ============================================================================

import type { BaseCalculoIntereses, Prestamo } from '../../types/prestamos';

/**
 * El tipo del dominio, con el nombre corto que usa este módulo.
 *
 * Alias, no una copia: dos uniones paralelas se desincronizan en cuanto alguien
 * añada o quite una base, y entonces la pantalla ofrecería una que el motor no
 * sabe calcular.
 */
export type BaseDeCalculo = BaseCalculoIntereses;

/** Lo que ATLAS hacía antes de preguntar · el mes comercial. */
export const BASE_POR_DEFECTO: BaseDeCalculo = '30/360';

const VALIDAS: readonly BaseDeCalculo[] = ['30/360', 'ACT/360', 'ACT/365'];

/** Cómo se llama cada una en pantalla, con lo que hace. */
export const NOMBRE_DE_LA_BASE: Record<BaseDeCalculo, string> = {
  '30/360': 'Mes comercial (30/360)',
  'ACT/360': 'Días reales / 360',
  'ACT/365': 'Días reales / 365',
};

/** La base de un préstamo · la que diga, o el mes comercial si no dice nada. */
export function baseDe(prestamo: Pick<Prestamo, 'baseCalculoIntereses'>): BaseDeCalculo {
  const dicha = prestamo.baseCalculoIntereses;
  return dicha && VALIDAS.includes(dicha) ? dicha : BASE_POR_DEFECTO;
}

/**
 * El interés de un periodo, en CÉNTIMOS.
 *
 * `capitalCentimos` es lo que queda vivo, `tinAnual` va en porcentaje (4,99 =
 * 4,99 %) y `dias` son los del devengo, ambos extremos incluidos.
 *
 * Con `30/360` los días no se miran: todos los meses cuestan lo mismo, que es
 * exactamente dividir entre doce.
 */
export function interesDelPeriodo(
  capitalCentimos: number,
  tinAnual: number,
  dias: number,
  base: BaseDeCalculo
): number {
  if (capitalCentimos <= 0 || !Number.isFinite(tinAnual) || tinAnual <= 0) return 0;

  const capital = capitalCentimos / 100;
  const tipo = tinAnual / 100;

  if (base === '30/360') return Math.round((capital * tipo) / 12 * 100);
  if (dias <= 0) return 0;

  const divisor = base === 'ACT/360' ? 360 : 365;
  return Math.round((capital * tipo * dias) / divisor * 100);
}

/**
 * El interés de un tramo suelto de días · el arranque irregular del préstamo.
 *
 * La prorrata del primer periodo y la liquidación de los días entre la firma y
 * el primer mes de cobro se cuentan SIEMPRE por días, aunque la base sea el mes
 * comercial: no son un mes, y llamarlos mes cobraría de más o de menos según
 * cuántos días tengan. Con `30/360` se cuentan sobre 365, que es lo que ATLAS
 * ya hacía y lo que dice la carta del Santander.
 */
export function interesPorDias(
  capitalCentimos: number,
  tinAnual: number,
  dias: number,
  base: BaseDeCalculo
): number {
  const porDias = base === '30/360' ? 'ACT/365' : base;
  return interesDelPeriodo(capitalCentimos, tinAnual, dias, porDias);
}
