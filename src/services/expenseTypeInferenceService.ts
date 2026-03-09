// UNICORNIO REFACTOR - Expense Type Inference Service
// Automatically classifies expenses into unified tipo_gasto categories

import { TipoGasto } from './db';
import { UtilityType } from '../types/inboxTypes';

export interface ExpenseInferenceInput {
  proveedor_nombre: string;
  concept?: string;
  fullText?: string;
  utility_type?: UtilityType;
  utility_provider?: string; // Changed from UtilityProvider to string
  movement_description?: string; // For bank movements
  source_type?: 'invoice' | 'bank_movement' | 'manual';
}

export interface ExpenseInferenceResult {
  tipo_gasto: TipoGasto;
  confidence: number; // 0-1
  reasoning: string;
  suggested_category?: string; // For UI display
}

/**
 * Infer expense type from document/movement data
 * Following exact rules from comment requirements
 */
export function inferExpenseType(input: ExpenseInferenceInput): ExpenseInferenceResult {
  const proveedor = input.proveedor_nombre.toLowerCase();
  const concept = (input.concept || '').toLowerCase();
  const fullText = (input.fullText || '').toLowerCase();
  const movementDesc = (input.movement_description || '').toLowerCase();
  
  // Combined text for keyword matching
  const allText = `${proveedor} ${concept} ${fullText} ${movementDesc}`.toLowerCase();

  // 1. Suministros: CUPS/kWh/kW, compañía eléctrica/agua/gas/telco
  if (input.utility_type) {
    const utilityTypeMap: Record<UtilityType, TipoGasto> = {
      electricity: 'suministro_electricidad',
      water: 'suministro_agua', 
      gas: 'suministro_gas',
      telecom: 'internet'
    };
    
    return {
      tipo_gasto: utilityTypeMap[input.utility_type],
      confidence: 0.95,
      reasoning: `Detected utility type: ${input.utility_type}`,
      suggested_category: getDisplayCategory(utilityTypeMap[input.utility_type])
    };
  }

  // Utility patterns from text
  if (hasUtilityPatterns(allText)) {
    const utilityType = detectUtilityFromText(allText);
    return {
      tipo_gasto: utilityType,
      confidence: 0.85,
      reasoning: 'Utility patterns detected in text',
      suggested_category: getDisplayCategory(utilityType)
    };
  }

  // 2. Reparación/Conservación: "reparación", "mantenimiento", "avería", "mano de obra"
  if (hasRepairPatterns(allText)) {
    return {
      tipo_gasto: 'reparacion_conservacion',
      confidence: 0.80,
      reasoning: 'Repair/maintenance patterns detected',
      suggested_category: 'Reparación y conservación'
    };
  }

  // 3. Mejora: "reforma integral", "mejora", "obra mayor", aumento valor/vida útil
  if (hasImprovementPatterns(allText)) {
    return {
      tipo_gasto: 'mejora',
      confidence: 0.75,
      reasoning: 'Property improvement patterns detected',
      suggested_category: 'Mejora'
    };
  }

  // 4. Mobiliario: "sofá", "cama", "frigorífico", "horno", etc.
  if (hasFurniturePatterns(allText)) {
    return {
      tipo_gasto: 'mobiliario',
      confidence: 0.80,
      reasoning: 'Furniture patterns detected',
      suggested_category: 'Mobiliario'
    };
  }

  // 5. IBI/Comunidad/Seguro: detecta por texto y emisor
  if (hasIBIPatterns(allText)) {
    return {
      tipo_gasto: 'ibi',
      confidence: 0.90,
      reasoning: 'IBI/property tax patterns detected',
      suggested_category: 'IBI'
    };
  }

  if (hasCommunityPatterns(allText)) {
    return {
      tipo_gasto: 'comunidad',
      confidence: 0.85,
      reasoning: 'Community fees patterns detected',
      suggested_category: 'Comunidad'
    };
  }

  if (hasInsurancePatterns(allText)) {
    return {
      tipo_gasto: 'seguro',
      confidence: 0.85,
      reasoning: 'Insurance patterns detected',
      suggested_category: 'Seguro'
    };
  }

  // 6. Intereses/Comisiones: desde extractos (banco)
  if (input.source_type === 'bank_movement') {
    if (hasInterestPatterns(allText)) {
      return {
        tipo_gasto: 'intereses',
        confidence: 0.85,
        reasoning: 'Bank interest patterns detected',
        suggested_category: 'Intereses'
      };
    }

    if (hasCommissionPatterns(allText)) {
      return {
        tipo_gasto: 'comisiones',
        confidence: 0.85,
        reasoning: 'Bank commission patterns detected',
        suggested_category: 'Comisiones'
      };
    }
  }

  // 7. Default → otros
  return {
    tipo_gasto: 'otros',
    confidence: 0.30,
    reasoning: 'No specific patterns matched, manual classification recommended',
    suggested_category: 'Otros'
  };
}

