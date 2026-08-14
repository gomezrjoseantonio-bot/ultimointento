// ============================================================================
// Tesorería V6 · §4.7 · el modelo de la sesión de extracto
// ============================================================================
//
// Lógica pura, separada de la UI: qué línea cuadra, cuál está a resolver, cuál
// está ignorada, y qué se manda a `confirmDecisions` cuando el usuario pulsa el
// único botón Guardar.
//
// Vocabulario de §4.7 (D4 de la adenda): "cuadran", "a resolver" e "ignoradas"
// describen líneas del FICHERO durante la sesión, no estados del movimiento. Al
// guardar, lo resuelto se materializa como `Movement` con `source: 'import'` —y
// por tanto conciliado—; lo no resuelto no se materializa.
// ============================================================================

import type { MatchResult } from '../../../services/movementMatchingService';
import type { Movement, TreasuryEvent } from '../../../services/db';
import { generateLineHash } from '../../../services/statementIgnoredLinesService';

export type VeredictoLinea = 'cuadra' | 'resolver' | 'ignorada' | 'mes_cerrado';

export interface LineaExtracto {
  /** id del `Movement` que `processFile` ya insertó para esta línea. */
  movementId: number;
  /** Identidad estable de la línea · sobrevive a reimportar el mismo fichero. */
  hashLinea: string;
  /** El texto LITERAL del banco · §4.7 lo exige, sin limpiar ni embellecer. */
  textoBanco: string;
  fecha: string;
  importe: number;
  veredicto: VeredictoLinea;
  /** Solo si cuadra · el previsto con el que casó. */
  previsto?: { id: number; descripcion: string; importe: number; fecha: string };
  /**
   * Varios previstos compiten por esta línea. El emparejamiento automático NO
   * elige por su cuenta: §4.7 manda a "a resolver" y deja que el usuario asigne.
   */
  candidatos?: Array<{ id: number; descripcion: string; importe: number; fecha: string }>;
}

export interface ResumenSesion {
  lineas: number;
  cuadran: number;
  resolver: number;
  ignoradas: number;
  /** Líneas de meses ya cerrados · no se cargan en esta sesión. */
  mesesCerrados: number;
}

/** Lo que el usuario ha decidido a mano · se aplica todo junto al Guardar. */
export interface DecisionesSesion {
  /** movementId → treasuryEventId elegido en "Asignar a un previsto". */
  asignados: Map<number, number>;
  /** movementIds que el usuario mandó a ignorar en ESTA sesión. */
  ignorados: Set<number>;
  /** movementIds para los que se creó un movimiento suelto desde la ficha. */
  creados: Set<number>;
  /**
   * Líneas que venían ignoradas de una importación anterior y el usuario ha
   * recuperado con el enlace de §4.7. Conjunto aparte de `ignorados` porque son
   * la operación inversa sobre poblaciones distintas: `ignorados` añade hashes
   * al batch, `recuperados` los borra.
   */
  recuperados: Set<number>;
  /**
   * movementIds que el usuario ha marcado como RETIRADA DE EFECTIVO.
   *
   * No es un ignorado ni un movimiento suelto: al guardar, ese cargo se
   * convierte en la pata de salida de un traspaso a la cuenta de Efectivo y
   * nace su pata espejo. El dinero no se ha gastado, ha cambiado de sitio.
   */
  aEfectivo: Set<number>;
}

export function decisionesVacias(): DecisionesSesion {
  return {
    asignados: new Map(),
    ignorados: new Set(),
    creados: new Set(),
    recuperados: new Set(),
    aEfectivo: new Set(),
  };
}

/**
 * Construye las líneas de la sesión a partir de lo que devuelve el orquestador.
 *
 * `ignoradasPrevias` son hashes que el usuario ya ignoró en importaciones
 * anteriores de esta cuenta (D1): al reimportar el mismo extracto no vuelven a
 * pedir atención, salen plegadas en "N ignoradas".
 */
