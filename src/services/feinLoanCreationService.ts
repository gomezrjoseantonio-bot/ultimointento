// FEIN Loan Creation Service - Automatic loan draft creation from FEIN data
// Implements requirements for creating PrestamoFinanciacion from extracted FEIN data

import { FEINData, FEINProcessingResult } from '../types/fein';
import { PrestamoFinanciacion, BonificacionFinanciacion } from '../types/financiacion';
import { prestamosService } from './prestamosService';

export interface FEINLoanCreationResult {
  success: boolean;
  loanId?: string;
  errors: string[];
  warnings: string[];
  missingCriticalFields: string[];
}

export class FEINLoanCreationService {
  private static instance: FEINLoanCreationService;
  
  static getInstance(): FEINLoanCreationService {
    if (!FEINLoanCreationService.instance) {
      FEINLoanCreationService.instance = new FEINLoanCreationService();
    }
    return FEINLoanCreationService.instance;
  }

  /**
   * Create loan draft from FEIN data
   */
  async createLoanFromFEIN(
    feinData: FEINData,
    mapping: {
      alias?: string;
      ambito: 'PERSONAL' | 'INMUEBLE';
      inmuebleId?: string;
      cuentaCargoId: string;
    },
    attachmentUrl?: string
  ): Promise<FEINLoanCreationResult> {
    console.log('[FEIN Loan Creation] Starting loan creation from FEIN data');
    
    try {
      // Validate critical fields are present
      const validation = this.validateCriticalFields(feinData);
      if (!validation.isValid) {
        console.log('[FEIN Loan Creation] Critical fields missing:', validation.missingFields);
        return {
          success: false,
          errors: ['Faltan campos críticos para crear el préstamo'],
          warnings: [],
          missingCriticalFields: validation.missingFields
        };
      }

      // Map FEIN data to PrestamoFinanciacion
      const loanData = this.mapFEINToLoan(feinData, mapping);
      
      // Create the loan draft
      const loan = await prestamosService.createPrestamo({
        ...loanData,
        // Add FEIN metadata
        documentoFEIN: attachmentUrl,
        origenCreacion: 'FEIN',
        estadoInicial: 'BORRADOR'
      } as any);

      console.log(`[FEIN Loan Creation] Loan created successfully: ${loan.id}`);
      
      return {
        success: true,
        loanId: loan.id,
        errors: [],
        warnings: this.generateWarnings(feinData),
        missingCriticalFields: []
      };

    } catch (error) {
      console.error('[FEIN Loan Creation] Error creating loan:', error);
      return {
        success: false,
        errors: ['Error interno al crear el préstamo desde FEIN'],
        warnings: [],
        missingCriticalFields: []
      };
    }
  }

  /**
   * Validate that critical fields are present for loan creation
   */
  private validateCriticalFields(feinData: FEINData): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];
    
    if (!feinData.capitalInicial) missingFields.push('capital');
    if (!feinData.plazoAnos && !feinData.plazoMeses) missingFields.push('plazo');
    if (!feinData.tipo) missingFields.push('tipo_hipoteca');
    
    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Map FEIN data to PrestamoFinanciacion structure
   */
  private mapFEINToLoan(feinData: FEINData, mapping: any): Partial<PrestamoFinanciacion> {
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate plazo in months
    let plazoTotal = 0;
    let plazoPeriodo: 'MESES' | 'AÑOS' = 'MESES';
    
    if (feinData.plazoAnos) {
      plazoTotal = feinData.plazoAnos;
      plazoPeriodo = 'AÑOS';
    } else if (feinData.plazoMeses) {
      plazoTotal = feinData.plazoMeses;
      plazoPeriodo = 'MESES';
    }

    const loanData: Partial<PrestamoFinanciacion> = {
      alias: mapping.alias || `Préstamo FEIN ${feinData.bancoEntidad || 'Banco'}`,
      ambito: mapping.ambito,
      inmuebleId: mapping.inmuebleId,
      cuentaCargoId: mapping.cuentaCargoId,
      
      fechaFirma: today,
      fechaPrimerCargo: feinData.fechaPrimerPago || today,
      diaCobroMes: 1, // Default, user can modify
      esquemaPrimerRecibo: 'NORMAL',
      
      // Financial data from FEIN
      capitalInicial: feinData.capitalInicial!,
      plazoTotal,
      plazoPeriodo,
      carencia: 'NINGUNA',
      tipo: feinData.tipo!,
      sistema: 'FRANCES',
      
      // Interest rates
      tinFijo: feinData.tipo === 'FIJO' ? feinData.tin : undefined,
      indice: this.mapIndexType(feinData.indice),
      diferencial: feinData.diferencial,
      revision: feinData.periodicidadRevision === 6 ? 6 : 12,
      
      // Mixed rate
      tramoFijoAnos: feinData.tramoFijoAnos,
      tinTramoFijo: feinData.tipo === 'MIXTO' ? feinData.tin : undefined,
      
      // Commissions
      comisionApertura: feinData.comisionApertura,
      comisionAmortizacionAnticipada: feinData.comisionAmortizacionParcial,
      
      // Bonifications
      bonificaciones: this.mapBonificaciones(feinData.bonificaciones || [])
    };

    return loanData;
  }

  /**
   * Map FEIN index to loan index type
   */
  private mapIndexType(indice?: string): 'EURIBOR' | 'OTRO' | undefined {
    if (!indice) return undefined;
    return indice.includes('EURIBOR') ? 'EURIBOR' : 'OTRO';
  }

  /**
   * Map FEIN bonifications to loan bonifications
   */
  private mapBonificaciones(feinBonificaciones: any[]): BonificacionFinanciacion[] {
    return feinBonificaciones.map((bonif, index) => ({
      id: `fein_bonif_${index}`,
      tipo: bonif.tipo,
      nombre: bonif.descripcion,
      condicionParametrizable: bonif.condicion || bonif.descripcion,
      descuentoTIN: bonif.descuento || 0,
      ventanaEvaluacion: 6,
      fuenteVerificacion: this.mapVerificationSource(bonif.tipo),
      estadoInicial: 'NO_CUMPLE',
      activa: true
    }));
  }

  /**
   * Map bonification type to verification source
   */
  private mapVerificationSource(tipo: string): 'TESORERIA' | 'SEGUROS' | 'MANUAL' {
    switch (tipo) {
      case 'NOMINA':
      case 'RECIBOS':
      case 'TARJETA':
      case 'INGRESOS_RECURRENTES':
        return 'TESORERIA';
      case 'SEGURO_HOGAR':
      case 'SEGURO_VIDA':
        return 'SEGUROS';
      default:
        return 'MANUAL';
    }
  }

  /**
   * Generate warnings for incomplete or unusual data
   */
  private generateWarnings(feinData: FEINData): string[] {
    const warnings: string[] = [];
    
    if (!feinData.tae && feinData.tin) {
      warnings.push('TAE no detectada - solo se extrajo TIN');
    }
    
    if (feinData.tipo === 'VARIABLE' && !feinData.periodicidadRevision) {
      warnings.push('Préstamo variable sin periodicidad de revisión detectada');
    }
    
    if (feinData.cuentaCargoIban && feinData.ibanMascarado) {
      warnings.push('IBAN de cuenta de cargo está parcialmente enmascarado');
    }
    
    if (!feinData.bonificaciones || feinData.bonificaciones.length === 0) {
      warnings.push('No se detectaron bonificaciones en la FEIN');
    }
    
    return warnings;
  }
}

export const feinLoanCreationService = FEINLoanCreationService.getInstance();