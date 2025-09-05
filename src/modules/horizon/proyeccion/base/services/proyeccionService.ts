import { initDB } from '../../../../../services/db';

// Types for base projections
export interface BaseAssumptions {
  rentGrowth: number; // Annual rent growth percentage (e.g., 3.5)
  expenseInflation: number; // Annual expense inflation percentage (e.g., 2.5)
  propertyAppreciation: number; // Annual property appreciation percentage (e.g., 4.0)
  vacancyRate: number; // Vacancy rate percentage (e.g., 5.0)
  referenceRate: number; // Reference interest rate for variable loans (e.g., 4.5)
  lastModified: string; // ISO timestamp
}

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

// Default assumptions
const DEFAULT_ASSUMPTIONS: BaseAssumptions = {
  rentGrowth: 3.5,
  expenseInflation: 2.5,
  propertyAppreciation: 4.0,
  vacancyRate: 5.0,
  referenceRate: 4.5,
  lastModified: new Date().toISOString()
};

// IndexedDB keys
const ASSUMPTIONS_KEY = 'base-assumptions';
const PROJECTION_KEY = 'base-projection';

// localStorage fallback keys
const STORAGE_PREFIX = 'atlas-proyeccion-';
const ASSUMPTIONS_STORAGE_KEY = STORAGE_PREFIX + 'base-assumptions';
const PROJECTION_STORAGE_KEY = STORAGE_PREFIX + 'base-projection';

class ProyeccionService {
  
  /**
   * Get base assumptions from IndexedDB or localStorage
   */
  async getBaseAssumptions(): Promise<BaseAssumptions> {
    try {
      // Try IndexedDB first
      const db = await initDB();
      const stored = await db.get('keyval', ASSUMPTIONS_KEY);
      
      if (stored && this.isValidAssumptions(stored)) {
        return stored;
      }
    } catch (error) {
      console.warn('Error loading assumptions from IndexedDB:', error);
    }

    try {
      // Fallback to localStorage
      const stored = localStorage.getItem(ASSUMPTIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this.isValidAssumptions(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Error loading assumptions from localStorage:', error);
    }

    // Return defaults if nothing found
    return { ...DEFAULT_ASSUMPTIONS };
  }

  /**
   * Save base assumptions to IndexedDB and localStorage
   */
  async saveBaseAssumptions(assumptions: BaseAssumptions): Promise<void> {
    const toSave = {
      ...assumptions,
      lastModified: new Date().toISOString()
    };

    try {
      // Save to IndexedDB
      const db = await initDB();
      await db.put('keyval', toSave, ASSUMPTIONS_KEY);
    } catch (error) {
      console.warn('Error saving assumptions to IndexedDB:', error);
    }

    try {
      // Save to localStorage as fallback
      localStorage.setItem(ASSUMPTIONS_STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.warn('Error saving assumptions to localStorage:', error);
    }
  }

  /**
   * Calculate and get base projection
   */
  async getBaseProjection(): Promise<BaseProjection> {
    const assumptions = await this.getBaseAssumptions();
    
    // For demo purposes, generate sample data
    // In a real implementation, this would calculate based on actual contracts and expenses
    const currentYear = new Date().getFullYear();
    const yearlyData: YearlyProjectionData[] = [];
    
    // Sample base values (would come from actual data)
    let currentRentalIncome = 24000; // Annual net rental income
    let currentExpenses = 8000; // Annual operating expenses
    let currentDebtService = 12000; // Annual debt service
    let currentPropertyValue = 300000; // Current property value
    let outstandingDebt = 180000; // Outstanding debt
    
    for (let i = 0; i <= 20; i++) {
      const year = currentYear + i;
      
      // Apply growth rates
      const adjustedRentalIncome = currentRentalIncome * Math.pow(1 + assumptions.rentGrowth / 100, i) * (1 - assumptions.vacancyRate / 100);
      const adjustedExpenses = currentExpenses * Math.pow(1 + assumptions.expenseInflation / 100, i);
      const adjustedPropertyValue = currentPropertyValue * Math.pow(1 + assumptions.propertyAppreciation / 100, i);
      
      // Calculate debt reduction (simplified - in reality would depend on loan terms)
      const debtReduction = i > 0 ? currentDebtService * 0.3 : 0; // Assume 30% goes to principal
      outstandingDebt = Math.max(0, outstandingDebt - debtReduction);
      
      const netCashflow = adjustedRentalIncome - adjustedExpenses - currentDebtService;
      const netWorth = adjustedPropertyValue - outstandingDebt;
      
      yearlyData.push({
        year,
        rentalIncome: adjustedRentalIncome,
        operatingExpenses: adjustedExpenses,
        debtService: currentDebtService,
        netCashflow,
        propertyValue: adjustedPropertyValue,
        netWorth
      });
    }

    // Sample upcoming impacts
    const upcomingImpacts: UpcomingImpact[] = [
      {
        description: 'Revisión hipoteca Piso A',
        date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 850,
        type: 'debt'
      },
      {
        description: 'IBI trimestral',
        date: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 320,
        type: 'expense'
      }
    ];

    const projection: BaseProjection = {
      currentAnnualCashflow: yearlyData[0].netCashflow,
      netWorth20Y: yearlyData[20].netWorth,
      currentDSCR: yearlyData[0].rentalIncome / yearlyData[0].debtService,
      yearlyData,
      upcomingImpacts,
      lastCalculated: new Date().toISOString()
    };

    // Cache the projection
    await this.cacheProjection(projection);
    
    return projection;
  }

  /**
   * Cache projection data
   */
  private async cacheProjection(projection: BaseProjection): Promise<void> {
    try {
      // Save to IndexedDB
      const db = await initDB();
      await db.put('keyval', projection, PROJECTION_KEY);
    } catch (error) {
      console.warn('Error caching projection to IndexedDB:', error);
    }

    try {
      // Save to localStorage as fallback
      localStorage.setItem(PROJECTION_STORAGE_KEY, JSON.stringify(projection));
    } catch (error) {
      console.warn('Error caching projection to localStorage:', error);
    }
  }

  /**
   * Validate assumptions object
   */
  private isValidAssumptions(obj: any): obj is BaseAssumptions {
    return obj &&
      typeof obj.rentGrowth === 'number' &&
      typeof obj.expenseInflation === 'number' &&
      typeof obj.propertyAppreciation === 'number' &&
      typeof obj.vacancyRate === 'number' &&
      typeof obj.referenceRate === 'number' &&
      typeof obj.lastModified === 'string';
  }
}

export const proyeccionService = new ProyeccionService();