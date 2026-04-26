import { initDB, TreasuryEvent, Document, Movement } from './db';
import type { OpexRule, Contract } from './db';
import { isCapexType } from './aeatClassificationService';
import { calculateRentPeriodsFromContract } from './contractService';
import { prestamosCalculationService } from './prestamosCalculationService';
import type { Prestamo } from '../types/prestamos';

/**
 * Create treasury forecast event from confirmed document
 */
export const createTreasuryEventFromDocument = async (document: Document): Promise<void> => {
  if (!document.metadata.financialData?.amount || document.metadata.financialData.amount <= 0) {
    return;
  }

  const { financialData, aeatClassification } = document.metadata;
  
  // Skip mejora - it doesn't create treasury events, just updates property value
  if (aeatClassification?.fiscalType && isCapexType(aeatClassification.fiscalType)) {
    return;
  }

  const db = await initDB();
  
  // Create treasury event for expense forecast
  const event: TreasuryEvent = {
    type: 'expense',
    amount: financialData.amount, // Already checked above
    predictedDate: financialData.predictedPaymentDate || financialData.dueDate || new Date().toISOString().split('T')[0],
    description: `${document.metadata.proveedor || 'Factura'} - ${financialData.invoiceNumber || document.filename}`,
    sourceType: 'document',
    sourceId: document.id!,
    paymentMethod: financialData.paymentMethod || 'Domiciliado',
    iban: financialData.iban,
    status: 'predicted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as TreasuryEvent;

  // Try to match IBAN to account
  if (financialData.iban) {
    const accounts = await db.getAll('accounts');
    const matchingAccount = accounts.find(acc => acc.iban === financialData.iban);
    if (matchingAccount) {
      event.accountId = matchingAccount.id;
    }
  }

  await db.add('treasuryEvents', event);
};

/**
 * Update treasury event when document is modified
 */
export const updateTreasuryEventFromDocument = async (document: Document): Promise<void> => {
  if (!document.id) return;

  const db = await initDB();
  
  // Find existing event for this document
  const events = await db.getAllFromIndex('treasuryEvents', 'sourceId', document.id);
  const documentEvents = events.filter(e => e.sourceType === 'document');

  if (documentEvents.length === 0) {
    // Create new event if none exists
    await createTreasuryEventFromDocument(document);
    return;
  }

  // Update existing event
  const event = documentEvents[0];
  if (document.metadata.financialData?.amount) {
    event.amount = document.metadata.financialData.amount;
    event.predictedDate = document.metadata.financialData.predictedPaymentDate || 
                         document.metadata.financialData.dueDate || 
                         event.predictedDate;
    event.description = `${document.metadata.proveedor || 'Factura'} - ${document.metadata.financialData.invoiceNumber || document.filename}`;
    event.paymentMethod = document.metadata.financialData.paymentMethod || event.paymentMethod;
    event.iban = document.metadata.financialData.iban || event.iban;
    event.updatedAt = new Date().toISOString();

    await db.put('treasuryEvents', event);
  }
};

/**
 * Create treasury forecast event from a new Ingreso
 */
export const createTreasuryEventFromIngreso = async (ingresoId: number): Promise<void> => {
  const db = await initDB();
  const ingreso = await db.get('ingresos', ingresoId);
  if (!ingreso || ingreso.importe <= 0) return;

  const event: TreasuryEvent = {
    type: 'income',
    amount: ingreso.importe,
    predictedDate: ingreso.fecha_prevista_cobro,
    description: `Ingreso: ${ingreso.contraparte}`,
    sourceType: 'ingreso',
    sourceId: ingresoId,
    status: 'predicted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.add('treasuryEvents', event);
};

/**
 * Update treasury forecast event when an Ingreso is modified
 */
export const updateTreasuryEventFromIngreso = async (ingresoId: number): Promise<void> => {
  const db = await initDB();
  const ingreso = await db.get('ingresos', ingresoId);
  if (!ingreso) return;

  const events = await db.getAllFromIndex('treasuryEvents', 'sourceId', ingresoId);
  const ingresoEvents = events.filter(e => e.sourceType === 'ingreso');

  if (ingresoEvents.length === 0) {
    await createTreasuryEventFromIngreso(ingresoId);
    return;
  }

  const event = ingresoEvents[0];
  event.amount = ingreso.importe;
  event.predictedDate = ingreso.fecha_prevista_cobro;
  event.description = `Ingreso: ${ingreso.contraparte}`;
  event.updatedAt = new Date().toISOString();

  await db.put('treasuryEvents', event);
};

/**
 * Create treasury forecast event from a new Gasto
 */
export const createTreasuryEventFromGasto = async (gastoId: number): Promise<void> => {
  const db = await initDB();
  const gasto = await db.get('gastosInmueble', gastoId) as any;
  if (!gasto || gasto.importe <= 0) return;

  const event: TreasuryEvent = {
    type: 'expense',
    amount: gasto.importe || gasto.total || 0,
    predictedDate: gasto.fecha || gasto.fecha_pago_prevista,
    description: `Gasto: ${gasto.proveedorNombre || gasto.contraparte_nombre || ''}`,
    sourceType: 'gasto',
    sourceId: gastoId,
    status: 'predicted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.add('treasuryEvents', event);
};

/**
 * Update treasury forecast event when a Gasto is modified
 */
export const updateTreasuryEventFromGasto = async (gastoId: number): Promise<void> => {
  const db = await initDB();
  const gasto = await db.get('gastosInmueble', gastoId) as any;
  if (!gasto) return;

  const events = await db.getAllFromIndex('treasuryEvents', 'sourceId', gastoId);
  const gastoEvents = events.filter(e => e.sourceType === 'gasto');

  if (gastoEvents.length === 0) {
    await createTreasuryEventFromGasto(gastoId);
    return;
  }

  const event = gastoEvents[0];
  event.amount = gasto.total;
  event.predictedDate = gasto.fecha_pago_prevista;
  event.description = `Gasto: ${gasto.contraparte_nombre}`;
  event.updatedAt = new Date().toISOString();

  await db.put('treasuryEvents', event);
};

/**
 * Get treasury projections for a specific period
 */
export const getTreasuryProjections = async (
  days: number,
  accountIds?: number[]
): Promise<{
  events: TreasuryEvent[];
  accountBalances: Map<number, { current: number; projected: number }>;
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
}> => {
  const db = await initDB();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  
  // Get all events within the period
  const allEvents = await db.getAll('treasuryEvents');
  const relevantEvents = allEvents.filter(event => {
    const eventDate = new Date(event.predictedDate);
    const today = new Date();
    return eventDate >= today && eventDate <= endDate && event.status !== 'executed';
  });

  // Filter by account if specified
  const filteredEvents = accountIds && accountIds.length > 0 
    ? relevantEvents.filter(event => event.accountId && accountIds.includes(event.accountId))
    : relevantEvents;

  // Get accounts
  const accounts = await db.getAll('accounts');
  const activeAccounts = accounts.filter(acc => acc.isActive);
  
  // Calculate projections
  const accountBalances = new Map<number, { current: number; projected: number }>();
  
  for (const account of activeAccounts) {
    if (accountIds && accountIds.length > 0 && !accountIds.includes(account.id!)) {
      continue;
    }
    
    const accountEvents = filteredEvents.filter(e => e.accountId === account.id);
    const inflow = accountEvents.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
    const outflow = accountEvents.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
    
    accountBalances.set(account.id!, {
      current: account.balance,
      projected: account.balance + inflow - outflow
    });
  }

  const totalInflow = filteredEvents.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const totalOutflow = filteredEvents.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);

  return {
    events: filteredEvents,
    accountBalances,
    totalInflow,
    totalOutflow,
    netFlow: totalInflow - totalOutflow
  };
};

/**
 * Generate treasury recommendations based on projections
 */
export const generateTreasuryRecommendations = async (): Promise<void> => {
  const db = await initDB();
  
  // treasuryRecommendations store removed in V62 (derivable runtime)
  // Clear recommendations is now a no-op

  // Get 30-day projections
  const { accountBalances } = await getTreasuryProjections(30);
  const accounts = await db.getAll('accounts');
  
  for (const account of accounts) {
    if (!account.isActive || !account.id) continue;
    
    const balance = accountBalances.get(account.id);
    if (!balance) continue;
    
    const minimumBalance = account.minimumBalance || 200; // Default 200€ minimum
    
    // Check if account will go below minimum
    if (balance.projected < minimumBalance) {
      const deficit = minimumBalance - balance.projected;
      const suggestedAmount = Math.ceil(deficit / 100) * 100; // Round up to nearest 100€
      
      // Find account with highest balance to suggest transfer from
      const sortedAccounts = accounts
        .filter(acc => acc.isActive && acc.id !== account.id)
        .map(acc => ({ 
          account: acc, 
          balance: accountBalances.get(acc.id!)?.projected || acc.balance 
        }))
        .sort((a, b) => b.balance - a.balance);
      
      if (sortedAccounts.length > 0 && sortedAccounts[0].balance > suggestedAmount) {
        // V62 (TAREA 7 sub-tarea 3): el store `treasuryRecommendations` fue
        // eliminado · la generación de recomendaciones es ahora derivable en
        // runtime por la UI. Mantener el bloque vacío para conservar el
        // control de flujo (skip si no hay cuentas suficientemente fondeadas).
      }
    }
  }
};

/**
 * Reconcile treasury event with bank movement
 */
export const reconcileTreasuryEvent = async (
  eventId: number, 
  movementId: number
): Promise<void> => {
  const db = await initDB();
  
  const event = await db.get('treasuryEvents', eventId);
  const movement = await db.get('movements', movementId);
  
  if (!event || !movement) {
    throw new Error('Event or movement not found');
  }
  
  // Update event
  event.status = 'executed';
  event.actualDate = movement.date;
  event.actualAmount = Math.abs(movement.amount);
  event.movementId = movementId;
  event.updatedAt = new Date().toISOString();
  
  // Update movement
  if (!movement.documentIds) {
    movement.documentIds = [];
  }
  if (event.sourceType === 'document' && event.sourceId) {
    movement.documentIds.push(event.sourceId);
  }
  movement.status = 'conciliado';
  movement.updatedAt = new Date().toISOString();
  
  await Promise.all([
    db.put('treasuryEvents', event),
    db.put('movements', movement)
  ]);
};

/**
 * Find potential matches between treasury events and movements
 */
export const findEventMovementMatches = async (): Promise<Array<{
  event: TreasuryEvent;
  movement: Movement;
  score: number;
  reason: string;
}>> => {
  const db = await initDB();
  
  // Get unreconciled events and movements
  const events = await db.getAllFromIndex('treasuryEvents', 'status', 'predicted');
  const movements = await db.getAllFromIndex('movements', 'status', 'pendiente');
  
  const matches: Array<{
    event: TreasuryEvent;
    movement: Movement; 
    score: number;
    reason: string;
  }> = [];
  
  for (const event of events) {
    for (const movement of movements) {
      // Amount matching (within 0.50€)
      const amountDiff = Math.abs(Math.abs(movement.amount) - event.amount);
      if (amountDiff > 0.50) continue;
      
      // Date matching (within 3 days)
      const eventDate = new Date(event.predictedDate);
      const movementDate = new Date(movement.date);
      const daysDiff = Math.abs((eventDate.getTime() - movementDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 3) continue;
      
      // Account matching
      if (event.accountId && event.accountId !== movement.accountId) continue;
      
      // Calculate score
      let score = 0.5; // Base score for amount/date match
      
      // Amount exact match bonus
      if (amountDiff < 0.01) score += 0.3;
      
      // Date exact match bonus  
      if (daysDiff < 1) score += 0.2;
      
      // Provider/counterparty matching
      if (event.description && movement.counterparty) {
        const eventWords = event.description.toLowerCase().split(' ');
        const movementWords = (movement.counterparty + ' ' + movement.description).toLowerCase();
        const commonWords = eventWords.filter((word: string) => 
          word.length > 3 && movementWords.includes(word)
        );
        if (commonWords.length > 0) {
          score += Math.min(0.3, commonWords.length * 0.1);
        }
      }
      
      if (score >= 0.6) { // Minimum confidence threshold
        matches.push({
          event,
          movement,
          score,
          reason: `Importe ±${amountDiff.toFixed(2)}€, fecha ±${daysDiff.toFixed(1)}d, confianza ${(score * 100).toFixed(0)}%`
        });
      }
    }
  }
  
  return matches.sort((a, b) => b.score - a.score);
};

// ═══════════════════════════════════════════════════════════════════════
// PR5-HOTFIX v2 · Regeneración de previsiones para un mes dado.
//
// Orquesta las tres fuentes automáticas de previsiones de Conciliación:
//   1. Rentas de contratos activos
//   2. Gastos recurrentes de opexRules activas
//   3. Cuotas de préstamos activos
//
// Reglas:
//   - No se tocan events con status='executed' (son verdad consumada).
//   - Se deduplica por (sourceType, sourceId, mes) — si ya existe un event
//     para esa combinación, no se vuelve a crear.
//   - Solo se regenera el rango [primer día del mes, último día del mes].
// ═══════════════════════════════════════════════════════════════════════

interface RegenerateParams {
  year: number;
  month: number; // 0-11 (mismo formato que Filters del hook)
}

interface RegenerateResult {
  rentalsCreated: number;
  opexCreated: number;
  loansCreated: number;
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const m = month + 1;
  const lastDay = new Date(year, m, 0).getDate();
  return {
    start: `${year}-${pad(m)}-01`,
    end: `${year}-${pad(m)}-${pad(lastDay)}`,
  };
}

function isInMonth(iso: string | undefined, year: number, month: number): boolean {
  if (!iso) return false;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1;
  return y === year && m === month;
}

// Mapa key natural → event ya existente para ese mes, usado en dedupe.
// Contempla dos esquemas: (sourceType, sourceId, month) y, para préstamos,
// (prestamoId, numeroCuota).
function buildExistingIndex(events: TreasuryEvent[], year: number, month: number): Set<string> {
  const idx = new Set<string>();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  for (const ev of events) {
    if (!isInMonth(ev.predictedDate, year, month)) continue;
    if (ev.sourceType && ev.sourceId != null) {
      idx.add(`${ev.sourceType}:${ev.sourceId}:${monthKey}`);
    }
    if (ev.prestamoId != null && ev.numeroCuota != null) {
      idx.add(`prestamo:${ev.prestamoId}:${ev.numeroCuota}`);
    }
    // Fallback para préstamos viejos que solo usaron prestamoId sin numeroCuota.
    if (ev.prestamoId != null) {
      idx.add(`prestamo:${ev.prestamoId}:${monthKey}`);
    }
  }
  return idx;
}

async function regenerateRentalsForecast(
  params: RegenerateParams,
  existingIndex: Set<string>,
): Promise<number> {
  const { year, month } = params;
  const db = await initDB();
  const contracts = (await (db as any).getAll('contracts').catch(() => [])) as Contract[];

  const activeContracts = contracts.filter((c) => c.estadoContrato === 'activo');
  const now = new Date().toISOString();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  let created = 0;

  for (const contract of activeContracts) {
    const periods = calculateRentPeriodsFromContract(contract);
    const period = periods.find((p) => p.periodo === monthKey);
    if (!period || period.importe <= 0) continue;

    const contractId = contract.id!;
    const key = `contract:${contractId}:${monthKey}`;
    if (existingIndex.has(key)) continue;

    // Día de cobro: diaPago del contrato (1-28). Día clamped al mes.
    const lastDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(Math.max(contract.diaPago ?? 1, 1), lastDay);
    const predictedDate = `${monthKey}-${String(day).padStart(2, '0')}`;

    const event: Omit<TreasuryEvent, 'id'> = {
      type: 'income',
      amount: period.importe,
      predictedDate,
      description: `Renta ${monthKey} · ${contract.inquilino?.nombre ?? ''} ${contract.inquilino?.apellidos ?? ''}`.trim(),
      sourceType: 'contract',
      sourceId: contractId,
      contratoId: contractId,
      status: 'predicted',
      ambito: 'INMUEBLE',
      inmuebleId: contract.inmuebleId,
      categoryLabel: 'Alquiler',
      categoryKey: 'alquiler',
      counterparty: `${contract.inquilino?.nombre ?? ''} ${contract.inquilino?.apellidos ?? ''}`.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    await (db as any).add('treasuryEvents', event);
    created++;
  }

  return created;
}

function opexRuleAppliesToMonth(rule: OpexRule, month: number): boolean {
  const m = month + 1; // 1-12
  switch (rule.frecuencia) {
    case 'mensual':
      return true;
    case 'anual': {
      // Sin mesInicio: aplica en enero por defecto.
      const start = rule.mesInicio ?? 1;
      return m === start;
    }
    case 'bimestral': {
      const start = rule.mesInicio ?? 1;
      return ((m - start + 12) % 2) === 0;
    }
    case 'trimestral': {
      const start = rule.mesInicio ?? 1;
      return ((m - start + 12) % 3) === 0;
    }
    case 'semestral': {
      const start = rule.mesInicio ?? 1;
      return ((m - start + 12) % 6) === 0;
    }
    case 'meses_especificos': {
      return (rule.mesesCobro ?? []).includes(m);
    }
    case 'semanal':
      // Semanal se expande en varias fechas del mes; omitido en este MVP.
      return false;
    default:
      return false;
  }
}

function opexRuleAmount(rule: OpexRule, month: number): number {
  const m = month + 1;
  if (rule.frecuencia === 'meses_especificos' && rule.asymmetricPayments) {
    const entry = rule.asymmetricPayments.find((p) => p.mes === m);
    if (entry) return entry.importe;
  }
  return rule.importeEstimado;
}

// Mapa opex categoria → CategoryKey canónico para nuevos events.
const OPEX_CAT_TO_KEY: Record<string, string> = {
  impuesto: 'ibi_inmueble',
  suministro: 'suministro_inmueble',
  comunidad: 'comunidad_inmueble',
  seguro: 'seguro_inmueble',
  servicio: 'servicio_inmueble',
  gestion: 'servicio_inmueble', // Gestión de alquiler → servicio
  otro: 'otros_inmueble',
};

async function regenerateOpexForecast(
  params: RegenerateParams,
  existingIndex: Set<string>,
): Promise<number> {
  const { year, month } = params;
  const db = await initDB();
  const rules = (await db.getAll('opexRules')) as OpexRule[];
  const activeRules = rules.filter((r) => r.activo);
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const now = new Date().toISOString();
  let created = 0;

  for (const rule of activeRules) {
    if (!rule.id) continue;
    if (!opexRuleAppliesToMonth(rule, month)) continue;

    const key = `opex_rule:${rule.id}:${monthKey}`;
    if (existingIndex.has(key)) continue;

    const amount = opexRuleAmount(rule, month);
    if (!amount || amount <= 0) continue;

    const day = Math.min(Math.max(rule.diaCobro ?? 1, 1), lastDay);
    const predictedDate = `${monthKey}-${String(day).padStart(2, '0')}`;

    const categoryKey = OPEX_CAT_TO_KEY[rule.categoria] ?? 'otros_inmueble';

    const event: Omit<TreasuryEvent, 'id'> = {
      type: 'expense',
      amount,
      predictedDate,
      description: rule.concepto || 'Gasto recurrente',
      sourceType: 'opex_rule',
      sourceId: rule.id,
      accountId: rule.accountId,
      status: 'predicted',
      ambito: 'INMUEBLE',
      inmuebleId: rule.propertyId,
      categoryLabel: rule.concepto || 'Gasto recurrente',
      categoryKey,
      counterparty: rule.proveedorNombre || undefined,
      createdAt: now,
      updatedAt: now,
    };
    await (db as any).add('treasuryEvents', event);
    created++;
  }

  return created;
}

async function regenerateLoansForecast(
  params: RegenerateParams,
  existingIndex: Set<string>,
): Promise<number> {
  const { year, month } = params;
  const db = await initDB();
  const prestamos = (await (db as any).getAll('prestamos').catch(() => [])) as Prestamo[];
  const activos = prestamos.filter((p) => p.activo && p.estado !== 'cancelado');
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const now = new Date().toISOString();
  let created = 0;

  for (const prestamo of activos) {
    try {
      const plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
      const periodo = plan.periodos.find(
        (p) => p.fechaCargo && p.fechaCargo.slice(0, 7) === monthKey,
      );
      if (!periodo || periodo.cuota <= 0) continue;

      const keyByCuota = `prestamo:${prestamo.id}:${periodo.periodo}`;
      const keyByMonth = `prestamo:${prestamo.id}:${monthKey}`;
      if (existingIndex.has(keyByCuota) || existingIndex.has(keyByMonth)) continue;

      // Resolver inmueble desde destinos (si aplica).
      const inmuebleDestino = prestamo.destinos?.find((d) => d.inmuebleId)?.inmuebleId
        ?? prestamo.inmuebleId;

      const event: Omit<TreasuryEvent, 'id'> = {
        type: 'financing',
        amount: periodo.cuota,
        predictedDate: periodo.fechaCargo,
        description: `Cuota ${periodo.periodo} · ${prestamo.nombre}`,
        sourceType: 'prestamo',
        prestamoId: prestamo.id,
        numeroCuota: periodo.periodo,
        status: 'predicted',
        ambito: inmuebleDestino ? 'INMUEBLE' : 'PERSONAL',
        inmuebleId: inmuebleDestino != null ? Number(inmuebleDestino) : undefined,
        createdAt: now,
        updatedAt: now,
      };
      await (db as any).add('treasuryEvents', event);
      created++;
    } catch (err) {
      console.warn('[regenerateLoansForecast] no se pudo procesar préstamo', prestamo.id, err);
    }
  }

  return created;
}

/**
 * Regenera las previsiones automáticas de tesorería para un mes dado.
 * Crea events `predicted` para contratos, opexRules y préstamos que no tengan
 * ya un event en el mes. NO toca events `executed` (ya confirmados por el
 * usuario) ni borra events manuales.
 */
export async function regenerateMonthForecast(
  params: RegenerateParams,
): Promise<RegenerateResult> {
  const { year, month } = params;
  const { start, end } = monthRange(year, month);

  const db = await initDB();
  const allEvents = (await db.getAll('treasuryEvents')) as TreasuryEvent[];
  const monthEvents = allEvents.filter((e) => {
    const iso = e.actualDate ?? e.predictedDate;
    return iso != null && iso >= start && iso <= end;
  });
  const existingIndex = buildExistingIndex(monthEvents, year, month);

  const [rentalsCreated, opexCreated, loansCreated] = await Promise.all([
    regenerateRentalsForecast({ year, month }, existingIndex),
    regenerateOpexForecast({ year, month }, existingIndex),
    regenerateLoansForecast({ year, month }, existingIndex),
  ]);

  return { rentalsCreated, opexCreated, loansCreated };
}