import { openDB } from 'idb';
import { Property, Contract, ExpenseH5 } from './db';
import { formatEuro, formatPercentage as formatPercentageUtil } from '../utils/formatUtils';

export type KPIMetricType = 
  | 'ingresos-anuales'
  | 'gastos-explotacion'
  | 'vacancia-estimada'
  | 'noi-anual'
  | 'coste-adquisicion'
  | 'rentabilidad-bruta'
  | 'rentabilidad-neta'
  | 'beneficio-neto-mes'
  | 'cash-on-cash'
  | 'cap-rate'
  | 'dscr'
  | 'ocupacion';

export interface KPIMetric {
  id: KPIMetricType;
  name: string;
  description: string;
  unit: 'currency' | 'percentage' | 'ratio';
  category: 'ingresos' | 'gastos' | 'rentabilidad' | 'financiero';
  dependsOn: string[];
  formula: string;
}

export type KPITemplate = 'basico' | 'fiscal' | 'inversor';

export interface KPIConfiguration {
  template: KPITemplate;
  activeMetrics: KPIMetricType[];
  metricOrder: KPIMetricType[];
  parameters: {
    costBasis: 'precio-solo' | 'coste-adquisicion';
    includeITP: boolean;
    includeIVA: boolean;
    includeNotary: boolean;
    includeRegistry: boolean;
    includeManagement: boolean;
    includePSI: boolean;
    includeRealEstate: boolean;
    includeOther: boolean;
    capexAmortizable: boolean;
    capexYears: number;
    managementFee: boolean;
    managementFeePercent: number;
    vacancyPercent: number;
    dxcrVisible: boolean;
    marketValue?: number;
  };
}

export interface KPIValue {
  metricId: KPIMetricType;
  value: number | null;
  formattedValue: string;
  isAvailable: boolean;
  tooltipText?: string;
}

export interface PropertyKPIData {
  propertyId: number;
  kpis: KPIValue[];
  lastCalculated: string;
}

// Default KPI metrics catalog
export const KPI_METRICS: Record<KPIMetricType, KPIMetric> = {
  'ingresos-anuales': {
    id: 'ingresos-anuales',
    name: 'Ingresos anuales',
    description: 'Sumatorio de rentas de contratos activos en 12 meses',
    unit: 'currency',
    category: 'ingresos',
    dependsOn: ['contratos'],
    formula: 'Σ(renta mensual × 12) para contratos activos'
  },
  'gastos-explotacion': {
    id: 'gastos-explotacion',
    name: 'Gastos de explotación',
    description: 'Sumatorio de gastos no financieros anuales',
    unit: 'currency',
    category: 'gastos',
    dependsOn: ['gastos'],
    formula: 'Σ gastos no financieros (suministros, comunidad, seguros, etc.)'
  },
  'vacancia-estimada': {
    id: 'vacancia-estimada',
    name: 'Vacancia estimada',
    description: 'Estimación de pérdidas por vacancia',
    unit: 'currency',
    category: 'gastos',
    dependsOn: ['ingresos-anuales', 'parametros'],
    formula: '% vacancia × ingresos anuales'
  },
  'noi-anual': {
    id: 'noi-anual',
    name: 'NOI anual',
    description: 'Net Operating Income anual',
    unit: 'currency',
    category: 'rentabilidad',
    dependsOn: ['ingresos-anuales', 'vacancia-estimada', 'gastos-explotacion'],
    formula: 'Ingresos anuales - vacancia - gastos de explotación'
  },
  'coste-adquisicion': {
    id: 'coste-adquisicion',
    name: 'Coste de adquisición',
    description: 'Precio más costes según configuración',
    unit: 'currency',
    category: 'financiero',
    dependsOn: ['propiedad', 'parametros'],
    formula: 'Precio + costes marcados en parámetros'
  },
  'rentabilidad-bruta': {
    id: 'rentabilidad-bruta',
    name: 'Rentabilidad bruta',
    description: 'Rentabilidad bruta anual sobre base de coste',
    unit: 'percentage',
    category: 'rentabilidad',
    dependsOn: ['ingresos-anuales', 'coste-adquisicion'],
    formula: '(Ingresos anuales ÷ base de coste) × 100'
  },
  'rentabilidad-neta': {
    id: 'rentabilidad-neta',
    name: 'Rentabilidad neta',
    description: 'Rentabilidad neta después de gastos y opcionales',
    unit: 'percentage',
    category: 'rentabilidad',
    dependsOn: ['ingresos-anuales', 'gastos-explotacion', 'vacancia-estimada', 'coste-adquisicion'],
    formula: '((Ingresos - vacancia - gastos - CAPEX amort. - gestión) ÷ base coste) × 100'
  },
  'beneficio-neto-mes': {
    id: 'beneficio-neto-mes',
    name: 'Beneficio neto/mes',
    description: 'Flujo de caja mensual neto',
    unit: 'currency',
    category: 'rentabilidad',
    dependsOn: ['ingresos-anuales', 'gastos-explotacion', 'vacancia-estimada'],
    formula: '(Ingresos - vacancia - gastos - deuda - CAPEX amort. - gestión) ÷ 12'
  },
  'cash-on-cash': {
    id: 'cash-on-cash',
    name: 'Cash-on-cash',
    description: 'Rentabilidad sobre aportación inicial con financiación',
    unit: 'percentage',
    category: 'financiero',
    dependsOn: ['prestamos', 'noi-anual'],
    formula: '(Flujo de caja anual después de deuda ÷ aportación inicial) × 100'
  },
  'cap-rate': {
    id: 'cap-rate',
    name: 'Cap rate',
    description: 'Capitalización rate sobre valor de mercado o coste',
    unit: 'percentage',
    category: 'rentabilidad',
    dependsOn: ['noi-anual', 'coste-adquisicion'],
    formula: '(NOI anual ÷ valor de mercado o coste adquisición) × 100'
  },
  'dscr': {
    id: 'dscr',
    name: 'DSCR',
    description: 'Debt Service Coverage Ratio',
    unit: 'ratio',
    category: 'financiero',
    dependsOn: ['noi-anual', 'prestamos'],
    formula: 'NOI ÷ servicio de deuda anual'
  },
  'ocupacion': {
    id: 'ocupacion',
    name: 'Ocupación',
    description: 'Porcentaje de ocupación actual',
    unit: 'percentage',
    category: 'ingresos',
    dependsOn: ['contratos'],
    formula: 'Días/unidades ocupadas ÷ días/unidades totales'
  }
};

