// ============================================================================
// Lo que se le pone delante a una bonificación · VOCABULARIO §6 ter
// ============================================================================
//
// La forma de la PREGUNTA. `cumplimiento` tiene la de la respuesta y
// `verificarBonificaciones` el reparto de quién contesta cada una; aquí vive lo
// que las reglas necesitan todas: qué pruebas hay sobre la mesa, en qué cuenta
// se mira y cómo se dice «no lo sé».
//
// Vive aparte porque lo comparten reglas que están en ficheros distintos, y
// tenerlo en uno de ellos obligaba a que los demás dependieran de él.
// ============================================================================

import type { Bonificacion } from '../../types/prestamos';
import type { Tarjeta } from '../../types/tarjetas';
import type { GastoDeUnPeriodo } from '../gastoPorTarjeta';
import type { CobroDeUnMes } from './cobrosDeNomina';
import type { RecibosDeUnMes } from './recibosDomiciliados';
import type { GastoDomiciliado } from './gastosDomiciliados';
import type { AportacionDesdeCuenta } from './aportacionesDeTesoreria';
import type { SaldoEnProducto } from './saldoEnElBanco';
import type { Cumplimiento } from './cumplimiento';
import { idDeCuenta } from './cumplimiento';

/** Lo que la tesorería puede aportar para probar una condición. */
export interface MovimientosQuePrueban {
  tarjetas: Tarjeta[];
  /** El gasto por tarjeta y periodo · lo que devuelve `gastoPorTarjeta`. */
  periodosDeTarjeta: GastoDeUnPeriodo[];
  /** La nómina por cuenta y mes · lo que devuelve `cobrosDeNomina`. */
  cobrosDeNomina: CobroDeUnMes[];
  /**
   * **Todo** lo que entra en una cuenta, mes a mes · `ingresosDeLaCuenta`.
   *
   * La otra rama de la condición de ingresos: muchos bancos aceptan «ingresos
   * recurrentes por importe anual igual o superior a X» sin exigir nómina, y
   * eso lo cumple quien cobra alquileres. Mirando solo `cobrosDeNomina` esa
   * rama no se podía cumplir jamás.
   *
   * Ausente = no se mira esa rama, y manda la nómina.
   */
  ingresosRecurrentes?: CobroDeUnMes[];
  /** Los recibos por cuenta y mes · lo que devuelve `recibosDomiciliados`. */
  recibosDomiciliados: RecibosDeUnMes[];
  /**
   * Los meses que ya se han cerrado · `YYYY-MM` (§6 quater).
   *
   * Es lo que convierte «todavía no consta» en un **no**. Sin esto, un mes sin
   * la nómina se queda siempre en «no cuenta todavía» y una bonificación no se
   * puede perder nunca — ni ganarse del todo.
   *
   * Ausente = ninguno cerrado, que es como se comportaba antes de existir el
   * cierre: nada se da por no ocurrido si nadie lo ha dicho.
   */
  mesesCerrados?: string[];
  /**
   * Las pólizas domiciliadas · lo que devuelve `segurosDomiciliados`.
   *
   * Un seguro se domicilia, así que la prueba está aquí y no en un módulo de
   * pólizas que no existe. Y a diferencia de la nómina, **lo previsto cuenta**:
   * un compromiso recurrente activo es un contrato dado de alta, no una
   * esperanza (§6 ter).
   *
   * Ausente = ATLAS no sabe de ninguno, que no es lo mismo que no tenerlos.
   */
  segurosDomiciliados?: GastoDomiciliado[];
  /**
   * **Todos** los recibos domiciliados, sea cual sea su tipo.
   *
   * Los hay que prueban una condición y no son un seguro — la alarma, sin ir
   * más lejos, que *«es un gasto recurrente que se puede crear siempre asociada
   * a la cuenta»* *(Jose · 8 ago 2026)*—. Ausente = no se han leído.
   */
  gastosDomiciliados?: GastoDomiciliado[];
  /**
   * Lo que sale de cada cuenta hacia un plan o un fondo · por año.
   *
   * La prueba de las dos condiciones de inversión, y estaba en tesorería desde
   * el principio: una aportación es un `TreasuryEvent` que sale de su cuenta.
   *
   * Ausente = ATLAS no sabe de ninguna, que no es lo mismo que no haberlas.
   */
  aportacionesDeTesoreria?: AportacionDesdeCuenta[];
  /**
   * Lo que TIENES en fondos y planes de cada banco · la otra rama.
   *
   * Un anexo puede pedir aportar o pedir tener, y no es la misma pregunta ni se
   * prueba en el mismo sitio. Ausente = no se han mirado las posiciones.
   */
  saldoEnElBanco?: SaldoEnProducto[];
  /**
   * La cuenta de cargo del préstamo · el respaldo de `cuentaExigidaId`.
   *
   * El banco bonifica por lo que le entra A ÉL, y la cuenta por la que te cobra
   * la hipoteca es suya. Pedirla otra vez bonificación a bonificación es
   * preguntar dos veces lo mismo, y el sitio donde se preguntaba no lo rellena
   * nadie: un seguro domiciliado en la cuenta correcta salía «sin comprobar ·
   * no dice en qué cuenta hay que domiciliar la póliza» teniendo ATLAS la
   * cuenta delante *(Jose · 8 ago 2026)*.
   *
   * Sigue mandando `cuentaExigidaId` cuando está: hay anexos que exigen una
   * cuenta distinta de la del recibo, y eso el préstamo no lo sabe.
   */
  cuentaDelPrestamo?: number;
    /**
   * De qué entidad es el préstamo que se está comprobando.
   *
   * Lo único de aquí que **no sale de la tesorería**: sale del propio préstamo,
   * y quien llama lo tiene. Hace falta para la condición de plan, que exige que
   * sea de ese banco. Sin ella no se puede responder, y se dice.
   */
  entidad?: string;
}


/** Redondeo a céntimos · restar dos sumas de euros deja 339.99999999999994. */
export const centimos = (n: number): number => Math.round(n * 100) / 100;

/**
 * En qué cuenta hay que mirar · la que exige la bonificación, o la del préstamo.
 *
 * El respaldo importa más de lo que parece: nadie rellena `cuentaExigidaId`, y
 * sin él un seguro domiciliado en la cuenta correcta salía «sin comprobar»
 * teniendo ATLAS la cuenta del préstamo delante. El banco bonifica por lo que
 * le entra a ÉL, y la cuenta por la que te cobra la hipoteca es suya.
 *
 * Las dos pasan por `idDeCuenta`, que es donde vive lo de que `Number('')` sea
 * cero: un id vacío no puede colarse por ninguna de las dos puertas.
 */
export function cuentaDondeMira(b: Bonificacion, movimientos: MovimientosQuePrueban): number | null {
  return idDeCuenta(b.cuentaExigidaId) ?? idDeCuenta(movimientos.cuentaDelPrestamo);
}

export const noVerificable = (b: Bonificacion, motivo: string): Cumplimiento => ({
  bonificacionId: b.id,
  nombre: b.nombre,
  veredicto: 'no_verificable',
  motivo,
});
