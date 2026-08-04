// ============================================================================
// Qué demuestran los movimientos de cada bonificación · VOCABULARIO §6 ter
// ============================================================================
//
// La forma común está en `cumplimiento`. Aquí viven las FUENTES: quién sabe
// agregar cada tipo de condición. Hoy tres —la tarjeta (§3.6), la nómina y los
// recibos domiciliados—; lo que queda se prueba con una póliza o un contrato, no
// con un movimiento, y se dice con todas las letras en vez de darse por bueno.
//
// Añadir una es quitar su fila de `SIN_FUENTE` y escribir su función. Esa tabla
// es, literalmente, la lista de lo que falta.
//
// Puro: no lee la base ni el reloj. Quien llame pasa los movimientos y el día.
// ============================================================================

import type { Bonificacion, ReglaBonificacion } from '../../types/prestamos';
import type { Tarjeta } from '../../types/tarjetas';
import type { GastoDeUnPeriodo } from '../gastoPorTarjeta';
import { gastoDeLaTarjeta } from '../gastoPorTarjeta';
import type { CobroDeUnMes } from './cobrosDeNomina';
import { cobrosDeLaCuenta } from './cobrosDeNomina';
import type { RecibosDeUnMes } from './recibosDomiciliados';
import { recibosDeLaCuenta } from './recibosDomiciliados';
import { bonificaHipoteca } from '../tarjetasReglas';
import type { Cumplimiento, Ventana } from './cumplimiento';
import { ventanaDeEvaluacion, veredictoDelImporte } from './cumplimiento';

/** Lo que la tesorería puede aportar para probar una condición. */
export interface MovimientosQuePrueban {
  tarjetas: Tarjeta[];
  /** El gasto por tarjeta y periodo · lo que devuelve `gastoPorTarjeta`. */
  periodosDeTarjeta: GastoDeUnPeriodo[];
  /** La nómina por cuenta y mes · lo que devuelve `cobrosDeNomina`. */
  cobrosDeNomina: CobroDeUnMes[];
  /** Los recibos por cuenta y mes · lo que devuelve `recibosDomiciliados`. */
  recibosDomiciliados: RecibosDeUnMes[];
}

/**
 * Lo que todavía no se puede mirar, y por qué · §6 ter.
 *
 * Exhaustiva a propósito, como las tablas de `metodoDePago`: un tipo de regla
 * nuevo no compila hasta que alguien decida qué se dice de él. Un `switch` con
 * `default` lo dejaría pasar en silencio, que es como se llega a «nadie las
 * mira» sin que nadie lo decidiera.
 */
const SIN_FUENTE: Record<
  Exclude<ReglaBonificacion['tipo'], 'TARJETA' | 'NOMINA' | 'RECIBOS'>,
  string