// Template configurations
export const KPI_TEMPLATES: Record<KPITemplate, { name: string; metrics: KPIMetricType[] }> = {
  basico: {
    name: 'Básico',
    metrics: [
      'rentabilidad-bruta',
      'ingresos-anuales',
      'gastos-explotacion',
      'beneficio-neto-mes',
      'ocupacion'
    ]
  },
  fiscal: {
    name: 'Fiscal',
    metrics: [
      'rentabilidad-bruta',
      'ingresos-anuales',
      'gastos-explotacion'
      // Note: fiscal-specific metrics will show as "—" until H9
    ]
  },
  inversor: {
    name: 'Inversor',
    metrics: [
      'rentabilidad-neta',
      'cash-on-cash',
      'cap-rate'
      // DSCR will be hidden by default
    ]
  }
};

// Default configuration
export const DEFAULT_KPI_CONFIG: KPIConfiguration = {
  template: 'basico',
  activeMetrics: KPI_TEMPLATES.basico.metrics,
  metricOrder: KPI_TEMPLATES.basico.metrics,
  parameters: {
    costBasis: 'coste-adquisicion',
    includeITP: true,
    includeIVA: true,
    includeNotary: true,
    includeRegistry: true,
    includeManagement: true,
    includePSI: true,
    includeRealEstate: true,
    includeOther: true,
    capexAmortizable: false,
    capexYears: 10,
    managementFee: false,
    managementFeePercent: 5,
    vacancyPercent: 7.5,
    dxcrVisible: false
  }
};

// Format ratio
export const formatRatio = (value: number): string => {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  }).format(value) + ' x';
};

// KPI Service Class
export class KPIService {
  private dbName = 'AtlasHorizonDB';
  private dbVersion = 4; // Match the current DB version

  async saveConfiguration(config: KPIConfiguration, module: 'horizon' | 'pulse' = 'horizon'): Promise<void> {
    try {
      const db = await openDB(this.dbName, this.dbVersion);
      await db.put('kpiConfigurations', { 
        id: module, 
        ...config,
        updatedAt: new Date().toISOString()
      });
      console.log(`KPI configuration saved for module: ${module}`);
    } catch (error) {
      console.error('Error saving KPI configuration:', error);
      throw new Error(`Failed to save KPI configuration: ${error}`);
    }
  }

  async getConfiguration(module: 'horizon' | 'pulse' = 'horizon'): Promise<KPIConfiguration> {
    try {
      const db = await openDB(this.dbName, this.dbVersion);
      const config = await db.get('kpiConfigurations', module);
      return config || DEFAULT_KPI_CONFIG;
    } catch (error) {
      console.warn('Could not load KPI configuration, using defaults', error);
      return DEFAULT_KPI_CONFIG;
    }
  }

