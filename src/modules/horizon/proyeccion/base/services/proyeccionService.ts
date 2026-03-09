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
    
    // Calculate based on actual contracts and expenses
    const currentYear = new Date().getFullYear();
    const yearlyData: YearlyProjectionData[] = [];
    
    // Get actual data from database
    const { rentalIncome, expenses, debtService, propertyValue, outstandingDebt } = await this.getActualBaseValues();
    
    let currentRentalIncome = rentalIncome;
    let currentExpenses = expenses;
    let currentDebtService = debtService;
    let currentPropertyValue = propertyValue;
    let currentOutstandingDebt = outstandingDebt;
    
    for (let i = 0; i <= 20; i++) {
      const year = currentYear + i;
      
      // Apply growth rates
      const adjustedRentalIncome = currentRentalIncome * Math.pow(1 + assumptions.rentGrowth / 100, i) * (1 - assumptions.vacancyRate / 100);
      const adjustedExpenses = currentExpenses * Math.pow(1 + assumptions.expenseInflation / 100, i);
      const adjustedPropertyValue = currentPropertyValue * Math.pow(1 + assumptions.propertyAppreciation / 100, i);
      
      // Calculate debt reduction (simplified - in reality would depend on loan terms)
      const debtReduction = i > 0 ? currentDebtService * 0.3 : 0; // Assume 30% goes to principal
      currentOutstandingDebt = Math.max(0, currentOutstandingDebt - debtReduction);
      
      const netCashflow = adjustedRentalIncome - adjustedExpenses - currentDebtService;
      const netWorth = adjustedPropertyValue - currentOutstandingDebt;
      
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

    // Get upcoming impacts from actual data
    const upcomingImpacts = await this.getUpcomingImpacts();

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

  /**
   * Calculate actual base values from database
   */
  private async getActualBaseValues(): Promise<{
    rentalIncome: number;
    expenses: number;
    debtService: number;
    propertyValue: number;
    outstandingDebt: number;
  }> {
    try {
      const db = await initDB();
      const [contracts, expenses, properties] = await Promise.all([
        db.getAll('contracts'),
        db.getAll('expenses'),
        db.getAll('properties')
      ]);

      // Calculate annual rental income from active contracts
      const currentYear = new Date().getFullYear();
      const rentalIncome = contracts
        .filter(contract => contract.status === 'active')
        .reduce((total, contract) => total + (contract.rentAmount * 12), 0);

      // Calculate annual expenses from this year
      const totalExpenses = expenses
        .filter(expense => expense.taxYear === currentYear)
        .reduce((total, expense) => total + expense.amount, 0);

      // Calculate property values
      const propertyValue = properties
        .reduce((total, property) => total + (property.purchasePrice || 0), 0);

      // For debt service and outstanding debt, return 0 if no data available
      // In a real implementation, this would come from mortgage/loan data
      return {
        rentalIncome: rentalIncome || 0,
        expenses: totalExpenses || 0,
        debtService: 0, // Would calculate from loan data
        propertyValue: propertyValue || 0,
        outstandingDebt: 0 // Would calculate from loan data
      };
    } catch (error) {
      console.warn('Error calculating base values:', error);
      return {
        rentalIncome: 0,
        expenses: 0,
        debtService: 0,
        propertyValue: 0,
        outstandingDebt: 0
      };
    }
  }

  /**
   * Get upcoming impacts from actual data
   */
  private async getUpcomingImpacts(): Promise<UpcomingImpact[]> {
    // In a real implementation, this would analyze contracts, expenses, and schedules
    // to determine upcoming financial impacts
    return [];
  }
}

export const proyeccionService = new ProyeccionService();