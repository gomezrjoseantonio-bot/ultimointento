import { initDB, TreasuryEvent, Document, Account, Movement } from './db';
import { suggestAEATClassification, isCapexType } from './aeatClassificationService';

/**
 * Create treasury forecast event from confirmed document
 */
export const createTreasuryEventFromDocument = async (document: Document): Promise<void> => {
  if (!document.metadata.financialData?.amount || document.metadata.financialData.amount <= 0) {
    return;
  }

  const { financialData, aeatClassification } = document.metadata;
  
  // Skip CAPEX - it doesn't create treasury events, just updates property value
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
  
  // Clear existing recommendations
  const existingRecs = await db.getAll('treasuryRecommendations');
  for (const rec of existingRecs) {
    if (rec.status === 'active') {
      await db.delete('treasuryRecommendations', rec.id!);
    }
  }

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
        const fromAccount = sortedAccounts[0].account;
        
        // Calculate recommended transfer date (a few days before deficit)
        const projectionDate = new Date();
        projectionDate.setDate(projectionDate.getDate() + 25); // 5 days before month end
        
        const recommendation = {
          id: `transfer-${account.id}-${Date.now()}`,
          type: 'transfer' as const,
          severity: balance.projected < 0 ? 'critical' as const : 'warning' as const,
          title: `Transferencia recomendada a ${account.name}`,
          description: `Transferir ${suggestedAmount}€ de ${fromAccount.name} a ${account.name} el ${projectionDate.toLocaleDateString('es-ES')} para mantener mínimo ${minimumBalance}€`,
          fromAccountId: fromAccount.id,
          toAccountId: account.id,
          suggestedAmount,
          suggestedDate: projectionDate.toISOString().split('T')[0],
          status: 'active' as const,
          createdAt: new Date().toISOString()
        };
        
        await db.add('treasuryRecommendations', recommendation);
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