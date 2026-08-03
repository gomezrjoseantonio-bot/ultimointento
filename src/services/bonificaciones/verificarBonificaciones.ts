// ============================================================================
// Qué demuestran los movimientos de cada bonificación · VOCABULARIO §6 ter
// ============================================================================
//
// La forma común está en `cumplimiento`. Aquí viven las FUENTES: quién sabe
// agregar cada tipo de condición. Hoy solo una, la de tarjeta (§3.6) — y el
// resto se dice con todas las letras en vez de darse por buenas.
//
// Añadir la nómina es quitar su fila de `SIN_FUENTE` y escribir su función.
// Esa tabla es, literalmente, la lista de lo que falta.
//
// Puro: no lee la base ni el reloj. Quien llame pasa los movimientos y el día.
// ============================================================================

import type { Bonificacion, ReglaBonificacion } from '../../types/prestamos';
import type { Tarjeta } from '../../types/tarjetas';
import type { GastoDeUnPeriodo } from '../gastoPorTarjeta';
import { gastoDeLaTarjeta } from '../gastoPorTarjeta';
import { bonificaHipoteca } from '../tarjetasReglas';
import type { Cumplimiento, Ventana } from './cumplimiento';
import { ventanaDeEvaluacion, veredictoDelImporte } from './cumplimiento';

/** Lo que la tesorería puede aportar para probar una condición. */
export interface MovimientosQuePrueban {
  tarjetas: Tarjeta[];
  /** El gasto por tarjeta y periodo · lo que devuelve `gastoPorTarjeta`. */
  periodosDeTarjeta: GastoDeUnPeriodo[];
}

/**
 * Lo que todavía no se puede mirar, y por qué · §6 ter.
 *
 * Exhaustiva a propósito, como las tablas de `metodoDePago`: un tipo de regla
 * nuevo no compila hasta que alguien decida qué se dice de él. Un `switch` con
 * `default` lo dejaría pasar en silencio, que es como se llega a «nadie las
 * mira» sin que nadie lo decidiera.
 */
const SIN_FUENTE: Record<Exclude<ReglaBonificacion['tipo'], 'TARJETA'>, string> = {
  NOMINA: 'hace falta reconocer la nómina entre los ingresos de la cuenta',
  PLAN_PENSIONES: 'la aportación al plan todavía no se sigue en tesorería',
  SEGURO_HOGAR: 'un seguro se prueba con su póliza, no con un movimiento',
  SEGURO_VIDA: 'un seguro se prueba con su póliza, no con un movimiento',
  ALARMA: 'la alarma se prueba con su contrato, no con un movimiento',
  OTRA: 'una condición escrita a mano no dice qué hay que mirar',
};

/** Redondeo a céntimos · restar dos sumas de euros deja 339.99999999999994. */
const centimos = (n: number): number => Math.round(n * 100) / 100;

const noVerificable = (b: Bonificacion, motivo: string): Cumplimiento => ({
  bonificacionId: b.id,
  nombre: b.nombre,
  veredicto: 'no_verificable',
  motivo,
});

/**
 * La condición de tarjeta · §3.6.
 *
 * Dos reglas del vocabulario mandan aquí, y las dos son de las que se pagan en
 * el recibo si se ignoran:
 *
 *   - **Solo cuenta la tarjeta DEL BANCO que bonifica.** Las de fuera nunca.
 *   - Se demuestra con lo **cobrado**, no con lo que esperas gastar: solo
 *     periodos ya cerrados (§3.5).
 */
