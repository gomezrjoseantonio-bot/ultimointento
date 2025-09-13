// Utility functions for Inmueble tax calculations and validations
// Following exact specifications from problem statement

import { ComunidadAutonoma, RegimenCompra, ImpuestosCompra, ComplecionStatus } from '../types/inmueble';

// ITP rates by CCAA (tipo general)
export const ITP_RATES: Record<ComunidadAutonoma, number> = {
  'Andalucía': 8.0,
  'Aragón': 8.0,
  'Asturias': 8.0,
  'Baleares': 8.0,
  'Canarias': 6.5,
  'Cantabria': 8.0,
  'Castilla-La Mancha': 9.0,
  'Castilla y León': 8.0,
  'Cataluña': 10.0,
  'Extremadura': 8.0,
  'Galicia': 10.0,
  'La Rioja': 7.0,
  'Madrid': 6.0,
  'Murcia': 8.0,
  'Navarra': 6.0,
  'País Vasco': 4.0,
  'Valencia': 10.0,
  'Ceuta': 6.0,
  'Melilla': 6.0
};

// IVA and AJD rates (standard rates)
export const IVA_RATE = 10.0; // 10% for new construction
export const AJD_RATE = 1.5; // 1.5% standard AJD rate

/**
 * Calculate ITP amount and rate for used properties
 */
export function calculateITP(precioCompra: number, ccaa: ComunidadAutonoma): {
  importe: number;
  porcentaje: number;
} {
  const rate = ITP_RATES[ccaa];
  const importe = Math.round((precioCompra * rate / 100) * 100) / 100; // Round to 2 decimals
  
  return {
    importe,
    porcentaje: rate
  };
}

/**
 * Calculate IVA amount and rate for new construction
 */
export function calculateIVA(precioCompra: number): {
  importe: number;
  porcentaje: number;
} {
  const importe = Math.round((precioCompra * IVA_RATE / 100) * 100) / 100; // Round to 2 decimals
  
  return {
    importe,
    porcentaje: IVA_RATE
  };
}

/**
 * Calculate AJD amount and rate for new construction
 */
export function calculateAJD(precioCompra: number): {
  importe: number;
  porcentaje: number;
} {
  const importe = Math.round((precioCompra * AJD_RATE / 100) * 100) / 100; // Round to 2 decimals
  
  return {
    importe,
    porcentaje: AJD_RATE
  };
}

/**
 * Calculate total taxes based on regime
 */
export function calculateTotalTaxes(
  precioCompra: number, 
  regimen: RegimenCompra, 
  ccaa: ComunidadAutonoma
): ImpuestosCompra {
  if (regimen === 'USADA_ITP') {
    const itp = calculateITP(precioCompra, ccaa);
    return {
      itp_importe: itp.importe,
      itp_porcentaje_info: itp.porcentaje
    };
  } else {
    const iva = calculateIVA(precioCompra);
    const ajd = calculateAJD(precioCompra);
    return {
      iva_importe: iva.importe,
      iva_porcentaje_info: iva.porcentaje,
      ajd_importe: ajd.importe,
      ajd_porcentaje_info: ajd.porcentaje
    };
  }
}

/**
 * Calculate total amount of taxes
 */
export function calculateTotalTaxAmount(impuestos: ImpuestosCompra): number {
  let total = 0;
  
  if (impuestos.itp_importe) {
    total += impuestos.itp_importe;
  }
  
  if (impuestos.iva_importe) {
    total += impuestos.iva_importe;
  }
  
  if (impuestos.ajd_importe) {
    total += impuestos.ajd_importe;
  }
  
  return Math.round(total * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate construction percentage
 */
export function calculateConstructionPercentage(
  valorCatastralConstruccion: number, 
  valorCatastralTotal: number
): number {
  if (valorCatastralTotal === 0) return 0;
  
  const percentage = (valorCatastralConstruccion / valorCatastralTotal) * 100;
  return Math.round(percentage * 10000) / 10000; // Round to 4 decimals
}

/**
 * Validate postal code format
 */
export function validatePostalCode(cp: string): boolean {
  return /^\d{5}$/.test(cp);
}

/**
 * Validate required fields for each step
 */
export function validateStep1(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.alias?.trim()) {
    errors.push('El alias es obligatorio');
  }
  
  if (!data.direccion?.calle?.trim()) {
    errors.push('La calle es obligatoria');
  }
  
  if (!data.direccion?.numero?.trim()) {
    errors.push('El número es obligatorio');
  }
  
  if (!data.direccion?.cp?.trim()) {
    errors.push('El código postal es obligatorio');
  } else if (!validatePostalCode(data.direccion.cp)) {
    errors.push('El código postal debe tener 5 dígitos');
  }
  
  return { isValid: errors.length === 0, errors };
}

export function validateStep2(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.caracteristicas?.m2 || data.caracteristicas.m2 <= 0) {
    errors.push('La superficie debe ser mayor que 0');
  }
  
  if (data.caracteristicas?.habitaciones < 0) {
    errors.push('El número de habitaciones no puede ser negativo');
  }
  
  if (data.caracteristicas?.banos < 0) {
    errors.push('El número de baños no puede ser negativo');
  }
  
  return { isValid: errors.length === 0, errors };
}

