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
//
// Lo que sigue en «te necesitan» no viaja: no se materializa (D4).
// ============================================================================

import { initDB, Movement, TreasuryEvent } from './db';
import type { LineaExtractoPersistida } from './db/types-lineasExtracto';
import { cerrarLineaDeGastoDelEvento, type DbParaCierre } from './cierreLineaInmueble';
import { sinMarcaDeDescarte } from './descarteDePrevision';
import { deriveCategoryFromEvent, feedLearningRule } from './aplicarSugerencia';
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
      if (cerrado) lineasTocadas.add(origen.lineaId);
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
  }
}
