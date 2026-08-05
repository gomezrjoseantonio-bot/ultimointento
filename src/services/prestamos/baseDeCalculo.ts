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
import { partes } from './fechas';

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
 * Cuántos días tiene un tramo suelto **según la base** · §6 bis · bis.
 *
 * Con días reales se cuentan días reales. Con el mes comercial NO: ahí un mes
 * vale 30 y el día 31 no existe, así que los días se cuentan igual. Es la
 * convención europea (30E/360).
 *
 * No es un detalle de redondeo. Los dos préstamos del Sabadell lo cobran así:
 *
 *   · formalizado el 04-07-2025, primer cargo el 31-07 → **26** días (30 − 4),
 *     no los 27 reales, y 79,45 € de 24.500 al 4,49 %.
 *   · formalizado el 13-09-2025, primer cargo el 30-09 → **17** días (30 − 13),
 *     y 34,98 € de 16.500.
 *
 * Contando días reales sobre 365 salían 81,37 € y 34,51 €. Ninguno de los dos.
 *
 * Ambos extremos NO se incluyen: es la diferencia entre dos fechas, que es como
 * lo cuenta el banco en el tramo del arranque.
 */
export function diasSegunBase(desdeISO: string, hastaISO: string, base: BaseDeCalculo): number {
  const [y1, m1, d1] = partes(desdeISO);
  const [y2, m2, d2] = partes(hastaISO);
  if (!y1 || !y2) return 0;

  if (base !== '30/360') {
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
  }

  // 30E/360 · el 31 se lee como 30 en los dos extremos.
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (Math.min(d2, 30) - Math.min(d1, 30));
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
 * Cómo cuenta el banco los DÍAS SUELTOS del arranque · §6 bis · bis.
 *
 * No tiene por qué ser la misma base que el resto del cuadro, y en la práctica
 * no lo es. Los seis cuadros que hay sobre la mesa dicen lo mismo de las cuotas
 * normales —TIN entre doce, valga el mes 28, 30 o 31— y cosas distintas del
 * tramo del arranque:
 *
 *   · Santander (tres préstamos) e ING · **días reales sobre 365**.
 *   · Sabadell (dos) · **30/360**, igual que el resto.
 *
 * Ausente = lo que ATLAS venía haciendo: días reales sobre 365 cuando la base
 * es el mes comercial, y la propia base en los demás casos. Así no se mueve
 * ningún préstamo ya guardado — los tres del Santander siguen cuadrando— y el
 * Sabadell puede decir lo suyo.
 */
export function baseDiasSueltosDe(
  prestamo: Pick<Prestamo, 'baseCalculoIntereses' | 'baseDiasSueltos'>
): BaseDeCalculo {
  const dicha = prestamo.baseDiasSueltos;
  if (dicha && VALIDAS.includes(dicha)) return dicha;

  const base = baseDe(prestamo);
  return base === '30/360' ? 'ACT/365' : base;
}

/**
 * El interés de un tramo suelto de días · el arranque irregular del préstamo.
 *
 * La liquidación de los días entre la disposición y la primera cuota no es un
 * mes, así que aquí los días SÍ se miran, también con el mes comercial: ahí
 * valen 30 por mes (`diasSegunBase`) y se dividen entre 360.
 *
 * La base que se pasa es la de los días sueltos (`baseDiasSueltosDe`), que no
 * tiene por qué ser la del resto del cuadro.
 */
export function interesPorDias(
  capitalCentimos: number,
  tinAnual: number,
  dias: number,
  base: BaseDeCalculo
): number {
  if (capitalCentimos <= 0 || !Number.isFinite(tinAnual) || tinAnual <= 0 || dias <= 0) return 0;

  const divisor = base === 'ACT/365' ? 365 : 360;
  return Math.round(((capitalCentimos / 100) * (tinAnual / 100) * dias) / divisor * 100);
}
