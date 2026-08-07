// ============================================================================
// Los seguros que prueban una bonificación · VOCABULARIO §6 ter
// ============================================================================
//
// **Un seguro se domicilia.** *«Los seguros tienen que domiciliarse, ya sea
// agrario o medio pensionista»* *(Jose · 6 ago 2026)*. Así que la prueba está
// en tesorería y no hace falta un módulo de pólizas: hace falta mirar si hay un
// cargo periódico de esa póliza en la cuenta del banco.
//
// Y **cada entidad bonifica de forma distinta**: unas por tenerlo, otras por el
// NÚMERO de seguros, otras por el IMPORTE TOTAL de las primas. Por eso esto no
// devuelve un booleano: devuelve las pólizas que hay, con lo que cada una
// cuesta al año, y que la regla pregunte lo suyo.
//
// ── Aquí lo previsto SÍ cuenta ──────────────────────────────────────────────
//
// Es la diferencia de fondo con la nómina, y la puso Jose cuando yo iba a
// montar esto sumando cargos hasta diciembre:
//
//   > «Un seguro se da de alta en gastos recurrentes y se proyecta su coste
//   > mensual y anual; en resumen, podemos decir que se cumple. Al revés es no
//   > decir nada... si no prevemos, cómo actuamos; si no informamos, para qué
//   > quiero la aplicación.»
//
// Y es correcto: una nómina puede venir por menos o no venir, y por eso allí
// solo cuenta lo cobrado. Un compromiso recurrente **no es una previsión
// incierta** — es un contrato que el usuario dio de alta, con su cuenta y su
// calendario, y que ATLAS ya está proyectando en tesorería. Ignorarlo sería que
// ATLAS desconfiara de su propio dato, y la respuesta llegaría en diciembre en
// vez de el primer día.
//
// ── Cómo se reconoce un seguro ──────────────────────────────────────────────
//
// Por `tipo === 'seguro'` del compromiso, que es un campo del modelo. No por
// `concepto.includes('seguro')` ni por la categoría: esta es la decisión que
// dice si una bonificación se gana o se pierde, y tiene que estar escrita en un
// sitio y no heredada de una heurística escondida.
// ============================================================================

import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import { costeAnualDe, esActivoRecurrente } from '../compromisos/costeProyectado';

/** Una póliza domiciliada, con lo que cuesta al año. */
export interface SeguroDomiciliado {
  /** La cuenta donde se carga · es lo que el banco exige, su cuenta. */
  cuentaId: number;
  /** Cómo se llama · para poder enseñar de cuál se trata. */
  alias: string;
  /**
   * De qué es · `'hogar'`, `'vida'`, `'salud'`, `'auto'`…
   *
   * `undefined` cuando el compromiso no lo dice, y entonces **no se adivina**:
   * una condición de «seguro de hogar» no se puede dar por cumplida con una
   * póliza que no dice de qué es.
   */
  subtipo?: string;
  /** Lo que suman sus recibos en el año · la prima proyectada. */
  primaAnual: number;
}

/**
 * Las pólizas activas, con lo que cuesta cada una.
 *
 * Van TODAS, sin filtrar por cuenta: quien pregunta es cada bonificación, y
 * cada una exige la suya. Es el mismo reparto que la nómina —`cobrosDeNomina`
 * agrega y `cobrosDeLaCuenta` filtra—, y evita tener que derivar esto una vez
 * por bonificación.
 *
 * `anio` es contra el que se proyecta la prima: un seguro que sube con el IPC
 * cuesta distinto cada año, y el banco mira el que corre.
 */
export function segurosDomiciliados(
  compromisos: CompromisoRecurrente[],
  anio: number
): SeguroDomiciliado[] {
  return compromisos
    .filter((c) => c.tipo === 'seguro' && esActivoRecurrente(c))
    .map((c) => ({
      cuentaId: c.cuentaCargo,
      alias: c.alias,
      subtipo: c.subtipo?.trim() || undefined,
      primaAnual: Math.round(costeAnualDe(c, anio) * 100) / 100,
    }));
}

/**
 * Las de la cuenta que el banco exige · las de fuera no bonifican.
 *
 * Un seguro domiciliado en otro banco no le entra a este, igual que la tarjeta
 * de fuera no cuenta (§3.6). Sin esto, tener el hogar en el banco de siempre
 * daría por cumplida la condición de la hipoteca nueva.
 */
export const deLaCuenta = (
  seguros: SeguroDomiciliado[],
  cuentaId: number
): SeguroDomiciliado[] => seguros.filter((s) => s.cuentaId === cuentaId);

/**
 * Las que son de un tipo concreto · para «seguro de hogar» y «seguro de vida».
 *
 * Se mira el `subtipo` y, si no lo dice, el alias — que es lo que el usuario
 * escribió y suele llevar la palabra. Las que no dicen nada de qué son **no
 * cuentan**: dar por buena una póliza cualquiera convertiría «tengo el seguro
 * de vida» en «tengo algún seguro», que no es la condición del contrato.
 */
export function delTipo(seguros: SeguroDomiciliado[], que: string): SeguroDomiciliado[] {
  const buscado = que.toLowerCase();
  return seguros.filter(
    (s) =>
      s.subtipo?.toLowerCase().includes(buscado) || s.alias.toLowerCase().includes(buscado)
  );
}

/** Lo que suman las primas de un año · para las condiciones por importe total. */
export const primaTotal = (seguros: SeguroDomiciliado[]): number =>
  Math.round(seguros.reduce((s, x) => s + x.primaAnual, 0) * 100) / 100;
