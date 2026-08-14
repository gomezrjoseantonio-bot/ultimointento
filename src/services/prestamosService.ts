// Préstamos Service - CRUD operations

import { Prestamo, PlanPagos, DestinoCapital, Garantia } from '../types/prestamos';
import {
  anotarValidado,
  needsPlanRegeneration,
  olvidarTodoLoValidado,
  olvidarValidado,
  planYaValidado,
  sellarReciénGenerado,
} from './prestamos/planVigente';
import { prestamosCalculationService } from './prestamosCalculationService';
import { conservarPunteo } from './prestamos/cuadro';
import { initDB } from './db';
import { reduccionPorBonificaciones } from './bonificaciones/tinEfectivo';

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

/**
 * ¿Este préstamo está imputado a este inmueble? Es el GATE de
 * `getPrestamosByProperty`; la fracción la da `getAllocationFactor`, y los dos
 * tienen que mirar los mismos sitios o un préstamo bien imputado se cae.
 *
 * Mira el modelo actual (`destinos[]`, que es lo único que guarda el asistente
 * hoy) y cae en los legacy. Sin la rama de `destinos`, un préstamo dado de alta
 * ahora no salía por ninguna parte y la cartera enseñaba deuda 0.
 */
export const prestamoAfectaInmueble = (
  prestamo: Pick<Prestamo, 'inmuebleId' | 'afectacionesInmueble' | 'destinos'>,
  inmuebleId: string,
): boolean => {
  if (prestamo.destinos?.some((d) => d.inmuebleId === inmuebleId)) return true;
  if (prestamo.inmuebleId === inmuebleId) return true;
  if (prestamo.afectacionesInmueble?.length) {
    return prestamo.afectacionesInmueble.some((a) => a.inmuebleId === inmuebleId);
  }
  return false;
};

/**
 * Deuda viva imputada a cada inmueble por su GARANTÍA hipotecaria.
 *
 * El LTV es un ratio de colateral: cuánto debes SOBRE el inmueble que está
 * hipotecado. Así que la deuda «de un inmueble» son los préstamos cuya garantía
 * HIPOTECARIA es ese inmueble —no los que lo financiaron: eso es el destino, y
 * sirve para la fiscalidad, no para el LTV—.
 *
 * Cuando una hipoteca tiene VARIOS inmuebles de garantía (caso Tenderina), el
 * principal vivo se reparte entre ellos por el importe de su DESTINO —dato real
 * del préstamo—, y a partes iguales solo si esa hipoteca no trae destinos por
 * inmueble. La decisión del reparto vive aquí, en Financiación: quien lo lea
 * (la cartera de Inmuebles) no inventa nada.
 *
 * Un préstamo sin garantía hipotecaria (personal) no carga NINGÚN inmueble,
 * aunque su destino apunte a uno: si no está hipotecado, no encumbra al LTV.
 */
export const deudaVivaPorGarantia = (
  prestamo: Pick<Prestamo, 'garantias' | 'destinos' | 'principalVivo'>,
): Map<string, number> => {
  const out = new Map<string, number>();
  const inmueblesGarantia = [
    ...new Set(
      (prestamo.garantias ?? [])
        .filter((g) => g.tipo === 'HIPOTECARIA' && g.inmuebleId)
        .map((g) => g.inmuebleId as string),
    ),
  ];
  const principal = prestamo.principalVivo ?? 0;
  if (inmueblesGarantia.length === 0 || principal === 0) return out;

  const pesoDestino = (id: string): number =>
    (prestamo.destinos ?? [])
      .filter((d) => d.inmuebleId === id && (d.tipo === 'ADQUISICION' || d.tipo === 'REFORMA'))
      .reduce((s, d) => s + (d.importe ?? 0), 0);

  const pesos = inmueblesGarantia.map((id) => ({ id, peso: pesoDestino(id) }));
  const sumaPesos = pesos.reduce((s, p) => s + p.peso, 0);

  for (const { id, peso } of pesos) {
    const fraccion = sumaPesos > 0 ? peso / sumaPesos : 1 / inmueblesGarantia.length;
    out.set(id, (out.get(id) ?? 0) + principal * fraccion);
  }
  return out;
};

