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

  /**
   * Get net worth (patrimonio neto) - Investor Dashboard "3 Bolsillos"
   */
  async getPatrimonioNeto(): Promise<{
    total: number;
    variacionMes: number;
    variacionPorcentaje: number;
    desglose: {
      inmuebles: number;
      inversiones: number;
      cuentas: number;
      deuda: number;
    };
  }> {
    try {
      const db = await initDB();
      
      // Get all active properties
      const properties = await db.getAll('properties');
      const activeProperties = properties.filter((p: any) => p.state === 'activo');
      
      // Calculate real estate value (sum of purchase prices + acquisition costs)
      const valorInmuebles = activeProperties.reduce((sum: number, prop: any) => {
        const purchasePrice = prop.acquisitionCosts?.price || 0;
        return sum + purchasePrice;
      }, 0);
      
      // Get accounts balance
      const accounts = await db.getAll('accounts');
      const activeAccounts = accounts.filter((acc: any) => acc.isActive !== false && !acc.deleted_at);
      const saldoCuentas = activeAccounts.reduce((sum: number, acc: any) => {
        return sum + (acc.balance || 0);
      }, 0);
      
      // Calculate debt (sum of active loans/mortgages)
      // For now, we'll estimate from property acquisition with mortgage assumption
      // In a real implementation, this should come from a loans/prestamos table
      const deudaViva = 0; // TODO: Implement when loans module exists
      
      // Inversiones (investments) - placeholder for future module
      const valorInversiones = 0; // TODO: Implement when investments module exists
      
      // Calculate total net worth
      const total = valorInmuebles + valorInversiones + saldoCuentas - deudaViva;
      
      // Calculate variation (placeholder - would need historical data)
      // For now, we'll return 0 until we implement month-over-month tracking
      const variacionMes = 0;
      const variacionPorcentaje = 0;
      
      return {
        total,
        variacionMes,
        variacionPorcentaje,
        desglose: {
          inmuebles: valorInmuebles,
          inversiones: valorInversiones,
          cuentas: saldoCuentas,
          deuda: deudaViva
        }
      };
    } catch (error) {
      console.error('Error calculating patrimonio neto:', error);
      return {
        total: 0,
        variacionMes: 0,
        variacionPorcentaje: 0,
        desglose: {
          inmuebles: 0,
          inversiones: 0,
          cuentas: 0,
          deuda: 0
        }
      };
    }
  }

  /**
   * Get summary of the 3 "bolsillos" (pockets): Trabajo, Inmuebles, Inversiones
   */
  async getTresBolsillos(): Promise<{
    trabajo: { mensual: number; tendencia: 'up' | 'down' | 'stable' };
    inmuebles: { cashflow: number; tendencia: 'up' | 'down' | 'stable' };
    inversiones: { dividendos: number; tendencia: 'up' | 'down' | 'stable' };
  }> {
    try {
      const db = await initDB();
      
      // TRABAJO: Calculate net monthly income from personal finance
      // This would include salaries minus personal expenses
      const ingresos = await db.getAll('ingresos');
      const gastos = await db.getAll('gastos');
      
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Filter personal income for current month
      const ingresosPersonalMes = ingresos
        .filter((ing: any) => {
          const fecha = new Date(ing.fecha);
          return fecha.getMonth() === currentMonth && 
                 fecha.getFullYear() === currentYear &&
                 ing.esPersonal === true;
        })
        .reduce((sum: number, ing: any) => sum + (ing.importe || 0), 0);
      
      // Filter personal expenses for current month
      const gastosPersonalMes = gastos
        .filter((gasto: any) => {
          const fecha = new Date(gasto.fecha);
          return fecha.getMonth() === currentMonth && 
                 fecha.getFullYear() === currentYear &&
                 gasto.esPersonal === true;
        })
        .reduce((sum: number, gasto: any) => sum + (gasto.importe || 0), 0);
      
      const trabajoMensual = ingresosPersonalMes - gastosPersonalMes;
      
      // INMUEBLES: Calculate cashflow from properties
      // Income from rents minus expenses and mortgages
      const rentPayments = await db.getAll('rentPayments');
      const expenses = await db.getAll('expenses');
      
      // Get rent income for current month
      const rentasMes = rentPayments
        .filter((payment: any) => {
          const fecha = new Date(payment.fecha);
          return fecha.getMonth() === currentMonth && 
                 fecha.getFullYear() === currentYear &&
                 payment.estado === 'pagada';
        })
        .reduce((sum: number, payment: any) => sum + (payment.importe || 0), 0);
      
      // Get property expenses for current month
      const gastosInmueblesMes = expenses
        .filter((expense: any) => {
          const fecha = new Date(expense.fecha);
          return fecha.getMonth() === currentMonth && 
                 fecha.getFullYear() === currentYear &&
                 expense.propertyId != null;
        })
        .reduce((sum: number, expense: any) => sum + (expense.importe || 0), 0);
      
      const cashflowInmuebles = rentasMes - gastosInmueblesMes;
      
      // INVERSIONES: Dividends from investment portfolio
      // Placeholder for future investments module
      const dividendos = 0; // TODO: Implement when investments module exists
      
      return {
        trabajo: {
          mensual: trabajoMensual,
          tendencia: 'stable' // TODO: Calculate trend based on historical data
        },
        inmuebles: {
          cashflow: cashflowInmuebles,
          tendencia: 'stable' // TODO: Calculate trend based on historical data
        },
        inversiones: {
          dividendos: dividendos,
          tendencia: 'stable' // TODO: Calculate trend when module exists
        }
      };
    } catch (error) {
      console.error('Error calculating tres bolsillos:', error);
      return {
        trabajo: { mensual: 0, tendencia: 'stable' },
        inmuebles: { cashflow: 0, tendencia: 'stable' },
        inversiones: { dividendos: 0, tendencia: 'stable' }
      };
    }
  }

  /**
   * Get liquidity projection
   */
  async getLiquidez(): Promise<{
    disponibleHoy: number;
    comprometido30d: number;
    ingresos30d: number;
    proyeccion30d: number;
  }> {
    try {
      const db = await initDB();
      
      // Get current balance from all active accounts
      const accounts = await db.getAll('accounts');
      const activeAccounts = accounts.filter((acc: any) => acc.isActive !== false && !acc.deleted_at);
      const disponibleHoy = activeAccounts.reduce((sum: number, acc: any) => {
        return sum + (acc.balance || 0);
      }, 0);
      
      const now = new Date();
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      // Calculate committed expenses in next 30 days
      // Include recurring expenses, mortgage payments, etc.
      const expenses = await db.getAll('expenses');
      const comprometido30d = expenses
        .filter((expense: any) => {
          const fecha = new Date(expense.fecha);
          return fecha >= now && fecha <= next30Days;
        })
        .reduce((sum: number, expense: any) => sum + (expense.importe || 0), 0);
      
      // Calculate expected income in next 30 days
      // Include rent payments, salaries, etc.
      const rentPayments = await db.getAll('rentPayments');
      const ingresos = await db.getAll('ingresos');
      
      const rentasEsperadas = rentPayments
        .filter((payment: any) => {
          const fecha = new Date(payment.fecha);
          return fecha >= now && fecha <= next30Days;
        })
        .reduce((sum: number, payment: any) => sum + (payment.importe || 0), 0);
      
      const ingresosEsperados = ingresos
        .filter((ing: any) => {
          const fecha = new Date(ing.fecha);
          return fecha >= now && fecha <= next30Days;
        })
        .reduce((sum: number, ing: any) => sum + (ing.importe || 0), 0);
      
      const ingresos30d = rentasEsperadas + ingresosEsperados;
      
      // Calculate projection
      const proyeccion30d = disponibleHoy + ingresos30d - comprometido30d;
      
      return {
        disponibleHoy,
        comprometido30d,
        ingresos30d,
        proyeccion30d
      };
    } catch (error) {
      console.error('Error calculating liquidez:', error);
      return {
        disponibleHoy: 0,
        comprometido30d: 0,
        ingresos30d: 0,
        proyeccion30d: 0
      };
    }
  }

  /**
   * Get alerts that require attention
   */
  async getAlertas(): Promise<Array<{
    id: string;
    tipo: 'trabajo' | 'inmuebles' | 'inversiones' | 'personal';
    mensaje: string;
    urgencia: 'alta' | 'media' | 'baja';
    link: string;
    diasHastaVencimiento?: number;
  }>> {
    try {
      const db = await initDB();
      const alerts: Array<{
        id: string;
        tipo: 'trabajo' | 'inmuebles' | 'inversiones' | 'personal';
        mensaje: string;
        urgencia: 'alta' | 'media' | 'baja';
        link: string;
        diasHastaVencimiento?: number;
      }> = [];
      
      const now = new Date();
      
      // Check for unpaid rent
      const rentPayments = await db.getAll('rentPayments');
      const unpaidRents = rentPayments.filter((payment: any) => {
        const fechaVencimiento = new Date(payment.fecha);
        return payment.estado !== 'pagada' && fechaVencimiento < now;
      });
      
      unpaidRents.forEach((payment: any, index: number) => {
        const diasVencido = Math.floor((now.getTime() - new Date(payment.fecha).getTime()) / (1000 * 60 * 60 * 24));
        alerts.push({
          id: `rent-${payment.id || index}`,
          tipo: 'inmuebles',
          mensaje: `Alquiler sin cobrar (vencido hace ${diasVencido} días)`,
          urgencia: diasVencido > 7 ? 'alta' : 'media',
          link: '/tesoreria',
          diasHastaVencimiento: -diasVencido
        });
      });
      
      // Check for unclassified documents in inbox
      const documents = await db.getAll('documents');
      const unclassifiedDocs = documents.filter((doc: any) => 
        !doc.classified && doc.status === 'processed'
      );
      
      if (unclassifiedDocs.length > 0) {
        alerts.push({
          id: 'docs-unclassified',
          tipo: 'personal',
          mensaje: `${unclassifiedDocs.length} documento${unclassifiedDocs.length > 1 ? 's' : ''} sin clasificar en Inbox`,
          urgencia: 'media',
          link: '/inbox'
        });
      }
      
      // Check for upcoming contract renewals (30 days)
      const contracts = await db.getAll('contracts');
      const upcomingRenewals = contracts.filter((contract: any) => {
        if (!contract.endDate || contract.estado !== 'activo') return false;
        const endDate = new Date(contract.endDate);
        const daysUntilEnd = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilEnd > 0 && daysUntilEnd <= 30;
      });
      
      upcomingRenewals.forEach((contract: any, index: number) => {
        const endDate = new Date(contract.endDate);
        const diasHastaVencimiento = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        alerts.push({
          id: `contract-${contract.id || index}`,
          tipo: 'inmuebles',
          mensaje: `Contrato próximo a vencer (${diasHastaVencimiento} días)`,
          urgencia: diasHastaVencimiento <= 7 ? 'alta' : 'media',
          link: '/contratos',
          diasHastaVencimiento
        });
      });
      
      // Check for upcoming invoices/bills (7 days)
      const expenses = await db.getAll('expenses');
      const upcomingExpenses = expenses.filter((expense: any) => {
        if (!expense.fecha) return false;
        const fecha = new Date(expense.fecha);
        const daysUntilDue = Math.floor((fecha.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue > 0 && daysUntilDue <= 7 && !expense.pagado;
      });
      
      upcomingExpenses.forEach((expense: any, index: number) => {
        const fecha = new Date(expense.fecha);
        const diasHastaVencimiento = Math.floor((fecha.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const tipo = expense.esPersonal ? 'personal' : 'inmuebles';
        alerts.push({
          id: `expense-${expense.id || index}`,
          tipo: tipo as 'trabajo' | 'inmuebles' | 'inversiones' | 'personal',
          mensaje: `${expense.esPersonal ? 'Factura' : 'Gasto'} pendiente (vence en ${diasHastaVencimiento} días)`,
          urgencia: diasHastaVencimiento <= 3 ? 'alta' : 'media',
          link: tipo === 'personal' ? '/personal' : '/inmuebles/gastos-capex',
          diasHastaVencimiento
        });
      });
      
      // Sort by urgency and days until due
      alerts.sort((a, b) => {
        // First sort by urgency
        const urgenciaOrder = { alta: 0, media: 1, baja: 2 };
        const urgenciaDiff = urgenciaOrder[a.urgencia] - urgenciaOrder[b.urgencia];
        if (urgenciaDiff !== 0) return urgenciaDiff;
        
        // Then by days until due (sooner first)
        const aDays = a.diasHastaVencimiento ?? 999;
        const bDays = b.diasHastaVencimiento ?? 999;
        return aDays - bDays;
      });
      
      // Limit to max 5 alerts
      return alerts.slice(0, 5);
    } catch (error) {
      console.error('Error getting alertas:', error);
      return [];
    }
  }
}

export const dashboardService = new DashboardService();