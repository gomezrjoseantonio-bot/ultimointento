import { initDB } from '../../../../../services/db';
import { getCachedStoreRecords } from '../../../../../services/indexedDbCacheService';
import { getSupuestosProyeccion } from '../../../../../services/escenariosService';

// C-PROY-5 · B1: `BaseAssumptions` + keyval 'base-assumptions' borrados.
// Los supuestos se leen de la fuente única (`Escenario.supuestos` ·
// escenariosService.getSupuestosProyeccion). Este motor legacy muere en B4;
// hasta entonces al menos proyecta con los mismos supuestos que todo lo demás.

export interface YearlyProjectionData {
  year: number;
  rentalIncome: number; // Net rental income
  operatingExpenses: number; // Operations + taxes + insurance + community
  debtService: number; // Debt service payments
  netCashflow: number; // Net cashflow
  propertyValue: number; // Estimated property value
  netWorth: number; // Net worth (property value - outstanding debt)
}

export interface UpcomingImpact {
  description: string;
  date: string; // ISO date
  amount?: number;
  type: 'income' | 'expense' | 'debt' | 'other';
}

export interface BaseProjection {
  currentAnnualCashflow: number;
  netWorth20Y: number;
  currentDSCR: number;
  yearlyData: YearlyProjectionData[];
  upcomingImpacts: UpcomingImpact[];
  lastCalculated: string; // ISO timestamp
}

// IndexedDB keys
const PROJECTION_KEY = 'base-projection';

// Projection cache TTL: 5 minutes
const PROJECTION_CACHE_TTL_MS = 5 * 60 * 1000;

class ProyeccionService {
  // In-memory cache so repeated calls within the same session are instant
  private cachedProjection: BaseProjection | null = null;
  private projectionCachedAt = 0;

  /**
   * Invalidate the projection cache (memory + persisted). Call after the
   * unified assumptions change so the next read recalculates.
   */
  async invalidateProjection(): Promise<void> {
    this.cachedProjection = null;
    this.projectionCachedAt = 0;
    try {
      const db = await initDB();
      await db.delete('keyval', PROJECTION_KEY);
    } catch {
      // Persisted cache is best-effort; memory invalidation already done.
    }
  }

  /**
   * Calculate and get base projection.
   * Returns in-memory cache if fresh; reads IndexedDB cache on cold start;
   * only recalculates when stale.
   */
  async getBaseProjection(): Promise<BaseProjection> {
    // 1. In-memory cache hit
    if (this.cachedProjection && Date.now() - this.projectionCachedAt < PROJECTION_CACHE_TTL_MS) {
      return this.cachedProjection;
    }

    // 2. Try reading persisted cache from IndexedDB before recalculating
    try {
      const db = await initDB();
      const persisted = await db.get('keyval', PROJECTION_KEY) as BaseProjection | undefined;
      if (persisted?.lastCalculated) {
        const age = Date.now() - new Date(persisted.lastCalculated).getTime();
        if (age < PROJECTION_CACHE_TTL_MS) {
          this.cachedProjection = persisted;
          this.projectionCachedAt = Date.now() - age;
          return persisted;
        }
      }
    } catch {
      // Proceed to recalculate
    }

    return this.recalculateProjection();
  }

  /**
   * Force a fresh calculation (e.g. after assumptions change).
   */
  private async recalculateProjection(): Promise<BaseProjection> {
    // Fuente única de supuestos (C-PROY-5 · B1)
    const supuestos = await getSupuestosProyeccion();
    const currentYear = new Date().getFullYear();

    const { rentalIncome, expenses, debtService, propertyValue, outstandingDebt } =
      await this.getActualBaseValues();

    let currentOutstandingDebt = outstandingDebt;
    const yearlyData: YearlyProjectionData[] = [];

    for (let i = 0; i <= 20; i++) {
      const adjustedRentalIncome =
        rentalIncome *
        Math.pow(1 + supuestos.subidaRentasPct / 100, i) *
        (1 - supuestos.vacanciaPct / 100);
      const adjustedExpenses = expenses * Math.pow(1 + supuestos.inflacionGastosPct / 100, i);
      const adjustedPropertyValue =
        propertyValue * Math.pow(1 + supuestos.revalorizacionInmueblesPct / 100, i);

      const debtReduction = i > 0 ? debtService * 0.3 : 0;
      currentOutstandingDebt = Math.max(0, currentOutstandingDebt - debtReduction);

      const netCashflow = adjustedRentalIncome - adjustedExpenses - debtService;
      const netWorth = adjustedPropertyValue - currentOutstandingDebt;

      yearlyData.push({
        year: currentYear + i,
        rentalIncome: adjustedRentalIncome,
        operatingExpenses: adjustedExpenses,
        debtService,
        netCashflow,
        propertyValue: adjustedPropertyValue,
        netWorth,
      });
    }

    const upcomingImpacts = await this.getUpcomingImpacts();

    const projection: BaseProjection = {
      currentAnnualCashflow: yearlyData[0].netCashflow,
      netWorth20Y: yearlyData[20].netWorth,
      currentDSCR: debtService > 0 ? yearlyData[0].rentalIncome / debtService : 0,
      yearlyData,
      upcomingImpacts,
      lastCalculated: new Date().toISOString(),
    };

    // Update in-memory cache
    this.cachedProjection = projection;
    this.projectionCachedAt = Date.now();

    // Persist to IndexedDB (fire-and-forget — don't block the return)
    initDB()
      .then((db) => db.put('keyval', projection, PROJECTION_KEY))
      .catch((err) => console.warn('Error caching projection to IndexedDB:', err));

    return projection;
  }

  /**
   * Load base values from DB using the shared in-memory store cache.
   */
  private async getActualBaseValues(): Promise<{
    rentalIncome: number;
    expenses: number;
    debtService: number;
    propertyValue: number;
    outstandingDebt: number;
  }> {
    try {
      const [contracts, expenses, properties] = await Promise.all([
        getCachedStoreRecords<any>('contracts'),
        getCachedStoreRecords<any>('expenses'),
        getCachedStoreRecords<any>('properties'),
      ]);

      const currentYear = new Date().getFullYear();

      const rentalIncome = contracts
        .filter((c: any) => c.status === 'active')
        .reduce((total: number, c: any) => total + (c.rentAmount * 12), 0);

      const totalExpenses = expenses
        .filter((e: any) => e.taxYear === currentYear)
        .reduce((total: number, e: any) => total + e.amount, 0);

      const propertyValue = properties.reduce(
        (total: number, p: any) => total + (p.purchasePrice || 0),
        0,
      );

      return {
        rentalIncome: rentalIncome || 0,
        expenses: totalExpenses || 0,
        debtService: 0,
        propertyValue: propertyValue || 0,
        outstandingDebt: 0,
      };
    } catch (error) {
      console.warn('Error calculating base values:', error);
      return { rentalIncome: 0, expenses: 0, debtService: 0, propertyValue: 0, outstandingDebt: 0 };
    }
  }

  private async getUpcomingImpacts(): Promise<UpcomingImpact[]> {
    return [];
  }
}

export const proyeccionService = new ProyeccionService();