// ── Fiscal engine ──────────────────────────────────────────────────────────

/**
 * El total de intereses DEDUCIBLES de un préstamo en un año · casilla 0105.
 *
 * Son **dos condiciones**, y hasta ahora solo se comprobaba una:
 *
 *   1. El capital tiene que estar TRAZADO a un inmueble, por adquisición o por
 *      reforma. Eso dice qué inmueble financia el préstamo y qué fracción de él
 *      —el resto se pidió para otra cosa y no deduce.
 *   2. Ese inmueble tiene que estar ALQUILADO en el ejercicio. Lo que abre la
 *      casilla es el rendimiento de capital inmobiliario; sin alquiler no hay
 *      rendimiento del que descontar el gasto.
 *
 * Faltaba la segunda *(Jose · 8 ago 2026: «la deducción fiscal de un préstamo
 * la genera si el inmueble está alquilado, no si el destino es adquisición»)*,
 * así que una vivienda comprada con hipoteca y vacía salía «deducible 100%».
 *
 * `inmueblesAlquilados` se pide de fuera —lo da `inmueblesAlquiladosEn`— porque
 * esta función es síncrona y la vive todo el módulo de financiación. Es un
 * parámetro obligatorio a propósito: con un opcional, quien no lo pasara
 * volvería a la respuesta falsa sin enterarse.
 */
