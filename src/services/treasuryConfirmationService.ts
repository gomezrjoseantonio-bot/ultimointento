// src/services/treasuryConfirmationService.ts
//
// PR3 · Arquitectura unificada de Tesorería.
//
// Modelo único y homogéneo:
//   treasuryEvents = lo previsto/pendiente
//   movements      = lo confirmado por el usuario (tras puntear)
//
// Puntear = materializar una previsión en un movimiento real.
//
// Efectos de confirmTreasuryEvent:
//   1. Crea un movement con los datos del treasuryEvent (opcionalmente editados)
//   2. Marca el treasuryEvent como 'executed' con executedMovementId + executedAt
//   3. Si ambito === 'INMUEBLE' y categoryLabel apunta a reparación/mejora/
//      mobiliario, crea la línea correspondiente en gastosInmueble /
//      mejorasInmueble / mueblesInmueble con referencia cruzada al movement
//      y al treasuryEvent.
//
// revertTreasuryConfirmation hace el inverso: elimina el movement, revierte
// el treasuryEvent a 'predicted' y borra la línea de inmueble si existía.
//
// Reutiliza la misma forma de movement que propertySaleService y
// LineasAnualesTab para mantener coherencia con todos los filtros de
// Conciliación.

import { initDB } from './db';
import type { TreasuryEvent, Movement } from './db';
import {
  resolveCategoryFromRecord,
  isTransferKey,
  type CategoryDef,
} from './categoryCatalog';

export interface ConfirmOverrides {
  amount?: number;
  date?: string;
  accountId?: number;
  description?: string;
  counterparty?: string;
  notes?: string;
}

export interface ConfirmResult {
  movementId: number;
  lineaId?: number;
  lineaStore?: CategoriaStoreName;
}

type CategoriaStoreName = 'gastosInmueble' | 'mejorasInmueble' | 'mueblesInmueble';

const ALL_LINE_STORES: CategoriaStoreName[] = [
  'gastosInmueble',
  'mejorasInmueble',
  'mueblesInmueble',
];

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Mapea un event (vía `categoryKey` del catálogo, con fallback a
 * `categoryLabel` legado) al store de líneas de inmueble correspondiente.
 * Devuelve null si la categoría no genera línea (ingresos, gastos personales,
 * traspasos…).
 *
 * PR5-HOTFIX v2: fuente única de verdad en `categoryCatalog.ts`.
 */
export function categoryLabelToStoreName(
  labelOrKey?: string,
): CategoriaStoreName | null {
  if (!labelOrKey) return null;

  // Match directo por key del catálogo.
  const def = resolveCategoryFromRecord({ categoryLabel: labelOrKey, categoryKey: labelOrKey });
  if (def?.storeName) return def.storeName;

  // Fallback para strings legados sin correspondencia en el catálogo: mantén
  // el heurístico antiguo para no romper datos existentes.
  const n = normalize(labelOrKey);
  if (n.includes('reparacion')) return 'gastosInmueble';
  if (n.includes('mejora')) return 'mejorasInmueble';
  if (n.includes('mobiliario') || n.includes('muebles')) return 'mueblesInmueble';
  if (
    n.includes('recurrente') ||
    n.includes('ibi') ||
    n.includes('comunidad') ||
    n.includes('seguro') ||
    n.includes('suministro') ||
    n.includes('tribut') ||
    n.includes('basura') ||
    n.includes('servicio')
  ) {
    return 'gastosInmueble';
  }
  return null;
}

/**
 * Resuelve la casilla AEAT para una línea de gasto a partir del catálogo,
 * con fallback a heurístico sobre el label legado.
 */
export function resolveCasillaAEAT(labelOrKey?: string): string | undefined {
  if (!labelOrKey) return undefined;
  const def = resolveCategoryFromRecord({ categoryLabel: labelOrKey, categoryKey: labelOrKey });
  if (def?.casillaAEAT) return def.casillaAEAT;

  const n = normalize(labelOrKey);
  if (n.includes('reparacion')) return '0106';
  if (n.includes('comunidad')) return '0109';
  if (n.includes('seguro')) return '0114';
  if (n.includes('ibi') || n.includes('tribut') || n.includes('basura')) return '0115';
  if (n.includes('suministro')) return '0113';
  if (n.includes('servicio')) return '0108';
  if (n.includes('mobiliario') || n.includes('muebles')) return '0117';
  return undefined;
}

/**
 * Resuelve el CategoryDef efectivo de un event (preferencia: categoryKey →
 * categoryLabel legado). Mantiene alineación con el catálogo canónico.
 */
function resolveEventCategory(event: TreasuryEvent): CategoryDef | undefined {
  return resolveCategoryFromRecord({
    categoryKey: event.categoryKey,
    categoryLabel: event.categoryLabel,
  });
}

/**
 * Deriva el valor de `GastoInmueble.categoria` (enum interno de fiscalidad)
 * a partir de la categoría canónica del event.
 *
 * Acepta tres formas de entrada:
 *   - `TreasuryEvent`: caso principal, resuelve vía `categoryKey`/`categoryLabel`.
 *   - `string`: `categoryLabel` o `categoryKey` suelto, usado por los flujos
 *     que editan el movimiento sin recargar el TreasuryEvent completo
 *     (p. ej. `updateConfirmedMovement` de PR5.6).
 *   - `undefined`: devuelve `'otro'` como default seguro.
 */
