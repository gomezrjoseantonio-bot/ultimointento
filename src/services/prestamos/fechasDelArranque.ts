// ============================================================================
// Las dos fechas del arranque de un préstamo · VOCABULARIO §6 bis · bis
// ============================================================================
//
// «Fecha de primer cargo» son DOS fechas distintas, y ATLAS preguntaba una sola
// casilla aceptando cualquiera de las dos. Una daba el cuadro del banco y la
// otra un cuadro imposible —un devengo que termina antes de empezar, dos cargos
// el mismo día, el préstamo acabando un mes antes— y sin avisar de nada. Es lo
// que llevaba ocho intentos fallando (Jose · 5 ago 2026).
//
// Seis cuadros de amortización reales, cuatro bancos, y las dos fechas salen de
// **la disposición y el día de cobro**. No hay nada que preguntar:
//
//   · La **liquidación de los días sueltos** es la primera fecha de cobro
//     POSTERIOR a la disposición, sea del mes que sea.
//   · La **primera cuota entera** es la primera fecha de cobro que está al
//     menos un mes después de la disposición.
//
//   Santander · 12-05-2026, cobro el 1        → sueltos 01-06 · cuota 01-07
//   Sabadell  · 04-07-2025, cobro fin de mes  → sueltos 31-07 · cuota 31-08
//   Sabadell  · 13-09-2025, cobro fin de mes  → sueltos 30-09 · cuota 31-10
//   Santander · 03-07-2025, cobro fin de mes  → sueltos 31-07 · cuota 31-08
//   Santander · 16-10-2023, cobro fin de mes  → sueltos 31-10 · cuota 30-11
//   ING       · 22-02-2022, cobro el 1        → sueltos 01-03 · cuota 01-04
//
// En los cinco primeros hay un recibo de solo intereses en la fecha de los
// sueltos. En ING no: ese día no se cobra nada y los días van dentro de la
// primera cuota. Pero **las fechas se calculan igual** — lo único que cambia es
// si el recibo de en medio existe.
// ============================================================================

import { aISO, diasDelMes, partes } from './fechas';
import { diasSegunBase, interesPorDias, type BaseDeCalculo } from './baseDeCalculo';

const recortar = (anio: number, mes: number, dia: number): number =>
  Math.min(dia, diasDelMes(anio, mes));

/** El mes siguiente a uno dado · `[año, mes 1-12]`. */
const mesSiguiente = (anio: number, mes: number): [number, number] => {
  const total = anio * 12 + (mes - 1) + 1;
  return [Math.floor(total / 12), (total % 12) + 1];
};

/**
 * La primera fecha de cobro POSTERIOR a la disposición · `null` si cae en ella.
 *
 * Aquí se liquidan los días sueltos. Solo se salta al mes siguiente cuando el
 * cobro de este ya ha pasado: eso es lo que ATLAS hacía SIEMPRE, y por eso el
 * préstamo del Sabadell formalizado un 4 de julio se saltaba el recibo de julio
 * entero.
 *
 * El día se recorta al último del mes en los dos sentidos: quien cobra «el 31»
 * y dispone un 30 de noviembre no tiene días sueltos, porque en noviembre el 31
 * es el 30.
 */
export function fechaDeLosDiasSueltos(fechaFirmaISO: string, diaCobro: number): string | null {
  const [y, m, d] = partes(fechaFirmaISO);
  if (!y || !diaCobro) return null;

  const esteMes = recortar(y, m, diaCobro);
  if (esteMes === d) return null;
  if (esteMes > d) return aISO(y, m, esteMes);

  const [sy, sm] = mesSiguiente(y, m);
  return aISO(sy, sm, recortar(sy, sm, diaCobro));
}

/**
 * Cuándo llega la PRIMERA CUOTA entera.
 *
 * La primera fecha de cobro que esté al menos un mes después de la disposición.
 * Los seis cuadros la cumplen, con días de cobro distintos y con las dos formas
 * de tratar los días sueltos.
 */
export function fechaDeLaPrimeraCuota(fechaFirmaISO: string, diaCobro: number): string {
  const [y, m, d] = partes(fechaFirmaISO);
  const [sy, sm] = mesSiguiente(y, m);

  // Un mes justo después de disponer · recortado, que un 31 de enero cae en el
  // 28 de febrero.
  const unMesDespues = recortar(sy, sm, d);
  const cobroDeEseMes = recortar(sy, sm, diaCobro);

  if (cobroDeEseMes >= unMesDespues) return aISO(sy, sm, cobroDeEseMes);

  const [ty, tm] = mesSiguiente(sy, sm);
  return aISO(ty, tm, recortar(ty, tm, diaCobro));
}

/** Los días sueltos del arranque, con su fecha y sus euros. */
export interface DiasSueltos {
  /** Contados como los cuenta el banco · con el mes comercial, el 31 es el 30. */
  dias: number;
  /** El día en que se liquidan · `YYYY-MM-DD`. */
  fechaLiquidacion: string;
  /** Lo que devengan, en euros. */
  intereses: number;
}

/**
 * Los días entre la disposición y la primera cuota, con lo que cuestan.
 *
 * UNA función, usada por el asistente y por los tests de los seis cuadros. Esto
 * se calculaba en dos pasos y en dos sitios —una función daba la fecha y los
 * días, otra los euros—, y la pantalla las llamaba con bases distintas.
 *
 * Devuelve `null` cuando no hay días sueltos: se dispone el mismo día en que se
 * cobra, o los datos todavía no dan para calcularlo.
 */
export function diasSueltosDelArranqueDe(args: {
  fechaFirma: string;
  diaCargo: number;
  capital: number;
  /** En porcentaje · 4,99 = 4,99 %. */
  tinAnual: number;
  base: BaseDeCalculo;
}): DiasSueltos | null {
  const { fechaFirma, diaCargo, capital, tinAnual, base } = args;
  if (!fechaFirma || !diaCargo || capital <= 0 || !(tinAnual > 0)) return null;

  const fechaLiquidacion = fechaDeLosDiasSueltos(fechaFirma, diaCargo);
  if (!fechaLiquidacion) return null;

  const dias = diasSegunBase(fechaFirma, fechaLiquidacion, base);
  if (dias <= 0) return null;

  const intereses = interesPorDias(Math.round(capital * 100), tinAnual, dias, base) / 100;
  if (intereses <= 0) return null;

  return { dias, fechaLiquidacion, intereses };
}
