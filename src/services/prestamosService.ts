// Préstamos Service - CRUD operations

import { Prestamo, PlanPagos, DestinoCapital, Garantia } from '../types/prestamos';
import { prestamosCalculationService } from './prestamosCalculationService';
import { initDB } from './db';

// ── Helper: generate short unique id ──────────────────────────────────────

function generateDestinoId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `d_${globalThis.crypto.randomUUID()}`;
  }
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── getAllocationFactor ────────────────────────────────────────────────────
// Retorna la fracción (0..1) del préstamo imputable a un inmueble concreto.
// Usa el nuevo modelo destinos[] si existe; cae en legacy si no.

export const getAllocationFactor = (
  prestamo: Partial<Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble' | 'destinos' | 'principalInicial'>>,
  inmuebleId: string,
): number => {
  // Nuevo modelo: usar destinos[]
  if (prestamo.destinos?.length) {
    const importeDeducible = prestamo.destinos
      .filter((d) => d.inmuebleId === inmuebleId && (d.tipo === 'ADQUISICION' || d.tipo === 'REFORMA'))
      .reduce((sum, d) => sum + d.importe, 0);
    return (prestamo.principalInicial ?? 0) > 0
      ? importeDeducible / (prestamo.principalInicial ?? 1)
      : 0;
  }

  // Legacy: afectacionesInmueble (% porcentaje sobre total préstamo)
  if (prestamo.afectacionesInmueble?.length) {
    const afectacion = prestamo.afectacionesInmueble.find((a) => a.inmuebleId === inmuebleId);
    return afectacion ? afectacion.porcentaje / 100 : 0;
  }

  // Legacy: inmuebleId simple (100%)
  return prestamo.inmuebleId === inmuebleId ? 1 : 0;
};

// ── Fiscal engine ──────────────────────────────────────────────────────────

/**
 * Calcula los intereses deducibles para un inmueble en un año.
 *
 * Solo los destinos de tipo ADQUISICION o REFORMA vinculados a un inmueble
 * de alquiler generan intereses deducibles (casilla 0105).
 * El reparto es proporcional al importe destinado vs principalInicial.
 */
export function interesesDeduciblesInmueble(
  prestamo: Prestamo,
  inmuebleId: string,
  interesesTotalAño: number,
): number {
  if (!prestamo.destinos?.length) {
    // Legacy: reutilizar getAllocationFactor para cubrir inmuebleId simple y afectacionesInmueble
    return interesesTotalAño * getAllocationFactor(prestamo, inmuebleId);
  }

  const destinoDeducible = prestamo.destinos
    .filter(
      (d) => d.inmuebleId === inmuebleId && (d.tipo === 'ADQUISICION' || d.tipo === 'REFORMA'),
    )
    .reduce((sum, d) => sum + d.importe, 0);

  return (prestamo.principalInicial ?? 0) > 0
    ? interesesTotalAño * (destinoDeducible / prestamo.principalInicial)
    : 0;
}

/**
 * Calcula el total de intereses deducibles de un préstamo en un año.
 * Suma solo los destinos que vinculan a inmuebles (ADQUISICION o REFORMA).
 */
export function interesesTotalDeducible(
  prestamo: Prestamo,
  interesesTotalAño: number,
): number {
  if (!prestamo.destinos?.length) {
    // Legacy: préstamos PERSONAL/INVERSION/OTRA no generan intereses deducibles
    const finalidadNoDeducible =
      prestamo.finalidad === 'PERSONAL' ||
      prestamo.finalidad === 'INVERSION' ||
      prestamo.finalidad === 'OTRA';
    if (finalidadNoDeducible || prestamo.ambito === 'PERSONAL') return 0;
    // ADQUISICION/REFORMA con afectacionesInmueble: suma porcentajes de todos los inmuebles
    if (prestamo.afectacionesInmueble?.length) {
      const pctTotal = prestamo.afectacionesInmueble.reduce((s, a) => s + a.porcentaje, 0);
      return interesesTotalAño * Math.min(pctTotal / 100, 1);
    }
    return interesesTotalAño; // single inmuebleId → 100% deducible
  }

  const importeDeducible = prestamo.destinos
    .filter((d) => d.inmuebleId && (d.tipo === 'ADQUISICION' || d.tipo === 'REFORMA'))
    .reduce((sum, d) => sum + d.importe, 0);

  return (prestamo.principalInicial ?? 0) > 0
    ? interesesTotalAño * (importeDeducible / prestamo.principalInicial)
    : 0;
}

