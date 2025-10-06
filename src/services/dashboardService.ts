import { initDB } from './db';

// Dashboard block types
export type DashboardBlockType = 
  | 'treasury'
  | 'income-expenses'
  | 'kpis'
  | 'tax'
  | 'alerts';

// Dashboard preset types
export type DashboardPreset = 'preset-a' | 'preset-b';

// Block configuration interface
export interface DashboardBlockConfig {
  id: DashboardBlockType;
  name: string;
  description: string;
  isActive: boolean;
  position: number;
  options: Record<string, any>;
}

// Treasury block specific options
export interface TreasuryBlockOptions {
  accountsIncluded: 'all' | 'selected';
  selectedAccounts?: string[];
  horizon: 7 | 30; // days
  thresholds: {
    red: number;
    amber: number;
  };
}

// Income vs Expenses block options
export interface IncomeExpensesBlockOptions {
  scope: 'portfolio' | 'property';
  selectedPropertyId?: number;
  period: 'current-month' | 'last-30-days';
}

// Tax block options
export interface TaxBlockOptions {
  fiscalYear: number;
  showAmortizations: boolean;
}

// Alerts block options
export interface AlertsBlockOptions {
  types: ('reconciliation' | 'ocr' | 'due-dates')[];
  maxLimit: number;
}

// KPIs block options  
export interface KPIsBlockOptions {
  selectedMetrics: string[];
  source: 'kpi-builder' | 'fixed-preset';
}

// Dashboard configuration
export interface DashboardPreferences {
  excludePersonalFromAnalytics: boolean;
}

export interface DashboardConfiguration {
  preset: DashboardPreset;
  blocks: DashboardBlockConfig[];
  lastModified: string;
  version: string;
  preferences?: DashboardPreferences;
}

const DEFAULT_PREFERENCES: DashboardPreferences = {
  excludePersonalFromAnalytics: false
};

// Default configurations
const PRESET_A_BLOCKS: DashboardBlockConfig[] = [
  {
    id: 'treasury',
    name: 'Tesorería',
    description: 'Saldo hoy + Proyección +7 días',
    isActive: true,
    position: 0,
    options: {
      accountsIncluded: 'all',
      horizon: 7,
      thresholds: { red: 1000, amber: 5000 }
    } as TreasuryBlockOptions
  },
  {
    id: 'income-expenses',
    name: 'Ingresos vs Gastos',
    description: 'Mes en curso (cartera completa)',
    isActive: true,
    position: 1,
    options: {
      scope: 'portfolio',
      period: 'current-month'
    } as IncomeExpensesBlockOptions
  },
  {
    id: 'tax',
    name: 'Fiscalidad',
    description: 'Año actual: deducciones aplicadas/pendientes + amortizaciones',
    isActive: true,
    position: 2,
    options: {
      fiscalYear: new Date().getFullYear(),
      showAmortizations: true
    } as TaxBlockOptions
  },
  {
    id: 'alerts',
    name: 'Alertas',
    description: 'Conciliación / OCR / vencimientos (máx. 5)',
    isActive: true,
    position: 3,
    options: {
      types: ['reconciliation', 'ocr', 'due-dates'],
      maxLimit: 5
    } as AlertsBlockOptions
  }
];

const PRESET_B_BLOCKS: DashboardBlockConfig[] = [
  {
    id: 'treasury',
    name: 'Tesorería',
    description: 'Saldo hoy + Proyección +30 días',
    isActive: true,
    position: 0,
    options: {
      accountsIncluded: 'all',
      horizon: 30,
      thresholds: { red: 5000, amber: 15000 }
    } as TreasuryBlockOptions
  },
  {
    id: 'income-expenses',
    name: 'Ingresos vs Gastos',
    description: 'Últimos 30 días (cartera completa)',
    isActive: true,
    position: 1,
    options: {
      scope: 'portfolio',
      period: 'last-30-days'
    } as IncomeExpensesBlockOptions
  },
  {
    id: 'kpis',
    name: 'KPIs',
    description: 'Rentabilidad neta %, Cashflow mensual neto, % Ocupación',
    isActive: true,
    position: 2,
    options: {
      selectedMetrics: ['rentabilidad-neta', 'beneficio-neto-mes', 'ocupacion'],
      source: 'fixed-preset'
    } as KPIsBlockOptions
  },
  {
    id: 'tax',
    name: 'Fiscalidad',
    description: 'Año actual: deducciones + amortizaciones',
    isActive: true,
    position: 3,
    options: {
      fiscalYear: new Date().getFullYear(),
      showAmortizations: true
    } as TaxBlockOptions
  },
  {
    id: 'alerts',
    name: 'Alertas',
    description: 'Conciliación / OCR / vencimientos (máx. 5)',
    isActive: true,
    position: 4,
    options: {
      types: ['reconciliation', 'ocr', 'due-dates'],
      maxLimit: 5
    } as AlertsBlockOptions
  }
];


class DashboardService {
  private readonly storageKey = 'atlas-dashboard-config';
  private readonly indexedDbKey = 'dashboardConfiguration';

  /**
   * Get property count from IndexedDB to determine preset
   */
  async getPropertyCount(): Promise<number> {
    try {
      const db = await initDB();
      const properties = await db.getAll('properties');
      
      // Filter active properties only
      const activeProperties = properties.filter((p: any) => p.state === 'activo');
      return activeProperties.length;
    } catch (error) {
      console.warn('Error getting property count:', error);
      return 0;
    }
  }

  /**
   * Determine which preset to use based on property count
   */
  async getRecommendedPreset(): Promise<DashboardPreset> {
    const propertyCount = await this.getPropertyCount();
    return propertyCount <= 3 ? 'preset-a' : 'preset-b';
  }

