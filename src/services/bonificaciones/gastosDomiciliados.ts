// ============================================================================
// Lo que se domicilia y prueba una bonificación · VOCABULARIO §6 ter
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
//
// ── Y la alarma, que no tiene casilla ───────────────────────────────────────
//
// *«La alarma es un gasto recurrente que se puede crear siempre asociada a la
// cuenta»* *(Jose · 8 ago 2026)*. Se prueba igual —domiciliada en su cuenta—,
// pero `TipoCompromiso` no tiene un `'alarma'`: se da de alta como suscripción,
// como cuota o como «otros». Por eso aquí conviven las dos consultas, y las dos
// comparten el criterio de «domiciliado y activo»: afinar qué cuenta como
// domiciliación tiene que afinarlo para las dos a la vez.
// ============================================================================

import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import { costeAnualDe, esActivoRecurrente } from '../compromisos/costeProyectado';

/**
 * Que el recibo lo cargue el banco · **domiciliado**, no de otra forma.
 *
 * El nombre de este fichero lo dice y la condición del contrato también: lo que
 * el banco premia es que le pases el recibo a él. Una póliza que pagas por
 * transferencia o con tarjeta puede estar puesta a una cuenta suya en el modelo
 * y no ser una domiciliación — con tarjeta, `cuentaCargo` es la de liquidación
 * de la tarjeta, que puede ser de otro banco entero.
 */
const esDomiciliado = (c: CompromisoRecurrente): boolean => c.metodoPago === 'domiciliacion';

/** Un recibo domiciliado —una póliza, una alarma— con lo que cuesta al año. */
export interface GastoDomiciliado {
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
  /**
   * Lo que suman sus recibos en el año · lo proyectado.
   *
   * Se llama «prima» porque nació para los seguros y así se llama en el resto
   * del modelo (`ReglaBonificacion.primaAnual`, `SeguroVinculado`). Para lo que
   * no es un seguro es, sin más, lo que cuesta al año.
   */
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
): GastoDomiciliado[] {
  return compromisos
    .filter((c) => c.tipo === 'seguro' && esDomiciliado(c) && esActivoRecurrente(c))
    .map((c) => ({
      cuentaId: c.cuentaCargo,
      alias: c.alias,
      subtipo: c.subtipo?.trim() || undefined,
      primaAnual: Math.round(costeAnualDe(c, anio) * 100) / 100,
    }));
}

/**
 * **Todos** los compromisos domiciliados, sea cual sea su tipo.
 *
 * *«La alarma es un gasto recurrente que se puede crear siempre asociada a la
 * cuenta»* *(Jose · 8 ago 2026)*. Y tiene razón, pero `TipoCompromiso` no tiene
 * una casilla para ella: una alarma se da de alta como suscripción, como cuota
 * o como «otros», según a quién le parezca.
 *
 * Por eso esto no filtra por tipo — filtra por lo único que la condición del
 * banco exige de verdad: que el recibo se lo pases a él. Quién es cada
 * compromiso lo decide luego la regla, con `queSuenanA`.
 *
 * Comparte con los seguros el criterio de «domiciliado y activo», escrito una
 * sola vez: si un día se afina qué cuenta como domiciliación, se afina para
 * los dos a la vez y no para uno sí y otro no.
 */
export function gastosDomiciliados(
  compromisos: CompromisoRecurrente[],
  anio: number
): GastoDomiciliado[] {
  return compromisos
    .filter((c) => esDomiciliado(c) && esActivoRecurrente(c))
    .map((c) => ({
      cuentaId: c.cuentaCargo,
      alias: c.alias,
      subtipo: c.subtipo?.trim() || undefined,
      primaAnual: Math.round(costeAnualDe(c, anio) * 100) / 100,
    }));
}

/**
 * Los que llevan una palabra en el subtipo o en el alias · sin tildes.
 *
 * Es el mismo criterio que `delTipo`, pero para lo que el modelo NO tipifica.
 * `delTipo` compara en crudo y aquí no vale: «Alarma» y «alarma» son la misma
 * palabra, y quien escribe «Alarmas Securitas» tiene una alarma.
 *
 * Lo que NO hace es adivinar por la marca. Una alarma dada de alta como
 * «Securitas» y nada más no la reconoce nadie, y eso hay que decirlo como un
 * «no lo sé» y no como un «no cumples»: quien decide eso es la regla, mirando
 * si en esa cuenta hay compromisos y ninguno lo dice.
 */
export function queSuenanA(gastos: GastoDomiciliado[], palabra: string): GastoDomiciliado[] {
  const sinTildes = (s: string): string =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const buscada = sinTildes(palabra);
  return gastos.filter(
    (g) => sinTildes(g.subtipo ?? '').includes(buscada) || sinTildes(g.alias).includes(buscada)
  );
}

/**
 * Las de la cuenta que el banco exige · las de fuera no bonifican.
 *
 * Un seguro domiciliado en otro banco no le entra a este, igual que la tarjeta
 * de fuera no cuenta (§3.6). Sin esto, tener el hogar en el banco de siempre
 * daría por cumplida la condición de la hipoteca nueva.
 */
export const deLaCuenta = (
  seguros: GastoDomiciliado[],
  cuentaId: number
): GastoDomiciliado[] => seguros.filter((s) => s.cuentaId === cuentaId);

/**
 * Las que son de un tipo concreto · para «seguro de hogar» y «seguro de vida».
 *
 * Se mira el `subtipo` y, si no lo dice, el alias — que es lo que el usuario
 * escribió y suele llevar la palabra. Las que no dicen nada de qué son **no
 * cuentan**: dar por buena una póliza cualquiera convertiría «tengo el seguro
 * de vida» en «tengo algún seguro», que no es la condición del contrato.
 */
export function delTipo(seguros: GastoDomiciliado[], que: string): GastoDomiciliado[] {
  const buscado = que.toLowerCase();
  return seguros.filter(
    (s) =>
      s.subtipo?.toLowerCase().includes(buscado) || s.alias.toLowerCase().includes(buscado)
  );
}

/** Lo que suman las primas de un año · para las condiciones por importe total. */
export const primaTotal = (seguros: GastoDomiciliado[]): number =>
  Math.round(seguros.reduce((s, x) => s + x.primaAnual, 0) * 100) / 100;