function porTarjeta(
  b: Bonificacion,
  regla: Extract<ReglaBonificacion, { tipo: 'TARJETA' }>,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban
): Cumplimiento {
  const base = { bonificacionId: b.id, nombre: b.nombre };

  if (b.tarjetaExigidaId == null) {
    return noVerificable(b, 'no dice con qué tarjeta se cumple');
  }

  const tarjeta = movimientos.tarjetas.find((t) => t.id === b.tarjetaExigidaId);
  if (!tarjeta || tarjeta.id == null) {
    return noVerificable(b, 'la tarjeta que exige ya no está');
  }

  // Esto SÍ es verificable, y la respuesta es que no: una tarjeta de fuera no
  // bonifica por mucho que se gaste con ella. Decir «no se puede comprobar»
  // mandaría a gastar más para arreglar algo que no se arregla gastando.
  if (!bonificaHipoteca(tarjeta)) {
    return {
      ...base,
      veredicto: 'no_cumple',
      motivo: `«${tarjeta.alias}» es de fuera, y las de fuera nunca bonifican`,
    };
  }

  if (regla.importeMinimo == null || regla.importeMinimo <= 0) {
    // Del crédito se conoce el recibo del periodo, que es la suma — no las
    // compras una a una (§3.5). Contar operaciones necesita otro dato.
    if (regla.movimientosMesMin != null && regla.movimientosMesMin > 0) {
      return noVerificable(b, 'cuenta operaciones, y de la tarjeta solo se conoce el total del periodo');
    }
    return noVerificable(b, 'no dice cuánto hay que gastar');
  }

  const cerrado = gastoDeLaTarjeta(movimientos.periodosDeTarjeta, tarjeta.id, {
    ...ventana,
    soloCerrados: true,
  });
  const todo = gastoDeLaTarjeta(movimientos.periodosDeTarjeta, tarjeta.id, ventana);

  return {
    ...base,
    veredicto: veredictoDelImporte(cerrado, regla.importeMinimo),
    ventana,
    medido: centimos(cerrado),
    exigido: regla.importeMinimo,
    sinCobrar: centimos(todo - cerrado),
  };
}

/**
 * Lo que hay guardado no siempre tiene la forma que dice el tipo.
 *
 * `regla` y `lookbackMeses` son obligatorios en `Bonificacion`, pero hay
 * préstamos anteriores a que existieran —el asistente los rellena al abrirlos,
 * y esto no pasa por el asistente: la ficha del préstamo lee de la base—. Sin
 * esta comprobación, una bonificación vieja no da un resultado raro: rompe la
 * pantalla entera al leer `.tipo` de un `undefined`.
 *
 * Y no se les pone un valor por defecto: una ventana inventada diría «no
 * cumples» de algo medido en otro plazo. No saber en cuántos meses se mide es
 * exactamente no poder comprobarlo.
 */
function loQueFaltaParaMirarla(b: Bonificacion): string | null {
  if (b.regla?.tipo == null) return 'no dice qué hay que demostrar';
  if (!Number.isFinite(b.lookbackMeses) || b.lookbackMeses <= 0) {
    return 'no dice en cuántos meses se mide';
  }
  return null;
}

function verificarUna(
  b: Bonificacion,
  movimientos: MovimientosQuePrueban,
  hasta: string
): Cumplimiento {
  const falta = loQueFaltaParaMirarla(b);
  if (falta) return noVerificable(b, falta);

  if (b.regla.tipo !== 'TARJETA') {
    // `hasOwnProperty` y no `SIN_FUENTE[...]` a secas, por lo mismo de arriba:
    // un tipo guardado que ya no está en la tabla daría un motivo `undefined`,
    // y el usuario leería «No se puede comprobar · undefined».
    const conocido = Object.prototype.hasOwnProperty.call(SIN_FUENTE, b.regla.tipo);
    return noVerificable(b, conocido ? SIN_FUENTE[b.regla.tipo] : 'no se reconoce qué mirar');
  }
  return porTarjeta(b, b.regla, ventanaDeEvaluacion(hasta, b.lookbackMeses), movimientos);
}

/**
 * Qué dicen los movimientos de cada bonificación del préstamo, a día `hasta`.
 *
 * Las que el usuario no contrató (`INACTIVO`) quedan fuera: enseñar «no
 * cumples» de algo que nunca se pidió es ruido, y el ruido acaba tapando la que
 * sí importa.
 */
export function verificarBonificaciones(
  bonificaciones: Bonificacion[] | undefined,
  movimientos: MovimientosQuePrueban,
  hasta: string
): Cumplimiento[] {
  return (bonificaciones ?? [])
    .filter((b) => b.estado !== 'INACTIVO')
    .map((b) => verificarUna(b, movimientos, hasta));
}