// Utility pattern detection functions
function hasUtilityPatterns(text: string): boolean {
  const patterns = [
    'cups', 'kwh', 'kw', 'electricidad', 'gas', 'agua', 'fibra', 'internet', 
    'telco', 'iban', 'factura', 'suministro', 'iberdrola', 'endesa', 'naturgy',
    'movistar', 'vodafone', 'orange', 'wekiwi'
  ];
  return patterns.some(pattern => text.includes(pattern));
}

function detectUtilityFromText(text: string): TipoGasto {
  // Electricity
  if (text.includes('electricidad') || text.includes('kwh') || text.includes('iberdrola') || 
      text.includes('endesa') || text.includes('wekiwi')) {
    return 'suministro_electricidad';
  }
  
  // Gas
  if (text.includes('gas') || text.includes('naturgy') || text.includes('repsol')) {
    return 'suministro_gas';
  }
  
  // Water  
  if (text.includes('agua') || text.includes('canal') || text.includes('agualia')) {
    return 'suministro_agua';
  }
  
  // Telecom
  if (text.includes('internet') || text.includes('fibra') || text.includes('movistar') || 
      text.includes('vodafone') || text.includes('orange')) {
    return 'internet';
  }
  
  // Default to electricity if generic utility
  return 'suministro_electricidad';
}

function hasRepairPatterns(text: string): boolean {
  const patterns = [
    'reparacion', 'reparación', 'mantenimiento', 'averia', 'avería', 
    'mano de obra', 'fontanero', 'electricista', 'cerrajero', 'cristalero',
    'limpieza', 'pintura', 'parche', 'arreglo'
  ];
  return patterns.some(pattern => text.includes(pattern));
}

function hasImprovementPatterns(text: string): boolean {
  const patterns = [
    'reforma integral', 'mejora', 'obra mayor', 'ampliacion', 'ampliación',
    'reforma', 'rehabilitacion', 'rehabilitación', 'acondicionamiento',
    'instalacion', 'instalación', 'construccion', 'construcción'
  ];
  return patterns.some(pattern => text.includes(pattern));
}

function hasFurniturePatterns(text: string): boolean {
  const patterns = [
    'sofa', 'sofá', 'cama', 'frigorifico', 'frigorífico', 'horno', 'lavadora',
    'lavavajillas', 'mesa', 'silla', 'armario', 'cocina', 'television', 'televisión',
    'mobiliario', 'mueble', 'electrodomestico', 'electrodoméstico'
  ];
  return patterns.some(pattern => text.includes(pattern));
}

function hasIBIPatterns(text: string): boolean {
  const patterns = [
    'ibi', 'impuesto bienes inmuebles', 'ayuntamiento', 'municipio',
    'tasa basura', 'tasa residuos', 'tributo'
  ];
  return patterns.some(pattern => text.includes(pattern));
}

function hasCommunityPatterns(text: string): boolean {
  const patterns = [
    'comunidad', 'administrador', 'cuota', 'gastos comunes', 
    'administracion', 'administración', 'finca'
  ];
  return patterns.some(pattern => text.includes(pattern));
}

function hasInsurancePatterns(text: string): boolean {
  const patterns = [
    'seguro', 'aseguradora', 'prima', 'poliza', 'póliza',
    'mapfre', 'allianz', 'axa', 'generali'
  ];
  return patterns.some(pattern => text.includes(pattern));
}

function hasInterestPatterns(text: string): boolean {
  const patterns = [
    'interes', 'interés', 'intereses', 'prestamo', 'préstamo',
    'hipoteca', 'credito', 'crédito', 'financiacion', 'financiación'
  ];
  return patterns.some(pattern => text.includes(pattern));
}

function hasCommissionPatterns(text: string): boolean {
  const patterns = [
    'comision', 'comisión', 'comisiones', 'mantenimiento cuenta',
    'tarjeta', 'transferencia', 'cargo', 'servicio bancario'
  ];
  return patterns.some(pattern => text.includes(pattern));
}

function getDisplayCategory(tipoGasto: TipoGasto): string {
  const categoryMap: Record<TipoGasto, string> = {
    'suministro_electricidad': 'Suministros / Electricidad',
    'suministro_agua': 'Suministros / Agua',
    'suministro_gas': 'Suministros / Gas', 
    'internet': 'Suministros / Internet',
    'reparacion_conservacion': 'Reparación y conservación',
    'mejora': 'Mejora',
    'mobiliario': 'Mobiliario',
    'comunidad': 'Comunidad',
    'seguro': 'Seguro',
    'ibi': 'IBI',
    'intereses': 'Intereses',
    'comisiones': 'Comisiones',
    'otros': 'Otros'
  };
  
  return categoryMap[tipoGasto] || 'Otros';
}