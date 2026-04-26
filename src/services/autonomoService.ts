import { initDB } from './db';
import {
  Autonomo,
  IngresosAutonomo,
  GastoDeducible,
  FuenteIngreso,
  GastoRecurrenteActividad,
  CalculoAutonomoResult
} from '../types/personal';
import { invalidateCachedStores } from './indexedDbCacheService';

/**
 * V63 (TAREA 7 sub-tarea 4): el store legacy `autonomos` ha sido eliminado.
 * Los registros viven ahora en el store unificado `ingresos` con
 * `tipo='autonomo'`. Este servicio actúa como adaptador: la API pública
 * (Autonomo IO) se preserva sin cambios para los consumidores; internamente
 * todas las operaciones leen/escriben en `ingresos` filtrando por `tipo`.
 */
const STORE = 'ingresos' as const;
const TIPO = 'autonomo' as const;

type StoredAutonomo = Autonomo & { tipo: typeof TIPO };

function asAutonomo(rec: any): Autonomo | null {
  if (!rec || rec.tipo !== TIPO) return null;
  // El `tipo` discriminador es interno al store unificado; los consumidores
  // siguen viendo la forma `Autonomo` original (sin `tipo`).
  const { tipo, ...rest } = rec as StoredAutonomo;
  void tipo;
  return rest as Autonomo;
}

class AutonomoService {
  private db: any = null;