> = {
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

/**
 * La condición de nómina · §6 ter.
 *
 * Lo que el banco mira es **lo que le entra a él**: la nómina domiciliada en su
 * cuenta, por encima del mínimo, **todos los meses**. Por eso el veredicto sale
 * del mes más flojo y no del total: un semestre con 7.200 € no cumple «1.200 €
 * al mes» si un mes vino vacío y otro doble.
 *
 * Y solo cuenta lo cobrado, como en la tarjeta (§3.5): lo que aún no ha entrado
 * no demuestra nada.
 */
function porNomina(
  b: Bonificacion,
  regla: Extract<ReglaBonificacion, { tipo: 'NOMINA' }>,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban
): Cumplimiento {
  const base = { bonificacionId: b.id, nombre: b.nombre };

  // `!b.cuentaExigidaId` y no `== null`: la cuenta se guarda como texto y el
  // selector deja `''` al no elegir ninguna — y `Number('')` es 0, un id que
  // parece válido. Se habría mirado la cuenta cero.
  const cuentaId = Number(b.cuentaExigidaId);
  if (!b.cuentaExigidaId || !Number.isFinite(cuentaId)) {
    return noVerificable(b, 'no dice en qué cuenta hay que domiciliarla');
  }
  if (!Number.isFinite(regla.minimoMensual) || regla.minimoMensual <= 0) {
    return noVerificable(b, 'no dice cuánto tiene que entrar al mes');
  }

  // Sin una sola nómina en toda la tesorería, el silencio no es un «no»: es que
  // ATLAS no sabe de ninguna. Distinto de tenerla domiciliada en otro banco,
  // que sí es incumplir y se ve más abajo.
  if (movimientos.cobrosDeNomina.length === 0) {
    return noVerificable(b, 'no hay ninguna nómina dada de alta');
  }

  const meses = cobrosDeLaCuenta(movimientos.cobrosDeNomina, cuentaId, {
    ...ventana,
    soloCerrados: true,
  });

  if (meses.length === 0) {
    return {
      ...base,
      veredicto: 'no_cumple',
      ventana,
      exigido: regla.minimoMensual,
      motivo: 'no ha entrado ninguna nómina en esa cuenta',
    };
  }

  // El mes más flojo es el que decide: basta uno por debajo para perderla.
  //
  // Contar y juzgar con la MISMA función · escrita a mano, la holgura de medio
  // céntimo viviría en dos sitios y bastaría tocar uno para que la línea dijera
  // «6 de 6 meses» junto a un «no cumple».
  const llega = (importe: number) => veredictoDelImporte(importe, regla.minimoMensual) === 'cumple';
  const peor = Math.min(...meses.map((m) => m.importe));
  const queLlegan = meses.filter((m) => llega(m.importe)).length;

  return {
    ...base,
    veredicto: veredictoDelImporte(peor, regla.minimoMensual),
    ventana,
    medido: centimos(peor),
    exigido: regla.minimoMensual,
    mensual: { conMovimiento: meses.length, queLlegan },
  };
}

/**
 * La condición de recibos domiciliados · §6 ter.
 *
 * «Tener domiciliados al menos N recibos». Lo que cuenta es **cuántos
 * distintos** —tres recibos son tres servicios, no el de la luz tres meses— y,
 * como la nómina, se mide **mes a mes**: el mes con menos recibos es el que
 * decide, porque basta uno flojo para que la revisión la tumbe.
 */
function porRecibos(
  b: Bonificacion,
  regla: Extract<ReglaBonificacion, { tipo: 'RECIBOS' }>,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban
): Cumplimiento {
  const base = { bonificacionId: b.id, nombre: b.nombre, unidad: 'recibos' as const };

  const cuentaId = Number(b.cuentaExigidaId);
  if (!b.cuentaExigidaId || !Number.isFinite(cuentaId)) {
    return noVerificable(b, 'no dice en qué cuenta hay que domiciliarlos');
  }
  if (!Number.isFinite(regla.minimoRecibos) || regla.minimoRecibos <= 0) {
    return noVerificable(b, 'no dice cuántos recibos hacen falta');
  }

  const meses = recibosDeLaCuenta(movimientos.recibosDomiciliados, cuentaId, {
    ...ventana,
    soloCerrados: true,
  });

  // Aquí el silencio SÍ es un «no»: a diferencia de la nómina, no hace falta
  // dar de alta nada para que ATLAS vea un recibo domiciliado — sale de los
  // gastos recurrentes, que es de donde sale toda la tesorería. Cero recibos
  // cargados en esa cuenta significa cero recibos domiciliados en ella.
  if (meses.length === 0) {
    return {
      ...base,
      veredicto: 'no_cumple',
      ventana,
      medido: 0,
      exigido: regla.minimoRecibos,
      motivo: 'no se ha cargado ningún recibo en esa cuenta',
    };
  }

  const llega = (cuantos: number) => cuantos >= regla.minimoRecibos;
  const peor = Math.min(...meses.map((m) => m.cuantos));

  return {
    ...base,
    veredicto: llega(peor) ? 'cumple' : 'no_cumple',
    ventana,
    medido: peor,
    exigido: regla.minimoRecibos,
    mensual: {
      conMovimiento: meses.length,
      queLlegan: meses.filter((m) => llega(m.cuantos)).length,
    },
  };
}

function verificarUna(
  b: Bonificacion,
  movimientos: MovimientosQuePrueban,
  hasta: string
): Cumplimiento {
  const falta = loQueFaltaParaMirarla(b);
  if (falta) return noVerificable(b, falta);

  const ventana = ventanaDeEvaluacion(hasta, b.lookbackMeses);
  if (b.regla.tipo === 'TARJETA') return porTarjeta(b, b.regla, ventana, movimientos);
  if (b.regla.tipo === 'NOMINA') return porNomina(b, b.regla, ventana, movimientos);
  if (b.regla.tipo === 'RECIBOS') return porRecibos(b, b.regla, ventana, movimientos);

  // `hasOwnProperty` y no `SIN_FUENTE[...]` a secas: un tipo guardado que ya no
  // esté en la tabla daría un motivo `undefined`, y el usuario leería
  // «No se puede comprobar · undefined».
  const conocido = Object.prototype.hasOwnProperty.call(SIN_FUENTE, b.regla.tipo);
  return noVerificable(b, conocido ? SIN_FUENTE[b.regla.tipo] : 'no se reconoce qué mirar');
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