export function validateStep3(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.compra?.regimen) {
    errors.push('Selecciona el régimen de la compra (usada u obra nueva)');
  }
  
  if (!data.compra?.precio_compra || data.compra.precio_compra <= 0) {
    errors.push('El precio de compra debe ser mayor que 0');
  }
  
  if (!data.compra?.fecha_compra) {
    errors.push('La fecha de compra es obligatoria');
  }
  
  return { isValid: errors.length === 0, errors };
}

export function validateStep4(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Step 4 fields are optional for now, can be completed later
  // Only validate if provided
  
  if (data.fiscalidad?.valor_catastral_total !== undefined && data.fiscalidad.valor_catastral_total < 0) {
    errors.push('El valor catastral no puede ser negativo');
  }
  
  if (data.fiscalidad?.valor_catastral_construccion !== undefined && data.fiscalidad.valor_catastral_construccion < 0) {
    errors.push('El valor catastral de construcción no puede ser negativo');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Calculate completion status for each section
 */
export function calculateCompletionStatus(data: any): {
  identificacion_status: ComplecionStatus;
  caracteristicas_status: ComplecionStatus;
  compra_status: ComplecionStatus;
  fiscalidad_status: ComplecionStatus;
} {
  // Identificación - required: alias, direccion (calle, numero, cp)
  const identificacionComplete = !!(
    data.alias?.trim() &&
    data.direccion?.calle?.trim() &&
    data.direccion?.numero?.trim() &&
    data.direccion?.cp?.trim() &&
    validatePostalCode(data.direccion.cp)
  );

  // Características - required: m2, optional: habitaciones, banos, anio_construccion
  const caracteristicasComplete = !!(data.caracteristicas?.m2 > 0);
  const caracteristicasPartial = !!(
    data.caracteristicas?.habitaciones !== undefined ||
    data.caracteristicas?.banos !== undefined ||
    data.caracteristicas?.anio_construccion !== undefined
  );

  // Compra - required: regimen, precio_compra, fecha_compra
  const compraComplete = !!(
    data.compra?.regimen &&
    data.compra?.precio_compra > 0 &&
    data.compra?.fecha_compra
  );

  // Fiscalidad - all optional, but if any is provided, consider partial
  const fiscalidadPartial = !!(
    data.fiscalidad?.valor_catastral_total !== undefined ||
    data.fiscalidad?.valor_catastral_construccion !== undefined ||
    data.fiscalidad?.nota?.trim()
  );

  return {
    identificacion_status: identificacionComplete ? 'COMPLETO' : 'PENDIENTE',
    caracteristicas_status: caracteristicasComplete ? 'COMPLETO' : 
      (caracteristicasPartial ? 'PARCIAL' : 'PENDIENTE'),
    compra_status: compraComplete ? 'COMPLETO' : 'PENDIENTE',
    fiscalidad_status: fiscalidadPartial ? 'PARCIAL' : 'PENDIENTE'
  };
}

/**
 * Generate unique ID
 */
export function generateInmuebleId(): string {
  return `inmueble_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format euro amount for display
 */
export function formatEuroAmount(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

/**
 * Parse euro input string to number
 */
export function parseEuroInput(input: string): number {
  // Remove currency symbols, spaces, and use comma as decimal separator
  const cleaned = input.replace(/[€\s]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
}