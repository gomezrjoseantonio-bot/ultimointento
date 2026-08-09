// ============================================================================
// Las condiciones de inversión · plan de pensiones y fondos · VOCABULARIO §6 ter
// ============================================================================
//
// *«Es aportación en este caso, pero habrá otros que será tener X en el fondo o
// en el plan de pensiones del banco — por eso era clave la modelación de las
// bonificaciones»* *(Jose · 9 ago 2026)*.
//
// Dos preguntas, dos pruebas y dos sitios donde vive cada una. Las dos viven
// aquí porque son la misma forma —un producto del banco, medido por lo que le
// entra o por lo que tienes dentro— y separarlas era escribir dos veces la
// disyunción.
// ============================================================================

import type { Bonificacion, ReglaBonificacion } from '../../types/prestamos';
import { aportadoDesde } from './aportacionesDeTesoreria';
import { saldoCon } from './saldoEnElBanco';
import type { Cumplimiento, Ventana } from './cumplimiento';
import { veredictoDelImporte } from './cumplimiento';
import type { MovimientosQuePrueban } from './pruebas';
import { centimos, cuentaDondeMira, noVerificable } from './pruebas';

/**
 * La condición de APORTACIÓN A UN PLAN · §6 ter, la quinta forma.
 *
 * `SIN_FUENTE` decía «la aportación al plan todavía no se sigue en tesorería»,
 * y era verdad a medias: no se sigue en tesorería porque no es un movimiento —
 * se sigue en el store de aportaciones, que lleva cada una con su ejercicio
 * fiscal. Lo que faltaba no era el dato, era la pregunta.
 *
 * La gestora importa tanto como el importe: el anexo pide un plan SUYO, no uno
 * cualquiera. Sin saber de qué entidad es el préstamo no se puede responder, y
 * eso se dice — es la tercera respuesta, no un no.
 *
 * Sin cifra pedida (`aportacionAnual` ausente) la condición es «tenerlo
 * contratado», y entonces basta con que exista un plan de esa gestora.
 */
export function porAportaciones(
  b: Bonificacion,
  regla: Extract<ReglaBonificacion, { tipo: 'PLAN_PENSIONES' }>,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban
): Cumplimiento {
  return porElProducto(b, ventana, movimientos, regla, 'plan');
}

/**
 * La condición de FONDOS · la sexta forma, y la que no se miraba.
 *
 * Estaba en `SIN_FUENTE` con la excusa «el saldo en fondos se prueba con la
 * posición, no con un movimiento». La mitad era verdad —el saldo sí— y de ahí
 * salía la conclusión falsa: que por eso no se podía comprobar. Las posiciones
 * están, y lo aportado también.
 */
export function porFondos(
  b: Bonificacion,
  regla: Extract<ReglaBonificacion, { tipo: 'FONDOS' }>,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban
): Cumplimiento {
  return porElProducto(b, ventana, movimientos, regla, 'fondo');
}

/**
 * Un plan o un fondo del banco · **por lo que le aportas o por lo que tienes**.
 *
 * *«Es aportación en este caso, pero habrá otros que será tener X en el fondo o
 * en el plan de pensiones del banco»* *(Jose · 9 ago 2026)*. Dos ramas y basta
 * con una, igual que la nómina admite «X al mes o Y al año».
 *
 * Y se prueban en sitios distintos, que es lo que obliga a distinguirlas:
 *
 *   · lo APORTADO sale de tesorería · lo que se va de su cuenta al producto;
 *   · lo que TIENES sale de la posición · lo que vale hoy.
 *
 * Medir una con la otra daría un veredicto sobre dinero que no se corresponde
 * con la condición: un fondo sin aportaciones desde hace años puede tener
 * 40.000 € dentro, y quien acaba de meter 30.000 € todavía no los tiene si el
 * mercado ha caído.
 */
function porElProducto(
  b: Bonificacion,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban,
  regla: { aportacionAnual?: number; saldoMinimo?: number },
  que: 'plan' | 'fondo'
): Cumplimiento {
  const base = { bonificacionId: b.id, nombre: b.nombre, ventana };
  const cifra = (n: number | undefined): n is number => Number.isFinite(n) && (n as number) > 0;

  // ── Rama SALDO · lo que tienes con ellos ──────────────────────────────────
  const saldo = movimientos.saldoEnElBanco
    ? saldoCon(movimientos.saldoEnElBanco, movimientos.entidad, que)
    : null;
  if (cifra(regla.saldoMinimo) && saldo != null) {
    const veredicto = veredictoDelImporte(saldo, regla.saldoMinimo);
    // Basta con una · si el saldo llega, no hace falta mirar lo aportado.
    if (veredicto === 'cumple') {
      return { ...base, veredicto, medido: saldo, exigido: regla.saldoMinimo };
    }
  }

  // ── Rama APORTACIÓN · lo que le entra ─────────────────────────────────────
  //
  // Cuenta lo que ha SALIDO, no lo apuntado: una transferencia al plan la haces
  // cuando quieres, así que una prevista no demuestra nada (§3.5, la misma
  // regla de la tarjeta). Lo que falta por salir se enseña aparte, que es como
  // se distingue «todavía no» de «no».
  const cuentaId = cuentaDondeMira(b, movimientos);
  const delAnio =
    movimientos.aportacionesDeTesoreria && cuentaId != null
      ? aportadoDesde(
          movimientos.aportacionesDeTesoreria,
          cuentaId,
          Number(ventana.hasta.slice(0, 4))
        )
      : undefined;
  const aportado =
    movimientos.aportacionesDeTesoreria && cuentaId != null ? (delAnio?.salido ?? 0) : null;
  const porSalir = centimos((delAnio?.importe ?? 0) - (delAnio?.salido ?? 0));

  if (cifra(regla.aportacionAnual)) {
    if (aportado == null) {
      return noVerificable(b, `no hay movimientos donde mirar la aportación al ${que}`);
    }
    return {
      ...base,
      veredicto: veredictoDelImporte(aportado, regla.aportacionAnual),
      medido: aportado,
      exigido: regla.aportacionAnual,
      ...(porSalir > 0 ? { sinCobrar: porSalir } : {}),
    };
  }

  // Pedía saldo y no hay posiciones que mirar · no se afirma nada.
  if (cifra(regla.saldoMinimo)) {
    return saldo == null
      ? noVerificable(b, `no consta ninguna posición en ${que}s de este banco`)
      : { ...base, veredicto: veredictoDelImporte(saldo, regla.saldoMinimo), medido: saldo, exigido: regla.saldoMinimo };
  }

  // Sin cifra ninguna, la condición es TENERLO · con que le entre algo o que
  // conste una posición suya, se cumple.
  if (aportado == null && saldo == null) {
    return noVerificable(b, `no consta ningún ${que} de este banco`);
  }
  if ((aportado ?? 0) > 0 || (saldo ?? 0) > 0) {
    return { ...base, veredicto: 'cumple', motivo: `tienes un ${que} de este banco` };
  }
  // Nada salido todavía y algo previsto · no es un no, es un todavía no. Decir
  // que no lo tienes cuando la aportación está puesta para el mes que viene
  // manda a contratar otro producto que ya está contratado.
  if (porSalir > 0) {
    return noVerificable(b, `la aportación al ${que} está prevista, pero todavía no ha salido`);
  }
  return { ...base, veredicto: 'no_cumple', motivo: `no consta ningún ${que} suyo` };
}