// ── Migration ─────────────────────────────────────────────────────────────

/**
 * Convierte un préstamo del modelo legacy al nuevo modelo con destinos y garantías.
 * Si ya tiene destinos definidos, lo devuelve sin cambios.
 *
 * NOTA: La migración automática asume destino = garantía (correcto para la mayoría
 * de casos). Los casos donde difieren (ej: ING — destino T48, garantía Buigas)
 * el usuario deberá corregir manualmente desde la ficha del préstamo.
 */
export function migratePrestamo(legacy: Prestamo): Prestamo {
  if (legacy.destinos?.length) return legacy;

  const destinos: DestinoCapital[] = [];
  const garantias: Garantia[] = [];

  if (legacy.afectacionesInmueble?.length) {
    // Multi-inmueble legacy (ej: Unicaja)
    for (const af of legacy.afectacionesInmueble) {
      destinos.push({
        id: generateDestinoId(),
        tipo: 'ADQUISICION',
        inmuebleId: af.inmuebleId,
        importe: legacy.principalInicial * (af.porcentaje / 100),
        porcentaje: af.porcentaje,
      });
      garantias.push({
        tipo: 'HIPOTECARIA',
        inmuebleId: af.inmuebleId,
      });
    }
  } else if (legacy.inmuebleId && legacy.inmuebleId !== 'standalone') {
    // Single-inmueble legacy — mapear finalidad completa a DestinoCapital['tipo']
    const tipoDestino: DestinoCapital['tipo'] =
      legacy.finalidad === 'REFORMA'    ? 'REFORMA'    :
      legacy.finalidad === 'INVERSION'  ? 'INVERSION'  :
      legacy.finalidad === 'PERSONAL'   ? 'PERSONAL'   :
      legacy.finalidad === 'OTRA'       ? 'OTRA'       :
      'ADQUISICION';

    destinos.push({
      id: generateDestinoId(),
      tipo: tipoDestino,
      inmuebleId: (tipoDestino === 'ADQUISICION' || tipoDestino === 'REFORMA')
        ? legacy.inmuebleId
        : undefined,
      importe: legacy.principalInicial,
      porcentaje: 100,
    });
    if (legacy.ambito === 'INMUEBLE' && (tipoDestino === 'ADQUISICION' || tipoDestino === 'REFORMA')) {
      garantias.push({
        tipo: 'HIPOTECARIA',
        inmuebleId: legacy.inmuebleId,
      });
    } else {
      garantias.push({ tipo: 'PERSONAL' });
    }
  } else {
    // Préstamo personal sin inmueble
    destinos.push({
      id: generateDestinoId(),
      tipo: 'PERSONAL',
      importe: legacy.principalInicial,
      porcentaje: 100,
    });
    garantias.push({ tipo: 'PERSONAL' });
  }

  // Recalcular ambito a partir de los destinos generados
  const ambito: Prestamo['ambito'] = destinos.some((d) => Boolean(d.inmuebleId))
    ? 'INMUEBLE'
    : 'PERSONAL';

  return { ...legacy, destinos, garantias, ambito };
}

// ── derivarCachePrestamo ──────────────────────────────────────────────────
// Deriva los campos de caché del préstamo (cuotasPagadas, principalVivo,
// fechaUltimaCuotaPagada) a partir del plan de pagos. Función pura sin
// efectos secundarios — adecuada para tests unitarios.

