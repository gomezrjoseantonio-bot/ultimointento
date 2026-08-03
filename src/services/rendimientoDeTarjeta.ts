// ============================================================================
// Qué rinde una tarjeta · el cashback · VOCABULARIO §3.7
// ============================================================================
//
// El cashback no es una curiosidad: es una DECISIÓN — por qué tarjeta canalizar
// el gasto. Y la cifra que la decide es una comparación, no un total:
//
//   «esta tarjeta me devolvió X € sobre Y € canalizados»
//
// Dos números más de los que decidió Jose (§3.7):
//
//   - **Se mide lo REALIZADO, no se prevé.** Solo cuenta el gasto de periodos
//     ya CERRADOS. Prever el cashback del trimestre que viene no cambia
//     ninguna decisión y cuesta bastante más.
//   - **El límite acota el techo de la estrategia.** 4.700 €/mes al 1 % son
//     564 €/año: eso responde «¿hasta dónde llega este camino?», que sí decide.
//
// Puro: no lee la base. Se le pasan las tarjetas y sus periodos.
// ============================================================================

import type { Tarjeta } from '../types/tarjetas';
import { gastoDeLaTarjeta } from './gastoPorTarjeta';
import type { GastoDeUnPeriodo } from './gastoPorTarjeta';

/**
 * Cuántos periodos de esta tarjeta caben en un año.
 *
 * `limite` es el techo de gasto **del periodo**, y el periodo no siempre es un
 * mes: la Unicaja corta cada semana. Multiplicar siempre por 12 dejaba su techo
 * cuatro veces por debajo de lo que es.
 *
 * Sin ciclo —una de débito con límite— se lee como mensual, que es como se
 * dicen los límites de tarjeta («4.700 € mensuales»).
 */
function periodosEnUnAnio(t: Tarjeta): number {
  return t.ciclo?.periodicidad === 'semanal' ? 52 : 12;
}

export interface RendimientoDeTarjeta {
  tarjetaId: number;
  alias: string;
  /** Porcentaje que devuelve · 1 = un 1 %. */
  porcentaje: number;
  /** Lo gastado por ella en periodos ya CERRADOS · la Y de la comparación. */
  canalizado: number;
  /**
   * Lo que le corresponde a ese gasto según su porcentaje · la X.
   *
   * Ojo con leerlo como «lo ingresado»: el abono llega cuando la emisora lo
   * paga y **se concilia como cualquier otro ingreso** (§3.7). Esto es lo que
   * el gasto ya realizado ha generado, no un apunte visto en el banco.
   */
  rendimiento: number;
  /**
   * Lo máximo que este camino puede rendir en un año, si se agotara el límite
   * todos los meses. `undefined` cuando la tarjeta no tiene límite dicho.
   *
   * No es una previsión: es el techo. Responde «¿hasta dónde llega esto?».
   */
  techoAnual?: number;
}

/** Redondeo a céntimos · sumar porcentajes en coma flotante deja 46.99999999. */
const centimos = (n: number): number => Math.round(n * 100) / 100;

/**
 * Qué ha rendido cada tarjeta, de la que más devuelve a la que menos.
 *
 * Las que no dan cashback quedan FUERA: enseñar «0 €» junto a las que sí dan
 * invita a compararlas, y no compiten — no es que rindan poco, es que no juegan
 * a esto.
 */
export function rendimientoDeTarjetas(
  tarjetas: Tarjeta[],
  periodos: GastoDeUnPeriodo[],
  ventana: { desde?: string; hasta?: string } = {}
): RendimientoDeTarjeta[] {
  const salida: RendimientoDeTarjeta[] = [];

  for (const t of tarjetas) {
    const porcentaje = t.cashbackPorcentaje ?? 0;
    if (t.id == null || porcentaje <= 0) continue;

    // Solo lo CERRADO · lo que aún puede crecer o quedarse corto no ha rendido
    // nada todavía, y esta cifra sirve para comparar tarjetas entre sí.
    const canalizado = gastoDeLaTarjeta(periodos, t.id, { ...ventana, soloCerrados: true });

    salida.push({
      tarjetaId: t.id,
      alias: t.alias,
      porcentaje,
      canalizado: centimos(canalizado),
      rendimiento: centimos((canalizado * porcentaje) / 100),
      techoAnual:
        t.limite != null && t.limite > 0
          ? centimos((t.limite * porcentaje * periodosEnUnAnio(t)) / 100)
          : undefined,
    });
  }

  return salida.sort((a, b) => b.rendimiento - a.rendimiento);
}
