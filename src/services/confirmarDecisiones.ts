// ============================================================================
// GUARDAR · las decisiones de la sesión, aplicadas por LÍNEA (E1.5)
// ============================================================================
//
// Hasta E1.5 el import ya había insertado un `Movement` por línea y aquí solo
// se hacía `get` + `put` sobre él. Tras el corte, importar guarda la línea y
// NADA más: el movimiento NACE aquí, al resolver, y se enlaza a su línea
// (`materializarLinea`). El payload habla en `lineaId`, que es la identidad de
// la sesión (E1.2b); los movimientos se crean según hace falta.
//
// Cuatro bloques, en este orden y por esta razón:
//   1 · cuadres con un previsto · la verdad más fuerte (el usuario lo anotó
//       para esa fecha) · nace el movimiento, el previsto pasa a `executed`;
//   2 · reconocido contra un libro (préstamo, nómina, inversión, venta) · nace
//       el movimiento y se cierra contra su origen · NO pisa un cuadre;
//   3 · la línea confirma algo que YA tenías anotado a mano (Confirmado) · D1:
//       NO nace nada · el Confirmado se conserva y recibe el aval del banco, y
//       la línea queda enlazada a él;
//   4 · ignoradas · §29: `atencion: 'silenciada'` en la línea · NO nace nada,
//       la línea sigue en el saldo y es reversible.
//   5 · E2.2 · resueltas por una REGLA APRENDIDA con confianza ganada
//       (`reglaResuelveSola`) · nace el movimiento por el MISMO camino que la
//       ficha (`gastoDesdeMovimiento` · con su fila fiscal) o que el traspaso
//       (`convertirLineaEnTraspaso`), y la línea queda `comoSeResolvio:
//       'motor'`. Es el canal que se retiró en 2.0.2 (`approvedSuggestions`)
//       vuelto a abrir, pero esta vez lo que sale es un movimiento
//       materializado como cualquier otro, no una sugerencia que se perdía.
//
// Lo que sigue en «te necesitan» no viaja: no se materializa (D4).
//
// Y en todos los bloques que clasifican (1, 2, 5 · y la ficha y el traspaso,
// que escriben por su cuenta) se APRENDE (`feedLearningRule`). E2.2 cierra el
// bucle: antes solo aprendía el bloque 1.
// ============================================================================

import { initDB, Movement, TreasuryEvent } from './db';
import type { LineaExtractoPersistida } from './db/types-lineasExtracto';
import { cerrarLineaDeGastoDelEvento, type DbParaCierre } from './cierreLineaInmueble';
import { sinMarcaDeDescarte } from './descarteDePrevision';
import { deriveCategoryFromEvent, deriveCategoryFromMovement, feedLearningRule } from './aplicarSugerencia';
import { penalizarRegla } from './movementLearningService';
import type { MovementLearningRule } from './db';
import { puedeResolverSola } from './reglaResuelveSola';
import { gastoDesdeMovimiento, origenIdRecurrenteDelGasto } from './altaMovimientoService';
import { convertirLineaEnTraspaso } from './traspasoDesdeMovimiento';
import { aplicarReconocimiento, baseDe } from './deterministas/cierreDeterminista';
import { aplicarReconciliacionConfirmado } from './reconciliarConfirmado';
import { origenParaMovimiento, type OrigenPorLinea } from './lineaComoMovimiento';
import {
  enlazarLineaAMovimiento,
  materializarLinea,
  type BaseParaMaterializar,
} from './materializarLinea';

export interface ConfirmationPayload {
  /** Líneas que cuadran con un previsto (automático aceptado, o asignado a mano). */
  approvedMatches: { lineaId: number; treasuryEventId: number }[];
  /**
   * Lo reconocido contra un origen determinista, que NO es una previsión y por
   * tanto no cabe en `approvedMatches`. Se pasa el reconocimiento entero: el
   * origen es una pieza dentro de otra cosa (el periodo 7 del cuadro).
   */
  approvedDeterministic?: OrigenPorLinea[];
  /** §29 · se silencia el recordatorio · nada más. */
  ignoredLineaIds: number[];
  /**
   * Líneas del extracto que son un movimiento que YA tenías anotado
   * (Confirmado). D1: el Confirmado se conserva con el aval del banco y la
   * línea queda enlazada a él. No nace ningún movimiento.
   */
  reconciliacionesConfirmado?: { lineaId: number; confirmadoMovementId: number }[];
  /**
   * E2.2 · líneas que una regla aprendida resuelve SOLA · la pantalla las
   * enseña en «resueltas» y el usuario no las ha tocado. Se vuelve a comprobar
   * aquí que la regla sigue teniendo la confianza (defensa: la regla pudo
   * penalizarse entre abrir y guardar).
   */
  resueltasPorRegla?: { lineaId: number; ruleId: number }[];
  /**
   * E2.2 · reglas que el usuario corrigió en esta sesión («No es esto» sobre
   * una línea que la regla había resuelto sola) · pierden la confianza.
   */
  reglasCorregidas?: number[];
}