export function derivarCachePrestamo(
  plan: PlanPagos,
  principalInicial: number,
): Pick<Prestamo, 'cuotasPagadas' | 'principalVivo' | 'fechaUltimaCuotaPagada'> {
  const pagados = plan.periodos.filter((p) => p.pagado);
  let ultimoPagadoContiguo: PlanPagos['periodos'][number] | null = null;

  for (const periodo of plan.periodos) {
    if (!periodo.pagado) break;
    ultimoPagadoContiguo = periodo;
  }

  return {
    cuotasPagadas: pagados.length,
    principalVivo: ultimoPagadoContiguo
      ? ultimoPagadoContiguo.principalFinal
      : principalInicial,
    fechaUltimaCuotaPagada: ultimoPagadoContiguo?.fechaCargo,
  };
}

export class PrestamosService {
  private planesGenerados: Map<string, PlanPagos> = new Map();
  private prestamosCache: Prestamo[] | null = null;

  /**
   * Load all loans from IndexedDB into the in-memory cache
   */
  private async ensureLoaded(): Promise<Prestamo[]> {
    if (this.prestamosCache !== null) return this.prestamosCache;
    try {
      const db = await initDB();
      this.prestamosCache = await db.getAll('prestamos');
    } catch (error) {
      console.error('[PRESTAMOS] Failed to load from IndexedDB:', error);
      this.prestamosCache = [];
    }
    return this.prestamosCache;
  }

  /**
   * Persist a single loan to IndexedDB
   */
  private async savePrestamo(prestamo: Prestamo): Promise<void> {
    try {
      const db = await initDB();
      await db.put('prestamos', prestamo);
    } catch (error) {
      console.error('[PRESTAMOS] Failed to save to IndexedDB:', error);
    }
  }

  /**
   * Delete a single loan from IndexedDB
   */
  private async deletePrestamoDB(id: string): Promise<void> {
    try {
      const db = await initDB();
      await db.delete('prestamos', id);
    } catch (error) {
      console.error('[PRESTAMOS] Failed to delete from IndexedDB:', error);
    }
  }

  /**
   * Get all loans for a property
   */
  async getPrestamosByProperty(inmuebleId: string): Promise<Prestamo[]> {
    const prestamos = await this.ensureLoaded();
    return prestamos.filter((p) => {
      if (p.inmuebleId === inmuebleId) return true;
      if (p.afectacionesInmueble?.length) {
        return p.afectacionesInmueble.some((a) => a.inmuebleId === inmuebleId);
      }
      return false;
    });
  }

  getPorcentajeAfectacion(prestamo: Prestamo, inmuebleId: string): number {
    return getAllocationFactor(prestamo, inmuebleId) * 100;
  }

  /**
   * Get loan by ID
   */
  async getPrestamoById(id: string): Promise<Prestamo | null> {
    const prestamos = await this.ensureLoaded();
    return prestamos.find(p => p.id === id) || null;
  }

