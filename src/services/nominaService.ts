import { initDB } from './db';
import { 
  Nomina, 
  Variable, 
  ReglaDia, 
  RetencionNomina,
  CalculoNominaResult,
  DistribucionMensualResult
} from '../types/personal';
import { getBaseMaxima, getSSDefaults } from '../constants/cotizacionSS';

class NominaService {
  private db: any = null;

  private async getDB() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  /**
   * Apply defaults to a nomina loaded from the database (backward compatibility)
   */
  private applyDefaults(nomina: any): Nomina {
    const now = new Date().toISOString();
    const currentYear = new Date().getFullYear();
    const ssConfig = getSSDefaults(currentYear);

    // Migrate old retencion format { irpfPorcentaje, cotizacionSS } → new RetencionNomina
    let retencion: RetencionNomina;
    if (nomina.retencion && typeof (nomina.retencion as any).cotizacionSS === 'number') {
      retencion = {
        irpfPorcentaje: nomina.retencion.irpfPorcentaje ?? 24,
        ss: {
          baseCotizacionMensual: getBaseMaxima(currentYear),
          contingenciasComunes: ssConfig.contingenciasComunes.trabajador,
          desempleo: ssConfig.desempleo.trabajador,
          formacionProfesional: ssConfig.formacionProfesional.trabajador,
          mei: ssConfig.mei.trabajador,
          overrideManual: false,
        },
      };
    } else if (nomina.retencion && nomina.retencion.ss) {
      retencion = nomina.retencion as RetencionNomina;
    } else {
      retencion = {
        irpfPorcentaje: 24,
        ss: {
          baseCotizacionMensual: getBaseMaxima(currentYear),
          contingenciasComunes: ssConfig.contingenciasComunes.trabajador,
          desempleo: ssConfig.desempleo.trabajador,
          formacionProfesional: ssConfig.formacionProfesional.trabajador,
          mei: ssConfig.mei.trabajador,
          overrideManual: false,
        },
      };
    }

    return {
      ...nomina,
      titular: nomina.titular ?? 'yo',
      fechaAntiguedad: nomina.fechaAntiguedad ?? nomina.fechaCreacion ?? now,
      beneficiosSociales: nomina.beneficiosSociales ?? [],
      deduccionesAdicionales: nomina.deduccionesAdicionales ?? [],
      retencion,
    } satisfies Nomina;
  }