export async function confirmDecisions(
  importBatchId: string,
  payload: ConfirmationPayload
): Promise<void> {
  const db = await initDB();
  const base = db as unknown as BaseParaMaterializar;
  const now = new Date().toISOString();
  void importBatchId;

  const lineasTocadas = new Set<number>();

  // 1 · cuadres con un previsto · nace el movimiento y hereda la clasificación.
  for (const { lineaId, treasuryEventId } of payload.approvedMatches) {
    const event = (await db.get('treasuryEvents', treasuryEventId)) as TreasuryEvent | undefined;
    if (!event) continue;
    if (event.status === 'executed') continue; // ya casado en otro flujo

    const { movement } = await materializarLinea(base, lineaId, now, 'confirmada');
    const movementId = movement.id as number;

    // Igual que el punteo manual: lo que se materializa deja de estar
    // descartado. Ver `descarteDePrevision`.
    await db.put('treasuryEvents', {
      ...sinMarcaDeDescarte(event),
      status: 'executed',
      executedMovementId: movementId,
      executedAt: now,
      actualDate: movement.date,
      // MAGNITUD, como el punteo manual (`treasuryConfirmationService:509`).
      actualAmount: Math.abs(movement.amount),
    });
    // El movimiento recién nacido HEREDA la clasificación de la previsión:
    // categoría, familia, ámbito e inmueble. El texto del banco se conserva
    // (`hashMovement` dedupica por él) y el nombre de la previsión va aparte.
    const conciliado: Movement = {
      ...movement,
      ...(event.categoryKey != null ? { categoryKey: event.categoryKey } : {}),
      ...(event.subtypeKey != null ? { subtypeKey: event.subtypeKey } : {}),
      ...(event.conceptoId != null ? { conceptoId: event.conceptoId } : {}),
      ...(event.ambito != null ? { ambito: event.ambito } : {}),
      ...(event.inmuebleId != null ? { inmuebleId: String(event.inmuebleId) } : {}),
      ...(event.description ? { descripcionPrevision: event.description } : {}),
      unifiedStatus: 'conciliado',
      statusConciliacion: 'match_manual',
      updatedAt: now,
    };
    await db.put('movements', conciliado);
    // La línea que DECLARA ese gasto se cierra CON EL DATO DEL BANCO.
    await cerrarLineaDeGastoDelEvento(db as unknown as DbParaCierre, event, conciliado);
    lineasTocadas.add(lineaId);

    // Se aprende de lo que SÍ se concilió: la categoría y de QUIÉN es.
    await feedLearningRule(
      conciliado,
      deriveCategoryFromEvent(event),
      event.counterparty ?? event.providerName
    );
  }

  // 2 · lo reconocido contra los libros del usuario · después de los cuadres:
  // un cuadre es la verdad más fuerte y no se pisa con un origen.
  for (const origen of payload.approvedDeterministic ?? []) {
    if (lineasTocadas.has(origen.lineaId)) continue;
    try {
      const { movement } = await materializarLinea(base, origen.lineaId, now, 'motor');
      const cerrado = await aplicarReconocimiento(
        baseDe(db as never),
        origenParaMovimiento(origen, movement.id as number),
        now
      );
      if (cerrado) {
        lineasTocadas.add(origen.lineaId);
        // E2.2 · lo reconocido también ENSEÑA · se lee del movimiento ya
        // cerrado (piso, categoría). Hoy los orígenes deterministas no ponen
        // categoría, así que de ellos aún no nace regla; el enganche queda
        // hecho para el día que la traigan.
        const cerradoMov = (await db.get('movements', movement.id as number)) as Movement | undefined;
        if (cerradoMov) await feedLearningRule(cerradoMov, deriveCategoryFromMovement(cerradoMov));
      }
    } catch (err) {
      // Una fuente que falla no puede tumbar el Guardar entero: el resto de
      // decisiones ya están aplicadas y la línea, en el peor caso, se queda
      // sin resolver y sigue visible. Nada se pierde (FASE 1).
      console.error('[confirmarDecisiones] no se pudo aplicar un reconocimiento determinista', err);
    }
  }

  // 3 · D1 · «las dos cosas» · el Confirmado se conserva con el aval del banco.
  for (const { lineaId, confirmadoMovementId } of payload.reconciliacionesConfirmado ?? []) {
    if (lineasTocadas.has(lineaId)) continue;
    const linea = (await db.get('lineasExtracto', lineaId)) as LineaExtractoPersistida | undefined;
    if (!linea) continue;
    const avalado = await aplicarReconciliacionConfirmado(
      db,
      {
        amount: linea.importe,
        date: linea.fechaOperacion,
        ...(linea.fechaValor ? { valueDate: linea.fechaValor } : {}),
      },
      confirmadoMovementId,
      now
    );
    if (avalado == null) continue; // el confirmado ya no existe · la línea sigue a resolver
    await enlazarLineaAMovimiento(base, lineaId, [avalado], now, 'confirmada');
    lineasTocadas.add(lineaId);
  }

  // 4 · §29 · ignorar silencia el recordatorio · no es un estado de dinero.
  for (const lineaId of payload.ignoredLineaIds) {
    if (lineasTocadas.has(lineaId)) continue;
    const linea = (await db.get('lineasExtracto', lineaId)) as LineaExtractoPersistida | undefined;
    if (!linea) continue;
    await db.put('lineasExtracto', { ...linea, atencion: 'silenciada', updatedAt: now });
    lineasTocadas.add(lineaId);
  }

  // 5 · E2.2 · lo que una regla con confianza resuelve sola · DESPUÉS de todo
  // lo que el usuario decidió: cualquier gesto suyo sobre la línea manda.
  for (const { lineaId, ruleId } of payload.resueltasPorRegla ?? []) {
    if (lineasTocadas.has(lineaId)) continue;
    try {
      const resuelta = await resolverPorRegla(db, lineaId, ruleId, now);
      if (resuelta) lineasTocadas.add(lineaId);
    } catch (err) {
      // Una regla que falla no tumba el Guardar: la línea se queda a resolver,
      // visible, y nada se pierde.
      console.error('[confirmarDecisiones] no se pudo aplicar una regla aprendida', err);
    }
  }

  // 6 · E2.2 · las reglas que el usuario desmintió pierden la confianza.
  for (const ruleId of new Set(payload.reglasCorregidas ?? [])) {
    try {
      await penalizarRegla(ruleId);
    } catch (err) {
      console.warn('[confirmarDecisiones] no se pudo penalizar la regla', ruleId, err);
    }
  }
}