function resolveGastoCategoria(input: TreasuryEvent | string | undefined): string {
  if (!input) return 'otro';

  const def =
    typeof input === 'string'
      ? resolveCategoryFromRecord({ categoryLabel: input, categoryKey: input })
      : resolveEventCategory(input);

  if (def) {
    // Los keys canónicos terminan en "_inmueble" para gastos de inmueble.
    // Quitamos el sufijo y mapeamos al enum fiscal `GastoCategoria`.
    const base = def.key.replace(/_inmueble$/, '');
    // Mapeo directo a valores válidos del enum `GastoCategoria`:
    //   'ibi' | 'comunidad' | 'seguro' | 'suministro' | 'reparacion' |
    //   'gestion' | 'servicio' | 'intereses' | 'otro'
    if (['reparacion', 'comunidad', 'seguro', 'ibi', 'suministro', 'servicio'].includes(base)) {
      return base;
    }
    // basuras → 'otro' (no hay enum específico), otros → 'otro', mobiliario
    // no pasa por aquí (su store es mueblesInmueble).
    return 'otro';
  }

  // Fallback heurístico sobre el label legado.
  const label = typeof input === 'string' ? input : (input.categoryLabel ?? '');
  const n = normalize(label);
  if (n.includes('reparacion')) return 'reparacion';
  if (n.includes('comunidad')) return 'comunidad';
  if (n.includes('seguro')) return 'seguro';
  if (n.includes('ibi') || n.includes('tribut')) return 'ibi';
  if (n.includes('suministro')) return 'suministro';
  if (n.includes('servicio')) return 'servicio';
  if (n.includes('gestion')) return 'gestion';
  return 'otro';
}

/**
 * Busca en un store de línea (gastosInmueble / mejorasInmueble / mueblesInmueble)
 * la primera línea vinculada a un treasuryEvent. Usa el índice
 * `treasuryEventId` si está disponible (PR3, DB_VERSION>=50) y cae a un
 * full-scan sólo para BDs muy antiguas.
 */
async function findLineByTreasuryEventId(
  store: IDBPObjectStoreLike,
  eventId: number,
): Promise<any | null> {
  try {
    const index = store.index('treasuryEventId');
    const matches = (await (index as any).getAll(eventId)) as any[];
    if (matches.length > 0) return matches[0];
  } catch {
    // índice no disponible → fallback
  }
  const all = (await store.getAll()) as any[];
  return all.find((l) => l?.treasuryEventId === eventId) ?? null;
}

// Tipo estructural para object stores dentro de transacciones — evita
// importar tipos estrictos de idb aquí.
type IDBPObjectStoreLike = {
  index: (name: string) => unknown;
  getAll: () => Promise<any[]>;
};

function buildMovementPayload({
  event,
  overrides,
  now,
}: {
  event: TreasuryEvent;
  overrides?: ConfirmOverrides;
  now: string;
}): { payload: Omit<Movement, 'id'>; accountId: number } {
  const finalDate = overrides?.date ?? event.predictedDate;
  const finalAmount = overrides?.amount ?? event.amount;
  const finalAccountId = overrides?.accountId ?? event.accountId;
  const finalDescription = overrides?.description ?? event.description;
  const finalCounterparty = overrides?.counterparty ?? event.counterparty ?? '';

  if (finalAccountId == null) {
    throw new Error(
      'No se puede confirmar una previsión sin cuenta. Asigna una cuenta o edita la previsión.',
    );
  }

  // Financing events (pagos/cancelaciones de préstamo) salen como 'Gasto'
  // para no contaminar los filtros de transferencias internas — consistente
  // con loanSettlementService.
  const type: Movement['type'] =
    event.type === 'income' ? 'Ingreso' : 'Gasto';

  const signedAmount =
    event.type === 'income' ? Math.abs(finalAmount) : -Math.abs(finalAmount);

  const payload: Omit<Movement, 'id'> = {
    accountId: finalAccountId,
    date: finalDate,
    valueDate: finalDate,
    amount: signedAmount,
    description: finalDescription,
    counterparty: finalCounterparty || undefined,
    reference: `treasury_event:${event.id}`,
    status: 'conciliado',
    unifiedStatus: 'conciliado',
    source: 'manual',
    category: {
      tipo: event.categoryLabel ?? 'Otros',
    },
    type,
    origin: 'Manual',
    movementState: 'Conciliado',
    ambito: event.ambito ?? 'PERSONAL',
    inmuebleId: event.inmuebleId != null ? String(event.inmuebleId) : undefined,
    statusConciliacion: 'match_manual',
    tags: ['treasury_confirmation'],
    // PR5-HOTFIX v2: propagar categoría canónica + sub-tipo + metadatos de traspaso
    categoryKey: event.categoryKey,
    subtypeKey: event.subtypeKey,
    transferMetadata: event.transferMetadata,
    createdAt: now,
    updatedAt: now,
  };

  return { payload, accountId: finalAccountId };
}

