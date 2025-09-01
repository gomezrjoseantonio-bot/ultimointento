// H5: AEAT Utilities for Gastos & CAPEX
import { AEATFiscalType, AEATBox } from '../services/db';

export interface AEATFiscalTypeOption {
  value: AEATFiscalType;
  label: string;
  description: string;
  suggestedBox?: AEATBox;
}

export interface AEATBoxOption {
  value: AEATBox;
  label: string;
  description: string;
}

// AEAT Fiscal Type options for expense classification
export const AEAT_FISCAL_TYPES: AEATFiscalTypeOption[] = [
  {
    value: 'financiacion',
    label: 'Financiación',
    description: 'Intereses y gastos asociados',
    suggestedBox: '0105'
  },
  {
    value: 'reparacion-conservacion',
    label: 'Reparación & Conservación',
    description: 'Gastos de reparación y conservación',
    suggestedBox: '0106'
  },
  {
    value: 'comunidad',
    label: 'Comunidad',
    description: 'Gastos de comunidad de propietarios',
    suggestedBox: '0109'
  },
  {
    value: 'suministros',
    label: 'Suministros',
    description: 'Agua, electricidad, gas, etc.',
    suggestedBox: '0113'
  },
  {
    value: 'seguros',
    label: 'Seguros',
    description: 'Seguros del inmueble',
    suggestedBox: '0114'
  },
  {
    value: 'tributos-locales',
    label: 'Tributos locales',
    description: 'IBI, basura, alumbrado (sin sanciones)',
    suggestedBox: '0115'
  },
  {
    value: 'servicios-personales',
    label: 'Servicios personales',
    description: 'Limpieza, mantenimiento externo, etc.',
    suggestedBox: '0112'
  },
  {
    value: 'amortizacion-muebles',
    label: 'Amortización muebles (10 años)',
    description: 'Solo registrar base y alta del bien; cálculo en H9',
    suggestedBox: '0117'
  },
  {
    value: 'capex-mejora-ampliacion',
    label: 'CAPEX (Mejora/Ampliación)',
    description: 'No es gasto del ejercicio; va a mayor valor'
  }
];

// AEAT Box options for Modelo 100 mapping
export const AEAT_BOXES: AEATBoxOption[] = [
  {
    value: '0105',
    label: '0105',
    description: 'Intereses y gastos de financiación'
  },
  {
    value: '0106',
    label: '0106',
    description: 'Reparación y conservación'
  },
  {
    value: '0109',
    label: '0109',
    description: 'Gastos de comunidad'
  },
  {
    value: '0112',
    label: '0112',
    description: 'Servicios personales'
  },
  {
    value: '0113',
    label: '0113',
    description: 'Suministros'
  },
  {
    value: '0114',
    label: '0114',
    description: 'Seguros'
  },
  {
    value: '0115',
    label: '0115',
    description: 'Tributos locales'
  },
  {
    value: '0117',
    label: '0117',
    description: 'Amortización de muebles'
  }
];

// Get suggested AEAT box for a fiscal type
export const getSuggestedAEATBox = (fiscalType: AEATFiscalType): AEATBox | undefined => {
  const fiscalTypeOption = AEAT_FISCAL_TYPES.find(type => type.value === fiscalType);
  return fiscalTypeOption?.suggestedBox;
};

// Get fiscal type label
export const getFiscalTypeLabel = (fiscalType: AEATFiscalType): string => {
  const fiscalTypeOption = AEAT_FISCAL_TYPES.find(type => type.value === fiscalType);
  return fiscalTypeOption?.label || fiscalType;
};

// Get AEAT box label
export const getAEATBoxLabel = (box: AEATBox): string => {
  const boxOption = AEAT_BOXES.find(b => b.value === box);
  return boxOption?.label || box;
};

// Calculate AEAT limits for a property in a tax year
export const calculateAEATLimits = (
  totalIncome: number,
  financingExpenses: number,
  repairExpenses: number
): {
  limit: number;
  applied: number;
  excess: number;
} => {
  const totalDeductible = financingExpenses + repairExpenses;
  const limit = totalIncome;
  const applied = Math.min(totalDeductible, limit);
  const excess = Math.max(0, totalDeductible - applied);

  return {
    limit,
    applied,
    excess
  };
};

// Generate carryforward expiration year (current + 4 years)
export const getCarryForwardExpirationYear = (taxYear: number): number => {
  return taxYear + 4;
};