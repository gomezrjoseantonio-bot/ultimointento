// Bonificaciones Service - Logic for applying bonifications intent during loan creation
// Implements the applyIntent method as specified in the problem statement

import { BonificacionFinanciacion, PrestamoFinanciacion } from '../types/financiacion';

export interface ApplyIntentResult {
  tinResult?: number;          // For FIJO loans
  difResult?: number;          // For VARIABLE loans
  sumaPuntosAplicada: number;  // Total points applied (capped)
  proximoCambio?: {           // Next expected change
    fecha: string;
    tipo: 'FIN_PROMO' | 'REVISION_ANUAL';
    descripcion: string;
  };
  bonificacionesAplicadas: BonificacionFinanciacion[]; // Actually applied bonifications
  incompatibilidadesResueltas: string[]; // Messages about resolved incompatibilities
}

export class BonificacionesService {
  
  /**
   * Apply bonifications intent during loan creation (alta)
   * Implements the logic specified in the problem statement
   */
  applyIntent(
    prestamo: PrestamoFinanciacion,
    asOfDate: Date = new Date()
  ): ApplyIntentResult {
    
    // 1. Take selected bonifications (seleccionado === true)
    const bonificacionesSeleccionadas = (prestamo.bonificaciones || [])
      .filter(b => b.seleccionado === true);
    
    // 2. Apply grace periods if graciaMeses > 0
    const bonificacionesConGracia = bonificacionesSeleccionadas.map(b => {
      const bonificacion = { ...b };
      if (b.graciaMeses && b.graciaMeses > 0) {
        // Mark as ACTIVO_POR_GRACIA during grace period
        bonificacion.estadoInicial = 'GRACIA_ACTIVA';
      }
      return bonificacion;
    });
    
    // 3. Resolve incompatibilities (keep highest impact)
    const { bonificacionesCompatibles, incompatibilidadesResueltas } = 
      this.resolveIncompatibilities(bonificacionesConGracia);
    
    // 4. Sum points and apply cap (−1,00 p.p.)
    const topeMaximo = 1.00; // Maximum 1.00 percentage points
    const sumaPuntos = bonificacionesCompatibles.reduce((sum, b) => 
      sum + (b.impacto?.puntos || b.descuentoTIN), 0);
    const sumaPuntosAplicada = Math.min(sumaPuntos, topeMaximo);
    
    // 5. Apply floors based on loan type
    const tinBase = this.calculateBaseTIN(prestamo);
    const difBase = this.calculateBaseDifferential(prestamo);
    
    let tinResult: number | undefined;
    let difResult: number | undefined;
    
    if (prestamo.tipo === 'FIJO') {
      const tinMin = 1.00; // 1,00% minimum for FIJO
      tinResult = Math.max(tinBase - sumaPuntosAplicada, tinMin);
    } else if (prestamo.tipo === 'VARIABLE') {
      const diferencialMin = 0.40; // 0,40% minimum for VARIABLE
      difResult = Math.max(difBase - sumaPuntosAplicada, diferencialMin);
    } else if (prestamo.tipo === 'MIXTO') {
      // Apply to the current section (simplified for now)
      const tinMin = 1.00;
      tinResult = Math.max(tinBase - sumaPuntosAplicada, tinMin);
    }
    
    // 6. Calculate next expected change
    const proximoCambio = this.calculateNextChange(prestamo, bonificacionesCompatibles, asOfDate);
    
    return {
      tinResult,
      difResult,
      sumaPuntosAplicada,
      proximoCambio,
      bonificacionesAplicadas: bonificacionesCompatibles,
      incompatibilidadesResueltas
    };
  }
  
