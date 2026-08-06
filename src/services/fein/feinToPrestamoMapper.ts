// FEIN to PrestamoFinanciacion Mapper
// Converts FeinLoanDraft to PrestamoFinanciacion format for form pre-filling

import { FeinLoanDraft } from '../../types/fein';
import { PrestamoFinanciacion, BonificacionFinanciacion } from '../../types/financiacion';

export class FeinToPrestamoMapper {
  
  /**
   * Convert FeinLoanDraft to Partial<PrestamoFinanciacion> for form initialization
   */
  static mapToPrestamoFinanciacion(
    feinDraft: FeinLoanDraft,
    defaultAccountId?: string
  ): Partial<PrestamoFinanciacion> {
    // Base mapping with defaults
    const mappedData: Partial<PrestamoFinanciacion> = {
      // Default values required by form
      ambito: 'PERSONAL', // User can change this
      esquemaPrimerRecibo: 'NORMAL',
      sistema: 'FRANCES',
      carencia: 'NINGUNA',

      // La fecha de firma, SOLO si la FEIN la trae · poner hoy era inventarse
      // el dato del que cuelga todo el cuadro, y encima con aspecto de leído.
      // Ausente, el formulario ya sabe qué hacer.
      fechaFirma: feinDraft.prestamo.fechaFirmaPrevista || undefined,

      // `fechaPrimerCargo` y `diaCobroMes` NO se rellenan aquí. Se ponían a la
      // fecha de firma y al día 1: dos datos falsos, y de los dos sale la
      // primera cuota. La FEIN no los dice —los dice la escritura—, y lo que no
      // está en el papel no se escribe.

      // Loan identification
      alias: feinDraft.prestamo.aliasSugerido || `Préstamo ${feinDraft.prestamo.banco || 'FEIN'}`,
      
      // Core financial data from FEIN
      capitalInicial: feinDraft.prestamo.capitalInicial || undefined,
      plazoTotal: feinDraft.prestamo.plazoMeses || undefined,
      plazoPeriodo: 'MESES' as const,
      
      // Interest type and rates
      tipo: this.mapTipo(feinDraft.prestamo.tipo),
      tinFijo: feinDraft.prestamo.tinFijo || undefined,
      
      // Variable/Mixed specific
      indice: this.mapIndice(feinDraft.prestamo.indiceReferencia || null),
      diferencial: feinDraft.prestamo.diferencial || undefined,
      revision: feinDraft.prestamo.revisionMeses || 12,
      
      // Mixed specific
      tramoFijoAnos: undefined, // TODO: Extract from FEIN if available
      tinTramoFijo: feinDraft.prestamo.tipo === 'MIXTO' ? (feinDraft.prestamo.tinFijo || undefined) : undefined,
      
      // Commissions
      comisionApertura: feinDraft.prestamo.comisionAperturaPct || undefined,
      // Se leía y se tiraba · va en EUROS AL MES, no en porcentaje.
      comisionMantenimiento: feinDraft.prestamo.comisionMantenimientoMes || undefined,
      comisionAmortizacionAnticipada: feinDraft.prestamo.amortizacionAnticipadaPct || undefined,
      
      // Account - use default if provided, otherwise user will need to select
      cuentaCargoId: defaultAccountId,
      
      // Bonifications
      bonificaciones: this.mapBonificaciones(feinDraft.bonificaciones || [])
    };

    // Remove undefined values to keep form clean
    return Object.fromEntries(
      Object.entries(mappedData).filter(([_, value]) => value !== undefined)
    ) as Partial<PrestamoFinanciacion>;
  }

  /**
   * Map FEIN loan type to PrestamoFinanciacion type
   */
  private static mapTipo(feinTipo: 'FIJO' | 'VARIABLE' | 'MIXTO' | null): 'FIJO' | 'VARIABLE' | 'MIXTO' | undefined {
    return feinTipo || undefined;
  }

  /**
   * Map FEIN index reference to PrestamoFinanciacion index
   */
  private static mapIndice(feinIndice: 'EURIBOR' | 'IRPH' | null): 'EURIBOR' | 'OTRO' | undefined {
    if (!feinIndice) return undefined;
    return feinIndice === 'EURIBOR' ? 'EURIBOR' : 'OTRO';
  }

