// Cómo se lee una bonificación verificada contra la tesorería · VOCABULARIO §6 ter.
//
// Lo que hay que poder leer de un vistazo es si el banco te la va a dar. Y eso
// son tres respuestas, no dos: cumple, no cumple, o nadie puede saberlo. La
// tercera es la que más se pierde al escribirla, y la que peor sale si se
// pierde — «no se puede comprobar» y «te falta» piden cosas distintas.

import type { Cumplimiento } from '../../services/bonificaciones/cumplimiento';
import { importeSaldo, mesCorto } from '../tesoreria/v6/formatoV6';

/** Los euros, con el formato único de la aplicación (§5). */
const euros = (n: number): string => importeSaldo(n);

/**
 * El día, en corto · "4 feb".
 *
 * Se lee de la cadena ISO tal cual, sin pasar por `Date`: construir una fecha
 * y volver a formatearla con la zona del navegador corre el día hacia atrás en
 * España, y CI corre en UTC, así que no lo cazaría ningún test.
 */
const dia = (iso: string): string => {
  const [, mes, d] = iso.split('-');
  return `${Number(d)} ${mesCorto(Number(mes) - 1)}`;
};

/**
 * Lo que dicen los movimientos de una bonificación, en una línea.
 *
 * El gasto que el banco aún no ha cobrado se dice aparte y con esas palabras:
 * ya está hecho, pero no consta, así que no demuestra nada (§3.5). Sumarlo
 * diría que la bonificación está ganada cuando no lo está; callarlo haría creer
 * que falta por gastar lo que ya se gastó.
 */
export function textoDeCumplimiento(c: Cumplimiento): string {
  if (c.veredicto === 'no_verificable') {
    return `No se puede comprobar · ${c.motivo ?? 'falta el dato que lo probaría'}`;
  }

  // Un «no» que no se arregla gastando: no lleva cifras porque no hay ninguna
  // que perseguir.
  if (c.medido == null || c.exigido == null) {
    return c.veredicto === 'cumple' ? 'Cumplida' : `No cuenta · ${c.motivo ?? 'no se cumple'}`;
  }

  const desde = c.ventana ? ` desde el ${dia(c.ventana.desde)}` : '';
  const sinCobrar =
    c.sinCobrar && c.sinCobrar > 0
      ? ` · ${euros(c.sinCobrar)} más gastados que el banco todavía no ha cobrado`
      : '';

  if (c.veredicto === 'cumple') {
    return `Cumplida · ${euros(c.medido)} de ${euros(c.exigido)}${desde}${sinCobrar}`;
  }

  return `Te faltan ${euros(c.exigido - c.medido)} · llevas ${euros(c.medido)} de ${euros(
    c.exigido
  )}${desde}${sinCobrar}`;
}