  /**
   * Resolve incompatibilities between bonifications
   */
  private resolveIncompatibilities(bonificaciones: BonificacionFinanciacion[]): {
    bonificacionesCompatibles: BonificacionFinanciacion[];
    incompatibilidadesResueltas: string[];
  } {
    const incompatibilidadesResueltas: string[] = [];
    const bonificacionesCompatibles: BonificacionFinanciacion[] = [];
    
    // Group conflicting bonifications
    const tarjetaCredito = bonificaciones.filter(b => b.tipo === 'TARJETA' && b.nombre.toLowerCase().includes('crédito'));
    const tarjetaDebito = bonificaciones.filter(b => b.tipo === 'TARJETA' && b.nombre.toLowerCase().includes('débito'));
    const seguros = bonificaciones.filter(b => b.tipo === 'SEGURO_HOGAR' || b.tipo === 'SEGURO_VIDA');
    const otros = bonificaciones.filter(b => 
      !['TARJETA'].includes(b.tipo) && 
      !['SEGURO_HOGAR', 'SEGURO_VIDA'].includes(b.tipo)
    );
    
    // Resolve TARJETA conflicts (keep higher impact)
    if (tarjetaCredito.length > 0 && tarjetaDebito.length > 0) {
      const mejorTarjeta = [...tarjetaCredito, ...tarjetaDebito]
        .sort((a, b) => (b.impacto?.puntos || b.descuentoTIN) - (a.impacto?.puntos || a.descuentoTIN))[0];
      bonificacionesCompatibles.push(mejorTarjeta);
      
      const descartadas = [...tarjetaCredito, ...tarjetaDebito].filter(t => t.id !== mejorTarjeta.id);
      if (descartadas.length > 0) {
        incompatibilidadesResueltas.push(
          `Aplicamos ${mejorTarjeta.nombre} y desactivamos ${descartadas.map(d => d.nombre).join(', ')} por incompatibilidad`
        );
      }
    } else {
      bonificacionesCompatibles.push(...tarjetaCredito, ...tarjetaDebito);
    }
    
    // Add other non-conflicting bonifications
    bonificacionesCompatibles.push(...otros, ...seguros);
    
    return { bonificacionesCompatibles, incompatibilidadesResueltas };
  }
  
  /**
   * Calculate base TIN for the loan
   */
  private calculateBaseTIN(prestamo: PrestamoFinanciacion): number {
    if (prestamo.tipo === 'FIJO') {
      return prestamo.tinFijo || 0;
    } else if (prestamo.tipo === 'VARIABLE') {
      return (prestamo.valorIndice || 0) + (prestamo.diferencial || 0);
    } else if (prestamo.tipo === 'MIXTO') {
      // For MIXTO, return the fixed section TIN (simplified)
      return prestamo.tinTramoFijo || 0;
    }
    return 0;
  }
  
  /**
   * Calculate base differential for variable loans
   */
  private calculateBaseDifferential(prestamo: PrestamoFinanciacion): number {
    if (prestamo.tipo === 'VARIABLE') {
      return prestamo.diferencial || 0;
    }
    return 0;
  }
  
  /**
   * Calculate next expected change date
   */
  private calculateNextChange(
    prestamo: PrestamoFinanciacion,
    bonificaciones: BonificacionFinanciacion[],
    asOfDate: Date
  ): { fecha: string; tipo: 'FIN_PROMO' | 'REVISION_ANUAL'; descripcion: string } | undefined {
    
    // Check if any bonification has grace period
    const bonificacionesConGracia = bonificaciones.filter(b => b.graciaMeses && b.graciaMeses > 0);
    
    if (bonificacionesConGracia.length > 0) {
      // Find the earliest grace period end
      const maxGraciaMeses = Math.max(...bonificacionesConGracia.map(b => b.graciaMeses || 0));
      const fechaFirma = new Date(prestamo.fechaFirma);
      const fechaFinGracia = new Date(fechaFirma);
      fechaFinGracia.setMonth(fechaFinGracia.getMonth() + maxGraciaMeses);
      
      return {
        fecha: fechaFinGracia.toISOString().split('T')[0],
        tipo: 'FIN_PROMO',
        descripcion: `Fin de promoción (${maxGraciaMeses} meses de gracia)`
      };
    }
    
    // If variable or mixed loan, calculate annual review
    if (prestamo.tipo === 'VARIABLE' || prestamo.tipo === 'MIXTO') {
      const fechaFirma = new Date(prestamo.fechaFirma);
      const fechaRevisionAnual = new Date(fechaFirma);
      fechaRevisionAnual.setFullYear(fechaRevisionAnual.getFullYear() + 1);
      
      return {
        fecha: fechaRevisionAnual.toISOString().split('T')[0],
        tipo: 'REVISION_ANUAL',
        descripcion: 'Revisión anual de condiciones'
      };
    }
    
    return undefined;
  }
  
