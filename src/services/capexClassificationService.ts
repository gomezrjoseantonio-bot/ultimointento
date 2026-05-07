import { initDB, Document, MejoraInmueble } from './db';
import toast from 'react-hot-toast';
import { mejorasInmuebleService } from './mejorasInmuebleService';
import { mueblesInmuebleService } from './mueblesInmuebleService';

/**
 * Enhanced Mejora Classification Service
 * Handles classification between repairs, improvements, and furniture with proper amortization
 *
 * NOTE · El store legacy `mejora` se eliminó en v62. Las funciones de
 * escritura siguen siendo no-op (createMejoraFromDocument · update*) hasta
 * que se reescriban contra `mejorasInmueble`. La lectura `getMejora-
 * AmortizationSummary` SÍ se reconectó a `mejorasInmuebleService` y
 * `mueblesInmuebleService` (T-RECONNECT-1 · Hallazgo 2.B) — ver función.
 */

/** Local Mejora type kept for backward-compatible signatures */
export type MejoraTipo = 'reparacion' | 'mejora' | 'ampliacion' | 'mobiliario';

export type Mejora = {
  id?: number;
  inmueble_id: number;
  contraparte: string;
  fecha_emision: string;
  total: number;
  tipo: string;
  anos_amortizacion: number;
  estado: string;
  movement_id?: number;
  source_doc_id?: number;
  createdAt: string;
  updatedAt: string;
};

export type MejoraNature = MejoraTipo;

export interface MejoraClassification {
  nature: MejoraNature;
  description: string;
  amortizationYears: number;
  isDeductibleThisYear: boolean;
  affectsPropertyValue: boolean;
}

/**
 * Classification rules for Mejora
 */
export const Mejora_CLASSIFICATION_RULES: Record<MejoraNature, MejoraClassification> = {
  reparacion: {
    nature: 'reparacion',
    description: 'Reparación y conservación - Gasto del año',
    amortizationYears: 1, // Deducible immediately
    isDeductibleThisYear: true,
    affectsPropertyValue: false
  },
  mejora: {
    nature: 'mejora',
    description: 'Mejora - Aumenta base amortizable del inmueble',
    amortizationYears: 15, // Same as property amortization
    isDeductibleThisYear: false,
    affectsPropertyValue: true
  },
  ampliacion: {
    nature: 'ampliacion',
    description: 'Ampliación - Aumenta base amortizable del inmueble',
    amortizationYears: 15, // Same as property amortization
    isDeductibleThisYear: false,
    affectsPropertyValue: true
  },
  mobiliario: {
    nature: 'mobiliario',
    description: 'Mobiliario - Amortización lineal 10 años',
    amortizationYears: 10,
    isDeductibleThisYear: false,
    affectsPropertyValue: false
  }
};

/**
 * Classify Mejora based on description and amount
 */
export const classifyMejora = (
  description: string,
  amount: number,
  existingClassification?: MejoraNature
): MejoraNature => {
  if (existingClassification) {
    return existingClassification;
  }

  const descLower = description.toLowerCase();

  // Furniture keywords
  const furnitureKeywords = [
    'mueble', 'mobiliario', 'silla', 'mesa', 'cama', 'armario', 'sofá',
    'electrodoméstico', 'nevera', 'lavadora', 'televisión', 'tv',
    'colchón', 'decoración', 'lámpara', 'estantería'
  ];

  // Repair keywords  
  const repairKeywords = [
    'reparación', 'reparar', 'arreglo', 'arreglar', 'mantenimiento',
    'pintura', 'pintar', 'limpieza', 'limpiar', 'revisar', 'revisión',
    'cambio bombilla', 'bombilla', 'grifo', 'persiana', 'cerradura',
    'mantenimiento', 'conservación'
  ];

  // Improvement keywords
  const improvementKeywords = [
    'reforma', 'reformar', 'ampliación', 'ampliar', 'construcción',
    'baño nuevo', 'cocina nueva', 'instalación', 'instalar',
    'aire acondicionado', 'calefacción', 'tarima', 'parquet',
    'azulejo', 'alicatar', 'fontanería nueva', 'electricidad nueva',
    'ventana nueva', 'puerta nueva'
  ];

  // Check furniture first
  if (furnitureKeywords.some(keyword => descLower.includes(keyword))) {
    return 'mobiliario';
  }

  // Check repairs
  if (repairKeywords.some(keyword => descLower.includes(keyword))) {
    return 'reparacion';
  }

  // Check improvements (including ampliacion)
  if (improvementKeywords.some(keyword => descLower.includes(keyword))) {
    return 'mejora';
  }

  // Default based on amount - higher amounts more likely to be improvements
  if (amount > 5000) {
    return 'mejora';
  } else if (amount > 1000) {
    return 'mobiliario';
  } else {
    return 'reparacion';
  }
};

