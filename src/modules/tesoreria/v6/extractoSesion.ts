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
import type { MovimientoConfirmadoRef } from '../../../services/conciliacionConfirmados';
import type { Movement, TreasuryEvent, LineaExtractoPersistida } from '../../../services/db';
import { generateLineHash } from '../../../services/statementIgnoredLinesService';

export type VeredictoLinea =
  | 'cuadra'
  | 'resolver'
  | 'ignorada'

;

export interface LineaExtracto {
  /**
   * E1.2b · LA identidad de la línea en la sesión: el id de su fila en el
   * store `lineasExtracto` (E1.1). Todas las decisiones (`DecisionesSesion`) y
   * todos los gestos (`decisionesDeSesion`) claven por este id, no por el del
   * movimiento. Así la sesión puede hablar de una línea del banco sin depender
   * de que su movimiento exista todavía (E1.5).
   */
  lineaId: number;
  /**
   * id del `Movement` que `processFile` insertó para esta línea (mientras el
   * movimiento siga naciendo al importar). La sesión NO decide por él; es lo
   * que se le entrega a los servicios que operan sobre movimientos ya creados
   * (`confirmDecisions`, traspasos, ficha de gasto) en la frontera
   * (`payloadDeConfirmacion` y compañía).
   */
  movementId: number;
  /**
   * §16.4 · TODOS los movimientos que esta línea ha engendrado, según la fila
   * persistida (`LineaExtractoPersistida.movementIds`). Hoy siempre uno; un
   * pago múltiple (fianza + dos meses) traerá varios. La frontera traduce
   * `lineaId → movementIds` con `movementIdsDe`. Opcional: sin él vale
   * `[movementId]`.
   */
  movementIds?: number[];
  /** Identidad estable de la línea · sobrevive a reimportar el mismo fichero. */
  hashLinea: string;
  /** El texto LITERAL del banco · §4.7 lo exige, sin limpiar ni embellecer. */
  textoBanco: string;
  fecha: string;
  /**
   * Lo demás que escribió el banco en esa fila · quién envía el dinero, el
   * número del préstamo, el concepto ampliado.
   *
   * Va APARTE de `textoBanco` y no concatenado dentro, y eso importa: el hash
   * de la línea se calcula sobre `description`, y meterle la referencia dentro
   * cambiaría el hash de todos los movimientos ya importados — el dedupe entre
   * importaciones solapadas dejaría de reconocerlos y los cargos se
   * duplicarían.
   *
   * El importador lo guarda desde #1831/#1832; hasta ahora la pantalla lo
   * tiraba. Una tarjeta que sólo dice «Transferencia recibida · +200 €» no se
   * puede puntear: no hay nada que decidir con eso.
   */
  referencia?: string;
  /** Quién pagó o cobró, cuando el banco lo trae en su propia columna. */
  contraparte?: string;
  importe: number;
  veredicto: VeredictoLinea;
  /** Solo si cuadra · el previsto con el que casó. */
  previsto?: { id: number; descripcion: string; importe: number; fecha: string };
  /**
   * Solo si cuadra con algo que YA tenías anotado a mano (Confirmado) y no con
   * un previsto. Al guardar, ese confirmado sube a Conciliado y esta línea no se
   * duplica. Evidencia más fuerte: la palabra del banco sobre la tuya.
   */
  confirmado?: { id: number; descripcion: string; importe: number; fecha: string };
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
}

/**
 * Lo que el usuario ha decidido a mano · se aplica todo junto al Guardar.
 *
 * E1.2b · las siete estructuras claven por `lineaId` (la fila de
 * `lineasExtracto`), NO por `movementId`. La traducción a movimientos ocurre
 * en la frontera con los servicios (`payloadDeConfirmacion`,
 * `movimientosAEfectivo`, `movimientosATraspaso`), que es lo único que sigue
 * hablando en `movementId`.
 */