  /**
   * Get standard bonifications templates
   */
  getStandardBonifications(): BonificacionFinanciacion[] {
    return [
      {
        id: 'nomina',
        tipo: 'NOMINA',
        nombre: 'Nómina',
        condicionParametrizable: 'Domiciliación de nómina ≥ 1.200€/mes',
        descuentoTIN: 0.30,
        impacto: { puntos: 0.30 },
        aplicaEn: 'FIJO',
        ventanaEvaluacion: 6,
        fuenteVerificacion: 'TESORERIA',
        estadoInicial: 'NO_CUMPLE',
        seleccionado: false,
        graciaMeses: 0,
        activa: false
      },
      {
        id: 'recibos',
        tipo: 'RECIBOS',
        nombre: 'Recibos',
        condicionParametrizable: 'Domiciliación de ≥ 3 recibos/mes',
        descuentoTIN: 0.15,
        impacto: { puntos: 0.15 },
        aplicaEn: 'FIJO',
        ventanaEvaluacion: 3,
        fuenteVerificacion: 'TESORERIA',
        estadoInicial: 'NO_CUMPLE',
        seleccionado: false,
        graciaMeses: 0,
        activa: false
      },
      {
        id: 'seguro_hogar',
        tipo: 'SEGURO_HOGAR',
        nombre: 'Seguro Hogar',
        condicionParametrizable: 'Seguro hogar contratado con la entidad',
        descuentoTIN: 0.20,
        impacto: { puntos: 0.20 },
        aplicaEn: 'FIJO',
        ventanaEvaluacion: 12,
        fuenteVerificacion: 'SEGUROS',
        estadoInicial: 'NO_CUMPLE',
        seleccionado: false,
        graciaMeses: 0,
        activa: false
      },
      {
        id: 'seguro_vida',
        tipo: 'SEGURO_VIDA',
        nombre: 'Seguro Vida',
        condicionParametrizable: 'Seguro vida contratado con la entidad',
        descuentoTIN: 0.15,
        impacto: { puntos: 0.15 },
        aplicaEn: 'FIJO',
        ventanaEvaluacion: 12,
        fuenteVerificacion: 'SEGUROS',
        estadoInicial: 'NO_CUMPLE',
        seleccionado: false,
        graciaMeses: 0,
        activa: false
      },
      {
        id: 'tarjeta_credito',
        tipo: 'TARJETA',
        nombre: 'Tarjeta Crédito',
        condicionParametrizable: 'Tarjeta crédito con uso ≥ 300€/mes',
        descuentoTIN: 0.10,
        impacto: { puntos: 0.10 },
        aplicaEn: 'FIJO',
        ventanaEvaluacion: 3,
        fuenteVerificacion: 'TESORERIA',
        estadoInicial: 'NO_CUMPLE',
        seleccionado: false,
        graciaMeses: 0,
        activa: false
      },
      {
        id: 'tarjeta_debito',
        tipo: 'TARJETA',
        nombre: 'Tarjeta Débito',
        condicionParametrizable: 'Tarjeta débito con uso ≥ 150€/mes',
        descuentoTIN: 0.05,
        impacto: { puntos: 0.05 },
        aplicaEn: 'FIJO',
        ventanaEvaluacion: 3,
        fuenteVerificacion: 'TESORERIA',
        estadoInicial: 'NO_CUMPLE',
        seleccionado: false,
        graciaMeses: 0,
        activa: false
      },
      {
        id: 'pensiones',
        tipo: 'PLAN_PENSIONES',
        nombre: 'Plan de Pensiones',
        condicionParametrizable: 'Plan pensiones con aportación ≥ 100€/mes',
        descuentoTIN: 0.25,
        impacto: { puntos: 0.25 },
        aplicaEn: 'FIJO',
        ventanaEvaluacion: 6,
        fuenteVerificacion: 'MANUAL',
        estadoInicial: 'NO_CUMPLE',
        seleccionado: false,
        graciaMeses: 0,
        activa: false
      },
      {
        id: 'alarma',
        tipo: 'ALARMA',
        nombre: 'Alarma',
        condicionParametrizable: 'Sistema alarma contratado',
        descuentoTIN: 0.10,
        impacto: { puntos: 0.10 },
        aplicaEn: 'FIJO',
        ventanaEvaluacion: 12,
        fuenteVerificacion: 'MANUAL',
        estadoInicial: 'NO_CUMPLE',
        seleccionado: false,
        graciaMeses: 0,
        activa: false
      }
    ];
  }
}

export const bonificacionesService = new BonificacionesService();