// Cómo se lee una bonificación verificada contra la tesorería · VOCABULARIO §6 ter.
//
// Lo que hay que poder leer de un vistazo es si el banco te la va a dar. Y eso
// son tres respuestas, no dos: cumple, no cumple, o nadie puede saberlo. La
// tercera es la que más se pierde al escribirla, y la que peor sale si se
// pierde — «no se puede comprobar» y «te falta» piden cosas distintas.

import type { Cumplimiento } from '../../services/bonificaciones/cumplimiento';
import { importeSaldo, mesCorto, nombreMes } from '../tesoreria/v6/formatoV6';

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
 * Cuándo revisa el banco, dicho con la precisión que se tiene.
 *
 * `2027-08` sale como «agosto de 2027» y no como «1 de agosto»: el banco da el
 * mes —«Próxima revisión 08/2027»— y ponerle un día sería prometer una
 * precisión que nadie ha dado. Con día (`2026-03-10`) se dice el día, que es
 * cuando viene de una periodicidad contada desde la firma.
 */
const cuandoRevisa = (iso: string): string => {
  const [anio, mes, d] = iso.split('-');
  return d ? `del ${Number(d)} ${mesCorto(Number(mes) - 1)}` : `de ${nombreMes(Number(mes) - 1)} de ${anio}`;
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

  // Casi todo se mide en euros, pero los recibos domiciliados se cuentan:
  // enseñar «3 €» donde el banco pide tres recibos no es un detalle de formato,
  // es otra cosa.
  const cifra = (n: number): string =>
    c.unidad === 'recibos' ? `${n} ${n === 1 ? 'recibo' : 'recibos'}` : euros(n);

  // Medida MES A MES · la nómina y los recibos. «1.200 € al mes» no lo cumple un
  // semestre con 7.200 € si un mes vino vacío y otro doble, así que la cifra que
  // se enseña es la del mes más flojo y hay que decir de cuántos meses sale.
  if (c.mensual) {
    const cuantos = `${c.mensual.queLlegan} de ${c.mensual.conMovimiento} ${
      c.mensual.conMovimiento === 1 ? 'mes' : 'meses'
    }`;
    // Los meses que todavía no cuentan no son un incumplimiento, pero callarlos
    // deja un «4 de 4» donde faltaban dos por mirar.
    //
    // «Todavía no cuentan» y no «sin conciliar»: puede que el cargo esté por
    // cuadrar o que sencillamente aún no haya pasado, y desde aquí no se
    // distingue. Lo que sí es cierto en los dos casos es que no prueban nada.
    const pendientes = c.mensual.sinCerrar
      ? ` · ${c.mensual.sinCerrar} ${
          c.mensual.sinCerrar === 1 ? 'mes' : 'meses'
        } más todavía no cuentan`
      : '';

    if (c.veredicto === 'cumple') {
      return `Cumplida · ${cuantos} con ${cifra(c.exigido)} o más${desde}${pendientes}`;
    }
    return `${cuantos} · el más flojo se quedó en ${cifra(c.medido)} de ${cifra(
      c.exigido
    )}${pendientes}`;
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
  /** El que se pagaría si el banco revisara con lo que hay hoy. */
  tinSiRevisaran: number;
  /** Lo que cambiaría la cuota al mes · positivo sube, negativo baja. */
  sobrecosteMensual: number;
  /**
   * Cuándo mira el banco · `YYYY-MM-DD` o `YYYY-MM`. Ausente si no se sabe.
   *
   * El mes solo llega cuando lo dice el banco, que es como lo enseña —«Próxima
   * revisión 08/2027»—. Se respeta tal cual: añadirle un día sería inventar.
   *
   * Es la diferencia entre una hipótesis y una cita. «Si la revisión fuera hoy»
   * no se puede agendar; «en la revisión del 10 de marzo» da tiempo a corregir,
   * que es para lo que sirve saberlo.
   */
  fechaRevision?: string;
  /**
   * Si hoy están aplicadas por el periodo inicial del préstamo.
   *
   * Hay que decirlo: durante ese plazo la cuota rebajada no demuestra que
   * cumplas, y quien no lo sepa creerá que va bien hasta la primera revisión
   * que cuenta.
   */
  enGracia?: boolean;
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

  // Cuándo lo mira el banco · con fecha es una cita, sin ella una hipótesis.
  const cuando = j.fechaRevision
    ? `En la revisión ${cuandoRevisa(j.fechaRevision)}`
    : 'Si la revisión fuera hoy';

  // El periodo inicial se dice SIEMPRE que esté activo, cumplas o no: es la
  // explicación de por qué pagas rebajado, y sin ella una lista de «cumple» se
  // lee como que ya te la has ganado.
  const gracia = j.enGracia
    ? ` · aplicadas por el periodo inicial${j.fechaRevision ? ', hasta esa fecha' : ''}`
    : '';

  if (j.sobrecosteMensual === 0) {
    return `${hoy} · con tus bonificaciones aplicadas${gracia}`;
  }

  // Se puede ir a mejor · empezar a cumplir una que no tenías baja la cuota en
  // la próxima revisión, y eso es exactamente igual de accionable que perderla.
  if (j.sobrecosteMensual < 0) {
    return `${hoy}. ${cuando} pasarías al ${pct(j.tinSiRevisaran)} · ${euros(
      Math.abs(j.sobrecosteMensual)
    )} menos al mes${gracia}`;
  }

  return `${hoy}. ${cuando} pasarías al ${pct(j.tinSiRevisaran)} · ${euros(
    j.sobrecosteMensual
  )} más al mes${gracia}`;
}