export interface DecisionesSesion {
  /** lineaId → treasuryEventId elegido en "Asignar a un previsto". */
  asignados: Map<number, number>;
  /** lineaIds que el usuario mandó a ignorar en ESTA sesión. */
  ignorados: Set<number>;
  /** lineaIds para las que se creó un movimiento suelto desde la ficha. */
  creados: Set<number>;
  /**
   * Líneas que venían ignoradas de una importación anterior y el usuario ha
   * recuperado con el enlace de §4.7. Conjunto aparte de `ignorados` porque son
   * la operación inversa sobre poblaciones distintas: `ignorados` añade hashes
   * al batch, `recuperados` los borra.
   */
  recuperados: Set<number>;
  /**
   * lineaIds que el usuario ha marcado como RETIRADA DE EFECTIVO.
   *
   * No es un ignorado ni un movimiento suelto: al guardar, ese cargo se
   * convierte en la pata de salida de un traspaso a la cuenta de Efectivo y
   * nace su pata espejo. El dinero no se ha gastado, ha cambiado de sitio.
   */
  aEfectivo: Set<number>;
  /**
   * lineaId → cuenta destino · el usuario ha marcado esta línea como un
   * TRASPASO a otra cuenta suya (P1/P3). Es el caso general de `aEfectivo`: al
   * importar, un traspaso entra como un cargo normal y sin esto se cuenta como
   * gasto (hunde el saldo y lo cuela en el gráfico). Al guardar, ese cargo se
   * convierte en la pata de salida (`convertirEnTraspaso`) y nace su espejo en
   * la cuenta destino. Solo cargos (importe < 0): la salida de un traspaso es un
   * cargo, y la pata de entrada del otro extracto se concilia aparte (§4.4).
   */
  aTraspaso: Map<number, number>;
  /**
   * lineaIds sobre las que el usuario ha dicho «No es esto».
   *
   * Es la vuelta atrás que faltaba. Una línea cae en «resueltas» porque el
   * emparejador dijo que casaba con un previsto, o porque el reconocedor la
   * casó contra un libro; cae en «personal» porque una regla aprendida dijo que
   * era suya. Los tres se equivocan —la cuota del préstamo del piso colada en
   * «personal» es de una captura real— y hasta ahora no había forma de decirlo:
   * el bucket se recalculaba solo en cada render y se comía la corrección.
   *
   * Conjunto aparte de `ignorados` porque son cosas distintas: ignorar es un
   * acto del usuario sobre una línea que no le interesa, y esto es corregir a
   * ATLAS sobre una que sí. Por eso desemparejar NO designora: para eso está
   * «reactivar».
   */
  desemparejados: Set<number>;
}

export function decisionesVacias(): DecisionesSesion {
  return {
    asignados: new Map(),
    ignorados: new Set(),
    creados: new Set(),
    recuperados: new Set(),
    aEfectivo: new Set(),
    aTraspaso: new Map(),
    desemparejados: new Set(),
  };
}

/**
 * E1.2a · `movementId → lineaId` a partir de las filas de `lineasExtracto`.
 *
 * Una línea puede haber engendrado VARIOS movimientos (§16.4 · `movementIds`
 * es plural): todos apuntan a la MISMA `lineaId`. Una fila sin `id` o sin
 * movimientos (descartada) no entra en el mapa.
 */