  /**
   * Create new loan - ENHANCED to automatically generate amortization schedule
   */
  async createPrestamo(prestamoData: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prestamo> {
    const prestamos = await this.ensureLoaded();
    const prestamo: Prestamo = {
      id: `prestamo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...prestamoData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.savePrestamo(prestamo);
    prestamos.push(prestamo);

    // Skip amortization generation for incomplete loans (detected from XML, pending user completion)
    if (prestamo.estado === 'pendiente_completar') {
      console.log(`[PRESTAMOS] Loan ${prestamo.id} is pendiente_completar — skipping amortization schedule generation`);
      return prestamo;
    }

    // AUTO-GENERATE AND PERSIST AMORTIZATION SCHEDULE ON SAVE
    console.log(`[PRESTAMOS] Auto-generating amortization schedule for loan ${prestamo.id}`);
    try {
      const paymentPlan = prestamosCalculationService.generatePaymentSchedule(prestamo);
      // Auto-mark all installments with fechaCargo <= today as paid
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      for (const periodo of paymentPlan.periodos) {
        if (new Date(periodo.fechaCargo) <= today) {
          periodo.pagado = true;
          periodo.fechaPagoReal = periodo.fechaCargo;
        }
      }
      await this.savePaymentPlan(prestamo.id, paymentPlan);
      console.log(`[PRESTAMOS] Amortization schedule generated: ${paymentPlan.periodos.length} payments, total interest: €${paymentPlan.resumen.totalIntereses.toFixed(2)}`);
    } catch (error) {
      console.error(`[PRESTAMOS] Failed to generate amortization schedule for loan ${prestamo.id}:`, error);
      // Don't fail loan creation if schedule generation fails
    }

    return prestamo;
  }

  /**
   * Update existing loan - ENHANCED to recalculate amortization schedule when parameters change
   */
  async updatePrestamo(id: string, updates: Partial<Prestamo>): Promise<Prestamo | null> {
    const prestamos = await this.ensureLoaded();
    const index = prestamos.findIndex(p => p.id === id);
    if (index === -1) return null;

    const originalPrestamo = { ...prestamos[index] };
    
    prestamos[index] = {
      ...prestamos[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.savePrestamo(prestamos[index]);

    // Check if parameters that affect amortization schedule changed
    const parametersChanged = this.hasAmortizationParametersChanged(originalPrestamo, prestamos[index]);
    
    if (parametersChanged) {
      console.log(`[PRESTAMOS] Loan parameters changed, regenerating amortization schedule for ${id}`);
      this.planesGenerados.delete(id);
      
      try {
        const paymentPlan = prestamosCalculationService.generatePaymentSchedule(prestamos[index]);
        // Re-mark all installments with fechaCargo <= today as paid
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        for (const periodo of paymentPlan.periodos) {
          if (new Date(periodo.fechaCargo) <= today) {
            periodo.pagado = true;
            periodo.fechaPagoReal = periodo.fechaCargo;
          }
        }
        await this.savePaymentPlan(id, paymentPlan);
        console.log(`[PRESTAMOS] Amortization schedule updated: ${paymentPlan.periodos.length} payments, total interest: €${paymentPlan.resumen.totalIntereses.toFixed(2)}`);
      } catch (error) {
        console.error(`[PRESTAMOS] Failed to regenerate amortization schedule for loan ${id}:`, error);
      }
    } else {
      // Just clear in-memory cache; persisted plan in IndexedDB remains valid
      this.planesGenerados.delete(id);
    }

    return prestamos[index];
  }

  /**
   * Check if amortization-affecting parameters have changed
   */
  private hasAmortizationParametersChanged(original: Prestamo, updated: Prestamo): boolean {
    const criticalFields = [
      'principalInicial', 'plazoMesesTotal', 'tipo',
      'tipoNominalAnualFijo', 'valorIndiceActual', 'diferencial', 
      'tramoFijoMeses', 'tipoNominalAnualMixtoFijo', 'mesesSoloIntereses',
      'diferirPrimeraCuotaMeses', 'diaCargoMes', 'fechaFirma', 'fechaPrimerCargo',
      'esquemaPrimerRecibo', 'prorratearPrimerPeriodo'
    ];
    
    return criticalFields.some(field => 
      original[field as keyof Prestamo] !== updated[field as keyof Prestamo]
    );
  }

  private needsPlanRegeneration(prestamo: Prestamo, plan: PlanPagos): boolean {
    if (!plan.periodos || plan.periodos.length === 0) return true;

    const customPlanSource = plan.metadata?.source;
    const isCancelledLoan = prestamo.activo === false || prestamo.estado === 'cancelado';
    const lastPeriod = plan.periodos[plan.periodos.length - 1];

    if (isCancelledLoan) {
      const finalPrincipalCentimos = Math.round((lastPeriod?.principalFinal || 0) * 100);
      if (prestamo.fechaCancelacion && plan.resumen.fechaFinalizacion === prestamo.fechaCancelacion && finalPrincipalCentimos === 0) {
        return false;
      }
    }

    if (customPlanSource === 'loan_settlement') {
      const amortizadoCentimos = plan.periodos.reduce(
        (sum, p) => sum + Math.round(p.amortizacion * 100),
        0,
      );
      const principalInicialCentimos = Math.round(prestamo.principalInicial * 100);
      const finalPrincipalCentimos = Math.round((lastPeriod?.principalFinal || 0) * 100);
      return amortizadoCentimos !== principalInicialCentimos || finalPrincipalCentimos !== 0;
    }

    if (this.hasIrregularMonthlyCadence(plan)) return true;

    // Date sequence must match current generation rules exactly.
    // This catches legacy persisted plans that kept monthly cadence but drifted
    // from the configured billing day after short months (e.g. day 31 loans).
    const expectedPlan = prestamosCalculationService.generatePaymentSchedule(prestamo);
    if (expectedPlan.periodos.length !== plan.periodos.length) {
      return true;
    }
    for (let i = 0; i < plan.periodos.length; i++) {
      const expected = expectedPlan.periodos[i];
      const current = plan.periodos[i];

      if (expected.fechaCargo !== current.fechaCargo) {
        return true;
      }

      // Keep canonical financial fields synced with current generation rules.
      // This forces legacy plans (e.g. old first-installment logic) to be refreshed
      // so Calendario de pagos and Cuadro de amortización stay aligned.
      const sameCuota = Math.round(expected.cuota * 100) === Math.round(current.cuota * 100);
      const sameInteres = Math.round(expected.interes * 100) === Math.round(current.interes * 100);
      const sameAmortizacion = Math.round(expected.amortizacion * 100) === Math.round(current.amortizacion * 100);
      const samePrincipalFinal = Math.round(expected.principalFinal * 100) === Math.round(current.principalFinal * 100);

      if (!sameCuota || !sameInteres || !sameAmortizacion || !samePrincipalFinal) {
        return true;
      }

      if ((expected.esProrrateado ?? false) !== (current.esProrrateado ?? false)) {
        return true;
      }

      if ((expected.esSoloIntereses ?? false) !== (current.esSoloIntereses ?? false)) {
        return true;
      }
    }

    // First installment must match explicit first charge date (date-only compare)
    if (prestamo.fechaPrimerCargo) {
      const expectedFirst = prestamo.fechaPrimerCargo.slice(0, 10);
      const currentFirst = plan.periodos[0]?.fechaCargo?.slice(0, 10);
      if (expectedFirst && currentFirst && expectedFirst !== currentFirst) {
        return true;
      }
    }

    // Principal amortized must match initial principal to the cent
    const amortizadoCentimos = plan.periodos.reduce(
      (sum, p) => sum + Math.round(p.amortizacion * 100),
      0,
    );
    const principalInicialCentimos = Math.round(prestamo.principalInicial * 100);
    if (amortizadoCentimos !== principalInicialCentimos) {
      return true;
    }

    const finalPrincipalCentimos = Math.round((plan.periodos[plan.periodos.length - 1]?.principalFinal || 0) * 100);
    if (finalPrincipalCentimos !== 0) {
      return true;
    }

    return false;
  }

  /**
   * Delete loan
   */
  async deletePrestamo(id: string): Promise<boolean> {
    const prestamos = await this.ensureLoaded();
    const index = prestamos.findIndex(p => p.id === id);
    if (index === -1) return false;

    await this.deletePrestamoDB(id);
    prestamos.splice(index, 1);
    this.planesGenerados.delete(id);
    return true;
  }


  private getMonthDistance(fromMonth: string, toMonth: string): number {
    const [fromY, fromM] = fromMonth.split('-').map(Number);
    const [toY, toM] = toMonth.split('-').map(Number);
    return (toY - fromY) * 12 + (toM - fromM);
  }

  private hasIrregularMonthlyCadence(plan: PlanPagos): boolean {
    if (!plan.periodos || plan.periodos.length < 2) return false;

    for (let i = 1; i < plan.periodos.length; i++) {
      const prevMonth = plan.periodos[i - 1].fechaCargo.substring(0, 7);
      const currentMonth = plan.periodos[i].fechaCargo.substring(0, 7);
      if (this.getMonthDistance(prevMonth, currentMonth) !== 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get or generate payment plan for a loan - reads from IndexedDB first
   */
  async getPaymentPlan(prestamoId: string): Promise<PlanPagos | null> {
    const prestamo = await this.getPrestamoById(prestamoId);
    if (!prestamo) return null;

    // Check in-memory cache first
    if (this.planesGenerados.has(prestamoId)) {
      const cachedPlan = this.planesGenerados.get(prestamoId)!;
      if (!this.needsPlanRegeneration(prestamo, cachedPlan)) {
        console.log(`[PRESTAMOS] Using cached amortization schedule for ${prestamoId}`);
        return cachedPlan;
      }

      console.warn(`[PRESTAMOS] Cached schedule is outdated/inconsistent, regenerating ${prestamoId}`);
      this.planesGenerados.delete(prestamoId);
    }

    // Try to load persisted plan from prestamo.planPagos (T15.3 · antes
    // vivía en keyval[`planpagos_${id}`] · ya migrado).
    try {
      const persistedPlan = prestamo.planPagos;
      if (persistedPlan) {
        if (!this.needsPlanRegeneration(prestamo, persistedPlan)) {
          console.log(`[PRESTAMOS] Loaded persisted amortization schedule for ${prestamoId} from IndexedDB`);
          this.planesGenerados.set(prestamoId, persistedPlan);
          return persistedPlan;
        }

        console.warn(`[PRESTAMOS] Persisted schedule is outdated/inconsistent, regenerating ${prestamoId}`);
      }
    } catch (error) {
      console.error('[PRESTAMOS] Failed to read payment plan from IndexedDB:', error);
    }

    // No persisted plan found — generate a fresh one
    console.log(`[PRESTAMOS] Generating fresh amortization schedule for ${prestamoId}`);
    const plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
    await this.savePaymentPlan(prestamoId, plan);
    
    console.log(`[PRESTAMOS] Schedule generated - ${plan.periodos.length} payments, ends ${plan.resumen.fechaFinalizacion}, total interest: €${plan.resumen.totalIntereses.toFixed(2)}`);
    
    return plan;
  }

  /**
   * Force regeneration of payment plan (useful for testing parameter changes)
   */
  async regeneratePaymentPlan(prestamoId: string): Promise<PlanPagos | null> {
    console.log(`[PRESTAMOS] Force regenerating amortization schedule for ${prestamoId}`);
    this.planesGenerados.delete(prestamoId);
    return this.getPaymentPlan(prestamoId);
  }

  /**
   * Get amortization schedule summary
   */
  async getAmortizationSummary(prestamoId: string): Promise<{
    totalPayments: number;
    totalInterest: number;
    monthlyPayment: number;
    finalPaymentDate: string;
    principalRemaining: number;
  } | null> {
    const plan = await this.getPaymentPlan(prestamoId);
    if (!plan) return null;

    const lastPeriod = plan.periodos[plan.periodos.length - 1];
    const regularPayments = plan.periodos.filter(p => !p.esProrrateado && !p.esSoloIntereses);
    const averagePayment = regularPayments.length > 0 
      ? regularPayments.reduce((sum, p) => sum + p.cuota, 0) / regularPayments.length 
      : 0;

    return {
      totalPayments: plan.periodos.length,
      totalInterest: plan.resumen.totalIntereses,
      monthlyPayment: Math.round(averagePayment * 100) / 100,
      finalPaymentDate: plan.resumen.fechaFinalizacion,
      principalRemaining: lastPeriod?.principalFinal || 0
    };
  }

  /**
   * Simulate amortization scenarios
   */
  async simulateAmortization(
    prestamoId: string,
    importeAmortizar: number,
    fechaAmortizacion: string,
    modo: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA'
  ) {
    const prestamo = await this.getPrestamoById(prestamoId);
    if (!prestamo) throw new Error('Préstamo no encontrado');

    return prestamosCalculationService.simulateAmortization(
      prestamo,
      importeAmortizar,
      fechaAmortizacion,
      modo
    );
  }

  /**
   * Apply amortization to loan (update principal)
   */
  async applyAmortization(prestamoId: string, importe: number): Promise<Prestamo | null> {
    const prestamo = await this.getPrestamoById(prestamoId);
    if (!prestamo) return null;

    const nuevoPrincipal = Math.max(0, prestamo.principalVivo - importe);
    
    return this.updatePrestamo(prestamoId, {
      principalVivo: nuevoPrincipal
    });
  }

  /**
   * Get all loans (for development/testing)
   */
  async getAllPrestamos(): Promise<Prestamo[]> {
    return [...(await this.ensureLoaded())];
  }

  /**
   * Reload all loans from IndexedDB, bypassing the in-memory cache.
   */
  async reloadAllPrestamos(): Promise<Prestamo[]> {
    this.clearCache();
    return this.getAllPrestamos();
  }

  /**
   * Clear all cached payment plans
   */
  clearCache(): void {
    this.planesGenerados.clear();
    this.prestamosCache = null;
  }

  /**
   * Save payment plan to prestamo.planPagos and in-memory cache.
   *
   * T15.3 · antes persistía en `keyval[\`planpagos_${prestamoId}\`]` · ahora
   * vive como campo del propio préstamo en el store `prestamos`.
   */
  async savePaymentPlan(prestamoId: string, plan: PlanPagos): Promise<void> {
    try {
      const db = await initDB();
      const prestamo = (await db.get('prestamos', prestamoId)) as Prestamo | undefined;
      if (!prestamo) {
        console.warn(`[PRESTAMOS] savePaymentPlan · préstamo ${prestamoId} no encontrado · plan en memoria sólo`);
      } else {
        await db.put('prestamos', { ...prestamo, planPagos: plan });
      }
    } catch (error) {
      console.error('[PRESTAMOS] Failed to save payment plan to IndexedDB:', error);
    }
    this.planesGenerados.set(prestamoId, plan);
  }

  /**
   * Auto-mark installments as paid for dates up to today
   */
  async autoMarcarCuotasPagadas(prestamoId: string): Promise<Prestamo | null> {
    const prestamo = await this.getPrestamoById(prestamoId);
    if (!prestamo) return null;

    const plan = await this.getPaymentPlan(prestamoId);
    if (!plan) return null;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let changed = false;
    for (const periodo of plan.periodos) {
      if (!periodo.pagado && new Date(periodo.fechaCargo) <= today) {
        periodo.pagado = true;
        periodo.fechaPagoReal = periodo.fechaCargo;
        changed = true;
      }
    }

    const cache = derivarCachePrestamo(plan, prestamo.principalInicial);
    const cacheInSync =
      prestamo.cuotasPagadas === cache.cuotasPagadas &&
      prestamo.principalVivo === cache.principalVivo &&
      prestamo.fechaUltimaCuotaPagada === cache.fechaUltimaCuotaPagada;

    // Skip all writes when neither flags nor cached fields need updating.
    // This prevents FinanciacionPage.load() from bumping updatedAt on every visit.
    if (!changed && cacheInSync) return prestamo;

    if (changed) {
      await this.savePaymentPlan(prestamoId, plan);
    }
    return this.updatePrestamo(prestamoId, cache);
  }

  /**
   * Manually toggle payment status of a specific installment
   */
  async marcarCuotaManual(
    prestamoId: string,
    numeroPeriodo: number,
    opciones: { pagado: boolean; fechaPagoReal?: string; movimientoTesoreriaId?: string }
  ): Promise<Prestamo | null> {
    const prestamo = await this.getPrestamoById(prestamoId);
    if (!prestamo) return null;

    const plan = await this.getPaymentPlan(prestamoId);
    if (!plan) return null;

    const periodo = plan.periodos.find(p => p.periodo === numeroPeriodo);
    if (!periodo) return prestamo;

    periodo.pagado = opciones.pagado;
    if (opciones.fechaPagoReal !== undefined) periodo.fechaPagoReal = opciones.fechaPagoReal;
    if (opciones.movimientoTesoreriaId !== undefined) periodo.movimientoTesoreriaId = opciones.movimientoTesoreriaId;

    await this.savePaymentPlan(prestamoId, plan);
    return this.updatePrestamo(prestamoId, derivarCachePrestamo(plan, prestamo.principalInicial));
  }
}

export const prestamosService = new PrestamosService();
