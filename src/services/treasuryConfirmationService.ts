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
 * Mapea una etiqueta de categoría (p.ej. "Reparación inmueble") al store
 * de líneas correspondiente. Devuelve null si la categoría no genera línea
 * de inmueble (p.ej. ingreso, transferencia personal…).
 */
export function categoryLabelToStoreName(
  label?: string,
): CategoriaStoreName | null {
  if (!label) return null;
  const n = normalize(label);
  if (n.includes('reparacion')) return 'gastosInmueble';
  if (n.includes('mejora')) return 'mejorasInmueble';
  if (n.includes('mobiliario') || n.includes('muebles')) return 'mueblesInmueble';
  // Gasto recurrente de inmueble (IBI, comunidad, seguro, suministros,
  // tributos) también se materializa en gastosInmueble para que sea
  // deducible en la declaración.
  if (
    n.includes('recurrente') ||
    n.includes('ibi') ||
    n.includes('comunidad') ||
    n.includes('seguro') ||
    n.includes('suministro') ||
    n.includes('tribut')
  ) {
    return 'gastosInmueble';
  }
  return null;
}

/**
 * Resuelve la casilla AEAT aproximada para una línea de gasto a partir
 * del categoryLabel. Devuelve undefined si no está claro (queda sin
 * deducción asignada hasta que el usuario la clasifique manualmente).
 */
export function resolveCasillaAEAT(label?: string): string | undefined {
  if (!label) return undefined;
  const n = normalize(label);
  if (n.includes('reparacion')) return '0106';
  // Casillas alineadas con aeatClassificationService / rendimientoActivoService:
  //   0109 = comunidad, 0114 = seguros.
  if (n.includes('comunidad')) return '0109';
  if (n.includes('seguro')) return '0114';
  if (n.includes('ibi') || n.includes('tribut')) return '0115';
  if (n.includes('suministro')) return '0113';
  return undefined;
}

/**
 * Deriva el valor de `GastoInmueble.categoria` a partir del categoryLabel
 * del treasuryEvent. Mantiene alineación con aeatClassificationService.
 */
function resolveGastoCategoria(label?: string): string {
  if (!label) return 'otro';
  const n = normalize(label);
  if (n.includes('reparacion')) return 'reparacion';
  if (n.includes('comunidad')) return 'comunidad';
  if (n.includes('seguro')) return 'seguro';
  if (n.includes('ibi') || n.includes('tribut')) return 'ibi';
  if (n.includes('suministro')) return 'suministro';
  if (n.includes('gestion')) return 'gestion';
  return 'otro';
}

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
  const esLineaInmueble =
    existingEvent.ambito === 'INMUEBLE' && !!existingEvent.categoryLabel;
  const lineaStore = esLineaInmueble
    ? categoryLabelToStoreName(existingEvent.categoryLabel)
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

    if (lineaStore === 'gastosInmueble') {
      const linea = {
        inmuebleId: existingEvent.inmuebleId,
        ejercicio,
        fecha: finalDate,
        concepto: finalDescription,
        // Categoría derivada del categoryLabel para no perder la
        // clasificación fiscal real (comunidad/seguro/ibi/suministro/…).
        categoria: resolveGastoCategoria(existingEvent.categoryLabel),
        casillaAEAT: resolveCasillaAEAT(existingEvent.categoryLabel) ?? '0106',
        importe: Math.abs(finalAmount),
        // origen: 'tesoreria' alinea con el resto de servicios que inyectan
        // desde Conciliación (ver propertyExpenses.test y fiscal services).
        origen: 'tesoreria' as const,
        estado: 'confirmado' as const,
        proveedorNIF: finalCounterparty || undefined,
        cuentaBancaria:
          accountIdForLinea != null ? String(accountIdForLinea) : undefined,
        movimientoId: String(movementId),
        treasuryEventId: eventId,
        createdAt: now,
        updatedAt: now,
      };
      lineaId = Number(await (tx.objectStore(lineaStore) as any).add(linea));
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
        createdAt: now,
        updatedAt: now,
      };
      lineaId = Number(await (tx.objectStore(lineaStore) as any).add(linea));
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
        createdAt: now,
        updatedAt: now,
      };
      lineaId = Number(await (tx.objectStore(lineaStore) as any).add(linea));
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
 * `treasury_event:{id}`). Si el movement no existe lanza; si no tiene
 * event asociado, simplemente borra el movement + las líneas vinculadas
 * sin tocar treasuryEvents.
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

  // PR3 · Usa el índice `movimientoId` (creado en DB_VERSION=50) para
  // localizar la línea sin cargar toda la tabla. Soportamos tanto el
  // valor string (GastoInmueble/MejoraInmueble/MuebleInmueble declaran
  // movimientoId como string) como el valor numérico por si se hubiese
  // guardado ya como número en datos legacy.
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

    const seenIds = new Set<number>();
    if (index) {
      for (const key of movementIdVariants) {
        const matches = (await (index as any).getAll(key)) as any[];
        for (const linea of matches) {
          if (linea?.id != null) seenIds.add(linea.id);
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
          seenIds.add(linea.id);
        }
      }
    }

    for (const lineaId of seenIds) {
      await store.delete(lineaId);
    }
  }

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
        updatedAt: new Date().toISOString(),
      };
      await (tx.objectStore('treasuryEvents') as any).put(reverted);
    }
  }

  await tx.done;
}