/**
 * Calculate amortization for Mejora based on its nature
 */
export const calculateMejoraAmortization = (
  mejora: Mejora,
  exerciseYear: number
): {
  annualAmortization: number;
  remainingYears: number;
  totalAmortized: number;
  remainingValue: number;
} => {
  const classification = Mejora_CLASSIFICATION_RULES[mejora.tipo as MejoraNature] || 
                        Mejora_CLASSIFICATION_RULES.mejora;

  const mejoraYear = new Date(mejora.fecha_emision).getFullYear();
  const yearsSinceAcquisition = exerciseYear - mejoraYear;

  if (yearsSinceAcquisition < 0) {
    // Future Mejora
    return {
      annualAmortization: 0,
      remainingYears: classification.amortizationYears,
      totalAmortized: 0,
      remainingValue: mejora.total
    };
  }

  if (classification.isDeductibleThisYear) {
    // Repairs are fully deductible in the year they occur
    return {
      annualAmortization: yearsSinceAcquisition === 0 ? mejora.total : 0,
      remainingYears: 0,
      totalAmortized: mejora.total,
      remainingValue: 0
    };
  }

  // Linear amortization for improvements and furniture
  const annualAmortization = mejora.total / classification.amortizationYears;
  const totalAmortized = Math.min(
    mejora.total,
    annualAmortization * (yearsSinceAcquisition + 1)
  );
  const remainingValue = mejora.total - totalAmortized;
  const remainingYears = Math.max(
    0,
    classification.amortizationYears - yearsSinceAcquisition - 1
  );

  return {
    annualAmortization: remainingYears > 0 ? annualAmortization : 0,
    remainingYears,
    totalAmortized,
    remainingValue
  };
};

/**
 * Adapta una `MejoraInmueble` (schema canónico actual) a la estructura
 * legacy `Mejora` que esperan callers ya escritos contra esta API.
 * T-RECONNECT-1 · Hallazgo 2.B.
 */