/**
 * E2.2 · una línea resuelta por una regla aprendida · `true` si quedó resuelta.
 *
 * Por el MISMO camino que el gesto humano equivalente, para que el resultado
 * sea indistinguible de haberlo hecho a mano: `convertirLineaEnTraspaso` para
 * un traspaso, `gastoDesdeMovimiento` para una clasificación (materializa la
 * línea, clasifica el movimiento y escribe la fila fiscal, buscando antes la
 * del recurrente para no contarla dos veces · #1834). Los dos son idempotentes
 * y los dos vuelven a ENSEÑAR (`appliedCount` sube con el acierto).
 *
 * Lo único propio de este camino es la huella: `comoSeResolvio: 'motor'` y
 * `statusConciliacion: 'match_automatico'`, para que quien audite sepa que
 * esto lo cerró ATLAS y no una persona.
 */
async function resolverPorRegla(
  db: Awaited<ReturnType<typeof initDB>>,
  lineaId: number,
  ruleId: number,
  now: string
): Promise<boolean> {
  const rule = (await db.get('movementLearningRules', ruleId)) as MovementLearningRule | undefined;
  if (!rule || !puedeResolverSola(rule)) return false;
  const linea = (await db.get('lineasExtracto', lineaId)) as LineaExtractoPersistida | undefined;
  if (!linea || linea.descarte) return false;
  // Ya resuelta (un Guardar anterior que falló a medias y se reintenta) · no se
  // repite. `materializarLinea` no crearía otro movimiento, pero
  // `gastoDesdeMovimiento` SÍ escribiría otra fila fiscal (solo busca la del
  // recurrente): el mismo gasto dos veces en la declaración, que es la zona
  // sensible de #1834. La guarda va aquí, antes de tocar nada.
  if (linea.estado === 'resuelta' || (linea.movementIds?.length ?? 0) > 0) return true;

  if (rule.resolucion === 'traspaso') {
    if (rule.cuentaDestinoId == null || linea.importe >= 0) return false;
    await convertirLineaEnTraspaso(lineaId, rule.cuentaDestinoId);
  } else {
    const inmuebleId =
      rule.ambito === 'INMUEBLE' && rule.inmuebleId ? Number(rule.inmuebleId) : null;
    const origenIdRecurrente = await origenIdRecurrenteDelGasto(inmuebleId, rule.categoria, linea.fechaOperacion);
    const r = await gastoDesdeMovimiento({
      lineaId,
      inmuebleId,
      concepto: linea.conceptoLiteral,
      importe: linea.importe,
      fecha: linea.fechaOperacion,
      categoryKey: rule.categoria,
      origenIdRecurrente,
    });
    // Sin casilla la ficha se quedaría abierta pidiéndola; en automático no hay
    // a quién. `puedeResolverSola` ya lo filtra, esto es la red por si cambia.
    if (r.resultado === 'falta_casilla') return false;
  }

  // La huella de que lo cerró el motor · sobre la línea y sobre su movimiento.
  const enlazada = (await db.get('lineasExtracto', lineaId)) as LineaExtractoPersistida | undefined;
  if (!enlazada) return false;
  await db.put('lineasExtracto', { ...enlazada, comoSeResolvio: 'motor', updatedAt: now });
  for (const movementId of enlazada.movementIds ?? []) {
    const m = (await db.get('movements', movementId)) as Movement | undefined;
    if (m) await db.put('movements', { ...m, statusConciliacion: 'match_automatico', updatedAt: now });
  }
  return true;
}