  /**
   * Map FEIN bonifications to PrestamoFinanciacion bonifications
   */
  private static mapBonificaciones(
    feinBonificaciones: NonNullable<FeinLoanDraft['bonificaciones']>
  ): BonificacionFinanciacion[] {
    return feinBonificaciones.map((bonif, index) => ({
      id: `fein_${bonif.id}_${index}`,
      tipo: this.mapBonificationType(bonif.id),
      nombre: bonif.etiqueta,
      condicionParametrizable: bonif.criterio || bonif.etiqueta,
      // En PUNTOS PORCENTUALES, tal como los da la FEIN y tal como los espera
      // `descuentoTIN` (financiacion.ts:70). Aquí se dividían entre 100, así que
      // el bloque de haberes de Unicaja —0,500000 p.p. en su FEIN— aterrizaba
      // como 0,005 p.p.: una bonificación cien veces más pequeña, o sea ninguna.
      descuentoTIN: bonif.descuentoPuntos ?? 0,
      impacto: { puntos: bonif.descuentoPuntos ?? 0 },
      ventanaEvaluacion: 6, // Default 6 months evaluation window
      fuenteVerificacion: this.mapVerificationSource(bonif.id),
      estadoInicial: 'NO_CUMPLE' as const, // Default to not met
      seleccionado: false,
      graciaMeses: 0 as const,
      activa: true
    }));
  }

  /**
   * Map FEIN bonification ID to PrestamoFinanciacion bonification type
   */
  private static mapBonificationType(bonifId: string): 'NOMINA' | 'RECIBOS' | 'TARJETA' | 'SEGURO_HOGAR' | 'SEGURO_VIDA' | 'PLAN_PENSIONES' | 'ALARMA' | 'INGRESOS_RECURRENTES' | 'OTROS' {
    const mapping: Record<string, 'NOMINA' | 'RECIBOS' | 'TARJETA' | 'SEGURO_HOGAR' | 'SEGURO_VIDA' | 'PLAN_PENSIONES' | 'ALARMA' | 'INGRESOS_RECURRENTES' | 'OTROS'> = {
      nomina: 'NOMINA',
      recibos: 'RECIBOS',
      tarjeta: 'TARJETA',
      hogar: 'SEGURO_HOGAR',
      vida: 'SEGURO_VIDA',
      pensiones: 'PLAN_PENSIONES',
      alarma: 'ALARMA'
    };
    
    return mapping[bonifId] || 'OTROS';
  }

  /**
   * Map bonification type to verification source
   */
  private static mapVerificationSource(bonifId: string): 'TESORERIA' | 'SEGUROS' | 'MANUAL' {
    if (['nomina', 'recibos', 'tarjeta'].includes(bonifId)) {
      return 'TESORERIA';
    } else if (['hogar', 'vida'].includes(bonifId)) {
      return 'SEGUROS';
    } else {
      return 'MANUAL';
    }
  }

  /**
   * Generate suggestions and warnings for the mapped data
   */
  static generateMappingInfo(feinDraft: FeinLoanDraft): {
    suggestions: string[];
    warnings: string[];
    missingFields: string[];
  } {
    const suggestions: string[] = [];
    const warnings: string[] = [];
    const missingFields: string[] = [];

    // Check critical fields
    if (!feinDraft.prestamo.capitalInicial) {
      missingFields.push('Capital inicial');
      warnings.push('Deberás introducir manualmente el capital del préstamo');
    }

    if (!feinDraft.prestamo.plazoMeses) {
      missingFields.push('Plazo');
      warnings.push('Deberás introducir manualmente el plazo del préstamo');
    }

    if (!feinDraft.prestamo.tipo) {
      missingFields.push('Tipo de interés');
      warnings.push('Deberás seleccionar el tipo de interés (Fijo/Variable/Mixto)');
    }

    // Check account selection
    missingFields.push('Cuenta de cargo');
    suggestions.push('Selecciona la cuenta de cargo desde tus cuentas guardadas');

    // Check property assignment for mortgages
    suggestions.push('Si es una hipoteca, asigna el inmueble correspondiente');

    // Bonifications info
    if (feinDraft.bonificaciones && feinDraft.bonificaciones.length > 0) {
      suggestions.push(`Se detectaron ${feinDraft.bonificaciones.length} bonificaciones. Revisa las condiciones.`);
    }

    // Processing info
    if (feinDraft.metadata.warnings && feinDraft.metadata.warnings.length > 0) {
      warnings.push(...feinDraft.metadata.warnings);
    }

    return { suggestions, warnings, missingFields };
  }
}