  /**
   * Get default configuration for a preset
   */
  getDefaultConfigForPreset(preset: DashboardPreset): DashboardConfiguration {
    const blocks = preset === 'preset-a' ? [...PRESET_A_BLOCKS] : [...PRESET_B_BLOCKS];

    return {
      preset,
      blocks,
      lastModified: new Date().toISOString(),
      version: '1.0.0',
      preferences: { ...DEFAULT_PREFERENCES }
    };
  }

  /**
   * Load dashboard configuration from IndexedDB or localStorage
   */
  async loadConfiguration(): Promise<DashboardConfiguration> {
    try {
      // Try IndexedDB first
      const db = await initDB();
      const config = await db.get('keyval', this.indexedDbKey);
      
      if (config && this.isValidConfiguration(config)) {
        return this.withDefaultPreferences(config);
      }
    } catch (error) {
      console.warn('Error loading from IndexedDB:', error);
    }

    try {
      // Fallback to localStorage
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const config = JSON.parse(stored);
        if (this.isValidConfiguration(config)) {
          return this.withDefaultPreferences(config);
        }
      }
    } catch (error) {
      console.warn('Error loading from localStorage:', error);
    }

    // If no valid configuration exists, create default based on property count
    const recommendedPreset = await this.getRecommendedPreset();
    return this.getDefaultConfigForPreset(recommendedPreset);
  }

  /**
   * Save dashboard configuration to IndexedDB and localStorage
   */
  async saveConfiguration(config: DashboardConfiguration): Promise<void> {
    config.lastModified = new Date().toISOString();
    config.preferences = this.withDefaultPreferences(config).preferences;

    try {
      // Save to IndexedDB
      const db = await initDB();
      await db.put('keyval', config, this.indexedDbKey);
    } catch (error) {
      console.warn('Error saving to IndexedDB:', error);
    }

    try {
      // Save to localStorage as fallback
      localStorage.setItem(this.storageKey, JSON.stringify(config));
    } catch (error) {
      console.warn('Error saving to localStorage:', error);
    }
  }

  /**
   * Reset dashboard to default preset based on current property count
   */
  async resetToDefault(): Promise<DashboardConfiguration> {
    const recommendedPreset = await this.getRecommendedPreset();
    const defaultConfig = this.getDefaultConfigForPreset(recommendedPreset);

    await this.saveConfiguration(defaultConfig);
    return defaultConfig;
  }

  async setExcludePersonalPreference(excludePersonal: boolean): Promise<DashboardConfiguration> {
    const config = await this.loadConfiguration();
    const preferences = this.withDefaultPreferences(config).preferences ?? { ...DEFAULT_PREFERENCES };

    const updatedConfig: DashboardConfiguration = {
      ...config,
      preferences: {
        ...preferences,
        excludePersonalFromAnalytics: excludePersonal
      }
    };

    await this.saveConfiguration(updatedConfig);
    return updatedConfig;
  }

  /**
   * Update block configuration
   */
  async updateBlockConfig(blockId: DashboardBlockType, updates: Partial<DashboardBlockConfig>): Promise<void> {
    const config = await this.loadConfiguration();
    
    const blockIndex = config.blocks.findIndex(b => b.id === blockId);
    if (blockIndex >= 0) {
      config.blocks[blockIndex] = { ...config.blocks[blockIndex], ...updates };
      await this.saveConfiguration(config);
    }
  }

  /**
   * Reorder blocks
   */
  async reorderBlocks(newOrder: DashboardBlockType[]): Promise<void> {
    const config = await this.loadConfiguration();
    
    // Create new blocks array in the specified order
    const reorderedBlocks = newOrder.map((blockId, index) => {
      const block = config.blocks.find(b => b.id === blockId);
      if (!block) throw new Error(`Block ${blockId} not found`);
      
      return {
        ...block,
        position: index
      };
    });

    config.blocks = reorderedBlocks;
    await this.saveConfiguration(config);
  }

  /**
   * Toggle block active state
   */
  async toggleBlock(blockId: DashboardBlockType): Promise<void> {
    const config = await this.loadConfiguration();
    
    const blockIndex = config.blocks.findIndex(b => b.id === blockId);
    if (blockIndex >= 0) {
      config.blocks[blockIndex].isActive = !config.blocks[blockIndex].isActive;
      await this.saveConfiguration(config);
    }
  }

  /**
   * Validate configuration structure
   */
  private isValidConfiguration(config: any): config is DashboardConfiguration {
    return (
      config &&
      typeof config === 'object' &&
      typeof config.preset === 'string' &&
      Array.isArray(config.blocks) &&
      typeof config.lastModified === 'string' &&
      typeof config.version === 'string'
    );
  }

  private withDefaultPreferences(config: DashboardConfiguration): DashboardConfiguration {
    const preferences = config.preferences ? { ...DEFAULT_PREFERENCES, ...config.preferences } : { ...DEFAULT_PREFERENCES };
    return {
      ...config,
      preferences
    };
  }

  /**
   * Get all available block types with metadata
   */
  getAllAvailableBlocks(): Record<DashboardBlockType, { name: string; description: string; }> {
    return {
      'treasury': {
        name: 'Tesorería',
        description: 'Saldo actual y proyecciones financieras'
      },
      'income-expenses': {
        name: 'Ingresos vs Gastos',
        description: 'Comparativa de ingresos y gastos por periodo'
      },
      'kpis': {
        name: 'KPIs',
        description: 'Métricas clave de rendimiento'
      },
      'tax': {
        name: 'Fiscalidad',
        description: 'Resumen fiscal con deducciones y amortizaciones'
      },
      'alerts': {
        name: 'Alertas',
        description: 'Notificaciones de conciliación, OCR y vencimientos'
      }
    };
  }
}

export const dashboardService = new DashboardService();