  private async getDB() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  /**
   * Get all autonomos for a personal data ID
   */
  async getAutonomos(personalDataId: number): Promise<Autonomo[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE], 'readonly');
      const store = transaction.objectStore(STORE);
      const index = store.index('personalDataId');
      const all = (await index.getAll(personalDataId)) as Array<{ tipo?: string }>;
      return all.filter(r => r.tipo === TIPO).map(r => asAutonomo(r)!).filter(Boolean) as Autonomo[];
    } catch (error) {
      console.error('Error getting autonomos:', error);
      return [];
    }
  }

  /**
   * Get active autonomo for a personal data ID
   */
  async getActivoAutonomo(personalDataId: number): Promise<Autonomo | null> {
    try {
      const autonomos = await this.getAutonomos(personalDataId);
      return autonomos.find(a => a.activo) || null;
    } catch (error) {
      console.error('Error getting active autonomo:', error);
      return null;
    }
  }

  async getAutonomosActivos(personalDataId: number): Promise<Autonomo[]> {
    try {
      const autonomos = await this.getAutonomos(personalDataId);
      return autonomos.filter(a => a.activo);
    } catch (error) {
      console.error('Error getting active autonomos:', error);
      return [];
    }
  }

  private getAutonomoConCuotaCompartida(autonomos: Autonomo[]): Autonomo | null {
    return autonomos.find(a => a.activo && a.cuotaAutonomosCompartida)
      ?? autonomos.find(a => a.activo && (a.cuotaAutonomos ?? 0) > 0)
      ?? autonomos.find(a => a.activo)
      ?? null;
  }

  /**
   * Save or update an autonomo
   */
  async saveAutonomo(autonomo: Omit<Autonomo, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Promise<Autonomo> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE], 'readwrite');
      const store = tx.objectStore(STORE);

      const now = new Date().toISOString();

      if (autonomo.cuotaAutonomosCompartida) {
        const index = store.index('personalDataId');
        const existing = (await index.getAll(autonomo.personalDataId)) as Array<any>;
        for (const rec of existing) {
          if (rec.tipo === TIPO && rec.cuotaAutonomosCompartida) {
            rec.cuotaAutonomosCompartida = false;
            rec.fechaActualizacion = now;
            await store.put(rec);
          }
        }
      }

      const newAutonomo: StoredAutonomo = {
        ...autonomo,
        tipo: TIPO,
        fechaCreacion: now,
        fechaActualizacion: now,
      };

      const result = await store.add(newAutonomo);
      const saved: Autonomo = { ...autonomo, id: result as number, fechaCreacion: now, fechaActualizacion: now };

      await tx.done;
      // V4.3: Invalidate fiscal/treasury caches so IRPF and projections refresh
      // El cache key se mantiene como 'autonomos' por compatibilidad con
      // consumidores que aún registran invalidaciones bajo ese nombre.
      invalidateCachedStores(['autonomos', 'ingresos', 'ejerciciosFiscalesCoord', 'treasuryEvents']);
      return saved;
    } catch (error) {
      this.db = null;
      console.error('Error saving autonomo:', error);
      throw error;
    }
  }

  /**
   * Update an existing autonomo
   */
  async updateAutonomo(id: number, updates: Partial<Autonomo>): Promise<Autonomo> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE], 'readwrite');
      const store = tx.objectStore(STORE);

      const existing = await store.get(id);
      if (!existing || existing.tipo !== TIPO) {
        throw new Error('Autonomo not found');
      }

      const now = new Date().toISOString();

      if (updates.cuotaAutonomosCompartida) {
        const index = store.index('personalDataId');
        const all = (await index.getAll(existing.personalDataId)) as Array<any>;
        for (const rec of all) {
          if (rec.id !== id && rec.tipo === TIPO && rec.cuotaAutonomosCompartida) {
            rec.cuotaAutonomosCompartida = false;
            rec.fechaActualizacion = now;
            await store.put(rec);
          }
        }
      }

      const updated: StoredAutonomo = {
        ...(existing as StoredAutonomo),
        ...updates,
        tipo: TIPO,
        fechaActualizacion: now,
      };

      await store.put(updated);
      await tx.done;

      invalidateCachedStores(['autonomos', 'ingresos', 'ejerciciosFiscalesCoord', 'treasuryEvents']);
      return asAutonomo(updated)!;
    } catch (error) {
      this.db = null;
      console.error('Error updating autonomo:', error);
      throw error;
    }
  }

  /**
   * Delete an autonomo
   */
  async deleteAutonomo(id: number): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE], 'readwrite');
      const store = tx.objectStore(STORE);

      const existing = await store.get(id);
      if (existing && existing.tipo !== TIPO) {
        // No borramos registros de otros tipos por id colisionado.
        await tx.done;
        return;
      }
      await store.delete(id);
      await tx.done;
      invalidateCachedStores(['autonomos', 'ingresos', 'ejerciciosFiscalesCoord', 'treasuryEvents']);
    } catch (error) {
      this.db = null;
      console.error('Error deleting autonomo:', error);
      throw error;
    }
  }

  private async mutateAutonomo(
    autonomoId: number,
    mutator: (autonomo: any) => void,
    errorMessage: string,
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE], 'readwrite');
      const store = tx.objectStore(STORE);

      const autonomo = await store.get(autonomoId);
      if (!autonomo || autonomo.tipo !== TIPO) throw new Error('Autonomo not found');

      mutator(autonomo);
      autonomo.fechaActualizacion = new Date().toISOString();
      autonomo.tipo = TIPO;

      await store.put(autonomo);
      await tx.done;
    } catch (error) {
      this.db = null;
      console.error(errorMessage, error);
      throw error;
    }
  }

  /**
   * Calculate autonomo results for a specific month/year
   */
  calculateAutonomoResults(autonomo: Autonomo, year: number, month?: number): CalculoAutonomoResult {
    const { ingresosFacturados, gastosDeducibles, cuotaAutonomos } = autonomo;

    // Filter by month if specified, otherwise use entire year
    const ingresosFiltrados = month
      ? ingresosFacturados.filter(i => new Date(i.fecha).getFullYear() === year && new Date(i.fecha).getMonth() + 1 === month)
      : ingresosFacturados.filter(i => new Date(i.fecha).getFullYear() === year);

    const gastosFiltrados = month
      ? gastosDeducibles.filter(g => new Date(g.fecha).getFullYear() === year && new Date(g.fecha).getMonth() + 1 === month)
      : gastosDeducibles.filter(g => new Date(g.fecha).getFullYear() === year);

    // Calculate total income (net of IVA for accurate calculation)
    const ingresosBrutos = ingresosFiltrados.reduce((total, ingreso) => {
      if (ingreso.conIva && ingreso.tipoIva) {
        // Remove IVA to get net income
        const baseImponible = ingreso.importe / (1 + ingreso.tipoIva / 100);
        return total + baseImponible;
      }
      return total + ingreso.importe;
    }, 0);

    // Calculate total deductible expenses
    const gastos = gastosFiltrados.reduce((total, gasto) => total + gasto.importe, 0);

    // Calculate autonomo fee (monthly or proportional)
    const cuotaPeriodo = month ? cuotaAutonomos : cuotaAutonomos * 12;

    // Calculate net result
    const resultadoNeto = ingresosBrutos - gastos - cuotaPeriodo;

    // Annual calculation
    const resultadoAnual = month
      ? resultadoNeto * 12 // Extrapolate from month
      : resultadoNeto;

    return {
      resultadoNetoMensual: month ? resultadoNeto : resultadoNeto / 12,
      ingresosBrutos,
      gastos,
      cuotaAutonomos: cuotaPeriodo,
      resultadoAnual
    };
  }

  /**
   * Add income to autonomo
   */
  async addIngreso(autonomoId: number, ingreso: Omit<IngresosAutonomo, 'id'>): Promise<void> {
    return this.mutateAutonomo(autonomoId, (a) => {
      const newIngreso: IngresosAutonomo = { ...ingreso, id: Date.now().toString() };
      a.ingresosFacturados.push(newIngreso);
    }, 'Error adding ingreso:');
  }

  /**
   * Add expense to autonomo
   */
  async addGasto(autonomoId: number, gasto: Omit<GastoDeducible, 'id'>): Promise<void> {
    return this.mutateAutonomo(autonomoId, (a) => {
      const newGasto: GastoDeducible = { ...gasto, id: Date.now().toString() };
      a.gastosDeducibles.push(newGasto);
    }, 'Error adding gasto:');
  }

  /**
   * Remove income from autonomo
   */
  async removeIngreso(autonomoId: number, ingresoId: string): Promise<void> {
    return this.mutateAutonomo(autonomoId, (a) => {
      a.ingresosFacturados = a.ingresosFacturados.filter((i: IngresosAutonomo) => i.id !== ingresoId);
    }, 'Error removing ingreso:');
  }

  /**
   * Remove expense from autonomo
   */
  async removeGasto(autonomoId: number, gastoId: string): Promise<void> {
    return this.mutateAutonomo(autonomoId, (a) => {
      a.gastosDeducibles = a.gastosDeducibles.filter((g: GastoDeducible) => g.id !== gastoId);
    }, 'Error removing gasto:');
  }

  /**
   * Add a recurring income source (fuente de ingreso) to autonomo
   */
  async addFuenteIngreso(autonomoId: number, fuente: Omit<FuenteIngreso, 'id'>): Promise<void> {
    return this.mutateAutonomo(autonomoId, (a) => {
      const newFuente: FuenteIngreso = { ...fuente, id: Date.now().toString() };
      a.fuentesIngreso = [...(a.fuentesIngreso || []), newFuente];
    }, 'Error adding fuente de ingreso:');
  }

  /**
   * Remove a recurring income source from autonomo
   */
  async removeFuenteIngreso(autonomoId: number, fuenteId: string): Promise<void> {
    return this.mutateAutonomo(autonomoId, (a) => {
      a.fuentesIngreso = (a.fuentesIngreso || []).filter((f: FuenteIngreso) => f.id !== fuenteId);
    }, 'Error removing fuente de ingreso:');
  }

  /**
   * Update a recurring income source in autonomo
   */
  async updateFuenteIngreso(autonomoId: number, fuenteId: string, updates: Omit<FuenteIngreso, 'id'>): Promise<void> {
    return this.mutateAutonomo(autonomoId, (a) => {
      a.fuentesIngreso = (a.fuentesIngreso || []).map((f: FuenteIngreso) =>
        f.id === fuenteId ? { ...updates, id: fuenteId } : f
      );
    }, 'Error updating fuente de ingreso:');
  }

  /**
   * Update a recurring activity expense in autonomo
   */
  async updateGastoRecurrenteActividad(autonomoId: number, gastoId: string, updates: Omit<GastoRecurrenteActividad, 'id'>): Promise<void> {
    return this.mutateAutonomo(autonomoId, (a) => {
      a.gastosRecurrentesActividad = (a.gastosRecurrentesActividad || []).map((g: GastoRecurrenteActividad) =>
        g.id === gastoId ? { ...updates, id: gastoId } : g
      );
    }, 'Error updating gasto recurrente actividad:');
  }

  /**
   * Add a recurring activity expense to autonomo
   */
  async addGastoRecurrenteActividad(autonomoId: number, gasto: Omit<GastoRecurrenteActividad, 'id'>): Promise<void> {
    return this.mutateAutonomo(autonomoId, (a) => {
      const newGasto: GastoRecurrenteActividad = { ...gasto, id: Date.now().toString() };
      a.gastosRecurrentesActividad = [...(a.gastosRecurrentesActividad || []), newGasto];
    }, 'Error adding gasto recurrente actividad:');
  }

  /**
   * Remove a recurring activity expense from autonomo
   */
  async removeGastoRecurrenteActividad(autonomoId: number, gastoId: string): Promise<void> {
    return this.mutateAutonomo(autonomoId, (a) => {
      a.gastosRecurrentesActividad = (a.gastosRecurrentesActividad || []).filter((g: GastoRecurrenteActividad) => g.id !== gastoId);
    }, 'Error removing gasto recurrente actividad:');
  }

  /**
   * Get quarterly summary for autonomo
   */
  getQuarterlySummary(autonomo: Autonomo, year: number, quarter: number): CalculoAutonomoResult {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;

    let totalIngresos = 0;
    let totalGastos = 0;

    for (let month = startMonth; month <= endMonth; month++) {
      const monthlyResult = this.calculateAutonomoResults(autonomo, year, month);
      totalIngresos += monthlyResult.ingresosBrutos;
      totalGastos += monthlyResult.gastos;
    }

    const cuotaTrimestral = autonomo.cuotaAutonomos * 3;
    const resultadoNeto = totalIngresos - totalGastos - cuotaTrimestral;

    return {
      resultadoNetoMensual: resultadoNeto / 3,
      ingresosBrutos: totalIngresos,
      gastos: totalGastos,
      cuotaAutonomos: cuotaTrimestral,
      resultadoAnual: resultadoNeto * 4 // Extrapolate to year
    };
  }

  /**
   * Calculate estimated annual figures based on fuentesIngreso and gastosRecurrentesActividad.
   * Used for dashboard summary cards.
   */
  calculateEstimatedAnnual(autonomo: Autonomo): { facturacionBruta: number; totalGastos: number; rendimientoNeto: number } {
    return this.calculateEstimatedAnnualForAutonomos([autonomo]);
  }

  calculateEstimatedAnnualForAutonomos(autonomos: Autonomo[]): { facturacionBruta: number; totalGastos: number; rendimientoNeto: number } {
    const activos = autonomos.filter(autonomo => autonomo.activo);
    const sourceAutonomos = activos.length > 0 ? activos : autonomos;
    const autonomoCuota = this.getAutonomoConCuotaCompartida(sourceAutonomos);

    const facturacionBruta = sourceAutonomos.reduce((aggregate, autonomo) => aggregate + (autonomo.fuentesIngreso || []).reduce((total, fuente) => {
      // Use meses array if present; fallback to frecuencia for legacy data
      const occurrences = fuente.meses?.length
        ? fuente.meses.length
        : (() => {
            const frecuenciaMultiplier: Record<string, number> = { mensual: 12, bimestral: 6, trimestral: 4, semestral: 2, anual: 1 };
            return frecuenciaMultiplier[fuente.frecuencia || 'mensual'] ?? 12;
          })();
      return total + fuente.importeEstimado * occurrences;
    }, 0), 0);

    const gastosActividadAnual = sourceAutonomos.reduce((aggregate, autonomo) => aggregate + (autonomo.gastosRecurrentesActividad || []).reduce((total, gasto) => {
      const occurrences = gasto.meses?.length ? gasto.meses.length : 12;
      return total + gasto.importe * occurrences;
    }, 0), 0);
    const totalGastos = (autonomoCuota?.cuotaAutonomos ?? 0) * 12 + gastosActividadAnual;

    return {
      facturacionBruta,
      totalGastos,
      rendimientoNeto: facturacionBruta - totalGastos,
    };
  }

  /**
   * Returns month-by-month (1–12) distribution of income and expenses for a given year.
   * Used by the Previsiones / Tesorería modules to project cash flows.
   */
  getMonthlyDistribution(autonomo: Autonomo): { mes: number; ingresos: number; gastos: number; neto: number }[] {
    return this.getMonthlyDistributionForAutonomos([autonomo]);
  }

  getMonthlyDistributionForAutonomos(autonomos: Autonomo[]): { mes: number; ingresos: number; gastos: number; neto: number }[] {
    const todosMeses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const activos = autonomos.filter(autonomo => autonomo.activo);
    const sourceAutonomos = activos.length > 0 ? activos : autonomos;
    const autonomoCuota = this.getAutonomoConCuotaCompartida(sourceAutonomos);

    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;

      const ingresos = sourceAutonomos.reduce((aggregate, autonomo) => aggregate + (autonomo.fuentesIngreso || []).reduce((total, fuente) => {
        const activeMeses = fuente.meses?.length ? fuente.meses : todosMeses;
        return activeMeses.includes(mes) ? total + fuente.importeEstimado : total;
      }, 0), 0);

      const gastosConcepto = sourceAutonomos.reduce((aggregate, autonomo) => aggregate + (autonomo.gastosRecurrentesActividad || []).reduce((total, gasto) => {
        const activeMeses = gasto.meses?.length ? gasto.meses : todosMeses;
        return activeMeses.includes(mes) ? total + gasto.importe : total;
      }, 0), 0);

      const gastos = gastosConcepto + (autonomoCuota?.cuotaAutonomos ?? 0);

      return { mes, ingresos, gastos, neto: ingresos - gastos };
    });
  }
}

export const autonomoService = new AutonomoService();
