import { initDB, Movement, Account } from './db';
import { calculateAccountBalanceAtDate, corteParaSaldoVivo, leerLineasParaSaldo } from './accountBalanceService';
import { getTreasuryProjections } from './treasuryForecastService';

// Domain Events Types
export type TreasuryDomainEvent = 
  | { type: 'MOVEMENT_CREATED'; payload: { movement: Movement } }
  | { type: 'MOVEMENT_UPDATED'; payload: { movement: Movement; previousMovement: Movement } }
  | { type: 'MOVEMENT_DELETED'; payload: { movement: Movement } }
  | { type: 'ACCOUNT_CHANGED'; payload: { account: Account; previousAccount?: Account } }
  | { type: 'ACCOUNT_DELETED'; payload: { accountId: number; account: Account } }
  | { type: 'ACCOUNT_DELETE_WIZARD_COMPLETED'; payload: { accountId: number; account: Account; decisions: any; movedMovements: number } };

// Event listeners registry
type EventListener = (event: TreasuryDomainEvent) => Promise<void>;
const eventListeners: EventListener[] = [];

/**
 * Register an event listener for treasury domain events
 */
export const addEventListener = (listener: EventListener): void => {
  eventListeners.push(listener);
};

/**
 * Remove an event listener
 */
export const removeEventListener = (listener: EventListener): void => {
  const index = eventListeners.indexOf(listener);
  if (index > -1) {
    eventListeners.splice(index, 1);
  }
};

/**
 * Emit a treasury domain event
 */
export const emitTreasuryEvent = async (event: TreasuryDomainEvent): Promise<void> => {
  console.log('🔄 Treasury Event:', event.type, event.payload);
  
  // Execute all listeners
  await Promise.all(
    eventListeners.map(async (listener) => {
      try {
        await listener(event);
      } catch (error) {
        console.error('Error in treasury event listener:', error);
      }
    })
  );
};

/**
 * E1.5 · D3 · `account.balance` sale del HUB ÚNICO (`accountBalanceService`).
 *
 * Antes esto sumaba `movements` por su cuenta —sin eventos comprometidos, sin
 * excluir la compra a crédito, sin corte, sin casado implícito— y escribía el
 * mismo campo que `rollForwardAccountBalancesToMonth`: dos definiciones de
 * saldo que divergían, y la previsión (`treasuryForecastService`) leía esta.
 * Ahora es el saldo VIVO del hub (corte mañana, reales futuros incluidos, y las
 * líneas del extracto sin resolver), el mismo que ven Tesorería y el Panel.
 */
export const recalculateAccountBalance = async (accountId: number): Promise<void> => {
  try {
    const db = await initDB();
    const account = await db.get('accounts', accountId);
    if (!account) return;

    const [treasuryEvents, movements, lineas] = await Promise.all([
      db.getAll('treasuryEvents'),
      db.getAll('movements'),
      leerLineasParaSaldo(db),
    ]);
    // Fecha LOCAL · a medianoche en España la UTC da el día anterior.
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    const balance = calculateAccountBalanceAtDate({
      account,
      cutoffDate: corteParaSaldoVivo(hoy),
      treasuryEvents,
      movements,
      lineas,
      incluirRealesFuturos: true,
    });

    await db.put('accounts', {
      ...account,
      balance,
      updatedAt: new Date().toISOString(),
    });

    console.log(`💰 Updated balance for account ${account.name}: ${balance}€`);
  } catch (error) {
    console.error('Error recalculating account balance:', error);
    throw error;
  }
};

/**
 * Update Radar summaries for all modules (Pulse, Horizon, Consolidated)
 */