  /**
   * Get all nominas for a personal data ID
   */
  async getNominas(personalDataId: number): Promise<Nomina[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['nominas'], 'readonly');
      const store = transaction.objectStore('nominas');
      const index = store.index('personalDataId');
      const nominas = await index.getAll(personalDataId);
      return (nominas || []).map((n: any) => this.applyDefaults(n));
    } catch (error) {
      console.error('Error getting nominas:', error);
      return [];
    }
  }

  /**
   * Get all active nominas across all personal data IDs (with defaults applied)
   */
  async getAllActiveNominas(): Promise<Nomina[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(['nominas'], 'readonly');
      const store = transaction.objectStore('nominas');
      const allNominas = await store.getAll();
      return (allNominas || [])
        .filter((n: any) => n.activa === true)
        .map((n: any) => this.applyDefaults(n));
    } catch (error) {
      console.error('Error getting all active nominas:', error);
      return [];
    }
  }

  /**
   * Get active nomina for a personal data ID
   */
  async getActivaNomina(personalDataId: number): Promise<Nomina | null> {
    try {
      const nominas = await this.getNominas(personalDataId);
      return nominas.find(n => n.activa) || null;
    } catch (error) {
      console.error('Error getting active nomina:', error);
      return null;
    }
  }

  /**
   * Save or update a nomina
   */
  async saveNomina(nomina: Omit<Nomina, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Promise<Nomina> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['nominas'], 'readwrite');
      const store = tx.objectStore('nominas');
      
      const now = new Date().toISOString();
      
      const newNomina: Nomina = {
        ...nomina,
        fechaCreacion: now,
        fechaActualizacion: now
      };

      const result = await store.add(newNomina);
      newNomina.id = result as number;
      
      await tx.done;
      return newNomina;
    } catch (error) {
      this.db = null;
      console.error('Error saving nomina:', error);
      throw error;
    }
  }

  /**
   * Update an existing nomina
   */
  async updateNomina(id: number, updates: Partial<Nomina>): Promise<Nomina> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['nominas'], 'readwrite');
      const store = tx.objectStore('nominas');
      
      const existing = await store.get(id);
      if (!existing) {
        throw new Error('Nomina not found');
      }

      const now = new Date().toISOString();

      const updated: Nomina = {
        ...existing,
        ...updates,
        fechaActualizacion: now
      };

      await store.put(updated);
      await tx.done;
      
      return updated;
    } catch (error) {
      this.db = null;
      console.error('Error updating nomina:', error);
      throw error;
    }
  }

  /**
   * Delete a nomina
   */
  async deleteNomina(id: number): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(['nominas'], 'readwrite');
      const store = tx.objectStore('nominas');
      
      await store.delete(id);
      await tx.done;
    } catch (error) {
      this.db = null;
      console.error('Error deleting nomina:', error);
      throw error;
    }
  }

  /**
   * Calculate net monthly salary and distribution (v2 engine)
   * - SS is topped against baseCotizacionMensual
   * - PP empleado is deducted from líquido
   * - Especie adds to IRPF base (not to líquido)
   * - Handles 14-pagas with explicit pagaExtra field
   */
  calculateSalary(nomina: Nomina): CalculoNominaResult {
    const { salarioBrutoAnual, distribucion, variables, bonus } = nomina;
    const retencion = nomina.retencion;
    const beneficiosSociales = nomina.beneficiosSociales ?? [];
    const planPensiones = nomina.planPensiones;
    const deduccionesAdicionales = nomina.deduccionesAdicionales ?? [];

    // How many salary units to divide the annual base into
    const mesesDistribucion =
      distribucion.tipo === 'personalizado'
        ? distribucion.meses || 12
        : distribucion.tipo === 'catorce'
        ? 14
        : 12;

    const salarioBaseMensual = salarioBrutoAnual / mesesDistribucion;

    // SS deductions per month — will be computed inside the loop against totalDevengado
    const { ss, cuotaSolidaridadMensual = 0 } = retencion;
    const ssTotalPct =
      (ss.contingenciasComunes + ss.desempleo + ss.formacionProfesional + (ss.mei ?? 0)) / 100;

    // Monthly especie (sum of benefits that increment IRPF base)
    const especieMensual = beneficiosSociales
      .filter(b => b.incrementaBaseIRPF)
      .reduce((acc, b) => acc + b.importeMensual, 0);

    const irpfPct = retencion.irpfPorcentaje / 100;

    const distribucionMensual: DistribucionMensualResult[] = [];
    let totalAnualNeto = 0;
    let totalAnualBruto = 0;
    let totalAnualEspecie = 0;
    let totalAnualPPEmpleado = 0;
    let totalAnualPPEmpresa = 0;

    for (let mes = 1; mes <= 12; mes++) {
      // Base salary per payment unit
      let salarioBase = salarioBaseMensual;
      let pagaExtra = 0;

      if (mesesDistribucion === 14 && (mes === 6 || mes === 12)) {
        // June and December include an extra payment
        pagaExtra = salarioBaseMensual;
      }

      // Variables for this month
      const variablesDelMes = variables.reduce((total, variable) => {
        const distribucionMes = variable.distribucionMeses.find(d => d.mes === mes);
        if (distribucionMes) {
          const variableAnual =
            variable.tipo === 'porcentaje'
              ? (salarioBrutoAnual * variable.valor) / 100
              : variable.valor;
          return total + (variableAnual * distribucionMes.porcentaje) / 100;
        }
        return total;
      }, 0);

      // Bonus for this month
      const bonusDelMes = bonus
        .filter(b => b.mes === mes)
        .reduce((total, b) => total + b.importe, 0);
      
      // Total bruto mensual
      const brutoMensual = salarioBase + variablesDelMes + bonusDelMes;

      // Total devengado for this month (base + paga extra)
      const totalDevengado = brutoMensual + pagaExtra;

      // SS deductions for this month — cap against actual devengado
      const baseCotizacionEfectiva = ss.overrideManual
        ? ss.baseCotizacionMensual
        : Math.min(ss.baseCotizacionMensual, totalDevengado);
      const ssTotal = baseCotizacionEfectiva * ssTotalPct + cuotaSolidaridadMensual;

      // IRPF on (devengado + especie)
      const irpfImporte = (totalDevengado + especieMensual) * irpfPct;

      // Plan pensiones contributions
      let ppEmpleado = 0;
      let ppEmpresa = 0;
      if (planPensiones) {
        const baseEmpleado = planPensiones.aportacionEmpleado.salarioBaseObjetivo ?? totalDevengado;
        ppEmpleado = planPensiones.aportacionEmpleado.tipo === 'porcentaje'
          ? (baseEmpleado * planPensiones.aportacionEmpleado.valor) / 100
          : planPensiones.aportacionEmpleado.valor;
        const baseEmpresa = planPensiones.aportacionEmpresa.salarioBaseObjetivo ?? totalDevengado;
        ppEmpresa = planPensiones.aportacionEmpresa.tipo === 'porcentaje'
          ? (baseEmpresa * planPensiones.aportacionEmpresa.valor) / 100
          : planPensiones.aportacionEmpresa.valor;
      }
      const ppTotalAlProducto = ppEmpleado + ppEmpresa;

      // Other deductions for this month
      const otrasDeducciones = deduccionesAdicionales
        .filter(d => d.esRecurrente || d.mes === mes)
        .reduce((acc, d) => acc + d.importeMensual, 0);

      // Total deductions and net
      const totalDeducciones = ssTotal + irpfImporte + ppEmpleado + otrasDeducciones;
      const netoTotal = totalDevengado - totalDeducciones;

      distribucionMensual.push({
        mes,
        salarioBase,
        pagaExtra,
        variables: variablesDelMes,
        bonus: bonusDelMes,
        totalDevengado,
        especie: especieMensual,
        ssTotal,
        irpfImporte,
        ppEmpleado,
        otrasDeducciones,
        totalDeducciones,
        netoTotal,
        ppTotalAlProducto,
      });

      totalAnualNeto += netoTotal;
      totalAnualBruto += totalDevengado;
      totalAnualEspecie += especieMensual;
      totalAnualPPEmpleado += ppEmpleado;
      totalAnualPPEmpresa += ppEmpresa;
    }

    return {
      netoMensual: totalAnualNeto / 12,
      distribucionMensual,
      totalAnualNeto,
      totalAnualBruto,
      totalAnualEspecie,
      totalAnualPP: totalAnualPPEmpresa + totalAnualPPEmpleado,
      totalAnualPPEmpleado,
      totalAnualPPEmpresa,
    };
  }

  /**
   * Calculate net salary from bruto applying SS and IRPF retentions
   */
  calculateNetFromBruto(bruto: number, retencion: RetencionNomina): number {
    const { ss, cuotaSolidaridadMensual = 0, irpfPorcentaje } = retencion;
    const ssTotalPct = (ss.contingenciasComunes + ss.desempleo + ss.formacionProfesional + (ss.mei ?? 0)) / 100;
    const baseCotizacionEfectiva = ss.overrideManual ? ss.baseCotizacionMensual : Math.min(ss.baseCotizacionMensual, bruto);
    const ssImporte = baseCotizacionEfectiva * ssTotalPct + cuotaSolidaridadMensual;
    const irpfImporte = bruto * (irpfPorcentaje / 100);
    return bruto - ssImporte - irpfImporte;
  }

  /**
   * Validate variable distribution
   */
  validateVariableDistribution(variable: Variable): { isValid: boolean; error?: string } {
    const totalPorcentaje = variable.distribucionMeses.reduce((total, d) => total + d.porcentaje, 0);
    
    if (totalPorcentaje === 0) {
      return { isValid: false, error: 'Debe distribuir al menos en un mes' };
    }
    
    // Allow distribution to be less than or greater than 100%
    if (totalPorcentaje !== 100) {
      return { 
        isValid: true, 
        error: `La distribución suma ${totalPorcentaje}% (se permite diferente de 100%)` 
      };
    }
    
    return { isValid: true };
  }

  /**
   * Get next payment date based on payment rules
   */
  getNextPaymentDate(reglasDia: ReglaDia, currentDate: Date = new Date()): Date {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    switch (reglasDia.tipo) {
      case 'fijo':
        const day = reglasDia.dia || 1;
        const fixedDate = new Date(year, month, day);
        
        // If the date has passed this month, get next month
        if (fixedDate <= currentDate) {
          return new Date(year, month + 1, day);
        }
        return fixedDate;
        
      case 'ultimo-habil':
        return this.getLastBusinessDay(year, month);
        
      case 'n-esimo-habil':
        const position = reglasDia.posicion || -1;
        return this.getNthBusinessDay(year, month, position);
        
      default:
        return new Date(year, month + 1, 1); // First day of next month as fallback
    }
  }

  /**
   * Get last business day of the month
   */
  private getLastBusinessDay(year: number, month: number): Date {
    const lastDay = new Date(year, month + 1, 0); // Last day of current month
    
    while (lastDay.getDay() === 0 || lastDay.getDay() === 6) { // Sunday or Saturday
      lastDay.setDate(lastDay.getDate() - 1);
    }
    
    return lastDay;
  }

  /**
   * Get nth business day from end of month
   * Negative position means counting from end (e.g., -1 = last, -2 = penultimate)
   */
  private getNthBusinessDay(year: number, month: number, position: number): Date {
    if (position >= 0) {
      // Count from beginning of month
      const firstDay = new Date(year, month, 1);
      let businessDays = 0;
      let currentDay = new Date(firstDay);
      
      while (businessDays < position) {
        if (currentDay.getDay() !== 0 && currentDay.getDay() !== 6) {
          businessDays++;
        }
        if (businessDays < position) {
          currentDay.setDate(currentDay.getDate() + 1);
        }
      }
      
      return currentDay;
    } else {
      // Count from end of month
      const lastBusinessDay = this.getLastBusinessDay(year, month);
      let businessDays = 1;
      let currentDay = new Date(lastBusinessDay);
      
      while (businessDays < Math.abs(position)) {
        currentDay.setDate(currentDay.getDate() - 1);
        if (currentDay.getDay() !== 0 && currentDay.getDay() !== 6) {
          businessDays++;
        }
      }
      
      return currentDay;
    }
  }
}

export const nominaService = new NominaService();