const mapMejoraInmuebleToLegacy = (m: MejoraInmueble): Mejora => {
  const tipoLegacy: MejoraTipo =
    m.tipo === 'reparacion' ? 'reparacion'
      : m.tipo === 'ampliacion' ? 'ampliacion'
        : 'mejora';
  return {
    id: m.id,
    inmueble_id: m.inmuebleId,
    contraparte: m.proveedorNombre ?? '',
    fecha_emision: m.fecha,
    total: m.importe,
    tipo: tipoLegacy,
    anos_amortizacion: Mejora_CLASSIFICATION_RULES[tipoLegacy].amortizationYears,
    estado: m.estadoTesoreria ?? 'confirmed',
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
};

/**
 * Get amortization summary for all Mejora of a property
 *
 * T-RECONNECT-1 · Hallazgo 2.B · reconectado a `mejorasInmuebleService` y
 * `mueblesInmuebleService` después de la migración v62 que eliminó el
 * store legacy `mejora`. Antes devolvía siempre 0€ (cable suelto).
 *
 * - improvementAmortization · suma anual de mejoras + ampliaciones (lineal 15 años · ver `Mejora_CLASSIFICATION_RULES`)
 * - repairExpenses · reparaciones del año en curso (deducibles 100% en el ejercicio)
 * - furnitureAmortization · suma anual de mobiliario (lineal 10 años por defecto · `mueblesInmueble`)
 * - propertyAmortization · sigue leyéndose de `property.aeatAmortization`
 */
export const getMejoraAmortizationSummary = async (
  propertyId: number,
  exerciseYear: number
): Promise<{
  propertyAmortization: number;
  improvementAmortization: number;
  furnitureAmortization: number;
  repairExpenses: number;
  totalAmortization: number;
  details: Array<{
    mejora: Mejora;
    classification: MejoraClassification;
    amortization: ReturnType<typeof calculateMejoraAmortization>;
  }>;
}> => {
  const db = await initDB();

  const summary = {
    propertyAmortization: 0,
    improvementAmortization: 0,
    furnitureAmortization: 0,
    repairExpenses: 0,
    totalAmortization: 0,
    details: [] as Array<{
      mejora: Mejora;
      classification: MejoraClassification;
      amortization: ReturnType<typeof calculateMejoraAmortization>;
    }>,
  };

  // Mejoras / ampliaciones / reparaciones (canónico v62+)
  const mejorasRaw = await mejorasInmuebleService.getHastaEjercicio(propertyId, exerciseYear);
  for (const raw of mejorasRaw) {
    const mejora = mapMejoraInmuebleToLegacy(raw);
    const nature = mejora.tipo as MejoraNature;
    const classification = Mejora_CLASSIFICATION_RULES[nature] || Mejora_CLASSIFICATION_RULES.mejora;
    const amortization = calculateMejoraAmortization(mejora, exerciseYear);

    summary.details.push({ mejora, classification, amortization });

    switch (nature) {
      case 'reparacion':
        // Reparaciones · deducibles 100% el año del gasto
        summary.repairExpenses += amortization.annualAmortization;
        break;
      case 'mejora':
      case 'ampliacion':
        summary.improvementAmortization += amortization.annualAmortization;
        break;
    }
  }

  // Mobiliario (store independiente desde v62)
  const muebles = await mueblesInmuebleService.getPorInmueble(propertyId);
  for (const mueble of muebles) {
    const fechaAlta = new Date(mueble.fechaAlta);
    if (Number.isNaN(fechaAlta.getTime())) continue;
    const altaYear = fechaAlta.getFullYear();
    if (altaYear > exerciseYear) continue;
    if (mueble.fechaBaja) {
      const fechaBaja = new Date(mueble.fechaBaja);
      if (!Number.isNaN(fechaBaja.getTime()) && fechaBaja.getFullYear() < exerciseYear) continue;
    }
    const vidaUtil = mueble.vidaUtil || 10;
    const yearsSinceAlta = exerciseYear - altaYear;
    if (yearsSinceAlta >= vidaUtil) continue;
    summary.furnitureAmortization += mueble.importe / vidaUtil;
  }

  // Property base amortization (separate from improvements)
  const property = await db.get('properties', propertyId);
  if (property?.aeatAmortization?.propertyAmortization) {
    summary.propertyAmortization = property.aeatAmortization.propertyAmortization;
  }

  summary.totalAmortization = summary.propertyAmortization +
                             summary.improvementAmortization +
                             summary.furnitureAmortization;

  return summary;
};

/**
 * Create Mejora from document with enhanced classification
 */
export const createMejoraFromDocument = async (
  document: Document,
  nature?: MejoraNature
): Promise<number> => {
  // mejora store removed — no-op, return 0
  console.warn('[Mejora] createMejoraFromDocument: mejora store removed, skipping write for', document.filename);
  toast.success('Mejora clasificado (store mejora eliminado, usar mejorasInmueble)');
  return 0;
};

/**
 * Update Mejora classification
 */
export const updateMejoraClassification = async (
  mejoraId: number,
  newNature: MejoraNature
): Promise<void> => {
  // mejora store removed — no-op
  console.warn('[Mejora] updateMejoraClassification: mejora store removed, skipping update for', mejoraId);
  toast.success(`Mejora reclasificado (store mejora eliminado)`);
};

/**
 * Get Mejora classification breakdown for export
 */
export const getMejoraClassificationBreakdown = async (
  propertyId: number,
  exerciseYear: number
): Promise<{
  repairs: Mejora[];
  improvements: Mejora[];
  furniture: Mejora[];
  totalByType: {
    repairs: number;
    improvements: number;
    furniture: number;
  };
}> => {
  // mejora store removed — return empty breakdown
  const propertyMejora: Mejora[] = [];

  const breakdown = {
    repairs: [] as Mejora[],
    improvements: [] as Mejora[],
    furniture: [] as Mejora[],
    totalByType: {
      repairs: 0,
      improvements: 0,
      furniture: 0
    }
  };

  for (const mejora of propertyMejora) {
    switch (mejora.tipo as MejoraNature) {
      case 'reparacion':
        breakdown.repairs.push(mejora);
        breakdown.totalByType.repairs += mejora.total;
        break;
      case 'mejora':
      case 'ampliacion':
        breakdown.improvements.push(mejora);
        breakdown.totalByType.improvements += mejora.total;
        break;
      case 'mobiliario':
        breakdown.furniture.push(mejora);
        breakdown.totalByType.furniture += mejora.total;
        break;
    }
  }

  return breakdown;
};