export function lineaIdPorMovementId(
  lineasPersistidas: ReadonlyArray<Pick<LineaExtractoPersistida, 'id' | 'movementIds'>>
): Map<number, number> {
  const m = new Map<number, number>();
  for (const l of lineasPersistidas) {
    if (l.id == null) continue;
    for (const movementId of l.movementIds ?? []) m.set(movementId, l.id);
  }
  return m;
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
   * Por línea del import, el confirmado que YA tenías y con el que casa (§ la
   * secuencia previsto → confirmado / conciliado). Vacío si nadie hace "las dos
   * cosas".
   */
  confirmadosPorMovimiento: Map<number, MovimientoConfirmadoRef> = new Map(),
  /**
   * E1.2a · las filas de `lineasExtracto` de este lote, para rellenar `lineaId`.
   * Se enlaza por `movementIds` (E1.1 lo deja en cada línea). Vacío = sin
   * `lineaId`, y todo lo demás funciona igual.
   */
  lineasPersistidas: ReadonlyArray<Pick<LineaExtractoPersistida, 'id' | 'movementIds'>> = [],
): LineaExtracto[] {
  const persistidaPorMovimiento = new Map<number, { id: number; movementIds: number[] }>();
  for (const l of lineasPersistidas) {
    if (l.id == null) continue;
    for (const movementId of l.movementIds ?? []) {
      persistidaPorMovimiento.set(movementId, { id: l.id, movementIds: [...(l.movementIds ?? [])] });
    }
  }
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
    // Un confirmado que ya tenías solo cuenta si la línea no casó con un
    // previsto: la previsión manda (la consume), y el confirmado es el respaldo
    // para quien lo anotó a mano en vez de tenerlo previsto.
    const confirmado = previsto ? undefined : confirmadosPorMovimiento.get(m.id);

    // Tres destinos y ninguna papelera:
    //   1. Una línea ya ignorada antes NO se vuelve a proponer. Si el usuario
    //      dijo que no la quiere, no se le pregunta otra vez sin que él la
    //      recupere.
    //   2. Si CUADRA —con un previsto o con algo que ya tenías anotado—, cuadra.
    //      Casar un cargo real con su previsión consume la previsión, usa el
    //      importe REAL y hace que un recibo de tarjeta cierre su periodo.
    //   3. Todo lo demás TE NECESITA. Sin excepciones por fecha.
    //
    // Aquí vivían dos destinos más, «mes cerrado» y «mes anterior», y no eran
    // una clasificación: eran una papelera. `lineasPendientes` los mandaba con
    // las sin resolver a `consolidarSesion`, que borraba su `Movement` — ochenta
    // y ocho movimientos reales del banco desaparecidos al pulsar Guardar. Y el
    // «mes cerrado» encima se apoyaba en un cierre imposible: `cerrarMes` no
    // tiene un solo llamante en toda la app, así que ningún mes está cerrado.
    const veredicto: VeredictoLinea = ignoradasPrevias.has(hashLinea)
      ? 'ignorada'
      : previsto || confirmado
        ? 'cuadra'
        : 'resolver';

    // E1.2b · sin fila persistida no hay identidad de sesión. No se inventa
    // una: desde V91 el orquestador escribe la línea ANTES de que el drawer la
    // construya, así que llegar aquí sin ella es un error de programación, no
    // un caso de datos.
    const persistida = persistidaPorMovimiento.get(m.id);
    if (!persistida) {
      throw new Error(
        `E1.2b · el movimiento ${m.id} no tiene fila en lineasExtracto; la sesión no puede identificarlo`
      );
    }
    lineas.push({
      lineaId: persistida.id,
      movementId: m.id,
      movementIds: persistida.movementIds,
      hashLinea,
      textoBanco: m.description,
      // Vacío o en blanco no se propaga: un renglón vacío debajo del texto
      // sería un hueco que parece un fallo de carga.
      ...(m.reference?.trim() ? { referencia: m.reference.trim() } : {}),
      ...(m.counterparty?.trim() ? { contraparte: m.counterparty.trim() } : {}),
      fecha: (m.date ?? '').slice(0, 10),
      importe: m.amount,
      veredicto,
      ...(previsto ? { previsto } : {}),
      ...(confirmado ? { confirmado } : {}),
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
 * E1.2b · la FRONTERA · los movimientos que hay detrás de una línea.
 *
 * Es la única traducción `lineaId → movementId(s)` de la sesión: quien
 * necesite hablar con un servicio que opera sobre movimientos ya creados pasa
 * por aquí. Soporta 1→N (§16.4) y cae a `[movementId]` cuando la línea no
 * trae la lista (tests, líneas construidas a mano).
 */
export function movementIdsDe(l: Pick<LineaExtracto, 'movementId' | 'movementIds'>): number[] {
  return l.movementIds && l.movementIds.length > 0 ? l.movementIds : [l.movementId];
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
  if (decisiones.ignorados.has(linea.lineaId)) return 'ignorada';
  if (decisiones.asignados.has(linea.lineaId)) return 'cuadra';
  if (decisiones.creados.has(linea.lineaId)) return 'cuadra';
  // Resuelta: el cargo se queda, convertido en traspaso a la cuenta de
  // efectivo. Por eso NO cuenta como pendiente y su movimiento sobrevive a
  // `consolidarSesion`, que es lo contrario de lo que pasa con lo sin resolver.
  if (decisiones.aEfectivo.has(linea.lineaId)) return 'cuadra';
  // Marcada como traspaso a otra cuenta · igual que efectivo: el cargo se queda
  // (convertido en la pata de salida), no cuenta como pendiente y sobrevive a
  // `consolidarSesion`.
  if (decisiones.aTraspaso.has(linea.lineaId)) return 'cuadra';

  // Recuperar una ignorada de una importación anterior, o un mes anterior
  // apartado, la devuelve al flujo · no la da por buena: vuelve a "a resolver"
  // salvo que además cuadre sola.
  if (
    linea.veredicto === 'ignorada' &&
    decisiones.recuperados.has(linea.lineaId)
  ) {
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
  };
  for (const l of lineas) {
    const v = veredictoEfectivo(l, decisiones);
    if (v === 'cuadra') r.cuadran++;
    else if (v === 'ignorada') r.ignoradas++;
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
  ignoredMovementIds: number[];
  /**
   * Líneas que cuadran con un Confirmado que ya tenías · al aplicarlas, ese
   * confirmado sube a Conciliado y la línea del import se descarta como
   * duplicado. `importMovementId` es la línea del banco; `confirmadoMovementId`
   * lo que ya habías anotado.
   */
  reconciliacionesConfirmado: Array<{ importMovementId: number; confirmadoMovementId: number }>;
} {
  const approvedMatches: Array<{ movementId: number; treasuryEventId: number }> = [];
  const ignoredMovementIds: number[] = [];
  const reconciliacionesConfirmado: Array<{ importMovementId: number; confirmadoMovementId: number }> = [];

  // E1.2b · aquí está la FRONTERA: las decisiones se leen por `lineaId` y lo
  // que sale va en `movementId`, que es lo que `confirmDecisions` entiende.
  // Un movimiento no viaja dos veces aunque dos tarjetas compartan línea.
  const emitidos = new Set<number>();
  const cadaMovimiento = (l: LineaExtracto, f: (movementId: number) => void) => {
    for (const movementId of movementIdsDe(l)) {
      if (emitidos.has(movementId)) continue;
      emitidos.add(movementId);
      f(movementId);
    }
  };

  for (const l of lineas) {
    const v = veredictoEfectivo(l, decisiones);
    if (v === 'ignorada') {
      cadaMovimiento(l, (movementId) => ignoredMovementIds.push(movementId));
      continue;
    }
    if (v !== 'cuadra') continue;

    // Marcada como efectivo o traspaso, NO se empareja con ningún previsto
    // aunque hubiera cuadrado sola: el usuario ha dicho qué es esa línea, y
    // confirmarle además un previsto lo daría por pagado dos veces.
    if (decisiones.aEfectivo.has(l.lineaId)) continue;
    if (decisiones.aTraspaso.has(l.lineaId)) continue;

    // Una asignación a mano gana al emparejamiento automático: es el usuario
    // corrigiendo, que es justo lo que la pantalla le ofrece hacer.
    const eventoId = decisiones.asignados.get(l.lineaId) ?? l.previsto?.id;
    if (eventoId != null) {
      cadaMovimiento(l, (movementId) => approvedMatches.push({ movementId, treasuryEventId: eventoId }));
      continue;
    }

    // Sin previsto, pero cuadra con un Confirmado que ya tenías: se reconcilia
    // (sube a Conciliado) salvo que el usuario lo haya resuelto a mano creando
    // un movimiento, que ya deja la línea clasificada por su cuenta.
    if (l.confirmado && !decisiones.creados.has(l.lineaId)) {
      const confirmadoMovementId = l.confirmado.id;
      cadaMovimiento(l, (movementId) =>
        reconciliacionesConfirmado.push({ importMovementId: movementId, confirmadoMovementId })
      );
    }
  }

  // Ya no hay `approvedSuggestions`: ese canal se retiró en la 2.0.2 porque
  // nadie lo llenaba —§4.7 ofrece asignar a un previsto o crear un movimiento,
  // no aceptar sugerencias de categoría— y lo que había al otro lado no creaba
  // la fila fiscal.
  return { approvedMatches, ignoredMovementIds, reconciliacionesConfirmado };
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
  return lineas.filter((l) => decisiones.ignorados.has(l.lineaId));
}

/**
 * Antes: las líneas sin resolver se «desmaterializaban» al Guardar —se BORRABA
 * su `Movement`— para que no movieran el saldo. Y por el mismo camino se iban
 * las que el drawer apartaba como «de meses cerrados»: ochenta y ocho
 * movimientos reales del banco destruidos de una vez, apoyándose en un cierre
 * de mes que nadie puede haber hecho (`cerrarMes` no tiene llamante).
 *
 * Ya no se borra nada. Una línea del banco es dinero que se movió: que ATLAS no
 * sepa clasificarla no la hace menos real, y perderla es peor que no entenderla.
 * Se queda en «te necesitan» hasta que alguien decida.
 *
 * Sigue devolviendo la lista —vacía— porque `consolidarSesion` la recibe para
 * guardar la identidad de lo pendiente en el batch; lo que se retira es que esa
 * lista implique un borrado.
 */
export function lineasPendientes(
  _lineas: LineaExtracto[],
  _decisiones: DecisionesSesion
): Array<{ movementId: number; hashLinea: string; fecha: string; importe: number; concepto: string }> {
  return [];
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
    .filter((l) => l.veredicto === 'ignorada' && decisiones.recuperados.has(l.lineaId))
    .filter((l) => !decisiones.ignorados.has(l.lineaId))
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
  // Frontera · de la línea decidida a los movimientos que la componen, sin
  // repetir ninguno (dos tarjetas de un pago 1→N comparten línea).
  const emitidos = new Set<number>();
  for (const l of lineas) {
    if (!decisiones.aEfectivo.has(l.lineaId) || decisiones.ignorados.has(l.lineaId)) continue;
    for (const movementId of movementIdsDe(l)) emitidos.add(movementId);
  }
  return Array.from(emitidos);
}

/**
 * Líneas que el usuario ha marcado como TRASPASO a otra cuenta suya, con la
 * cuenta destino elegida.
 *
 * Como en efectivo, se transforman al guardar (`convertirEnTraspaso`): el cargo
 * pasa a ser la pata de salida y nace la de entrada en la cuenta destino. Se
 * devuelve el par (movementId, cuentaDestinoId) porque el movimiento ya existe
 * y lo que hace falta es transformarlo.
 */
/** A2 · clave para agrupar líneas IGUALES · mismo texto del banco y signo. */
export function claveDeLineaIgual(l: Pick<LineaExtracto, 'textoBanco' | 'importe'>): string {
  return `${l.textoBanco} ${l.importe < 0 ? 'S' : 'E'}`;
}

/**
 * A2 · cuántos CARGOS iguales (mismo texto y signo) siguen SIN RESOLVER, por
 * clave · para ofrecer "y las N iguales" al marcar uno como traspaso.
 */
export function contarIgualesSinResolver(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion
): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lineas) {
    if (l.importe >= 0 || veredictoEfectivo(l, decisiones) !== 'resolver') continue;
    const k = claveDeLineaIgual(l);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * A2 · lineaIds de los cargos iguales a `linea` que siguen SIN RESOLVER
 * (excluida ella) · los que marcaría "y las N iguales". No pisa lo ya cuadrado
 * ni ignorado, ni los ingresos (un traspaso es un cargo). Devuelve lineaIds
 * porque lo que se hace con ellos es escribir DECISIONES (`traspasarVarias`).
 */
export function idsIgualesAResolver(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion,
  linea: LineaExtracto
): number[] {
  const clave = claveDeLineaIgual(linea);
  return lineas
    .filter((l) => l.lineaId !== linea.lineaId && l.importe < 0)
    .filter((l) => claveDeLineaIgual(l) === clave)
    .filter((l) => veredictoEfectivo(l, decisiones) === 'resolver')
    .map((l) => l.lineaId);
}

export function movimientosATraspaso(
  lineas: LineaExtracto[],
  decisiones: DecisionesSesion
): Array<{ movementId: number; cuentaDestinoId: number }> {
  // Frontera · de la línea decidida a los movimientos que la componen, sin
  // repetir ninguno. El Map conserva el orden de inserción, como el array.
  const porMovimiento = new Map<number, number>();
  for (const l of lineas) {
    if (!decisiones.aTraspaso.has(l.lineaId) || decisiones.ignorados.has(l.lineaId)) continue;
    const cuentaDestinoId = decisiones.aTraspaso.get(l.lineaId) as number;
    for (const movementId of movementIdsDe(l)) {
      if (!porMovimiento.has(movementId)) porMovimiento.set(movementId, cuentaDestinoId);
    }
  }
  return Array.from(porMovimiento, ([movementId, cuentaDestinoId]) => ({ movementId, cuentaDestinoId }));
}

/**
 * ¿Se le ofrece esta previsión a las líneas de un extracto de esta cuenta?
 *
 * Vale para las dos vías: el cuadre automático y el selector de «asignar a
 * mano». Tres reglas:
 *
 *   · lo ya EJECUTADO no: su cargo ya está;
 *   · lo DESCARTADO tampoco — el usuario dijo que no iba a ocurrir, y casarlo
 *     por detrás lo dejaba `executed` con la marca puesta, invisible en
 *     pantalla mientras su movimiento movía el saldo (ver `descarteDePrevision`);
 *   · y tiene que ser de esta cuenta… con una excepción: una cuota de préstamo
 *     (`financing`) que quedó HUÉRFANA de cuenta no la ofrecía nadie, porque
 *     esto filtra por cuenta, y la hipoteca salía «sin rastro». Se ofrece para
 *     poder conciliarla a mano (el importe y la fecha la acotan). La raíz —el
 *     regenerado del arranque que pierde la cuenta— se arregla en
 *     `resolveAccountId`; esto es la red para los datos que ya nacieron así.
 */
export function seOfrecePara(evento: TreasuryEvent, cuentaId: number | undefined): boolean {
  if (evento.status === 'executed') return false;
  if (evento.descartado === true) return false;
  // Los dos ids tienen que EXISTIR para que «es de esta cuenta» signifique
  // algo: con los dos a `undefined`, un `===` daría verdadero y ofrecería un
  // evento sin cuenta a un destino sin cuenta.
  const esDeLaCuenta = cuentaId != null && evento.accountId === cuentaId;
  return esDeLaCuenta || (evento.type === 'financing' && evento.accountId == null);
}
