// src/services/kpiService.ts
// V62 (TAREA 7 sub-tarea 3): store eliminado · stub para evitar romper consumers.
// Configuraciones ahora en keyval['kpiConfig_*'].

export interface KPIDefinition {
  id: string;
  name: string;
  description?: string;
  category: string;
  formula: string;
  unit: string;
  format?: 'currency' | 'percentage' | 'number';
  decimals?: number;
  trend?: 'higher-better' | 'lower-better' | 'neutral';
  isActive: boolean;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KPIConfiguration {
  id: 'horizon' | 'pulse';
  kpis: KPIDefinition[];
  updatedAt: string;
}

export const kpiService = {
  async getConfiguration(_id: 'horizon' | 'pulse'): Promise<KPIConfiguration | null> {
    return null;
  },

  async saveConfiguration(_config: KPIConfiguration): Promise<void> {
    console.warn('[kpiService] Store eliminado en V62 · usar keyval["kpiConfig_*"]');
  },

  async getActiveKPIs(_configId: 'horizon' | 'pulse'): Promise<KPIDefinition[]> {
    return [];
  },
};