/**
 * Puntea (confirma) una previsión de tesorería creando el movement real.
 *
 * @throws Error si el evento no existe, ya está ejecutado, o no tiene cuenta.
 */
export async function confirmTreasuryEvent(
  eventId: number,
  overrides?: ConfirmOverrides,
): Promise<ConfirmResult> {
  const db = await initDB();

  const existingEvent = (await db.get('treasuryEvents', eventId)) as
    | TreasuryEvent
    | undefined;

  if (!existingEvent) {
    throw new Error('Previsión no encontrada');
  }
  if (existingEvent.status === 'executed') {
    throw new Error('Esta previsión ya está confirmada');
  }

  const now = new Date().toISOString();
  // PR5-HOTFIX v2 · Resuelve la categoría canónica del event. Preferimos
  // `categoryKey`; si no existe (datos previos o events generados por
  // servicios que aún no lo rellenan), inferimos desde `categoryLabel`.
  const categoryDef = resolveEventCategory(existingEvent);

  // Traspasos internos NO generan línea de inmueble nunca (son movimientos
  // espejo entre cuentas propias).
  const esTransfer = isTransferKey(existingEvent.categoryKey);

  const esLineaInmueble =
    !esTransfer &&
    existingEvent.ambito === 'INMUEBLE' &&
    (!!categoryDef?.storeName || !!existingEvent.categoryLabel);

  // El store se deriva del catálogo; si no hay key canónica, fallback al
  // heurístico sobre el label legado.
  const lineaStore: CategoriaStoreName | null = esLineaInmueble
    ? (categoryDef?.storeName ?? categoryLabelToStoreName(existingEvent.categoryLabel))
    : null;

  const stores: string[] = ['treasuryEvents', 'movements'];
  if (lineaStore) stores.push(lineaStore);

  const tx = db.transaction(stores as any, 'readwrite');

  const { payload } = buildMovementPayload({
    event: existingEvent,
    overrides,
    now,
  });

  const movementId = Number(
    await (tx.objectStore('movements') as any).add(payload),
  );

  let lineaId: number | undefined;
  if (lineaStore && existingEvent.inmuebleId != null) {
    const finalDate = overrides?.date ?? existingEvent.predictedDate;
    const finalAmount = overrides?.amount ?? existingEvent.amount;
    const finalDescription = overrides?.description ?? existingEvent.description;
    const finalCounterparty =
      overrides?.counterparty ?? existingEvent.counterparty ?? '';
    const ejercicio = Number(String(finalDate).slice(0, 4));
    const accountIdForLinea =
      overrides?.accountId ?? existingEvent.accountId ?? undefined;

    // PR5.5 · Si ya existe una línea vinculada al event (por haber
    // desconciliado antes), la reutilizamos en lugar de crear un duplicado.
    const existingLine = await findLineByTreasuryEventId(
      tx.objectStore(lineaStore) as any,
      eventId,
    );

    if (lineaStore === 'gastosInmueble') {
      const linea = {
        inmuebleId: existingEvent.inmuebleId,
        ejercicio,
        fecha: finalDate,
        concepto: finalDescription,
        // Categoría derivada del catálogo canónico (con fallback a heurístico
        // sobre el label legado para no perder la clasificación fiscal).
        categoria: resolveGastoCategoria(existingEvent),
        casillaAEAT:
          categoryDef?.casillaAEAT
          ?? resolveCasillaAEAT(existingEvent.categoryKey ?? existingEvent.categoryLabel)
          ?? '0106',
        importe: Math.abs(finalAmount),
        // origen: 'tesoreria' alinea con el resto de servicios que inyectan
        // desde Conciliación (ver propertyExpenses.test y fiscal services).
        origen: 'tesoreria' as const,
        estado: 'confirmado' as const,
        estadoTesoreria: 'confirmed' as const,
        proveedorNIF: finalCounterparty || undefined,
        cuentaBancaria:
          accountIdForLinea != null ? String(accountIdForLinea) : undefined,
        movimientoId: String(movementId),
        treasuryEventId: eventId,
        // PR5-HOTFIX v2: identificador canónico + sub-tipo
        categoryKey: existingEvent.categoryKey ?? categoryDef?.key,
        subtypeKey: existingEvent.subtypeKey,
        createdAt: existingLine?.createdAt ?? now,
        updatedAt: now,
      };
      if (existingLine?.id != null) {
        await (tx.objectStore(lineaStore) as any).put({
          ...existingLine,
          ...linea,
          id: existingLine.id,
        });
        lineaId = existingLine.id;
      } else {
        lineaId = Number(await (tx.objectStore(lineaStore) as any).add(linea));
      }
    } else if (lineaStore === 'mejorasInmueble') {
      const linea = {
        inmuebleId: existingEvent.inmuebleId,
        ejercicio,
        descripcion: finalDescription,
        tipo: 'mejora' as const,
        importe: Math.abs(finalAmount),
        fecha: finalDate,
        proveedorNIF: finalCounterparty || undefined,
        movimientoId: String(movementId),
        treasuryEventId: eventId,
        estadoTesoreria: 'confirmed' as const,
        // PR5-HOTFIX v2: identificador canónico
        categoryKey: existingEvent.categoryKey ?? categoryDef?.key,
        createdAt: existingLine?.createdAt ?? now,
        updatedAt: now,
      };
      if (existingLine?.id != null) {
        await (tx.objectStore(lineaStore) as any).put({
          ...existingLine,
          ...linea,
          id: existingLine.id,
        });
        lineaId = existingLine.id;
      } else {
        lineaId = Number(await (tx.objectStore(lineaStore) as any).add(linea));
      }
    } else if (lineaStore === 'mueblesInmueble') {
      const linea = {
        inmuebleId: existingEvent.inmuebleId,
        ejercicio,
        descripcion: finalDescription,
        fechaAlta: finalDate,
        importe: Math.abs(finalAmount),
        vidaUtil: 10,
        activo: true,
        proveedorNIF: finalCounterparty || undefined,
        movimientoId: String(movementId),
        treasuryEventId: eventId,
        estadoTesoreria: 'confirmed' as const,
        // PR5-HOTFIX v2: identificador canónico
        categoryKey: existingEvent.categoryKey ?? categoryDef?.key,
        createdAt: existingLine?.createdAt ?? now,
        updatedAt: now,
      };
      if (existingLine?.id != null) {
        await (tx.objectStore(lineaStore) as any).put({
          ...existingLine,
          ...linea,
          id: existingLine.id,
        });
        lineaId = existingLine.id;
      } else {
        lineaId = Number(await (tx.objectStore(lineaStore) as any).add(linea));
      }
    }
  }

  const updatedEvent: TreasuryEvent = {
    ...existingEvent,
    status: 'executed',
    executedMovementId: movementId,
    executedAt: now,
    actualDate: overrides?.date ?? existingEvent.actualDate ?? existingEvent.predictedDate,
    // actualAmount se persiste como magnitud positiva — el signo siempre
    // se deriva de event.type en el resto del flujo (alineado con
    // reconcileTreasuryEvent).
    actualAmount: Math.abs(
      overrides?.amount ?? existingEvent.actualAmount ?? existingEvent.amount,
    ),
    notes: overrides?.notes ?? existingEvent.notes,
    movementId,
    updatedAt: now,
  };
  await (tx.objectStore('treasuryEvents') as any).put(updatedEvent);

  await tx.done;

  // PR5-HOTFIX v2 · Si el event es una amortización parcial de préstamo,
  // descontar el importe del capital pendiente. El ID de préstamo se guarda en
  // `sourceId` (tipo string en prestamos) cuando `sourceType === 'prestamo'`.
  if (
    existingEvent.sourceType === 'prestamo' &&
    existingEvent.transferMetadata?.esAmortizacionParcial &&
    existingEvent.sourceId != null
  ) {
    try {
      const prestamoId = String(existingEvent.sourceId);
      const prestamo = (await db.get('prestamos' as any, prestamoId)) as any;
      if (prestamo && typeof prestamo.principalVivo === 'number') {
        const nuevoPrincipalVivo = Math.max(
          0,
          prestamo.principalVivo - Math.abs(existingEvent.amount),
        );
        await (db as any).put('prestamos', {
          ...prestamo,
          principalVivo: nuevoPrincipalVivo,
          updatedAt: now,
        });
      }
    } catch (err) {
      console.warn('[treasuryConfirmation] amortización parcial: no se pudo actualizar el préstamo', err);
    }
  }

  // PR3 · Si el event confirmado era la línea "Cancelación deuda" de una
  // venta de inmueble (propertySaleService), finaliza el cierre del
  // préstamo en prestamosService. El import es dinámico para no crear un
  // ciclo de dependencias (propertySaleService depende de este servicio
  // indirectamente vía loan settlement).
  try {
    const { finalizePropertySaleLoanCancellationFromTreasuryEvent } =
      await import('./propertySaleService');
    await finalizePropertySaleLoanCancellationFromTreasuryEvent(eventId);
  } catch (err) {
    console.warn('[treasuryConfirmation] finalizePropertySaleLoanCancellation falló:', err);
  }

  return {
    movementId,
    lineaId,
    lineaStore: lineaStore ?? undefined,
  };
}