export const updateRadarSummaries = async (): Promise<void> => {
  try {
    const db = await initDB();
    
    // Get all accounts grouped by destination
    const allAccounts = await db.getAll('accounts');
    const horizonAccounts = allAccounts.filter(acc => acc.destination === 'horizon');
    const pulseAccounts = allAccounts.filter(acc => acc.destination === 'pulse');
    const consolidatedAccounts = allAccounts.filter(acc => acc.includeInConsolidated);
    
    // Calculate projections for different time horizons
    const horizons = [7, 30];
    
    for (const days of horizons) {
      // Horizon module
      if (horizonAccounts.length > 0) {
        await getTreasuryProjections(days, horizonAccounts.map(a => a.id!));
      }
      
      // Pulse module  
      if (pulseAccounts.length > 0) {
        await getTreasuryProjections(days, pulseAccounts.map(a => a.id!));
      }
      
      // Consolidated view
      if (consolidatedAccounts.length > 0) {
        await getTreasuryProjections(days, consolidatedAccounts.map(a => a.id!));
      }
    }
    
    console.log('📊 Updated Radar summaries for all modules');
    
  } catch (error) {
    console.error('Error updating Radar summaries:', error);
    throw error;
  }
};

/**
 * Check and update "En riesgo" flags for accounts
 */
export const updateRiskFlags = async (): Promise<number> => {
  try {
    const db = await initDB();
    const allAccounts = await db.getAll('accounts');
    
    let accountsAtRisk = 0;
    
    for (const account of allAccounts) {
      if (!account.id) continue;
      
      // Get 30-day projection for this account
      const { accountBalances } = await getTreasuryProjections(30, [account.id]);
      const projectedBalance = accountBalances.get(account.id)?.projected || account.balance || 0;
      
      // Check if account is at risk (projected balance < minimum balance)
      const minimumBalance = account.minimumBalance || 200; // Default minimum
      const isAtRisk = projectedBalance < minimumBalance;
      
      if (isAtRisk) {
        accountsAtRisk++;
        console.log(`⚠️ Account at risk: ${account.name} (projected: ${projectedBalance}€, minimum: ${minimumBalance}€)`);
      }
      
      // Update account risk flag if needed
      if (account.isAtRisk !== isAtRisk) {
        const updatedAccount = {
          ...account,
          isAtRisk,
          updatedAt: new Date().toISOString()
        };
        await db.put('accounts', updatedAccount);
      }
    }
    
    return accountsAtRisk;
    
  } catch (error) {
    console.error('Error updating risk flags:', error);
    throw error;
  }
};

/**
 * Complete treasury update pipeline - recalculates everything
 */
export const triggerTreasuryUpdate = async (affectedAccountIds?: number[]): Promise<void> => {
  try {
    // 1. Recalculate balances for affected accounts (or all if not specified)
    if (affectedAccountIds && affectedAccountIds.length > 0) {
      for (const accountId of affectedAccountIds) {
        await recalculateAccountBalance(accountId);
      }
    } else {
      // Recalculate all accounts
      const db = await initDB();
      const allAccounts = await db.getAll('accounts');
      for (const account of allAccounts) {
        if (account.id) {
          await recalculateAccountBalance(account.id);
        }
      }
    }
    
    // 2. Update Radar summaries
    await updateRadarSummaries();
    
    // 3. Update risk flags
    await updateRiskFlags();
    
    console.log('✅ Treasury update pipeline completed');
    
  } catch (error) {
    console.error('Error in treasury update pipeline:', error);
    throw error;
  }
};

// Setup default event listeners
addEventListener(async (event) => {
  switch (event.type) {
    case 'MOVEMENT_CREATED':
    case 'MOVEMENT_UPDATED':
    case 'MOVEMENT_DELETED':
      // Recalculate balance for the affected account
      await triggerTreasuryUpdate([event.payload.movement.accountId]);
      break;
      
    case 'ACCOUNT_CHANGED':
      // If account properties changed that could affect calculations
      await triggerTreasuryUpdate([event.payload.account.id!]);
      break;
      
    case 'ACCOUNT_DELETED':
    case 'ACCOUNT_DELETE_WIZARD_COMPLETED':
      // Full treasury update when accounts are deleted
      await triggerTreasuryUpdate();
      break;
  }
});
