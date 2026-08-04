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

/** Un tipo de interés · dos decimales, con la coma española. */
const pct = (n: number): string => `${n.toFixed(2).replace('.', ',')} %`;

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

  // Medida MES A MES · la nómina. «1.200 € al mes» no lo cumple un semestre con
  // 7.200 € si un mes vino vacío y otro doble, así que la cifra que se enseña
  // es la del mes más flojo y hay que decir de cuántos meses sale.
  if (c.mensual) {
    const cuantos = `${c.mensual.queLlegan} de ${c.mensual.conMovimiento} ${
      c.mensual.conMovimiento === 1 ? 'mes' : 'meses'
    }`;
    if (c.veredicto === 'cumple') {
      return `Cumplida · ${cuantos} con ${euros(c.exigido)} o más${desde}`;
    }
    return `${cuantos} · el más flojo se quedó en ${euros(c.medido)} de ${euros(c.exigido)}`;
  }

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

/** Lo que está en juego, en el tipo y en la cuota. */
export interface LoQueEstaEnJuego {
  /** El TIN que se paga hoy · con las bonificaciones aplicadas. */
  tinHoy: number;
  /** El que se pagaría si la revisión fuese hoy. */
  tinSiRevisaran: number;
  /** Lo que subiría la cuota al mes. */
  sobrecosteMensual: number;
}

/**
 * A qué cuota vas · §6 ter.
 *
 * Es donde el veredicto deja de ser informativo. Y hay que decirlo con la
 * condición delante —«si la revisión fuera hoy»—: lo que gastes este mes **no
 * cambia el recibo de este mes**, cambia lo que el banco decida en la próxima
 * revisión. Enseñarlo como la cuota actual sería enseñar una cuota que nadie
 * te está cobrando.
 */
export function textoDeLoQueEstaEnJuego(j: LoQueEstaEnJuego): string {
  const hoy = `Pagas al ${pct(j.tinHoy)}`;
  if (j.sobrecosteMensual <= 0) return `${hoy} · con tus bonificaciones aplicadas`;

  return `${hoy}. Si la revisión fuera hoy pasarías al ${pct(j.tinSiRevisaran)} · ${euros(
    j.sobrecosteMensual
  )} más al mes`;
}