/**
 * Desconfirmar (revertir) un punteo: borra el movement, borra la línea de
 * inmueble asociada si existía, y devuelve el treasuryEvent a 'predicted'.
 *
 * Recibe el `movementId` creado por confirmTreasuryEvent. El eventId se
 * extrae automáticamente del campo `reference` del movement (formato
 * `treasury_event:{id}`).
 *
 * PR5.5: la línea de inmueble asociada se CONSERVA (la reparación/mejora/
 * mobiliario sigue existiendo), pero pasa a `estadoTesoreria: 'predicted'`
 * con `movimientoId: undefined` para que el usuario pueda volver a puntear
 * sin perder datos. El vínculo `treasuryEventId` se mantiene.
 *
 * Previsto al revertir:
 *   1. Borra el movement.
 *   2. Conserva la línea de inmueble con estadoTesoreria='predicted' y
 *      (solo GastoInmueble) estado='previsto'.
 *   3. Revierte el treasuryEvent a 'predicted'.
 */
export async function revertTreasuryConfirmation(
  movementId: number,
): Promise<void> {
  const db = await initDB();

  const movement = (await db.get('movements', movementId)) as
    | Movement
    | undefined;
  if (!movement) {
    throw new Error('Movimiento no encontrado');
  }

  const ref = String(movement.reference || '');
  const eventIdMatch = ref.match(/^treasury_event:(\d+)$/);
  const eventId = eventIdMatch ? Number(eventIdMatch[1]) : null;

  const stores = [
    'movements',
    'treasuryEvents',
    ...ALL_LINE_STORES,
  ];
  const tx = db.transaction(stores as any, 'readwrite');

  await (tx.objectStore('movements') as any).delete(movementId);

  // PR5.5 · Localiza las líneas vinculadas usando el índice `movimientoId`
  // (PR3, DB_VERSION>=50) y las conserva en lugar de borrarlas, marcándolas
  // como pendientes de tesorería de nuevo.
  const now = new Date().toISOString();
  const movementIdVariants: Array<string | number> = [
    String(movementId),
    movementId,
  ];
  for (const storeName of ALL_LINE_STORES) {
    const store = tx.objectStore(storeName) as any;
    let index: IDBIndex | null = null;
    try {
      index = store.index('movimientoId');
    } catch {
      index = null;
    }

    const matchedLines = new Map<number, any>();
    if (index) {
      for (const key of movementIdVariants) {
        const matches = (await (index as any).getAll(key)) as any[];
        for (const linea of matches) {
          if (linea?.id != null) matchedLines.set(linea.id, linea);
        }
      }
    } else {
      // Fallback para BDs anteriores a la migración: recorrido completo.
      const all = (await store.getAll()) as any[];
      for (const linea of all) {
        if (
          linea?.id != null &&
          (linea.movimientoId === String(movementId) ||
            linea.movimientoId === movementId)
        ) {
          matchedLines.set(linea.id, linea);
        }
      }
    }

    for (const [, linea] of matchedLines) {
      const reverted: any = {
        ...linea,
        movimientoId: undefined,
        estadoTesoreria: 'predicted',
        updatedAt: now,
      };
      // GastoInmueble tiene además un `estado` fiscal propio que se puso a
      // 'confirmado' en confirmTreasuryEvent. Al desconciliar, debe volver
      // a 'previsto' para no falsear las casillas AEAT.
      if (storeName === 'gastosInmueble' && linea.estado === 'confirmado') {
        reverted.estado = 'previsto';
      }
      await store.put(reverted);
    }
  }

  let revertedEvent: TreasuryEvent | null = null;
  if (eventId != null) {
    const existing = (await (tx.objectStore('treasuryEvents') as any).get(
      eventId,
    )) as TreasuryEvent | undefined;
    if (existing) {
      const reverted: TreasuryEvent = {
        ...existing,
        status: 'predicted',
        executedMovementId: undefined,
        executedAt: undefined,
        movementId: undefined,
        actualDate: undefined,
        actualAmount: undefined,
        updatedAt: now,
      };
      await (tx.objectStore('treasuryEvents') as any).put(reverted);
      revertedEvent = existing; // guardamos el estado PREVIO a la reversión
    }
  }

  await tx.done;

  // PR5-HOTFIX v2 · Si el event era una amortización parcial de préstamo,
  // sumar de nuevo el importe al capital pendiente (rollback del ajuste
  // hecho al confirmar). Se hace fuera de la transacción principal para no
  // meter el store `prestamos` en la tx.
  if (
    revertedEvent?.sourceType === 'prestamo' &&
    revertedEvent.transferMetadata?.esAmortizacionParcial &&
    revertedEvent.sourceId != null
  ) {
    try {
      const prestamoId = String(revertedEvent.sourceId);
      const prestamo = (await db.get('prestamos' as any, prestamoId)) as any;
      if (prestamo && typeof prestamo.principalVivo === 'number') {
        await (db as any).put('prestamos', {
          ...prestamo,
          principalVivo: prestamo.principalVivo + Math.abs(revertedEvent.amount),
          updatedAt: now,
        });
      }
    } catch (err) {
      console.warn('[treasuryConfirmation] rollback amortización parcial falló', err);
    }
  }

  // PR5-HOTFIX v2 · Si el event era una pata de traspaso, desconciliar también
  // el event espejo para mantener ambas patas en el mismo estado.
  // Guardamos contra re-entradas en la misma llamada usando un set global
  // efímero dentro del módulo.
  if (revertedEvent?.transferMetadata?.pairEventId != null) {
    try {
      const pairEventId = revertedEvent.transferMetadata.pairEventId;
      const pairEvent = (await db.get('treasuryEvents', pairEventId)) as
        | TreasuryEvent
        | undefined;
      if (pairEvent?.executedMovementId != null) {
        // Evita loop infinito: el event espejo también apunta al original.
        // Se comprueba que su propio movement exista; si no, ya se revirtió.
        const pairMovement = (await db.get(
          'movements',
          pairEvent.executedMovementId,
        )) as Movement | undefined;
        if (pairMovement) {
          await revertTreasuryConfirmation(pairEvent.executedMovementId);
        }
      }
    } catch (err) {
      console.warn('[treasuryConfirmation] cascade revert de traspaso falló', err);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PR5.6 · Edición y borrado en cascada de eventos confirmados
// ═══════════════════════════════════════════════════════════════════════

export interface UpdateConfirmedUpdates {
  amount?: number;
  date?: string;
  accountId?: number;
  description?: string;
  counterparty?: string;
  notes?: string;
  categoryLabel?: string;
  ambito?: 'PERSONAL' | 'INMUEBLE';
  inmuebleId?: number;
  facturaId?: number;
  facturaNoAplica?: boolean;
  justificanteId?: number;
  justificanteNoAplica?: boolean;
}

type LineMatch = {
  linea: any;
  storeName: CategoriaStoreName;
};

/**
 * Busca la primera línea (gastosInmueble/mejorasInmueble/mueblesInmueble)
 * asociada a un event/movement. Match defensivo:
 *   1. `treasuryEventId === eventId` (vínculo directo PR3)
 *   2. fallback: `movimientoId === movementId` (string o number)
 *
 * Recorre las 3 stores dentro de la misma transacción. Devuelve la primera
 * coincidencia · no espera duplicados entre stores.
 */
async function findLinkedLineInTx(
  tx: any,
  eventId: number,
  movementId: number | null | undefined,
): Promise<LineMatch | null> {
  for (const storeName of ALL_LINE_STORES) {
    const store = tx.objectStore(storeName);
    const all = (await store.getAll()) as any[];
    const linea = all.find((l) => {
      if (!l) return false;
      const matchByEvent =
        l.treasuryEventId != null && Number(l.treasuryEventId) === eventId;
      const matchByMovement =
        movementId != null &&
        l.movimientoId != null &&
        Number(l.movimientoId) === Number(movementId);
      return matchByEvent || matchByMovement;
    });
    if (linea) return { linea, storeName };
  }
  return null;
}

/**
 * PR5.6 · Borra un treasuryEvent con cascada completa: event + movement
 * asociado (si estaba confirmado) + línea de inmueble vinculada (gastos/
 * mejoras/muebles). Reemplaza el flujo viejo que solo llamaba a
 * `revertTreasuryConfirmation` + `delete(event)`, que dejaba la línea viva.
 *
 * Match defensivo de la línea por `treasuryEventId` y fallback por
 * `movimientoId` · cubre líneas legacy cuyo índice pudiera no estar presente.
 */
export async function deleteTreasuryEventCompletely(
  eventId: number,
): Promise<void> {
  const db = await initDB();

  const event = (await db.get('treasuryEvents', eventId)) as
    | TreasuryEvent
    | undefined;
  if (!event) return;

  const movementId = event.executedMovementId ?? event.movementId ?? null;

  const stores = ['treasuryEvents', 'movements', ...ALL_LINE_STORES];
  const tx = db.transaction(stores as any, 'readwrite');

  // 1. Borrar líneas asociadas en las 3 stores (match por treasuryEventId
  //    o por movimientoId · cubre líneas legacy sin doble vínculo).
  for (const storeName of ALL_LINE_STORES) {
    const store = tx.objectStore(storeName) as any;
    const all = (await store.getAll()) as any[];
    const lineas = all.filter((l) => {
      if (!l) return false;
      const matchByEvent =
        l.treasuryEventId != null && Number(l.treasuryEventId) === eventId;
      const matchByMovement =
        movementId != null &&
        l.movimientoId != null &&
        Number(l.movimientoId) === Number(movementId);
      return matchByEvent || matchByMovement;
    });
    for (const linea of lineas) {
      if (linea?.id != null) await store.delete(linea.id);
    }
  }

  // 2. Borrar movement asociado si existía.
  if (movementId != null) {
    await (tx.objectStore('movements') as any).delete(movementId);
  }

  // 3. Borrar el event.
  await (tx.objectStore('treasuryEvents') as any).delete(eventId);

  await tx.done;
}

/**
 * PR5.6 · Edita un treasuryEvent confirmado propagando los cambios a:
 *   - treasuryEvents[eventId]
 *   - movements[event.executedMovementId] (con signo correcto según type)
 *   - línea vinculada en gastosInmueble/mejorasInmueble/mueblesInmueble
 *
 * Mantiene la conciliación · no desconcilia. Los campos del movement y la
 * línea se derivan de `updates`, respetando las convenciones de cada store
 * (gastosInmueble usa `concepto/fecha`, mejoras/muebles usan `descripcion`
 * y `fecha`/`fechaAlta` respectivamente).
 *
 * NOTA sobre migración entre stores: si `categoryLabel` cambia a una categoría
 * que apuntaría a un store distinto (ej. Reparación → Mejora), la línea
 * existente NO se migra entre stores. Solo se actualizan sus campos. El
 * usuario debe eliminar y recrear el movimiento para un cambio de tipo.
 */
export async function updateConfirmedMovement(
  eventId: number,
  updates: UpdateConfirmedUpdates,
): Promise<void> {
  const db = await initDB();

  const event = (await db.get('treasuryEvents', eventId)) as
    | TreasuryEvent
    | undefined;
  if (!event) throw new Error('Evento no encontrado');

  const movementId = event.executedMovementId ?? event.movementId ?? null;
  const now = new Date().toISOString();

  const stores = ['treasuryEvents', 'movements', ...ALL_LINE_STORES];
  const tx = db.transaction(stores as any, 'readwrite');

  // 1. Actualizar event (magnitud positiva · el signo se deriva del type).
  const updatedEvent: TreasuryEvent = {
    ...event,
    amount:
      updates.amount != null ? Math.abs(updates.amount) : event.amount,
    predictedDate: updates.date ?? event.predictedDate,
    actualDate: updates.date ?? event.actualDate,
    actualAmount:
      updates.amount != null
        ? Math.abs(updates.amount)
        : event.actualAmount,
    accountId: updates.accountId ?? event.accountId,
    description: updates.description ?? event.description,
    counterparty:
      updates.counterparty !== undefined
        ? updates.counterparty || undefined
        : event.counterparty,
    notes:
      updates.notes !== undefined
        ? updates.notes || undefined
        : event.notes,
    categoryLabel: updates.categoryLabel ?? event.categoryLabel,
    ambito: updates.ambito ?? event.ambito,
    inmuebleId:
      updates.ambito === 'PERSONAL'
        ? undefined
        : updates.inmuebleId ?? event.inmuebleId,
    facturaId:
      updates.facturaId !== undefined ? updates.facturaId : event.facturaId,
    facturaNoAplica:
      updates.facturaNoAplica !== undefined
        ? updates.facturaNoAplica
        : event.facturaNoAplica,
    justificanteId:
      updates.justificanteId !== undefined
        ? updates.justificanteId
        : event.justificanteId,
    justificanteNoAplica:
      updates.justificanteNoAplica !== undefined
        ? updates.justificanteNoAplica
        : event.justificanteNoAplica,
    updatedAt: now,
  };
  await (tx.objectStore('treasuryEvents') as any).put(updatedEvent);

  // 2. Actualizar movement si existe (importe con signo según type).
  if (movementId != null) {
    const movementsStore = tx.objectStore('movements') as any;
    const movement = (await movementsStore.get(movementId)) as
      | Movement
      | undefined;
    if (movement) {
      const signedAmount =
        updates.amount != null
          ? event.type === 'income'
            ? Math.abs(updates.amount)
            : -Math.abs(updates.amount)
          : movement.amount;
      const nextInmuebleId =
        updates.ambito === 'PERSONAL'
          ? undefined
          : updates.inmuebleId != null
          ? String(updates.inmuebleId)
          : movement.inmuebleId;
      await movementsStore.put({
        ...movement,
        amount: signedAmount,
        date: updates.date ?? movement.date,
        valueDate: updates.date ?? movement.valueDate,
        description: updates.description ?? movement.description,
        counterparty:
          updates.counterparty !== undefined
            ? updates.counterparty || undefined
            : movement.counterparty,
        ambito: updates.ambito ?? movement.ambito,
        inmuebleId: nextInmuebleId,
        category: updates.categoryLabel
          ? { ...movement.category, tipo: updates.categoryLabel }
          : movement.category,
        facturaId:
          updates.facturaId !== undefined
            ? updates.facturaId
            : movement.facturaId,
        facturaNoAplica:
          updates.facturaNoAplica !== undefined
            ? updates.facturaNoAplica
            : movement.facturaNoAplica,
        justificanteId:
          updates.justificanteId !== undefined
            ? updates.justificanteId
            : movement.justificanteId,
        justificanteNoAplica:
          updates.justificanteNoAplica !== undefined
            ? updates.justificanteNoAplica
            : movement.justificanteNoAplica,
        updatedAt: now,
      });
    }
  }

  // 3. Actualizar línea vinculada (primera coincidencia en las 3 stores).
  const linked = await findLinkedLineInTx(tx, eventId, movementId);
  if (linked?.linea?.id != null) {
    const { linea, storeName } = linked;
    const store = tx.objectStore(storeName) as any;

    const commonPatch: Record<string, any> = {
      importe:
        updates.amount != null ? Math.abs(updates.amount) : linea.importe,
      inmuebleId: updates.inmuebleId ?? linea.inmuebleId,
      proveedorNombre:
        updates.counterparty !== undefined
          ? updates.counterparty || undefined
          : linea.proveedorNombre,
      facturaId:
        updates.facturaId !== undefined
          ? updates.facturaId
          : linea.facturaId,
      facturaNoAplica:
        updates.facturaNoAplica !== undefined
          ? updates.facturaNoAplica
          : linea.facturaNoAplica,
      justificanteId:
        updates.justificanteId !== undefined
          ? updates.justificanteId
          : linea.justificanteId,
      justificanteNoAplica:
        updates.justificanteNoAplica !== undefined
          ? updates.justificanteNoAplica
          : linea.justificanteNoAplica,
      updatedAt: now,
    };

    if (storeName === 'gastosInmueble') {
      const newDate = updates.date ?? linea.fecha;
      await store.put({
        ...linea,
        ...commonPatch,
        fecha: newDate,
        ejercicio: newDate
          ? Number(String(newDate).slice(0, 4))
          : linea.ejercicio,
        concepto: updates.description ?? linea.concepto,
        categoria: updates.categoryLabel
          ? resolveGastoCategoria(updates.categoryLabel)
          : linea.categoria,
        casillaAEAT: updates.categoryLabel
          ? resolveCasillaAEAT(updates.categoryLabel) ?? linea.casillaAEAT
          : linea.casillaAEAT,
      });
    } else if (storeName === 'mejorasInmueble') {
      const newDate = updates.date ?? linea.fecha;
      await store.put({
        ...linea,
        ...commonPatch,
        fecha: newDate,
        ejercicio: newDate
          ? Number(String(newDate).slice(0, 4))
          : linea.ejercicio,
        descripcion: updates.description ?? linea.descripcion,
      });
    } else if (storeName === 'mueblesInmueble') {
      const newDate = updates.date ?? linea.fechaAlta;
      await store.put({
        ...linea,
        ...commonPatch,
        fechaAlta: newDate,
        ejercicio: newDate
          ? Number(String(newDate).slice(0, 4))
          : linea.ejercicio,
        descripcion: updates.description ?? linea.descripcion,
      });
    }
  }

  await tx.done;
}

// ═══════════════════════════════════════════════════════════════════════
// PR5 · Propagación bidireccional de documentos (factura + justificante)
// ═══════════════════════════════════════════════════════════════════════

export type DocSlot = 'factura' | 'justificante';

type DocUpdate = Partial<
  Pick<
    TreasuryEvent,
    'facturaId' | 'facturaNoAplica' | 'justificanteId' | 'justificanteNoAplica'
  >
>;

/**
 * Aplica la misma mutación documental en:
 *   - treasuryEvents[eventId]
 *   - movements[event.executedMovementId] (si existe)
 *   - todas las líneas de gastosInmueble/mejorasInmueble/mueblesInmueble
 *     cuyo `treasuryEventId` apunte al event (índice PR3)
 */
async function applyDocUpdateToEventAndLinkedRows(
  eventId: number,
  update: DocUpdate,
): Promise<void> {
  const db = await initDB();
  const now = new Date().toISOString();

  const stores: string[] = ['treasuryEvents', 'movements', ...ALL_LINE_STORES];
  const tx = db.transaction(stores as any, 'readwrite');

  const eventsStore = tx.objectStore('treasuryEvents') as any;
  const event = (await eventsStore.get(eventId)) as TreasuryEvent | undefined;
  if (!event) {
    await tx.done;
    throw new Error('Previsión no encontrada');
  }

  const updatedEvent: TreasuryEvent = { ...event, ...update, updatedAt: now };
  await eventsStore.put(updatedEvent);

  // Propagar al movement que materializó este event (si ya fue punteado).
  const movementId = event.executedMovementId ?? event.movementId;
  if (movementId != null) {
    const movementsStore = tx.objectStore('movements') as any;
    const movement = (await movementsStore.get(movementId)) as
      | Movement
      | undefined;
    if (movement) {
      await movementsStore.put({ ...movement, ...update, updatedAt: now });
    }
  }

  // Propagar a las líneas de inmueble vinculadas a este event.
  for (const storeName of ALL_LINE_STORES) {
    const store = tx.objectStore(storeName) as any;
    let index: IDBIndex | null = null;
    try {
      index = store.index('treasuryEventId');
    } catch {
      index = null;
    }

    const matches: any[] = index
      ? await (index as any).getAll(eventId)
      : ((await store.getAll()) as any[]).filter(
          (l: any) => l?.treasuryEventId === eventId,
        );

    for (const linea of matches) {
      if (linea?.id != null) {
        await store.put({ ...linea, ...update, updatedAt: now });
      }
    }
  }

  await tx.done;
}

/**
 * Asocia un documento (del store `documents`) a un slot (factura o justificante)
 * de un treasuryEvent. Propaga a movement y líneas de inmueble vinculadas.
 *
 * Al asociar, desmarca automáticamente el flag `*NoAplica` del mismo slot.
 */
export async function attachDocumentToEvent(
  eventId: number,
  slot: DocSlot,
  documentId: number,
): Promise<void> {
  const update: DocUpdate =
    slot === 'factura'
      ? { facturaId: documentId, facturaNoAplica: false }
      : { justificanteId: documentId, justificanteNoAplica: false };
  await applyDocUpdateToEventAndLinkedRows(eventId, update);
}

/**
 * Desvincula el documento de un slot. No toca el flag `*NoAplica` (el usuario
 * puede mantener "no aplica" aunque retire el documento).
 */
export async function detachDocumentFromEvent(
  eventId: number,
  slot: DocSlot,
): Promise<void> {
  const update: DocUpdate =
    slot === 'factura'
      ? { facturaId: undefined }
      : { justificanteId: undefined };
  await applyDocUpdateToEventAndLinkedRows(eventId, update);
}

/**
 * Marca / desmarca el flag `*NoAplica` del slot. Mantiene el documentId
 * asociado si lo había (así el usuario no pierde la referencia si cambia
 * de idea). Propaga a movement y líneas vinculadas.
 */
export async function setDocumentNoAplica(
  eventId: number,
  slot: DocSlot,
  value: boolean,
): Promise<void> {
  const update: DocUpdate =
    slot === 'factura'
      ? { facturaNoAplica: value }
      : { justificanteNoAplica: value };
  await applyDocUpdateToEventAndLinkedRows(eventId, update);
}