export function construirLineas(
  movimientos: Movement[],
  matchResult: MatchResult,
  eventos: TreasuryEvent[],
  ignoradasPrevias: Set<string>,
  /**
   * Meses ya cerrados (`YYYY-MM`). Una línea de un mes cerrado NO se carga: el
   * mes se dio por bueno tal como estaba, y meter ahora un cargo le movería el
   * saldo. Se aparta —como las ignoradas— y no cuenta como "a resolver". Si de
   * verdad hay que cargarlo, primero se reabre el mes.
   */
  mesesCerrados: Set<string> = new Set()
): LineaExtracto[] {
  const eventoPorId = new Map<number, TreasuryEvent>();
  for (const e of eventos) if (e.id != null) eventoPorId.set(e.id, e);

  const matchPorMovimiento = new Map<number, number>();
  for (const m of matchResult.matches) matchPorMovimiento.set(m.movementId, m.treasuryEventId);

  const candidatosPorMovimiento = new Map<number, number[]>();
  for (const mm of matchResult.multiMatches) {
    candidatosPorMovimiento.set(
      mm.movementId,
      mm.candidates.map((c) => c.treasuryEventId)
    );
  }

  const resumirEvento = (id: number) => {
    const e = eventoPorId.get(id);
    if (!e) return undefined;
    return {
      id,
      descripcion: e.description,
      importe: e.type === 'income' ? Math.abs(e.amount) : -Math.abs(e.amount),
      fecha: (e.predictedDate ?? '').slice(0, 10),
    };
  };

  const lineas: LineaExtracto[] = [];
  for (const m of movimientos) {
    if (m.id == null) continue;
    const hashLinea = generateLineHash({
      date: m.date,
      amount: m.amount,
      description: m.description,
    });

    const eventoId = matchPorMovimiento.get(m.id);
    const candidatosIds = candidatosPorMovimiento.get(m.id);
    const previsto = eventoId != null ? resumirEvento(eventoId) : undefined;

    // El orden importa:
    //   1. Una línea ya ignorada antes NO se vuelve a proponer, aunque ahora
    //      cuadre con algo. Si el usuario dijo que no la quiere, no se le
    //      pregunta otra vez sin que él la recupere.
    //   2. Si CUADRA con un previsto, cuadra — aunque su mes esté cerrado. Casar
    //      un cargo real con su previsión es siempre correcto: consume la
    //      previsión, usa el importe REAL y hace que un recibo de tarjeta cierre
    //      su periodo. Ese cargo ya estaba proyectado en el mes; confirmarlo solo
    //      lo pasa de previsto a real. Apartarlo aquí era lo que rompía el cuadre
    //      del recibo de tarjeta ("cuadraba antes y ahora no").
    //   3. Solo si NO cuadra y su mes está cerrado se aparta: eso es el ruido que
    //      el usuario no quiere reabrir, no un cuadre legítimo.
    const mesLinea = (m.date ?? '').slice(0, 7);
    const veredicto: VeredictoLinea = ignoradasPrevias.has(hashLinea)
      ? 'ignorada'
      : previsto
        ? 'cuadra'
        : mesesCerrados.has(mesLinea)
          ? 'mes_cerrado'
          : 'resolver';

    lineas.push({
      movementId: m.id,
      hashLinea,
      textoBanco: m.description,
      fecha: (m.date ?? '').slice(0, 10),
      importe: m.amount,
      veredicto,
      ...(previsto ? { previsto } : {}),
      ...(candidatosIds
        ? {
            candidatos: candidatosIds
              .map(resumirEvento)
              .filter((c): c is NonNullable<typeof c> => c != null),
          }
        : {}),
    });
  }
  return lineas;
}

/**
 * Veredicto EFECTIVO de una línea, ya contadas las decisiones del usuario.
 *
 * Se calcula al vuelo en vez de mutar las líneas: así "recuperar" una ignorada
 * es quitar una entrada de un Set, y no hay estado duplicado que pueda
 * desincronizarse con lo que se manda al guardar.
 */
export function veredictoEfectivo(
  linea: LineaExtracto,
  decisiones: DecisionesSesion
): VeredictoLinea {
  // Ignorar gana a todo: es la última palabra del usuario sobre esa línea.
  if (decisiones.ignorados.has(linea.movementId)) return 'ignorada';
  if (decisiones.asignados.has(linea.movementId)) return 'cuadra';
  if (decisiones.creados.has(linea.movementId)) return 'cuadra';
  // Resuelta: el cargo se queda, convertido en traspaso a la cuenta de
  // efectivo. Por eso NO cuenta como pendiente y su movimiento sobrevive a
  // `consolidarSesion`, que es lo contrario de lo que pasa con lo sin resolver.
  if (decisiones.aEfectivo.has(linea.movementId)) return 'cuadra';

  // Recuperar una ignorada de una importación anterior la devuelve al flujo,
  // no la da por buena: vuelve a "a resolver" salvo que además cuadre sola.
  if (linea.veredicto === 'ignorada' && decisiones.recuperados.has(linea.movementId)) {
    return linea.previsto ? 'cuadra' : 'resolver';
  }
  return linea.veredicto;
}

export function resumir(lineas: LineaExtracto[], decisiones: DecisionesSesion): ResumenSesion {
  const r: ResumenSesion = {
    lineas: lineas.length,
    cuadran: 0,
    resolver: 0,
    ignoradas: 0,
    mesesCerrados: 0,
  };
  for (const l of lineas) {
    const v = veredictoEfectivo(l, decisiones);
    if (v === 'cuadra') r.cuadran++;
    else if (v === 'ignorada') r.ignoradas++;
    else if (v === 'mes_cerrado') r.mesesCerrados++;
    else r.resolver++;
  }
  return r;
}

