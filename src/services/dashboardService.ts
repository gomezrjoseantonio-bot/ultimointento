import { initDB } from './db';
import { autonomoService } from './autonomoService';
import { personalDataService } from './personalDataService';
import { rollForwardAccountBalancesToMonth } from './accountBalanceService';
import { prestamosService } from './prestamosService';
import { generateProyeccionMensual } from '../modules/horizon/proyeccion/mensual/services/proyeccionMensualService';

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

const parseNumericValue = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = value
      .trim()
      .replace(/\s+/g, '')
      .replace(/[€$£]/g, '');

    if (!normalized) return 0;

    // Handle both ES (1.234,56) and EN (1,234.56) formats
    const hasComma = normalized.includes(',');
    const hasDot = normalized.includes('.');

    if (hasComma && hasDot) {
      const commaIndex = normalized.lastIndexOf(',');
      const dotIndex = normalized.lastIndexOf('.');
      const decimalSeparator = commaIndex > dotIndex ? ',' : '.';
      const thousandSeparator = decimalSeparator === ',' ? '.' : ',';
      const candidate = normalized
        .replace(new RegExp(`\\${thousandSeparator}`, 'g'), '')
        .replace(decimalSeparator, '.');
      const parsed = Number(candidate);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (hasComma) {
      const candidate = normalized.replace(/\./g, '').replace(',', '.');
      const parsed = Number(candidate);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    const parsed = Number(normalized.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDateValue = (value: unknown): Date | null => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isDateWithinRange = (value: unknown, start: Date, end: Date): boolean => {
  const date = parseDateValue(value);
  return Boolean(date && date >= start && date <= end);
};

const isCardAccount = (acc: any): boolean => {
  const explicitCardType = acc?.tipo === 'TARJETA_CREDITO' || acc?.type === 'card';
  const normalizedName = String(acc?.alias || acc?.name || acc?.bank || acc?.banco?.name || '').toLowerCase();
  const inferredFromName = normalizedName.includes('tarjeta') || normalizedName.includes('card');
  return explicitCardType || inferredFromName;
};

const toNumericId = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const isForecastTreasuryEvent = (event: any): boolean => {
  const status = String(event?.status || '').toLowerCase();
  return status === 'predicted' || status === 'pending';
};

const isConfirmedTreasuryEvent = (event: any): boolean => {
  const status = String(event?.status || '').toLowerCase();
  return status === 'confirmed' || status === 'executed';
};

const toDateOnlyString = (value: unknown): string | null => {
  if (!value) return null;
  const raw = String(value);
  return raw.includes('T') ? raw.split('T')[0] : raw;
};

const isTreasuryEventInMonth = (value: unknown, monthStart: string, monthEnd: string): boolean => {
  const dateOnly = toDateOnlyString(value);
  return Boolean(dateOnly && dateOnly >= monthStart && dateOnly <= monthEnd);
};

const resolveTreasuryEventDisplayAccountId = (
  event: any,
  cardSettlementByAccountId: Map<number, { chargeAccountId: number }>,
): number | undefined => {
  const eventAccountId = toNumericId(event?.accountId);
  const sourceId = toNumericId(event?.sourceId);

  const directCardConfig = eventAccountId != null
    ? cardSettlementByAccountId.get(eventAccountId)
    : undefined;

  const sourceCardConfig =
    eventAccountId == null
      && event?.sourceType === 'personal_expense'
      && sourceId != null
      ? cardSettlementByAccountId.get(sourceId)
      : undefined;

  return directCardConfig?.chargeAccountId
    ?? sourceCardConfig?.chargeAccountId
    ?? eventAccountId;
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

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
      const fechaCalculo = now.toISOString();

      const toNumber = (value: unknown): number => {
        return parseNumericValue(value);
      };

      // Inmuebles: use latest valuation when available, fallback to acquisition price.
      const properties = await db.getAll('properties');
      const activeProperties = properties.filter((prop: any) => prop.state === 'activo');
      const valoraciones = await db.getAll('valoraciones_historicas').catch(() => []);

      const valorInmuebles = activeProperties.reduce((sum: number, prop: any) => {
        const propertyValuations = (valoraciones as any[])
          .filter((val) => val.tipo_activo === 'inmueble' && String(val.activo_id) === String(prop.id))
          .sort((a, b) => String(b.fecha_valoracion).localeCompare(String(a.fecha_valoracion)));

        const ultimaValoracion = propertyValuations[0]?.valor;
        const fallbackValorActual = prop.valor_actual
          ?? prop.currentValue
          ?? prop.marketValue
          ?? prop.estimatedValue
          ?? prop.valuation
          ?? prop.compra?.valor_actual
          ?? prop.acquisitionCosts?.currentValue
          ?? prop.acquisitionCosts?.price
          ?? prop.compra?.precio_compra
          ?? 0;
        return sum + toNumber(ultimaValoracion ?? fallbackValorActual);
      }, 0);

      // Cuentas: use Tesorería "HOY" total as single source of truth to avoid divergences.
      const tesoreriaPanel = await this.getTesoreriaPanel();
      const saldoCuentas = toNumber(tesoreriaPanel.totales.hoy);

      // Inversiones: latest current valuation.
      const inversiones = await db.getAll('inversiones');
      const inversionesActivas = inversiones.filter((inv: any) => inv.activo !== false);
      const valorInversiones = inversionesActivas.reduce((sum: number, inv: any) => sum + toNumber(inv.valor_actual), 0);

      // Deuda: include active loans from prestamos store.
      const prestamos = await db.getAll('prestamos').catch(() => []);
      const deudaVivaPorPrestamo = await Promise.all((prestamos as any[])
        .filter((prestamo) => prestamo?.activo !== false && prestamo?.estado !== 'cancelado')
        .map(async (prestamo) => {
          const principalFallback = prestamo.principalVivo ?? prestamo.capital_pendiente ?? prestamo.capitalPendiente ?? 0;

          try {
            const plan = await prestamosService.getPaymentPlan(prestamo.id);
            const ultimaCuotaPagada = plan?.periodos
              ?.filter((periodo) => periodo.pagado)
              .sort((a, b) => b.periodo - a.periodo)[0];

            return toNumber(ultimaCuotaPagada?.principalFinal ?? principalFallback);
          } catch (error) {
            console.warn('[DASHBOARD] No se pudo calcular capital vivo desde plan de pagos:', prestamo?.id, error);
            return toNumber(principalFallback);
          }
        }));
      const deudaViva = deudaVivaPorPrestamo.reduce((sum, principal) => sum + principal, 0);

      const total = valorInmuebles + valorInversiones + saldoCuentas - deudaViva;

      let variacionMes = 0;
      let variacionPorcentaje = 0;

      try {
        const snapshots = await db.getAllFromIndex('patrimonioSnapshots', 'fecha');
        const previousSnapshot = snapshots.find((snapshot: any) => snapshot.fecha === previousMonthKey);

        if (previousSnapshot) {
          variacionMes = total - toNumber(previousSnapshot.total);
          variacionPorcentaje = toNumber(previousSnapshot.total) !== 0
            ? (variacionMes / toNumber(previousSnapshot.total)) * 100
            : 0;
        }
      } catch (error) {
        console.warn('Could not calculate variation from snapshots:', error);
      }

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
      netoHoy: number;
      pendienteMes: number;
      tendencia: 'up' | 'down' | 'stable';
      variacionPorcentaje: number;
    };
    inmuebles: {
      cashflow: number;
      cashflowHoy: number;
      pendienteMes: number;
      ocupacion: number;
      vacantes: Array<{
        propertyId?: number;
        propertyAlias: string;
        unidadLabel: string;
      }>;
      tendencia: 'up' | 'down' | 'stable';
    };
    inversiones: {
      rendimientoMes: number;
      dividendosMes: number;
      totalHoy: number;
      pendienteMes: number;
      tendencia: 'up' | 'down' | 'stable';
    };
  }> {
    try {
      const db = await initDB();
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const toNumber = (value: unknown): number => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const getDate = (item: any): Date | null => {
        const raw = item?.fecha ?? item?.date ?? item?.fecha_emision ?? item?.fecha_prevista_cobro ?? item?.fecha_pago_prevista ?? item?.expected_charge_date ?? item?.predictedDate ?? item?.actualDate;
        if (!raw) return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
      };

      const getImporte = (item: any): number => toNumber(item?.importe ?? item?.total ?? item?.amount);
      const getRentPaymentAmount = (payment: any): number => {
        const candidates = [
          payment?.expectedAmount,
          payment?.paidAmount,
          payment?.importe,
          payment?.amount,
          payment?.total
        ];
        const firstDefined = candidates.find((value) => value !== undefined && value !== null);
        return toNumber(firstDefined);
      };
      const getRentPaymentDate = (payment: any): Date | null => {
        const period = String(payment?.period ?? '').trim();
        if (/^\d{4}-\d{2}$/.test(period)) {
          const [year, month] = period.split('-').map(Number);
          const d = new Date(year, month - 1, 1);
          return Number.isNaN(d.getTime()) ? null : d;
        }

        const raw = payment?.fecha ?? payment?.paymentDate ?? payment?.fecha_prevista_cobro ?? payment?.fechaPago;
        if (!raw) return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
      };
      const rentPaymentInMonth = (payment: any, month: number, year: number): boolean => {
        const d = getRentPaymentDate(payment);
        return !!d && d.getMonth() === month && d.getFullYear() === year;
      };
      const rentPaymentThroughToday = (payment: any, month: number, year: number): boolean => {
        const d = getRentPaymentDate(payment);
        return !!d && d.getMonth() === month && d.getFullYear() === year && d <= todayDate;
      };
      const inMonthThroughToday = (item: any, month: number, year: number): boolean => {
        const d = getDate(item);
        return !!d && d.getMonth() === month && d.getFullYear() === year && d <= todayDate;
      };

      const isActiveContractForMonth = (contract: any, month: number, year: number): boolean => {
        const status = String(contract?.estadoContrato ?? contract?.estado ?? contract?.status ?? '').toLowerCase();
        if (['finalizado', 'terminated', 'rescindido', 'cancelado', 'cancelled'].includes(status)) {
          return false;
        }

        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const startRaw = contract?.fechaInicio ?? contract?.fecha_inicio ?? contract?.startDate;
        const endRaw = contract?.fechaFin ?? contract?.fecha_fin ?? contract?.endDate;

        const startDate = startRaw ? new Date(startRaw) : null;
        const endDate = endRaw ? new Date(endRaw) : null;

        if (startDate && Number.isNaN(startDate.getTime())) return false;
        if (endDate && Number.isNaN(endDate.getTime())) return false;

        if (startDate && startDate > monthEnd) return false;
        if (endDate && endDate < monthStart) return false;

        return true;
      };

      const getContractMonthlyRent = (contract: any): number =>
        toNumber(contract?.rentaMensual ?? contract?.renta_mensual ?? contract?.monthlyRent ?? contract?.importeMensual);

      const isCancelledRentPayment = (payment: any): boolean => {
        const status = String(payment?.estado ?? payment?.status ?? '').toLowerCase().trim();
        return ['cancelado', 'cancelada', 'cancelled', 'anulado', 'anulada', 'void'].includes(status);
      };
      const isCollectedRentPayment = (payment: any): boolean => {
        const status = String(payment?.estado ?? payment?.status ?? '').toLowerCase().trim();
        if (!status) return true;
        return [
          'pagada',
          'pagado',
          'paid',
          'cobrada',
          'cobrado',
          'confirmada',
          'confirmado',
          'confirmed',
          'ejecutada',
          'ejecutado',
          'executed',
          'partial',
          'parcial'
        ].includes(status);
      };
      const getCollectedRentIncomeThroughToday = (month: number, year: number, rentPaymentsData: any[]): number => {
        return rentPaymentsData
          .filter((payment: any) => rentPaymentThroughToday(payment, month, year) && !isCancelledRentPayment(payment) && isCollectedRentPayment(payment))
          .reduce((sum: number, payment: any) => {
            const partialStatus = String(payment?.estado ?? payment?.status ?? '').toLowerCase().trim();
            const amount = partialStatus === 'partial' || partialStatus === 'parcial'
              ? toNumber(payment?.paidAmount ?? payment?.importe ?? payment?.amount)
              : getRentPaymentAmount(payment);
            return sum + amount;
          }, 0);
      };

      const getRentalIncomeForMonth = (month: number, year: number, rentPaymentsData: any[], contractsData: any[]): number => {
        const scheduledPayments = rentPaymentsData
          .filter((payment: any) => rentPaymentInMonth(payment, month, year) && !isCancelledRentPayment(payment));

        // En el dashboard mensual mostramos el flujo previsto del mes completo.
        // Si existen pagos planificados/generados para ese mes, se suman todos sus
        // importes esperados (o el mejor fallback disponible), no solo lo cobrado
        // hasta hoy. La foto "a día de hoy" ya vive en tesorería/liquidez.
        if (scheduledPayments.length > 0) {
          return scheduledPayments.reduce((sum: number, payment: any) => sum + getRentPaymentAmount(payment), 0);
        }

        return contractsData
          .filter((contract: any) => isActiveContractForMonth(contract, month, year))
          .reduce((sum: number, contract: any) => sum + getContractMonthlyRent(contract), 0);
      };

      const isPersonalIngreso = (ing: any): boolean => ing?.esPersonal === true || ing?.destino === 'personal';
      const isPersonalGasto = (gasto: any): boolean => gasto?.esPersonal === true || gasto?.destino === 'personal';
      const isInmuebleExpense = (expense: any): boolean => expense?.propertyId != null || expense?.destino === 'inmueble_id' || expense?.destino_id != null;

      const inMonth = (item: any, month: number, year: number): boolean => {
        const d = getDate(item);
        return !!d && d.getMonth() === month && d.getFullYear() === year;
      };

      const getPersonalExpenseAmountForMonth = (expense: any, month1to12: number): number => {
        if (!expense?.activo) return 0;

        const frequency = String(expense?.frecuencia ?? '').toLowerCase();
        const startMonth = toNumber(expense?.mesInicio ?? 1) || 1;
        const specificMonths = Array.isArray(expense?.mesesCobro) ? expense.mesesCobro.map((value: unknown) => toNumber(value)) : [];

        const applies = (() => {
          switch (frequency) {
            case 'semanal':
            case 'mensual':
              return true;
            case 'bimestral':
              return month1to12 >= startMonth && (month1to12 - startMonth) % 2 === 0;
            case 'trimestral':
              return month1to12 >= startMonth && (month1to12 - startMonth) % 3 === 0;
            case 'semestral':
              return month1to12 >= startMonth && (month1to12 - startMonth) % 6 === 0;
            case 'anual':
              return month1to12 === startMonth;
            case 'meses_especificos':
              return specificMonths.includes(month1to12);
            default:
              return false;
          }
        })();

        if (!applies) return 0;

        if (Array.isArray(expense?.asymmetricPayments) && expense.asymmetricPayments.length > 0) {
          const override = expense.asymmetricPayments.find((payment: any) => toNumber(payment?.mes) === month1to12);
          if (override) return toNumber(override?.importe);
        }

        const amount = toNumber(expense?.importe);
        return frequency === 'semanal' ? amount * (52 / 12) : amount;
      };

      const getRecurringPersonalExpenseAmountForMonth = (expense: any, month1to12: number): number => {
        if (!expense?.activo) return 0;

        const frequency = String(expense?.frecuencia ?? '').toLowerCase();
        const startRaw = expense?.fechaInicio;
        const startDate = startRaw ? new Date(startRaw) : null;
        const startMonth = startDate && !Number.isNaN(startDate.getTime()) ? startDate.getMonth() + 1 : 1;
        const specificMonths = Array.isArray(expense?.mesesCobro) ? expense.mesesCobro.map((value: unknown) => toNumber(value)) : [];

        switch (frequency) {
          case 'mensual':
            return toNumber(expense?.importe);
          case 'bimestral':
            return month1to12 >= startMonth && (month1to12 - startMonth) % 2 === 0 ? toNumber(expense?.importe) : 0;
          case 'trimestral':
            return month1to12 >= startMonth && (month1to12 - startMonth) % 3 === 0 ? toNumber(expense?.importe) : 0;
          case 'semestral':
            return month1to12 >= startMonth && (month1to12 - startMonth) % 6 === 0 ? toNumber(expense?.importe) : 0;
          case 'anual':
            return month1to12 === startMonth ? toNumber(expense?.importe) : 0;
          case 'meses_especificos':
            return specificMonths.includes(month1to12) ? toNumber(expense?.importe) : 0;
          default:
            return 0;
        }
      };

      const ingresos = await db.getAll('ingresos');
      const gastos = await db.getAll('gastos');
      const expenses = await db.getAll('expenses');
      const rentPayments = await db.getAll('rentPayments');
      const contracts = await db.getAll('contracts');
      const inversiones = await db.getAll('inversiones');

      // TRABAJO (salario/otros ingresos personales - gastos personales + autónomo)
      const ingresosPersonalMes = ingresos
        .filter((ing: any) => inMonth(ing, currentMonth, currentYear) && isPersonalIngreso(ing))
        .reduce((sum: number, ing: any) => sum + getImporte(ing), 0);
      const ingresosPersonalHoy = ingresos
        .filter((ing: any) => inMonthThroughToday(ing, currentMonth, currentYear) && isPersonalIngreso(ing))
        .reduce((sum: number, ing: any) => sum + getImporte(ing), 0);

      const gastosPersonalTesoreriaMes = gastos
        .filter((gasto: any) => inMonth(gasto, currentMonth, currentYear) && isPersonalGasto(gasto))
        .reduce((sum: number, gasto: any) => sum + getImporte(gasto), 0);
      const gastosPersonalTesoreriaHoy = gastos
        .filter((gasto: any) => inMonthThroughToday(gasto, currentMonth, currentYear) && isPersonalGasto(gasto))
        .reduce((sum: number, gasto: any) => sum + getImporte(gasto), 0);

      const personalDataId = 1;
      const personalExpenses = await db.getAll('personalExpenses').catch(() => []);
      const gastosRecurrentes = await db.getAll('gastosRecurrentes').catch(() => []);
      const gastosPuntuales = await db.getAll('gastosPuntuales').catch(() => []);

      const gastosPersonalesModeloMes = (personalExpenses as any[])
        .filter((expense: any) => toNumber(expense?.personalDataId) === personalDataId)
        .reduce((sum: number, expense: any) => sum + getPersonalExpenseAmountForMonth(expense, currentMonth + 1), 0)
        + (gastosRecurrentes as any[])
          .filter((expense: any) => toNumber(expense?.personalDataId) === personalDataId)
          .reduce((sum: number, expense: any) => sum + getRecurringPersonalExpenseAmountForMonth(expense, currentMonth + 1), 0)
        + (gastosPuntuales as any[])
          .filter((expense: any) => toNumber(expense?.personalDataId) === personalDataId && inMonth(expense, currentMonth, currentYear))
          .reduce((sum: number, expense: any) => sum + toNumber(expense?.importe), 0);

      const gastosPersonalesModeloHoy = (gastosPuntuales as any[])
        .filter((expense: any) => toNumber(expense?.personalDataId) === personalDataId && inMonthThroughToday(expense, currentMonth, currentYear))
        .reduce((sum: number, expense: any) => sum + toNumber(expense?.importe), 0);

      const gastosPersonalMes = gastosPersonalTesoreriaMes + gastosPersonalesModeloMes;
      const gastosPersonalHoy = gastosPersonalTesoreriaHoy + gastosPersonalesModeloHoy;

      const trabajoBase = ingresosPersonalMes - gastosPersonalMes;
      const trabajoBaseHoy = ingresosPersonalHoy - gastosPersonalHoy;

      let autonomoNetoMensual = 0;
      try {
        const personalData = await personalDataService.getPersonalData();
        const personalDataId = personalData?.id ?? 1;
        const autonomo = await autonomoService.getActivoAutonomo(personalDataId);
        if (autonomo) {
          const annual = autonomoService.calculateEstimatedAnnual(autonomo);
          autonomoNetoMensual = annual.rendimientoNeto / 12;
        }
      } catch {
        // No autonomo data
      }

      const trabajoMensual = trabajoBase + autonomoNetoMensual;
      const elapsedDays = Math.max(1, now.getDate());
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const autonomoHoy = daysInMonth > 0 ? autonomoNetoMensual * (elapsedDays / daysInMonth) : 0;
      const trabajoHoy = trabajoBaseHoy + autonomoHoy;

      // INMUEBLES (rentas cobradas - gastos - cuotas de préstamos de inmueble)
      const rentasMes = getRentalIncomeForMonth(currentMonth, currentYear, rentPayments, contracts);
      const rentasHoy = getCollectedRentIncomeThroughToday(currentMonth, currentYear, rentPayments);

      const gastosInmueblesMes = [
        ...expenses.filter((expense: any) => inMonth(expense, currentMonth, currentYear) && isInmuebleExpense(expense)),
        ...gastos.filter((gasto: any) => inMonth(gasto, currentMonth, currentYear) && !isPersonalGasto(gasto) && (gasto.destino === 'inmueble_id' || gasto.destino_id != null))
      ].reduce((sum: number, expense: any) => sum + getImporte(expense), 0);
      const gastosInmueblesHoy = [
        ...expenses.filter((expense: any) => inMonthThroughToday(expense, currentMonth, currentYear) && isInmuebleExpense(expense)),
        ...gastos.filter((gasto: any) => inMonthThroughToday(gasto, currentMonth, currentYear) && !isPersonalGasto(gasto) && (gasto.destino === 'inmueble_id' || gasto.destino_id != null))
      ].reduce((sum: number, expense: any) => sum + getImporte(expense), 0);

      const prestamos = await db.getAll('prestamos').catch(() => []);
      const hipotecasActivas = (prestamos as any[])
        .filter((prestamo) => prestamo?.activo !== false && prestamo?.ambito === 'INMUEBLE')
        .map((prestamo) => ({
          cuota: toNumber(prestamo.cuotaMensual ?? prestamo.cuota_mensual ?? 0),
          diaCargoMes: toNumber(prestamo.diaCargoMes ?? prestamo.dia_cargo_mes ?? 1)
        }));
      const cuotasHipotecaMes = hipotecasActivas.reduce((sum, prestamo) => sum + prestamo.cuota, 0);
      const cuotasHipotecaHoy = hipotecasActivas
        .filter((prestamo) => prestamo.diaCargoMes <= now.getDate())
        .reduce((sum, prestamo) => sum + prestamo.cuota, 0);

      const cashflowInmuebles = rentasMes - gastosInmueblesMes - cuotasHipotecaMes;
      const cashflowInmueblesHoy = rentasHoy - gastosInmueblesHoy - cuotasHipotecaHoy;

      const properties = await db.getAll('properties');
      const activeProperties = properties.filter((p: any) => {
        const status = String(p?.state ?? p?.status ?? p?.estado ?? '').toLowerCase();
        return status === '' || status === 'activo' || status === 'active';
      });
      const activeContracts = contracts.filter((c: any) => {
        const status = String(c?.estado ?? c?.estadoContrato ?? c?.status ?? '').toLowerCase();
        if (status === 'activo' || status === 'active') return true;
        return isActiveContractForMonth(c, currentMonth, currentYear);
      });

      const activePropertyIds = new Set(
        activeProperties
          .map((p: any) => toNumericId(p?.id ?? p?.propertyId ?? p?.inmueble_id))
          .filter((id): id is number => id != null)
      );

      const roomPropertyIds = new Set(
        contracts
          .filter((c: any) => {
            const propertyId = toNumericId(c?.inmuebleId ?? c?.inmueble_id ?? c?.propertyId ?? c?.property_id);
            if (propertyId == null || !activePropertyIds.has(propertyId)) return false;
            const unitType = String(c?.unidadTipo ?? c?.unidad_tipo ?? c?.type ?? '').toLowerCase();
            return unitType === 'habitacion' || unitType === 'habitación' || String(c?.habitacionId ?? c?.habitacion_id ?? '').trim() !== '';
          })
          .map((c: any) => toNumericId(c?.inmuebleId ?? c?.inmueble_id ?? c?.propertyId ?? c?.property_id))
          .filter((id): id is number => id != null)
      );

      const totalUnits = activeProperties.reduce((sum: number, property: any) => {
        const propertyId = toNumericId(property?.id ?? property?.propertyId ?? property?.inmueble_id);
        if (propertyId == null || !activePropertyIds.has(propertyId)) return sum;

        if (roomPropertyIds.has(propertyId)) {
          const rooms = toNumber(property?.bedrooms ?? property?.habitaciones ?? 0);
          return sum + Math.max(1, Math.floor(rooms));
        }

        return sum + 1;
      }, 0);

      const occupiedUnits = Array.from(activePropertyIds).reduce((sum: number, propertyId: number) => {
        const propertyActiveContracts = activeContracts.filter((c: any) => {
          const contractPropertyId = toNumericId(c?.inmuebleId ?? c?.inmueble_id ?? c?.propertyId ?? c?.property_id);
          return contractPropertyId === propertyId;
        });

        if (roomPropertyIds.has(propertyId)) {
          const occupiedRooms = new Set(
            propertyActiveContracts
              .map((c: any) => String(c?.habitacionId ?? c?.habitacion_id ?? '').trim().toUpperCase())
              .filter((roomId: string) => roomId !== '')
          );
          return sum + occupiedRooms.size;
        }

        return sum + (propertyActiveContracts.length > 0 ? 1 : 0);
      }, 0);

      const ocupacionBase = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
      const ocupacion = Math.max(0, Math.min(100, ocupacionBase));
      const vacantes = Array.from(activePropertyIds).flatMap((propertyId) => {
        const property = activeProperties.find((item: any) => toNumericId(item?.id ?? item?.propertyId ?? item?.inmueble_id) === propertyId);
        const propertyAlias = String(property?.alias ?? property?.globalAlias ?? property?.address ?? `Inmueble ${propertyId}`);
        const propertyActiveContracts = activeContracts.filter((c: any) => {
          const contractPropertyId = toNumericId(c?.inmuebleId ?? c?.inmueble_id ?? c?.propertyId ?? c?.property_id);
          return contractPropertyId === propertyId;
        });

        if (roomPropertyIds.has(propertyId)) {
          const roomCount = Math.max(1, Math.floor(toNumber(property?.bedrooms ?? property?.habitaciones ?? 0)));
          const occupiedRooms = new Set(
            propertyActiveContracts
              .map((c: any) => String(c?.habitacionId ?? c?.habitacion_id ?? '').trim().toUpperCase())
              .filter((roomId: string) => roomId !== '')
          );

          return Array.from({ length: roomCount }, (_, index) => {
            const roomNumber = index + 1;
            const canonicalId = `H${roomNumber}`;
            const numericId = String(roomNumber);
            if (occupiedRooms.has(canonicalId) || occupiedRooms.has(numericId)) return null;

            return {
              propertyId,
              propertyAlias,
              unidadLabel: `Habitación ${canonicalId}`
            };
          }).filter(Boolean) as Array<{ propertyId?: number; propertyAlias: string; unidadLabel: string }>;
        }

        if (propertyActiveContracts.length === 0) {
          return [{
            propertyId,
            propertyAlias,
            unidadLabel: 'Vivienda completa'
          }];
        }

        return [];
      });

      const last3Months = Array.from({ length: 3 }, (_, i) => {
        const date = new Date(currentYear, currentMonth - (i + 1), 1);
        return { month: date.getMonth(), year: date.getFullYear() };
      });

      const getTrabajoProjectionValue = (row: any): number =>
        toNumber(row?.ingresos?.nomina) +
        toNumber(row?.ingresos?.serviciosFreelance) +
        toNumber(row?.ingresos?.pensiones) +
        toNumber(row?.ingresos?.otrosIngresos) -
        toNumber(row?.gastos?.gastosPersonales) -
        toNumber(row?.gastos?.gastosAutonomo) -
        toNumber(row?.financiacion?.cuotasPrestamos);

      const getInmueblesProjectionValue = (row: any): number =>
        toNumber(row?.ingresos?.rentasAlquiler) -
        toNumber(row?.gastos?.gastosOperativos) -
        toNumber(row?.financiacion?.cuotasHipotecas);

      const trabajoLast3 = last3Months.map(({ month, year }) => {
        const ing = ingresos
          .filter((item: any) => inMonth(item, month, year) && isPersonalIngreso(item))
          .reduce((sum: number, item: any) => sum + getImporte(item), 0);
        const gas = gastos
          .filter((item: any) => inMonth(item, month, year) && isPersonalGasto(item))
          .reduce((sum: number, item: any) => sum + getImporte(item), 0);
        return ing - gas + autonomoNetoMensual;
      });

      const cashflowLast3 = last3Months.map(({ month, year }) => {
        const rentas = getRentalIncomeForMonth(month, year, rentPayments, contracts);
        const gastosMes = [
          ...expenses.filter((expense: any) => inMonth(expense, month, year) && isInmuebleExpense(expense)),
          ...gastos.filter((gasto: any) => inMonth(gasto, month, year) && !isPersonalGasto(gasto) && (gasto.destino === 'inmueble_id' || gasto.destino_id != null))
        ].reduce((sum: number, expense: any) => sum + getImporte(expense), 0);

        return rentas - gastosMes - cuotasHipotecaMes;
      });

      let trabajoMensualProyectado = trabajoMensual;
      let cashflowInmueblesProyectado = cashflowInmuebles;
      let inversionesMensualProyectado = 0;
      let trabajoSerieTendencia = trabajoLast3;
      let inmueblesSerieTendencia = cashflowLast3;

      try {
        const annualProjections = await generateProyeccionMensual();
        const projectionRows = annualProjections.reduce((rows: any[], annualProjection: any) => {
          if (Array.isArray(annualProjection?.months)) {
            rows.push(...annualProjection.months);
          }
          return rows;
        }, []);
        const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const currentProjection = projectionMonths.find((row) => row.month === monthKey);
        if (currentProjection) {
          trabajoMensualProyectado = getTrabajoProjectionValue(currentProjection);
          cashflowInmueblesProyectado = getInmueblesProjectionValue(currentProjection);
          inversionesMensualProyectado = toNumber(currentProjection.ingresos.dividendosInversiones);
        }

        const projectionLookup = new Map(projectionMonths.map((row) => [row.month, row]));
        trabajoSerieTendencia = last3Months.map(({ month, year }, index) => {
          const key = `${year}-${String(month + 1).padStart(2, '0')}`;
          const row = projectionLookup.get(key);
          return row ? getTrabajoProjectionValue(row) : trabajoLast3[index] ?? 0;
        });
        inmueblesSerieTendencia = last3Months.map(({ month, year }, index) => {
          const key = `${year}-${String(month + 1).padStart(2, '0')}`;
          const row = projectionLookup.get(key);
          return row ? getInmueblesProjectionValue(row) : cashflowLast3[index] ?? 0;
        });
      } catch {
        inversionesMensualProyectado = 0;
      }

      const trabajoAvg = trabajoSerieTendencia.length > 0 ? trabajoSerieTendencia.reduce((sum, value) => sum + value, 0) / trabajoSerieTendencia.length : 0;
      const trabajoVariacion = trabajoAvg !== 0 ? ((trabajoMensualProyectado - trabajoAvg) / Math.abs(trabajoAvg)) * 100 : 0;
      const trabajoTendencia: 'up' | 'down' | 'stable' = trabajoVariacion > 5 ? 'up' : trabajoVariacion < -5 ? 'down' : 'stable';

      const cashflowAvg = inmueblesSerieTendencia.length > 0 ? inmueblesSerieTendencia.reduce((sum, value) => sum + value, 0) / inmueblesSerieTendencia.length : 0;
      const cashflowVariacion = cashflowAvg !== 0 ? ((cashflowInmueblesProyectado - cashflowAvg) / Math.abs(cashflowAvg)) * 100 : 0;
      const inmueblesTendencia: 'up' | 'down' | 'stable' = cashflowVariacion > 5 ? 'up' : cashflowVariacion < -5 ? 'down' : 'stable';

      // INVERSIONES (solo flujos cobrados en el mes; no plusvalía latente)
      const inversionesActivas = inversiones.filter((inv: any) => inv.activo !== false);
      const rendimientoMes = inversionesActivas.reduce((sum: number, inv: any) => {
        const pagos = inv?.rendimiento?.pagos_generados ?? [];
        const importePagado = (Array.isArray(pagos) ? pagos : [])
          .filter((pago: any) => {
            const fecha = new Date(pago?.fecha_pago);
            if (Number.isNaN(fecha.getTime())) return false;
            const estado = pago?.estado;
            return fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear && (estado === undefined || estado === 'pagado' || estado === 'reinvertido');
          })
          .reduce((acc: number, pago: any) => acc + toNumber(pago?.importe_neto ?? pago?.importe_bruto ?? pago?.importe), 0);
        return sum + importePagado;
      }, 0);

      const dividendosMes = inversionesActivas.reduce((sum: number, inv: any) => {
        const pagos = inv?.dividendos?.dividendos_recibidos ?? [];
        const importePagado = (Array.isArray(pagos) ? pagos : [])
          .filter((pago: any) => {
            const fecha = new Date(pago?.fecha_pago);
            if (Number.isNaN(fecha.getTime())) return false;
            const estado = pago?.estado;
            return fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear && (estado === undefined || estado === 'pagado' || estado === 'reinvertido');
          })
          .reduce((acc: number, pago: any) => acc + toNumber(pago?.importe_neto ?? pago?.importe_bruto ?? pago?.importe), 0);
        return sum + importePagado;
      }, 0);
      const rendimientoHoy = inversionesActivas.reduce((sum: number, inv: any) => {
        const pagos = inv?.rendimiento?.pagos_generados ?? [];
        const importePagado = (Array.isArray(pagos) ? pagos : [])
          .filter((pago: any) => {
            const fecha = new Date(pago?.fecha_pago);
            if (Number.isNaN(fecha.getTime())) return false;
            return fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear && fecha <= todayDate;
          })
          .reduce((acc: number, pago: any) => acc + toNumber(pago?.importe_neto ?? pago?.importe_bruto ?? pago?.importe), 0);
        return sum + importePagado;
      }, 0);
      const dividendosHoy = inversionesActivas.reduce((sum: number, inv: any) => {
        const pagos = inv?.dividendos?.dividendos_recibidos ?? [];
        const importePagado = (Array.isArray(pagos) ? pagos : [])
          .filter((pago: any) => {
            const fecha = new Date(pago?.fecha_pago);
            if (Number.isNaN(fecha.getTime())) return false;
            return fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear && fecha <= todayDate;
          })
          .reduce((acc: number, pago: any) => acc + toNumber(pago?.importe_neto ?? pago?.importe_bruto ?? pago?.importe), 0);
        return sum + importePagado;
      }, 0);
      const inversionesHoy = rendimientoHoy + dividendosHoy;

      return {
        trabajo: {
          netoMensual: trabajoMensualProyectado,
          netoHoy: trabajoHoy,
          pendienteMes: trabajoMensualProyectado - trabajoHoy,
          tendencia: trabajoTendencia,
          variacionPorcentaje: trabajoVariacion
        },
        inmuebles: {
          cashflow: cashflowInmueblesProyectado,
          cashflowHoy: cashflowInmueblesHoy,
          pendienteMes: cashflowInmueblesProyectado - cashflowInmueblesHoy,
          ocupacion,
          vacantes,
          tendencia: inmueblesTendencia
        },
        inversiones: {
          rendimientoMes: 0,
          dividendosMes: inversionesMensualProyectado || (rendimientoMes + dividendosMes),
          totalHoy: inversionesHoy,
          pendienteMes: (inversionesMensualProyectado || (rendimientoMes + dividendosMes)) - inversionesHoy,
          tendencia: 'stable'
        }
      };
    } catch (error) {
      console.error('Error calculating flujos de caja:', error);
      return {
        trabajo: { netoMensual: 0, netoHoy: 0, pendienteMes: 0, tendencia: 'stable', variacionPorcentaje: 0 },
        inmuebles: { cashflow: 0, cashflowHoy: 0, pendienteMes: 0, ocupacion: 0, vacantes: [], tendencia: 'stable' },
        inversiones: { rendimientoMes: 0, dividendosMes: 0, totalHoy: 0, pendienteMes: 0, tendencia: 'stable' }
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
        return sum + parseNumericValue(acc.balance);
      }, 0);
      
      const now = new Date();
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const treasuryEvents = await db.getAll('treasuryEvents').catch(() => []);
      
      // Calculate committed expenses in next 30 days
      // Include recurring expenses, mortgage payments, etc.
      const expenses = await db.getAll('expenses');
      const gastosExpenses = expenses
        .filter((expense: any) => isDateWithinRange(expense.fecha, now, next30Days))
        .reduce((sum: number, expense: any) => sum + parseNumericValue(expense.importe), 0);

      const gastosEventosTesoreria = (treasuryEvents as any[])
        .filter((event) => (event.type === 'expense' || event.type === 'financing') && isForecastTreasuryEvent(event))
        .filter((event) => isDateWithinRange(event.predictedDate, now, next30Days))
        .reduce((sum, event) => sum + parseNumericValue(event.amount), 0);

      const comprometido30d = gastosExpenses + gastosEventosTesoreria;
      
      // Calculate expected income in next 30 days
      // Include rent payments, salaries, etc.
      const rentPayments = await db.getAll('rentPayments');
      const ingresos = await db.getAll('ingresos');
      
      const rentasEsperadas = rentPayments
        .filter((payment: any) => isDateWithinRange(payment.fecha, now, next30Days))
        .reduce((sum: number, payment: any) => sum + parseNumericValue(payment.importe), 0);
      
      const ingresosEsperados = ingresos
        .filter((ing: any) => isDateWithinRange(ing.fecha, now, next30Days))
        .reduce((sum: number, ing: any) => sum + parseNumericValue(ing.importe), 0);

      const ingresosEventosTesoreria = (treasuryEvents as any[])
        .filter((event) => event.type === 'income' && isForecastTreasuryEvent(event))
        .filter((event) => isDateWithinRange(event.predictedDate, now, next30Days))
        .reduce((sum, event) => sum + parseNumericValue(event.amount), 0);
      
      const ingresos30d = rentasEsperadas + ingresosEsperados + ingresosEventosTesoreria;
      
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

  async getTesoreriaPanel(): Promise<{
    asOf: string;
    filas: Array<{
      accountId: number;
      banco: string;
      inicioMes: number;
      hoy: number;
      porCobrar: number;
      porPagar: number;
      proyeccion: number;
    }>;
    totales: {
      inicioMes: number;
      hoy: number;
      porCobrar: number;
      porPagar: number;
      proyeccion: number;
    };
  }> {
    try {
      const now = new Date();
      await rollForwardAccountBalancesToMonth(now.getFullYear(), now.getMonth() + 1);

      const db = await initDB();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const toNumber = (value: unknown): number => {
        return parseNumericValue(value);
      };

      const accounts = await db.getAll('accounts');
      const treasuryEvents = await db.getAll('treasuryEvents').catch(() => []);

      const cardSettlementByAccountId = new Map<number, { chargeAccountId: number }>();
      for (const account of accounts as any[]) {
        if (account?.id == null || account?.cardConfig?.chargeAccountId == null) continue;
        cardSettlementByAccountId.set(account.id, { chargeAccountId: account.cardConfig.chargeAccountId });
      }

      const activeAccounts = accounts.filter((acc: any) => (
        acc.isActive !== false
        && acc.activa !== false
        && acc.status !== 'DELETED'
        && !acc.deleted_at
        && !isCardAccount(acc)
      ));

      const startOfMonthDateOnly = toDateOnlyString(startOfMonth.toISOString())!;
      const endOfMonthDateOnly = toDateOnlyString(endOfMonth.toISOString())!;
      const todayDateOnly = toDateOnlyString(now.toISOString())!;

      const filas = activeAccounts.map((account: any) => {
        const accountId = account.id as number;
        const openingBalance = toNumber(account.balance);

        const eventosMesCuenta = (treasuryEvents as any[]).filter((event) => {
          const displayAccountId = resolveTreasuryEventDisplayAccountId(event, cardSettlementByAccountId);
          return displayAccountId === accountId
            && isTreasuryEventInMonth(event.predictedDate, startOfMonthDateOnly, endOfMonthDateOnly);
        });

        const confirmadosHastaHoy = eventosMesCuenta
          .filter((event) => isConfirmedTreasuryEvent(event))
          .filter((event) => {
            const predictedDateOnly = toDateOnlyString(event.predictedDate);
            return Boolean(predictedDateOnly && predictedDateOnly <= todayDateOnly);
          })
          .reduce((sum, event) => sum + (event.type === 'income' ? 1 : -1) * toNumber(event.amount), 0);

        const futurosCuenta = eventosMesCuenta.filter((event) => isForecastTreasuryEvent(event));

        const porCobrar = futurosCuenta
          .filter((event) => event.type === 'income')
          .reduce((sum, event) => sum + toNumber(event.amount), 0);

        const porPagar = futurosCuenta
          .filter((event) => event.type === 'expense' || event.type === 'financing')
          .reduce((sum, event) => sum + toNumber(event.amount), 0);

        const hoy = openingBalance + confirmadosHastaHoy;
        const proyeccion = hoy + porCobrar - porPagar;

        return {
          accountId,
          banco: account.alias || account.name || account.bank || account.banco?.name || 'Cuenta sin nombre',
          inicioMes: openingBalance,
          hoy,
          porCobrar,
          porPagar,
          proyeccion
        };
      });

      const totales = filas.reduce((acc, fila) => ({
        inicioMes: acc.inicioMes + fila.inicioMes,
        hoy: acc.hoy + fila.hoy,
        porCobrar: acc.porCobrar + fila.porCobrar,
        porPagar: acc.porPagar + fila.porPagar,
        proyeccion: acc.proyeccion + fila.proyeccion
      }), { inicioMes: 0, hoy: 0, porCobrar: 0, porPagar: 0, proyeccion: 0 });

      return {
        asOf: now.toISOString(),
        filas: filas.sort((a, b) => a.banco.localeCompare(b.banco)),
        totales
      };
    } catch (error) {
      console.error('Error getting tesorería panel:', error);
      return {
        asOf: new Date().toISOString(),
        filas: [],
        totales: { inicioMes: 0, hoy: 0, porCobrar: 0, porPagar: 0, proyeccion: 0 }
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
        return sum + parseNumericValue(acc.balance);
      }, 0);
      
      // Calculate average monthly expenses from last 3 months
      const now = new Date();
      const gastos = await db.getAll('gastos');
      const expenses = await db.getAll('expenses');
      const treasuryEvents = await db.getAll('treasuryEvents').catch(() => []);
      
      const last3MonthsExpenses: number[] = [];
      for (let i = 0; i < 3; i++) {
        const pastDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = pastDate.getMonth();
        const year = pastDate.getFullYear();
        
        // All expenses in `gastos` for the month (personal + non-personal)
        const gastosMes = gastos
          .filter((gasto: any) => {
            const fecha = parseDateValue(gasto.fecha);
            if (!fecha) return false;
            if (fecha > now) return false;
            return fecha.getMonth() === month && fecha.getFullYear() === year;
          })
          .reduce((sum: number, gasto: any) => sum + parseNumericValue(gasto.importe), 0);
        
        // All property expenses registered in `expenses`
        const gastosInmuebles = expenses
          .filter((expense: any) => {
            const fecha = parseDateValue(expense.fecha);
            if (!fecha) return false;
            if (fecha > now) return false;
            return fecha.getMonth() === month && fecha.getFullYear() === year;
          })
          .reduce((sum: number, expense: any) => sum + parseNumericValue(expense.importe), 0);

        const gastosProgramados = (treasuryEvents as any[])
          .filter((event) => (event.type === 'expense' || event.type === 'financing') && isForecastTreasuryEvent(event))
          .filter((event) => {
            const fecha = parseDateValue(event.predictedDate);
            if (!fecha) return false;
            if (fecha > now) return false;
            return fecha.getMonth() === month && fecha.getFullYear() === year;
          })
          .reduce((sum, event) => sum + parseNumericValue(event.amount), 0);
        
        last3MonthsExpenses.push(gastosMes + gastosInmuebles + gastosProgramados);
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
      const gastosEsperadosGastos = gastos
        .filter((gasto: any) => isDateWithinRange(gasto.fecha, now, next30Days))
        .reduce((sum: number, gasto: any) => sum + parseNumericValue(gasto.importe), 0);

      const gastosEsperadosExpenses = expenses
        .filter((expense: any) => isDateWithinRange(expense.fecha, now, next30Days))
        .reduce((sum: number, expense: any) => sum + parseNumericValue(expense.importe), 0);

      const gastosEventosTesoreria = (treasuryEvents as any[])
        .filter((event) => (event.type === 'expense' || event.type === 'financing') && isForecastTreasuryEvent(event))
        .filter((event) => isDateWithinRange(event.predictedDate, now, next30Days))
        .reduce((sum, event) => sum + parseNumericValue(event.amount), 0);
      
      // Expected income in next 30 days
      const ingresos = await db.getAll('ingresos');
      const rentPayments = await db.getAll('rentPayments');
      
      const ingresosEsperados = ingresos
        .filter((ing: any) => isDateWithinRange(ing.fecha, now, next30Days))
        .reduce((sum: number, ing: any) => sum + parseNumericValue(ing.importe), 0);
      
      const rentasEsperadas = rentPayments
        .filter((payment: any) => isDateWithinRange(payment.fecha, now, next30Days))
        .reduce((sum: number, payment: any) => sum + parseNumericValue(payment.importe), 0);

      const ingresosEventosTesoreria = (treasuryEvents as any[])
        .filter((event) => event.type === 'income' && isForecastTreasuryEvent(event))
        .filter((event) => isDateWithinRange(event.predictedDate, now, next30Days))
        .reduce((sum, event) => sum + parseNumericValue(event.amount), 0);

      const gastosTotal = gastosEsperadosGastos + gastosEsperadosExpenses + gastosEventosTesoreria;
      const ingresosTotal = ingresosEsperados + rentasEsperadas + ingresosEventosTesoreria;
      const estimado30d = liquidezHoy + ingresosTotal - gastosTotal;
      
      return {
        liquidezHoy,
        gastoMedioMensual,
        colchonMeses,
        estado,
        proyeccion30d: {
          estimado: estimado30d,
          ingresos: ingresosTotal,
          gastos: gastosTotal
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
        const fechaVencimiento = new Date(payment.fecha ?? payment.paymentDate ?? `${payment.period}-01`);
        const status = String(payment.estado ?? payment.status ?? '').toLowerCase();
        return status !== 'pagada' && status !== 'paid' && fechaVencimiento < now;
      });
      
      unpaidRents.forEach((payment: any, index: number) => {
        const fechaReferencia = new Date(payment.fecha ?? payment.paymentDate ?? `${payment.period}-01`);
        const diasVencido = Math.floor((now.getTime() - fechaReferencia.getTime()) / (1000 * 60 * 60 * 24));
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

      const properties = await db.getAll('properties');
      const activeProperties = properties.filter((property: any) => {
        const status = String(property?.state ?? property?.status ?? property?.estado ?? '').toLowerCase();
        return status === '' || status === 'activo' || status === 'active';
      });

      if (activeProperties.length > 0) {
        const flujos = await this.getFlujosCaja();
        if (flujos.inmuebles.ocupacion < 100) {
          const vacantes = flujos.inmuebles.vacantes ?? [];
          const resumenVacantes = vacantes
            .slice(0, 2)
            .map((vacante) => `${vacante.propertyAlias} · ${vacante.unidadLabel}`)
            .join('; ');
          const vacantesExtra = vacantes.length > 2 ? ` (+${vacantes.length - 2} más)` : '';
          alerts.push({
            id: 'occupancy-warning',
            tipo: 'contrato',
            titulo: `${vacantes.length || 1} vacante${(vacantes.length || 1) > 1 ? 's' : ''} hoy`,
            descripcion: resumenVacantes
              ? `Ocupación ${flujos.inmuebles.ocupacion.toFixed(1)}% · Libres hoy: ${resumenVacantes}${vacantesExtra}`
              : `La ocupación actual es del ${flujos.inmuebles.ocupacion.toFixed(1)}% y hay unidades vacantes`,
            urgencia: flujos.inmuebles.ocupacion < 90 ? 'alta' : 'media',
            diasVencimiento: 0,
            link: '/inmuebles/cartera'
          });
        }
      }
      
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

export interface DashboardSnapshot {
  patrimonio: Awaited<ReturnType<DashboardService['getPatrimonioNeto']>>;
  liquidez: Awaited<ReturnType<DashboardService['getLiquidez']>>;
  salud: Awaited<ReturnType<DashboardService['getSaludFinanciera']>>;
  tesoreria: Awaited<ReturnType<DashboardService['getTesoreriaPanel']>>;
  alertas: Awaited<ReturnType<DashboardService['getAlertas']>>;
}

export const dashboardService = new DashboardService();
