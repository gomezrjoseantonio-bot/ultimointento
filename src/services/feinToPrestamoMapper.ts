// FEIN to Prestamo Mapping Service
// Converts canonical FEIN data to PrestamoFinanciacion format for wizard prefill

import { FEINCanonicalData } from '../types/fein';
import { PrestamoFinanciacion } from '../types/financiacion';

export class FEINToPrestamoMappingService {
  private static instance: FEINToPrestamoMappingService;
  
  static getInstance(): FEINToPrestamoMappingService {
    if (!FEINToPrestamoMappingService.instance) {
      FEINToPrestamoMappingService.instance = new FEINToPrestamoMappingService();
    }
    return FEINToPrestamoMappingService.instance;
  }

  /**
   * Map FEIN canonical data to PrestamoFinanciacion format
   * Following exact requirements from problem statement
   */
  mapFEINToLoan(feinData: FEINCanonicalData, userSelections: {
    ambito: 'PERSONAL' | 'INMUEBLE';
    inmuebleId?: string;
    cuentaCargoId: string;
    alias?: string;
    fechaFirma?: string;
    fechaPrimerCargo?: string;
  }): Partial<PrestamoFinanciacion> {
    
    const now = new Date();
    const defaultFirma = now.toISOString().split('T')[0];
    const defaultCargo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days from now
    
    const mappedLoan: Partial<PrestamoFinanciacion> = {
      // Step 1: Identification & Account Selection
      ambito: userSelections.ambito,
      inmuebleId: userSelections.inmuebleId,
      cuentaCargoId: userSelections.cuentaCargoId,
      alias: userSelections.alias || feinData.prestamo.alias,
      fechaFirma: userSelections.fechaFirma || defaultFirma,
      fechaPrimerCargo: userSelections.fechaPrimerCargo || defaultCargo,
      diaCobroMes: 1, // Default to 1st of month
      esquemaPrimerRecibo: 'NORMAL', // Default scheme
      
      // Step 2: Financial Conditions
      capitalInicial: feinData.prestamo.capitalInicial,
      plazoTotal: feinData.prestamo.plazoMeses,
      plazoPeriodo: 'MESES',
      carencia: feinData.prestamo.carencia,
      carenciaMeses: undefined, // Set if carencia !== 'NINGUNA'
      
      tipo: feinData.prestamo.tipo,
      sistema: 'FRANCES', // Always French system as per requirements
      
      // Fixed rate mapping
      ...(feinData.prestamo.tipo === 'FIJO' && feinData.prestamo.fijo && {
        tinFijo: this.convertToDecimal(feinData.prestamo.fijo.tinFijoPrc)
      }),
      
      // Variable rate mapping
      ...(feinData.prestamo.tipo === 'VARIABLE' && feinData.prestamo.variable && {
        indice: feinData.prestamo.variable.indice === 'EURIBOR' ? 'EURIBOR' : 'OTRO',
        valorIndice: this.convertToDecimal(feinData.prestamo.variable.valorIndiceActualPrc),
        diferencial: this.convertToDecimal(feinData.prestamo.variable.diferencialPrc),
        revision: feinData.prestamo.variable.revisionMeses as 6 | 12
      }),
      
      // Mixed rate mapping
      ...(feinData.prestamo.tipo === 'MIXTO' && feinData.prestamo.mixto && {
        tramoFijoAnos: feinData.prestamo.mixto.tramoFijoAnios,
        tinTramoFijo: this.convertToDecimal(feinData.prestamo.mixto.tinFijoTramoPrc),
        indice: feinData.prestamo.mixto.posteriorVariable.indice === 'EURIBOR' ? 'EURIBOR' : 'OTRO',
        diferencial: this.convertToDecimal(feinData.prestamo.mixto.posteriorVariable.diferencialPrc),
        revision: feinData.prestamo.mixto.posteriorVariable.revisionMeses as 6 | 12
      }),
      
      // Commissions mapping
      comisionApertura: this.convertToDecimal(feinData.prestamo.comisiones.aperturaPrc),
      comisionMantenimiento: feinData.prestamo.comisiones.mantenimientoMes,
      comisionAmortizacionAnticipada: this.convertToDecimal(feinData.prestamo.comisiones.amortizacionAnticipadaPrc),
      
      // Bonifications mapping
      bonificaciones: feinData.prestamo.bonificaciones.map((b, index) => ({
        id: `fein-bonif-${index}`,
        tipo: b.tipo,
        nombre: this.getBonificationDescription(b.tipo),
        condicionParametrizable: this.getBonificationCondition(b.tipo),
        descuentoTIN: Math.abs(b.pp), // Convert back to positive value for display
        ventanaEvaluacion: 6, // Default evaluation window
        fuenteVerificacion: 'MANUAL' as const, // FEIN bonifications are manual verification
        estadoInicial: b.estado === 'CUMPLE' ? 'CUMPLE' as const : 'NO_CUMPLE' as const,
        activa: b.estado === 'CUMPLE' // Only active if already compliant
      })),
      
      // Audit fields
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    return mappedLoan;
  }

  /**
   * Get human-readable condition description for bonification types
   */
  private getBonificationCondition(tipo: string): string {
    const conditions: Record<string, string> = {
      'NOMINA': 'Domiciliación de nómina por importe ≥ 2.000€',
      'RECIBOS': 'Domiciliación de ≥ 3 recibos en últimos 6 meses',
      'TARJETA': 'Uso de tarjeta ≥ 10 operaciones/mes',
      'SEGURO_HOGAR': 'Contratación de seguro del hogar',
      'SEGURO_VIDA': 'Contratación de seguro de vida',
      'ALARMA': 'Contratación de sistema de alarma',
      'PLAN_PENSIONES': 'Aportación plan de pensiones ≥ 300€/año',
      'INGRESOS_RECURRENTES': 'Ingresos recurrentes ≥ 2.500€/mes'
    };
    
    return conditions[tipo] || 'Condición no especificada';
  }

  /**
   * Convert percentage from human format (2.95) to decimal format (0.0295)
   * As per requirements: "Porcentajes: entrada/almacenado humanos (ej. 2.95 ≡ 2,95 %). No guardar en formato 0.0295"
   * But PrestamoFinanciacion uses decimal format internally
   */
  private convertToDecimal(percentage: number): number {
    if (percentage > 1) {
      return percentage / 100; // Convert 2.95 -> 0.0295
    }
    return percentage; // Already in decimal format
  }

  /**
   * Get human-readable description for bonification types
   */
  private getBonificationDescription(tipo: string): string {
    const descriptions: Record<string, string> = {
      'NOMINA': 'Domiciliación de nómina',
      'RECIBOS': 'Domiciliación de recibos',
      'TARJETA': 'Uso de tarjeta',
      'SEGURO_HOGAR': 'Seguro del hogar',
      'SEGURO_VIDA': 'Seguro de vida',
      'ALARMA': 'Sistema de alarma',
      'PLAN_PENSIONES': 'Plan de pensiones',
      'INGRESOS_RECURRENTES': 'Ingresos recurrentes'
    };
    
    return descriptions[tipo] || tipo;
  }

  /**
   * Validate if FEIN data has minimum required fields for loan creation
   */
  validateRequiredFields(feinData: FEINCanonicalData): {
    isValid: boolean;
    missing: string[];
    warnings: string[];
  } {
    const missing: string[] = [];
    const warnings: string[] = [];
    
    // Critical fields
    if (!feinData.prestamo.capitalInicial || feinData.prestamo.capitalInicial <= 0) {
      missing.push('Capital inicial');
    }
    
    if (!feinData.prestamo.plazoMeses || feinData.prestamo.plazoMeses <= 0) {
      missing.push('Plazo');
    }
    
    if (!feinData.prestamo.tipo) {
      missing.push('Tipo de préstamo');
    }
    
    // Type-specific validations
    if (feinData.prestamo.tipo === 'FIJO' && !feinData.prestamo.fijo?.tinFijoPrc) {
      missing.push('TIN fijo');
    }
    
    if (feinData.prestamo.tipo === 'VARIABLE' && !feinData.prestamo.variable?.diferencialPrc) {
      missing.push('Diferencial variable');
    }
    
    if (feinData.prestamo.tipo === 'MIXTO' && 
        (!feinData.prestamo.mixto?.tinFijoTramoPrc || !feinData.prestamo.mixto?.posteriorVariable?.diferencialPrc)) {
      missing.push('Condiciones préstamo mixto');
    }
    
    // Warnings for incomplete data
    if (!feinData.prestamo.cuentaCargo.iban) {
      warnings.push('IBAN de cuenta de cargo no identificado');
    }
    
    if (!feinData.prestamo.cuentaCargo.banco) {
      warnings.push('Banco no identificado');
    }
    
    if (feinData.prestamo.bonificaciones.length === 0) {
      warnings.push('No se detectaron bonificaciones');
    }
    
    return {
      isValid: missing.length === 0,
      missing,
      warnings
    };
  }
}

export const feinToPrestamoMapper = FEINToPrestamoMappingService.getInstance();