  async calculateKPIsForProperty(propertyId: number, config?: KPIConfiguration): Promise<PropertyKPIData> {
    const actualConfig = config || await this.getConfiguration();
    const db = await openDB(this.dbName, this.dbVersion);
    
    // Get property data
    const property = await db.get('properties', propertyId);
    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }

    // Get related data
    const contracts = await db.getAll('contracts');
    const expenses = await db.getAll('expenses');
    
    // Filter data for this property
    const propertyContracts = contracts.filter(c => c.propertyId === propertyId);
    const propertyExpenses = expenses.filter(e => e.propertyId === propertyId);

    // Calculate KPIs
    const kpis: KPIValue[] = [];
    
    for (const metricId of actualConfig.activeMetrics) {
      const kpiValue = await this.calculateSingleKPI(metricId, property, propertyContracts, propertyExpenses, actualConfig);
      kpis.push(kpiValue);
    }

    return {
      propertyId,
      kpis,
      lastCalculated: new Date().toISOString()
    };
  }

  private async calculateSingleKPI(
    metricId: KPIMetricType,
    property: Property,
    contracts: Contract[],
    expenses: ExpenseH5[],
    config: KPIConfiguration
  ): Promise<KPIValue> {
    const metric = KPI_METRICS[metricId];
    let value: number | null = null;
    let isAvailable = true;
    let tooltipText = metric.formula;

    try {
      switch (metricId) {
        case 'ingresos-anuales':
          value = this.calculateIngresosAnuales(contracts);
          break;
          
        case 'gastos-explotacion':
          value = this.calculateGastosExplotacion(expenses);
          break;
          
        case 'vacancia-estimada':
          const ingresos = this.calculateIngresosAnuales(contracts);
          value = ingresos * (config.parameters.vacancyPercent / 100);
          break;
          
        case 'noi-anual':
          const ingresosAnuales = this.calculateIngresosAnuales(contracts);
          const gastosExplotacion = this.calculateGastosExplotacion(expenses);
          const vacancia = ingresosAnuales * (config.parameters.vacancyPercent / 100);
          value = ingresosAnuales - vacancia - gastosExplotacion;
          break;
          
        case 'coste-adquisicion':
          value = this.calculateCosteAdquisicion(property, config);
          break;
          
        case 'rentabilidad-bruta':
          const ingresosAnu = this.calculateIngresosAnuales(contracts);
          const costeAdq = this.calculateCosteAdquisicion(property, config);
          value = costeAdq > 0 ? (ingresosAnu / costeAdq) * 100 : 0;
          break;
          
        case 'rentabilidad-neta':
          value = this.calculateRentabilidadNeta(property, contracts, expenses, config);
          break;
          
        case 'beneficio-neto-mes':
          value = this.calculateBeneficioNetoMes(property, contracts, expenses, config);
          break;
          
        case 'cash-on-cash':
          // Will show "—" since no loan data available yet
          isAvailable = false;
          tooltipText = 'Disponible cuando existan préstamos';
          break;
          
        case 'cap-rate':
          const noi = this.calculateNOI(contracts, expenses, config);
          const baseValue = config.parameters.marketValue || this.calculateCosteAdquisicion(property, config);
          value = baseValue > 0 ? (noi / baseValue) * 100 : 0;
          break;
          
        case 'dscr':
          if (!config.parameters.dxcrVisible) {
            isAvailable = false;
            tooltipText = 'Métrica oculta por configuración';
          } else {
            isAvailable = false;
            tooltipText = 'Disponible cuando existan préstamos';
          }
          break;
          
        case 'ocupacion':
          value = this.calculateOcupacion(contracts);
          if (contracts.length === 0) {
            isAvailable = false;
            tooltipText = 'Disponible cuando existan contratos';
          }
          break;
          
        default:
          isAvailable = false;
          value = null;
      }
    } catch (error) {
      console.warn(`Error calculating KPI ${metricId}:`, error);
      isAvailable = false;
      value = null;
    }

    return {
      metricId,
      value,
      formattedValue: this.formatKPIValue(value, metric.unit, isAvailable),
      isAvailable,
      tooltipText
    };
  }

  private calculateIngresosAnuales(contracts: Contract[]): number {
    const now = new Date();
    const activeContracts = contracts.filter(c => {
      const startDate = new Date(c.startDate);
      if (startDate > now) return false; // Not started yet
      
      if (c.isIndefinite) return true; // Indefinite contracts are active
      
      if (c.endDate) {
        return new Date(c.endDate) > now; // Check if not ended
      }
      
      return true; // If no end date and not indefinite, assume active
    });
    return activeContracts.reduce((total, contract) => total + (contract.monthlyRent * 12), 0);
  }

  private calculateGastosExplotacion(expenses: ExpenseH5[]): number {
    const currentYear = new Date().getFullYear();
    const operatingExpenses = expenses.filter(e => 
      e.taxYear === currentYear && 
      e.fiscalType !== 'financiacion' && 
      e.fiscalType !== 'capex-mejora-ampliacion'
    );
    return operatingExpenses.reduce((total, expense) => total + expense.amount, 0);
  }

  private calculateCosteAdquisicion(property: Property, config: KPIConfiguration): number {
    if (config.parameters.costBasis === 'precio-solo') {
      return property.acquisitionCosts.price;
    }

    let total = property.acquisitionCosts.price;
    const costs = property.acquisitionCosts;

    if (config.parameters.includeITP && costs.itp) total += costs.itp;
    if (config.parameters.includeIVA && costs.iva) total += costs.iva;
    if (config.parameters.includeNotary && costs.notary) total += costs.notary;
    if (config.parameters.includeRegistry && costs.registry) total += costs.registry;
    if (config.parameters.includeManagement && costs.management) total += costs.management;
    if (config.parameters.includePSI && costs.psi) total += costs.psi;
    if (config.parameters.includeRealEstate && costs.realEstate) total += costs.realEstate;
    if (config.parameters.includeOther && costs.other) {
      total += costs.other.reduce((sum, item) => sum + item.amount, 0);
    }

    return total;
  }

  private calculateNOI(contracts: Contract[], expenses: ExpenseH5[], config: KPIConfiguration): number {
    const ingresos = this.calculateIngresosAnuales(contracts);
    const gastos = this.calculateGastosExplotacion(expenses);
    const vacancia = ingresos * (config.parameters.vacancyPercent / 100);
    return ingresos - vacancia - gastos;
  }

  private calculateRentabilidadNeta(
    property: Property, 
    contracts: Contract[], 
    expenses: ExpenseH5[], 
    config: KPIConfiguration
  ): number {
    const noi = this.calculateNOI(contracts, expenses, config);
    let adjustedNOI = noi;

    // Apply management fee if configured
    if (config.parameters.managementFee) {
      const ingresos = this.calculateIngresosAnuales(contracts);
      const managementCost = ingresos * (config.parameters.managementFeePercent / 100);
      adjustedNOI -= managementCost;
    }

    // Apply CAPEX amortization if configured
    if (config.parameters.capexAmortizable) {
      // TODO: Calculate CAPEX amortization when CAPEX data is available
    }

    const costeAdquisicion = this.calculateCosteAdquisicion(property, config);
    return costeAdquisicion > 0 ? (adjustedNOI / costeAdquisicion) * 100 : 0;
  }

  private calculateBeneficioNetoMes(
    property: Property, 
    contracts: Contract[], 
    expenses: ExpenseH5[], 
    config: KPIConfiguration
  ): number {
    const noi = this.calculateNOI(contracts, expenses, config);
    let monthlyBenefit = noi / 12;

    // Apply management fee if configured
    if (config.parameters.managementFee) {
      const ingresos = this.calculateIngresosAnuales(contracts);
      const managementCost = (ingresos * (config.parameters.managementFeePercent / 100)) / 12;
      monthlyBenefit -= managementCost;
    }

    // Apply CAPEX amortization if configured
    if (config.parameters.capexAmortizable) {
      // TODO: Calculate monthly CAPEX amortization when CAPEX data is available
    }

    // TODO: Subtract debt service when loan data is available

    return monthlyBenefit;
  }

  private calculateOcupacion(contracts: Contract[]): number {
    if (contracts.length === 0) return 0;
    
    const now = new Date();
    const activeContracts = contracts.filter(c => {
      const startDate = new Date(c.startDate);
      if (startDate > now) return false; // Not started yet
      
      if (c.isIndefinite) return true; // Indefinite contracts are active
      
      if (c.endDate) {
        return new Date(c.endDate) > now; // Check if not ended
      }
      
      return true; // If no end date and not indefinite, assume active
    });
    
    return (activeContracts.length / contracts.length) * 100;
  }

  private formatKPIValue(value: number | null, unit: 'currency' | 'percentage' | 'ratio', isAvailable: boolean): string {
    if (!isAvailable || value === null) {
      return '—';
    }

    switch (unit) {
      case 'currency':
        return formatEuro(value);
      case 'percentage':
        return formatPercentageUtil(value);
      case 'ratio':
        return formatRatio(value);
      default:
        return '—';
    }
  }
}

// Export singleton instance
export const kpiService = new KPIService();