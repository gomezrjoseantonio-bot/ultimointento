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
   * Get net worth (patrimonio neto) - REFACTORED for Dashboard 2.0
   * 
   * Calculates complete net worth with:
   * - Real property values
   * - Account balances
   * - Investment positions
   * - Active debt from prestamos
   * - Month-over-month variation from snapshots
   */
  async getPatrimonioNeto(): Promise<{
    total: number;
    variacionMes: number;
    variacionPorcentaje: number;
    fechaCalculo: string;
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
      
      // Calculate real estate value (sum of purchase prices)
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
      
      // Calculate debt from prestamos service
      // Note: prestamos are currently stored in memory in prestamosService
      // For now, we'll use a placeholder. In production, this would query the prestamos table
      const deudaViva = 0; // TODO: Integrate with prestamosService.getAllPrestamos()
      
      // Inversiones (investments) - get from inversiones table
      const inversiones = await db.getAll('inversiones');
      const inversionesActivas = inversiones.filter((inv: any) => inv.activo !== false);
      const valorInversiones = inversionesActivas.reduce((sum: number, inv: any) => {
        // valorActual = cantidad * precioActual
        const cantidad = inv.cantidad || 0;
        const precioActual = inv.precioActual || inv.precioCompra || 0;
        return sum + (cantidad * precioActual);
      }, 0);
      
      // Calculate total net worth
      const total = valorInmuebles + valorInversiones + saldoCuentas - deudaViva;
      
      // Calculate variation vs previous month using snapshots
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
      
      let variacionMes = 0;
      let variacionPorcentaje = 0;
      
      try {
        const snapshots = await db.getAllFromIndex('patrimonioSnapshots', 'fecha');
        const previousSnapshot = snapshots.find((s: any) => s.fecha === previousMonthKey);
        
        if (previousSnapshot) {
          variacionMes = total - previousSnapshot.total;
          variacionPorcentaje = previousSnapshot.total !== 0 
            ? (variacionMes / previousSnapshot.total) * 100 
            : 0;
        }
      } catch (error) {
        console.warn('Could not calculate variation from snapshots:', error);
      }
      
      const fechaCalculo = now.toISOString();
      
      // Save snapshot for current month (if not exists)
      await this.savePatrimonioSnapshot({
        fecha: currentMonth,
        total,
        inmuebles: valorInmuebles,
        inversiones: valorInversiones,
        cuentas: saldoCuentas,
        deuda: deudaViva,
        createdAt: fechaCalculo
      });
      
      return {
        total,
        variacionMes,
        variacionPorcentaje,
        fechaCalculo,
        desglose: {
          inmuebles: valorInmuebles,
          inversiones: valorInversiones,
          cuentas: saldoCuentas,
          deuda: deudaViva
        }
      };
    } catch (error) {
      console.error('Error calculating patrimonio neto:', error);
      const now = new Date();
      return {
        total: 0,
        variacionMes: 0,
        variacionPorcentaje: 0,
        fechaCalculo: now.toISOString(),
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
   * Save patrimonio snapshot for historical tracking
   * Only saves if snapshot doesn't exist for the given month
   */
  async savePatrimonioSnapshot(snapshot: {
    fecha: string;
    total: number;
    inmuebles: number;
    inversiones: number;
    cuentas: number;
    deuda: number;
    createdAt: string;
  }): Promise<void> {
    try {
      const db = await initDB();
      
      // Check if snapshot already exists for this month
      const existing = await db.getAllFromIndex('patrimonioSnapshots', 'fecha');
      const exists = existing.some((s: any) => s.fecha === snapshot.fecha);
      
      if (!exists) {
        await db.add('patrimonioSnapshots', snapshot);
        console.log(`[DASHBOARD] Saved patrimonio snapshot for ${snapshot.fecha}`);
      }
    } catch (error) {
      console.warn('Could not save patrimonio snapshot:', error);
    }
  }

  /**
   * Get cashflows (flujos de caja) - RENAMED AND ENHANCED from getTresBolsillos()
   * 
   * Returns detailed monthly cashflow data for the 3 sources:
   * - Trabajo: Net personal income with trend
   * - Inmuebles: Property cashflow with occupancy and trend
   * - Inversiones: Investment returns with trend
   */
  async getFlujosCaja(): Promise<{
    trabajo: {
      netoMensual: number;
      tendencia: 'up' | 'down' | 'stable';
      variacionPorcentaje: number;
    };
    inmuebles: {
      cashflow: number;
      ocupacion: number;
      tendencia: 'up' | 'down' | 'stable';
    };
    inversiones: {
      rendimientoMes: number;
      dividendosMes: number;
      tendencia: 'up' | 'down' | 'stable';
    };
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
      
      // Subtract mortgage payments (if prestamos table existed, we'd query it here)
      const cuotasHipotecaMes = 0; // TODO: Calculate from prestamos service
      
      const cashflowInmuebles = rentasMes - gastosInmueblesMes - cuotasHipotecaMes;
      
      // Calculate occupancy rate
      const properties = await db.getAll('properties');
      const activeProperties = properties.filter((p: any) => p.state === 'activo');
      const contracts = await db.getAll('contracts');
      const activeContracts = contracts.filter((c: any) => c.estado === 'activo');
      
      const totalUnidades = activeProperties.length;
      const unidadesOcupadas = activeContracts.length;
      const ocupacion = totalUnidades > 0 ? (unidadesOcupadas / totalUnidades) * 100 : 0;
      
      // Calculate trends - compare current month vs average of last 3 months
      const last3Months = [];
      for (let i = 1; i <= 3; i++) {
        const pastDate = new Date(currentYear, currentMonth - i, 1);
        last3Months.push({
          month: pastDate.getMonth(),
          year: pastDate.getFullYear()
        });
      }
      
      // Trabajo trend
      const ingresosLast3Months = last3Months.map(({month, year}) => {
        return ingresos
          .filter((ing: any) => {
            const fecha = new Date(ing.fecha);
            return fecha.getMonth() === month && 
                   fecha.getFullYear() === year &&
                   ing.esPersonal === true;
          })
          .reduce((sum: number, ing: any) => sum + (ing.importe || 0), 0);
      });
      
      const gastosLast3Months = last3Months.map(({month, year}) => {
        return gastos
          .filter((gasto: any) => {
            const fecha = new Date(gasto.fecha);
            return fecha.getMonth() === month && 
                   fecha.getFullYear() === year &&
                   gasto.esPersonal === true;
          })
          .reduce((sum: number, gasto: any) => sum + (gasto.importe || 0), 0);
      });
      
      const trabajoLast3Months = ingresosLast3Months.map((ing, i) => ing - gastosLast3Months[i]);
      const trabajoAvg = trabajoLast3Months.length > 0 
        ? trabajoLast3Months.reduce((sum, val) => sum + val, 0) / trabajoLast3Months.length 
        : 0;
      const trabajoVariacion = trabajoAvg !== 0 ? ((trabajoMensual - trabajoAvg) / trabajoAvg) * 100 : 0;
      const trabajoTendencia: 'up' | 'down' | 'stable' = 
        trabajoVariacion > 5 ? 'up' : trabajoVariacion < -5 ? 'down' : 'stable';
      
      // Inmuebles trend
      const cashflowLast3Months = last3Months.map(({month, year}) => {
        const rentas = rentPayments
          .filter((payment: any) => {
            const fecha = new Date(payment.fecha);
            return fecha.getMonth() === month && 
                   fecha.getFullYear() === year &&
                   payment.estado === 'pagada';
          })
          .reduce((sum: number, payment: any) => sum + (payment.importe || 0), 0);
        
        const gastos = expenses
          .filter((expense: any) => {
            const fecha = new Date(expense.fecha);
            return fecha.getMonth() === month && 
                   fecha.getFullYear() === year &&
                   expense.propertyId != null;
          })
          .reduce((sum: number, expense: any) => sum + (expense.importe || 0), 0);
        
        return rentas - gastos;
      });
      
      const cashflowAvg = cashflowLast3Months.length > 0 
        ? cashflowLast3Months.reduce((sum, val) => sum + val, 0) / cashflowLast3Months.length 
        : 0;
      const cashflowVariacion = cashflowAvg !== 0 ? ((cashflowInmuebles - cashflowAvg) / cashflowAvg) * 100 : 0;
      const inmueblesTendencia: 'up' | 'down' | 'stable' = 
        cashflowVariacion > 5 ? 'up' : cashflowVariacion < -5 ? 'down' : 'stable';
      
      // INVERSIONES: Get from inversiones table
      const inversiones = await db.getAll('inversiones');
      const inversionesActivas = inversiones.filter((inv: any) => inv.activo !== false);
      
      // Calculate monthly return (simplified)
      const rendimientoMes = inversionesActivas.reduce((sum: number, inv: any) => {
        const cantidad = inv.cantidad || 0;
        const precioActual = inv.precioActual || 0;
        const precioCompra = inv.precioCompra || 0;
        const rendimiento = (precioActual - precioCompra) * cantidad;
        return sum + rendimiento;
      }, 0);
      
      // Calculate dividends for current month
      const dividendosMes = 0; // TODO: Add dividends tracking to inversiones table
      
      return {
        trabajo: {
          netoMensual: trabajoMensual,
          tendencia: trabajoTendencia,
          variacionPorcentaje: trabajoVariacion
        },
        inmuebles: {
          cashflow: cashflowInmuebles,
          ocupacion: ocupacion,
          tendencia: inmueblesTendencia
        },
        inversiones: {
          rendimientoMes: rendimientoMes,
          dividendosMes: dividendosMes,
          tendencia: 'stable' // TODO: Calculate trend when we have historical data
        }
      };
    } catch (error) {
      console.error('Error calculating flujos de caja:', error);
      return {
        trabajo: { netoMensual: 0, tendencia: 'stable', variacionPorcentaje: 0 },
        inmuebles: { cashflow: 0, ocupacion: 0, tendencia: 'stable' },
        inversiones: { rendimientoMes: 0, dividendosMes: 0, tendencia: 'stable' }
      };
    }
  }

  /**
   * Backward compatibility: getTresBolsillos() now calls getFlujosCaja()
   * @deprecated Use getFlujosCaja() instead
   */
  async getTresBolsillos(): Promise<{
    trabajo: { mensual: number; tendencia: 'up' | 'down' | 'stable' };
    inmuebles: { cashflow: number; tendencia: 'up' | 'down' | 'stable' };
    inversiones: { dividendos: number; tendencia: 'up' | 'down' | 'stable' };
  }> {
    const flujos = await this.getFlujosCaja();
    return {
      trabajo: {
        mensual: flujos.trabajo.netoMensual,
        tendencia: flujos.trabajo.tendencia
      },
      inmuebles: {
        cashflow: flujos.inmuebles.cashflow,
        tendencia: flujos.inmuebles.tendencia
      },
      inversiones: {
        dividendos: flujos.inversiones.dividendosMes,
        tendencia: flujos.inversiones.tendencia
      }
    };
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
   * Get financial health (salud financiera) - NEW for Dashboard 2.0
   * 
   * Calculates:
   * - Current liquidity
   * - Average monthly expenses
   * - Financial cushion in months
   * - Health status (ok/warning/critical)
   * - 30-day projection
   */
  async getSaludFinanciera(): Promise<{
    liquidezHoy: number;
    gastoMedioMensual: number;
    colchonMeses: number;
    estado: 'ok' | 'warning' | 'critical';
    proyeccion30d: {
      estimado: number;
      ingresos: number;
      gastos: number;
    };
  }> {
    try {
      const db = await initDB();
      
      // Get current liquidity
      const accounts = await db.getAll('accounts');
      const activeAccounts = accounts.filter((acc: any) => acc.isActive !== false && !acc.deleted_at);
      const liquidezHoy = activeAccounts.reduce((sum: number, acc: any) => {
        return sum + (acc.balance || 0);
      }, 0);
      
      // Calculate average monthly expenses from last 3 months
      const now = new Date();
      const gastos = await db.getAll('gastos');
      const expenses = await db.getAll('expenses');
      
      const last3MonthsExpenses: number[] = [];
      for (let i = 0; i < 3; i++) {
        const pastDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = pastDate.getMonth();
        const year = pastDate.getFullYear();
        
        // Personal expenses from gastos
        const gastosPersonales = gastos
          .filter((gasto: any) => {
            const fecha = new Date(gasto.fecha);
            return fecha.getMonth() === month && 
                   fecha.getFullYear() === year &&
                   gasto.esPersonal === true;
          })
          .reduce((sum: number, gasto: any) => sum + (gasto.importe || 0), 0);
        
        // Property expenses
        const gastosInmuebles = expenses
          .filter((expense: any) => {
            const fecha = new Date(expense.fecha);
            return fecha.getMonth() === month && 
                   fecha.getFullYear() === year &&
                   expense.propertyId != null;
          })
          .reduce((sum: number, expense: any) => sum + (expense.importe || 0), 0);
        
        last3MonthsExpenses.push(gastosPersonales + gastosInmuebles);
      }
      
      const gastoMedioMensual = last3MonthsExpenses.length > 0
        ? last3MonthsExpenses.reduce((sum, val) => sum + val, 0) / last3MonthsExpenses.length
        : 0;
      
      // Calculate cushion in months
      const colchonMeses = gastoMedioMensual > 0 ? liquidezHoy / gastoMedioMensual : 0;
      
      // Determine health status
      let estado: 'ok' | 'warning' | 'critical';
      if (colchonMeses >= 3) {
        estado = 'ok';
      } else if (colchonMeses >= 1) {
        estado = 'warning';
      } else {
        estado = 'critical';
      }
      
      // Calculate 30-day projection
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      // Expected expenses in next 30 days
      const gastosEsperados = expenses
        .filter((expense: any) => {
          const fecha = new Date(expense.fecha);
          return fecha >= now && fecha <= next30Days;
        })
        .reduce((sum: number, expense: any) => sum + (expense.importe || 0), 0);
      
      // Expected income in next 30 days
      const ingresos = await db.getAll('ingresos');
      const rentPayments = await db.getAll('rentPayments');
      
      const ingresosEsperados = ingresos
        .filter((ing: any) => {
          const fecha = new Date(ing.fecha);
          return fecha >= now && fecha <= next30Days;
        })
        .reduce((sum: number, ing: any) => sum + (ing.importe || 0), 0);
      
      const rentasEsperadas = rentPayments
        .filter((payment: any) => {
          const fecha = new Date(payment.fecha);
          return fecha >= now && fecha <= next30Days;
        })
        .reduce((sum: number, payment: any) => sum + (payment.importe || 0), 0);
      
      const ingresosTotal = ingresosEsperados + rentasEsperadas;
      const estimado30d = liquidezHoy + ingresosTotal - gastosEsperados;
      
      return {
        liquidezHoy,
        gastoMedioMensual,
        colchonMeses,
        estado,
        proyeccion30d: {
          estimado: estimado30d,
          ingresos: ingresosTotal,
          gastos: gastosEsperados
        }
      };
    } catch (error) {
      console.error('Error calculating salud financiera:', error);
      return {
        liquidezHoy: 0,
        gastoMedioMensual: 0,
        colchonMeses: 0,
        estado: 'critical',
        proyeccion30d: {
          estimado: 0,
          ingresos: 0,
          gastos: 0
        }
      };
    }
  }

  /**
   * Get alerts that require attention - ENHANCED for Dashboard 2.0
   * 
   * Returns prioritized alerts including:
   * - cobro: Unpaid rent payments
   * - contrato: Contract renewals
   * - pago: Pending payments
   * - documento: Unclassified documents
   * - hipoteca: EURIBOR reviews (TODO: when prestamos integrated)
   * - ipc: Pending IPC increases (TODO: when contracts support it)
   * 
   * Only returns 'alta' and 'media' urgency (baja filtered out)
   */
  async getAlertas(): Promise<Array<{
    id: string;
    tipo: 'cobro' | 'contrato' | 'pago' | 'documento' | 'hipoteca' | 'ipc';
    titulo: string;
    descripcion: string;
    urgencia: 'alta' | 'media';
    diasVencimiento: number;
    importe?: number;
    link: string;
  }>> {
    try {
      const db = await initDB();
      const alerts: Array<{
        id: string;
        tipo: 'cobro' | 'contrato' | 'pago' | 'documento' | 'hipoteca' | 'ipc';
        titulo: string;
        descripcion: string;
        urgencia: 'alta' | 'media';
        diasVencimiento: number;
        importe?: number;
        link: string;
      }> = [];
      
      const now = new Date();
      
      // Check for unpaid rent (cobro type)
      const rentPayments = await db.getAll('rentPayments');
      const unpaidRents = rentPayments.filter((payment: any) => {
        const fechaVencimiento = new Date(payment.fecha);
        return payment.estado !== 'pagada' && fechaVencimiento < now;
      });
      
      unpaidRents.forEach((payment: any, index: number) => {
        const diasVencido = Math.floor((now.getTime() - new Date(payment.fecha).getTime()) / (1000 * 60 * 60 * 24));
        alerts.push({
          id: `rent-${payment.id || index}`,
          tipo: 'cobro',
          titulo: 'Alquiler impagado',
          descripcion: `Renta vencida hace ${diasVencido} días`,
          urgencia: diasVencido > 7 ? 'alta' : 'media',
          diasVencimiento: -diasVencido,
          importe: payment.importe || undefined,
          link: '/tesoreria'
        });
      });
      
      // Check for unclassified documents (documento type)
      const documents = await db.getAll('documents');
      const unclassifiedDocs = documents.filter((doc: any) => 
        !doc.classified && doc.status === 'processed'
      );
      
      if (unclassifiedDocs.length > 0) {
        alerts.push({
          id: 'docs-unclassified',
          tipo: 'documento',
          titulo: 'Documentos sin clasificar',
          descripcion: `${unclassifiedDocs.length} documento${unclassifiedDocs.length > 1 ? 's' : ''} pendiente${unclassifiedDocs.length > 1 ? 's' : ''} en Inbox`,
          urgencia: 'media',
          diasVencimiento: 0,
          link: '/inbox'
        });
      }
      
      // Check for upcoming contract renewals (contrato type)
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
          tipo: 'contrato',
          titulo: 'Contrato próximo a vencer',
          descripcion: `Vence en ${diasHastaVencimiento} días`,
          urgencia: diasHastaVencimiento <= 7 ? 'alta' : 'media',
          diasVencimiento: diasHastaVencimiento,
          link: '/contratos'
        });
      });
      
      // Check for upcoming payments (pago type)
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
        alerts.push({
          id: `expense-${expense.id || index}`,
          tipo: 'pago',
          titulo: 'Pago pendiente',
          descripcion: `${expense.concepto || 'Gasto'} vence en ${diasHastaVencimiento} días`,
          urgencia: diasHastaVencimiento <= 3 ? 'alta' : 'media',
          diasVencimiento: diasHastaVencimiento,
          importe: expense.importe || undefined,
          link: '/inmuebles/gastos-capex'
        });
      });
      
      // TODO: Add hipoteca type alerts when prestamos are integrated
      // TODO: Add ipc type alerts when contracts support IPC tracking
      
      // Sort by urgency and days until due
      alerts.sort((a, b) => {
        // First sort by urgency
        const urgenciaOrder = { alta: 0, media: 1 };
        const urgenciaDiff = urgenciaOrder[a.urgencia] - urgenciaOrder[b.urgencia];
        if (urgenciaDiff !== 0) return urgenciaDiff;
        
        // Then by days until due (sooner first, negatives = overdue come first)
        return a.diasVencimiento - b.diasVencimiento;
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