export function interesesTotalDeducible(
  prestamo: Prestamo,
  interesesTotalAño: number,
  inmueblesAlquilados: ReadonlySet<string>,
): number {
  const alquilado = (id: string | number | undefined | null): boolean =>
    id != null && id !== '' && inmueblesAlquilados.has(String(id));

  if (prestamo.destinos?.length) {
    const importeDeducible = prestamo.destinos
      .filter(
        (d) =>
          alquilado(d.inmuebleId) && (d.tipo === 'ADQUISICION' || d.tipo === 'REFORMA'),
      )
      .reduce((sum, d) => sum + d.importe, 0);

    return (prestamo.principalInicial ?? 0) > 0
      ? interesesTotalAño * (importeDeducible / prestamo.principalInicial)
      : 0;
  }

  // Legacy: préstamos PERSONAL/INVERSION/OTRA no generan intereses deducibles
  const finalidadNoDeducible =
    prestamo.finalidad === 'PERSONAL' ||
    prestamo.finalidad === 'INVERSION' ||
    prestamo.finalidad === 'OTRA';
  if (finalidadNoDeducible || prestamo.ambito === 'PERSONAL') return 0;

  // ADQUISICION/REFORMA con afectacionesInmueble: suma los porcentajes de los
  // inmuebles alquilados, no de todos.
  if (prestamo.afectacionesInmueble?.length) {
    const pctTotal = prestamo.afectacionesInmueble
      .filter((a) => alquilado(a.inmuebleId))
      .reduce((s, a) => s + a.porcentaje, 0);
    return interesesTotalAño * Math.min(pctTotal / 100, 1);
  }

  return alquilado(prestamo.inmuebleId) ? interesesTotalAño : 0;
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
    return prestamos.filter((p) => prestamoAfectaInmueble(p, inmuebleId));
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
  /**
   * @param opciones.conservarPlan No regenerar el cuadro aunque cambien los
   *   parámetros. Lo usa quien va a escribir uno MEJOR justo después —confirmar
   *   una revisión, que recalcula desde la fecha en vez de desde el origen—.
   *   Sin esto quedaba persistido un cuadro incorrecto entre las dos escrituras,
   *   y ahí se queda para siempre si la app se cierra en medio.
   */
  async updatePrestamo(
    id: string,
    updates: Partial<Prestamo>,
    opciones?: { conservarPlan?: boolean },
  ): Promise<Prestamo | null> {
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
    const parametersChanged =
      !opciones?.conservarPlan &&
      this.hasAmortizationParametersChanged(originalPrestamo, prestamos[index]);
    
    if (parametersChanged) {
      console.log(`[PRESTAMOS] Loan parameters changed, regenerating amortization schedule for ${id}`);
      this.planesGenerados.delete(id);
      
      try {
        // El punteo del cuadro anterior se conserva · el enlace al movimiento
        // con el que se cuadró cada cuota es trabajo del usuario, no un dato
        // calculado, y regenerar no puede borrarlo. Esto lo hacía solo el
        // wizard, así que editar desde cualquier otro sitio lo perdía entero.
        //
        // Se lee el plan GUARDADO, no `getPaymentPlan`: ese ya compara contra
        // los parámetros nuevos y devolvería un cuadro recién generado, que es
        // justamente el que no tiene punteo que conservar.
        const anterior = originalPrestamo.planPagos ?? null;
        const paymentPlan = conservarPunteo(
          prestamosCalculationService.generatePaymentSchedule(prestamos[index]),
          anterior,
        );
        await this.savePaymentPlan(id, paymentPlan);
        // Y se sella · acabamos de generarlo con el mismo motor contra el que
        // se compararía, así que la lectura siguiente no tiene que rehacerlo
        // entero para confirmar lo que ya sabemos. Es el coste de guardar un
        // préstamo, que era la otra mitad de la queja.
        sellarReciénGenerado(prestamos[index], paymentPlan);
        console.log(`[PRESTAMOS] Amortization schedule updated: ${paymentPlan.periodos.length} payments, total interest: €${paymentPlan.resumen.totalIntereses.toFixed(2)}`);
      } catch (error) {
        console.error(`[PRESTAMOS] Failed to regenerate amortization schedule for loan ${id}:`, error);
      }
    } else if (updates.planPagos !== undefined) {
      // El cuadro llega en el propio update · lo de memoria ya no vale.
      this.planesGenerados.delete(id);
    }
    // Y si no, el cuadro en memoria SIGUE VALIENDO, así que se queda.
    //
    // Antes se borraba siempre, con el comentario «persisted plan remains
    // valid» al lado — que es justo la razón por la que no había que borrarlo.
    // Como `autoMarcarCuotasPagadas` pasa por aquí al abrir la pantalla, la
    // caché se vaciaba entera y la lectura siguiente revalidaba cada cuadro
    // desde cero.

    return prestamos[index];
  }

  /**
   * Check if amortization-affecting parameters have changed
   */
  private hasAmortizationParametersChanged(original: Prestamo, updated: Prestamo): boolean {
    const criticalFields = [
      'principalInicial', 'plazoMesesTotal', 'tipo',
      'tipoNominalAnualFijo', 'valorIndiceActual', 'diferencial', 
      'tramoFijoMeses', 'tipoNominalAnualMixtoFijo', 'carencia', 'carenciaMeses',
      'baseCalculoIntereses',
      'diferirPrimeraCuotaMeses', 'diaCargoMes', 'fechaFirma', 'fechaPrimerCargo',
      'esquemaPrimerRecibo', 'prorratearPrimerPeriodo'
    ];
    
    if (criticalFields.some(field =>
      original[field as keyof Prestamo] !== updated[field as keyof Prestamo]
    )) {
      return true;
    }

    // Las revisiones del índice parten el cuadro en tramos (§6 bis · bis), así
    // que apuntar una lo cambia. También son un array, y se comparan por lo que
    // dicen —fecha y valor— y no por identidad de objeto.
    // Normalizado a propósito: una fecha guardada con hora o un valor que no es
    // un número no cambian lo que la revisión DICE, y compararlos en crudo
    // regeneraría el cuadro —y con él las previsiones de tesorería— en guardados
    // donde no ha cambiado nada.
    const comoTexto = (p: Prestamo) =>
      (p.revisionesDeTipo ?? [])
        .filter((r) => typeof r?.desde === 'string' && Number.isFinite(r?.valorIndice))
        .map((r) => `${r.desde.slice(0, 10)}:${r.valorIndice}`)
        .sort()
        .join('|');

    if (comoTexto(original) !== comoTexto(updated)) return true;

    // Las bonificaciones cambian el tipo que se paga, así que cambian el cuadro
    // (§6 ter). No van en `criticalFields` porque son un array: compararlas con
    // `!==` daría siempre distinto y regeneraría en cada guardado. Lo que hay
    // que mirar es cuánto rebajan.
    return (
      reduccionPorBonificaciones(original.bonificaciones, original) !==
      reduccionPorBonificaciones(updated.bonificaciones, updated)
    );
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



  /**
   * Get or generate payment plan for a loan - reads from IndexedDB first
   */
  async getPaymentPlan(prestamoId: string): Promise<PlanPagos | null> {
    const prestamo = await this.getPrestamoById(prestamoId);
    if (!prestamo) return null;

    // Check in-memory cache first
    if (this.planesGenerados.has(prestamoId)) {
      const cachedPlan = this.planesGenerados.get(prestamoId)!;
      // Lo ya validado no se revalida mientras el préstamo no cambie · sin este
      // sello, un acierto de caché costaba lo mismo que generar el cuadro.
      if (planYaValidado(prestamo, cachedPlan)) return cachedPlan;
      if (!needsPlanRegeneration(prestamo, cachedPlan)) {
        anotarValidado(prestamo, cachedPlan);
        return cachedPlan;
      }
      olvidarValidado(prestamoId);

      console.warn(`[PRESTAMOS] Cached schedule is outdated/inconsistent, regenerating ${prestamoId}`);
      this.planesGenerados.delete(prestamoId);
    }

    // Try to load persisted plan from prestamo.planPagos (T15.3 · antes
    // vivía en keyval[`planpagos_${id}`] · ya migrado).
    try {
      const persistedPlan = prestamo.planPagos;
      if (persistedPlan) {
        if (!needsPlanRegeneration(prestamo, persistedPlan)) {
          this.planesGenerados.set(prestamoId, persistedPlan);
          anotarValidado(prestamo, persistedPlan);
          return persistedPlan;
        }

        console.warn(`[PRESTAMOS] Persisted schedule is outdated/inconsistent, regenerating ${prestamoId}`);
      }
    } catch (error) {
      console.error('[PRESTAMOS] Failed to read payment plan from IndexedDB:', error);
    }

    // No persisted plan found — generate a fresh one
    //
    // Regenerar EN LECTURA es lo mismo que regenerar al editar, así que también
    // conserva el punteo: un plan viejo que no cuadra con las reglas de hoy se
    // rehace, pero el enlace de cada cuota con el movimiento del banco lo puso
    // el usuario y no se puede perder por haber abierto una pantalla.
    console.log(`[PRESTAMOS] Generating fresh amortization schedule for ${prestamoId}`);
    const plan = conservarPunteo(
      prestamosCalculationService.generatePaymentSchedule(prestamo),
      prestamo.planPagos ?? null,
    );
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
    // Y los sellos · tirar media caché y quedarse con el testigo de la otra
    // media es cómo se acaba dando por bueno algo que ya no está.
    olvidarTodoLoValidado();
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

    if (changed) {
      await this.savePaymentPlan(prestamoId, plan);
    }

    // Y la caché derivada solo se reescribe si de verdad está mal.
    //
    // Aquí ponía «always recalculate cache so that data created before this fix
    // gets corrected on first load»: una migración de UNA vez cobrada en CADA
    // carga. Un `db.put` del préstamo entero —con su cuadro de 240 cuotas
    // dentro— por préstamo, cada vez que se entra en Financiación, aunque no
    // hubiera cambiado nada. Comparar cuesta tres números; escribir, un viaje a
    // IndexedDB. Los datos viejos se siguen corrigiendo la primera vez que se
    // abren, que es cuando la comparación falla.
    const cache = derivarCachePrestamo(plan, prestamo.principalInicial);
    if (
      prestamo.cuotasPagadas === cache.cuotasPagadas &&
      prestamo.principalVivo === cache.principalVivo &&
      prestamo.fechaUltimaCuotaPagada === cache.fechaUltimaCuotaPagada
    ) {
      return prestamo;
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