/**
 * Payload para `confirmDecisions`.
 *
 * Lo que queda "a resolver" NO viaja: por D4 no se materializa. Solo van los
 * emparejamientos (automáticos + asignados a mano) y lo ignorado.
 */
export function payloadDeConfirmacion(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion
): {
  approvedMatches: Array<{ movementId: number; treasuryEventId: number }>;
  approvedSuggestions: Array<{ movementId: number; suggestionIndex: number }>;
  ignoredMovementIds: number[];
} {
  const approvedMatches: Array<{ movementId: number; treasuryEventId: number }> = [];
  const ignoredMovementIds: number[] = [];

  for (const l of lineas) {
    const v = veredictoEfectivo(l, decisiones);
    if (v === 'ignorada') {
      ignoredMovementIds.push(l.movementId);
      continue;
    }
    if (v !== 'cuadra') continue;

    // Marcada como efectivo, NO se empareja con ningún previsto aunque hubiera
    // cuadrado sola: el usuario ha dicho qué es esa línea, y confirmarle además
    // un previsto lo daría por pagado con el mismo dinero dos veces.
    if (decisiones.aEfectivo.has(l.movementId)) continue;

    // Una asignación a mano gana al emparejamiento automático: es el usuario
    // corrigiendo, que es justo lo que la pantalla le ofrece hacer.
    const eventoId = decisiones.asignados.get(l.movementId) ?? l.previsto?.id;
    if (eventoId != null) approvedMatches.push({ movementId: l.movementId, treasuryEventId: eventoId });
  }

  // `approvedSuggestions` queda vacío a propósito: §4.7 ofrece asignar a un
  // previsto o crear un movimiento, no aceptar sugerencias de categoría. El
  // campo existe porque el servicio lo pide y lo usa el camino de importación
  // antiguo.
  return { approvedMatches, approvedSuggestions: [], ignoredMovementIds };
}

/**
 * Líneas que el usuario ignoró en ESTA sesión.
 *
 * Devuelve las líneas y no sus hashes porque `ignoreLine` recibe la identidad
 * (fecha + importe + concepto) y calcula el hash por dentro: una sola
 * implementación del hash, en el servicio, y no dos que puedan divergir.
 */
export function lineasAIgnorar(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion
): LineaExtracto[] {
  return lineas.filter((l) => decisiones.ignorados.has(l.movementId));
}

/**
 * Líneas que siguen "a resolver" al pulsar Guardar.
 *
 * Por D4 NO se materializan: al consolidar hay que borrar sus `Movement` y
 * dejar su identidad en el batch. Si se quedaran en el store, en cuanto la
 * sesión dejase de ser borrador aparecerían en la lista de la cuenta como
 * conciliadas y moverían el saldo.
 */
export function lineasPendientes(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion
): Array<{ movementId: number; hashLinea: string; fecha: string; importe: number; concepto: string }> {
  // "resolver" y "mes_cerrado" comparten destino: NO se materializan. La sin
  // resolver porque el usuario no la resolvió; la de mes cerrado porque ese mes
  // ya no se toca. En los dos casos su `Movement` se borra al consolidar, para
  // que no aparezca como conciliada moviendo un saldo que no debe.
  return lineas
    .filter((l) => {
      const v = veredictoEfectivo(l, decisiones);
      return v === 'resolver' || v === 'mes_cerrado';
    })
    .map((l) => ({
      movementId: l.movementId,
      hashLinea: l.hashLinea,
      fecha: l.fecha,
      importe: l.importe,
      concepto: l.textoBanco,
    }));
}

/**
 * Líneas ignoradas en importaciones anteriores que el usuario ha recuperado ·
 * hay que borrar su hash del batch donde se guardó, o volverían a esconderse.
 */
export function hashesARecuperar(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion
): string[] {
  return lineas
    .filter((l) => l.veredicto === 'ignorada' && decisiones.recuperados.has(l.movementId))
    .filter((l) => !decisiones.ignorados.has(l.movementId))
    .map((l) => l.hashLinea);
}

/**
 * Líneas que el usuario ha marcado como retirada de efectivo.
 *
 * Se convierten al guardar —el cargo pasa a ser la pata de salida y nace la de
 * entrada en la cuenta de Efectivo—, así que se devuelven los movementIds: el
 * movimiento ya existe y lo que hace falta es transformarlo, no crearlo.
 */
export function movimientosAEfectivo(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion
): number[] {
  return lineas
    .filter((l) => decisiones.aEfectivo.has(l.movementId))
    .filter((l) => !decisiones.ignorados.has(l.movementId))
    .map((l) => l.movementId);
}
