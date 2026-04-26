// src/services/kpiService.ts
// V62 (TAREA 7 sub-tarea 3): store eliminado · stub enriquecido para preservar API surface.
// Configuraciones ahora en keyval['kpiConfig_*'].

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
    mejoraAmortizable: boolean;
    mejoraYears: number;
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
    formula: '((Ingresos - vacancia - gastos - mejora amort. - gestión) ÷ base coste) × 100'
  },
  'beneficio-neto-mes': {
    id: 'beneficio-neto-mes',
    name: 'Beneficio neto/mes',
    description: 'Flujo de caja mensual neto',
    unit: 'currency',
    category: 'rentabilidad',
    dependsOn: ['ingresos-anuales', 'gastos-explotacion', 'vacancia-estimada'],
    formula: '(Ingresos - vacancia - gastos - deuda - mejora amort. - gestión) ÷ 12'
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
    ]
  },
  inversor: {
    name: 'Inversor',
    metrics: [
      'rentabilidad-neta',
      'cash-on-cash',
      'cap-rate'
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
    mejoraAmortizable: false,
    mejoraYears: 10,
    managementFee: false,
    managementFeePercent: 5,
    vacancyPercent: 7.5,
    dxcrVisible: false
  }
};

// KPI Service Class
export class KPIService {
  async saveConfiguration(_config: KPIConfiguration, _module: 'horizon' | 'pulse' = 'horizon'): Promise<void> {
    console.warn('[kpiService] Store eliminado en V62 · usar keyval["kpiConfig_*"]');
  }

  async getConfiguration(_module: 'horizon' | 'pulse' = 'horizon'): Promise<KPIConfiguration> {
    return DEFAULT_KPI_CONFIG;
  }

  async calculateKPIsForProperty(_propertyId: number, _config?: KPIConfiguration): Promise<PropertyKPIData> {
    return {
      propertyId: _propertyId,
      kpis: [],
      lastCalculated: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const kpiService = new KPIService();
