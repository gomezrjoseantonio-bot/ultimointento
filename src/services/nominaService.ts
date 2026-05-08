import { initDB } from './db';
import {
  Nomina,
  Variable,
  ReglaDia,
  RetencionNomina,
  CalculoNominaResult,
  DistribucionMensualResult,
  NominaHistorialEntry,
  NominaRetributivoSnapshot,
} from '../types/personal';
import { getBaseMaxima, getSSDefaults } from '../constants/cotizacionSS';
import { invalidateCachedStores } from './indexedDbCacheService';

// PR-C4 · helpers de resolución del historial retributivo.

const genHistorialEntryId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * PR-C4 · resuelve la entrada del historial vigente para `ymd` (YYYY-MM-DD)
 * sobre un historial **ya ordenado** ascendentemente por `vigenciaDesde`.
 * Devuelve null si el array está vacío o ninguna entrada cualifica.
 *
 * El caller es responsable de ordenar una sola vez. Ver
 * `getSortedHistorial` para el helper que ordena defensivamente.
 */
function resolveSnapshotForFechaSorted(
  ordenado: NominaHistorialEntry[],
  ymd: string,
): NominaRetributivoSnapshot | null {
  if (ordenado.length === 0) return null;
  let activa: NominaHistorialEntry | null = null;
  for (const e of ordenado) {
    if (e.vigenciaDesde <= ymd) activa = e;
    else break;
  }
  return activa ? activa.snapshot : null;
}

/**
 * PR-C4 · ordena defensivamente el historial por `vigenciaDesde` ASC.
 * Devuelve `[]` si la nómina no tiene historial. Llamarse UNA VEZ por
 * cómputo (perf · evita 12 sorts en `calculateSalary`).
 */
function getSortedHistorial(nomina: Nomina): NominaHistorialEntry[] {
  if (!nomina.historial || nomina.historial.length === 0) return [];
  return [...nomina.historial].sort((a, b) =>
    a.vigenciaDesde.localeCompare(b.vigenciaDesde),
  );
}

/**
 * PR-C4 · aplica un snapshot retributivo sobre el registro Nomina,
 * sustituyendo solo los campos versionados. Si `snapshot` es null,
 * devuelve la nómina sin cambios (retrocompatibilidad pre-V70 · sin
 * historial · campos top-level rigen).
 */
function applySnapshot(
  nomina: Nomina,
  snapshot: NominaRetributivoSnapshot | null,
): Nomina {
  if (!snapshot) return nomina;
  return {
    ...nomina,
    salarioBrutoAnual: snapshot.salarioBrutoAnual,
    variables: snapshot.variables ?? nomina.variables,
    bonus: snapshot.bonus ?? nomina.bonus,
    pagasExtra: snapshot.pagasExtra ?? nomina.pagasExtra,
    variableObjetivo: snapshot.variableObjetivo ?? nomina.variableObjetivo,
    bonusObjetivo: snapshot.bonusObjetivo ?? nomina.bonusObjetivo,
    retribucionEspecieAnual:
      snapshot.retribucionEspecieAnual ?? nomina.retribucionEspecieAnual,
    aportacionEmpresaPlanPensionesAnual:
      snapshot.aportacionEmpresaPlanPensionesAnual ??
      nomina.aportacionEmpresaPlanPensionesAnual,
    planPensiones: snapshot.planPensiones ?? nomina.planPensiones,
  };
}

/**
 * PR-C4 · construye un snapshot retributivo desde los campos top-level
 * actuales de una Nomina. Solo serializa campos definidos para evitar
 * persistir `undefined` en IndexedDB.
 *
 * Exportado para uso desde la UI (NominaWizard) cuando se registra un
 * cambio con vigencia y se necesita capturar el snapshot completo.
 */
export function buildSnapshotFromNomina(n: Nomina): NominaRetributivoSnapshot {
  const snap: NominaRetributivoSnapshot = {
    salarioBrutoAnual: n.salarioBrutoAnual,
  };
  if (n.variables !== undefined) snap.variables = n.variables;
  if (n.bonus !== undefined) snap.bonus = n.bonus;
  if (n.pagasExtra !== undefined) snap.pagasExtra = n.pagasExtra;
  if (n.variableObjetivo !== undefined) snap.variableObjetivo = n.variableObjetivo;
  if (n.bonusObjetivo !== undefined) snap.bonusObjetivo = n.bonusObjetivo;
  if (n.retribucionEspecieAnual !== undefined) {
    snap.retribucionEspecieAnual = n.retribucionEspecieAnual;
  }
  if (n.aportacionEmpresaPlanPensionesAnual !== undefined) {
    snap.aportacionEmpresaPlanPensionesAnual = n.aportacionEmpresaPlanPensionesAnual;
  }
  if (n.planPensiones !== undefined) snap.planPensiones = n.planPensiones;
  return snap;
}

class NominaService {
  private db: any = null;

  private async getDB() {
    if (!this.db) {
      this.db = await initDB();
    }
    return this.db;
  }

  /**
   * Apply defaults to a nomina loaded from the database (backward compatibility).
   *
   * The wizard UI only exposes a fixed SS retention breakdown (4 percentages
   * for the current year + cuota solidaridad) and does not surface
   * `deduccionesAdicionales`. If legacy records keep stale SS rates (e.g. MEI
   * from a prior year) or hidden recurring deductions imported via XLSX,
   * calculateSalary would diverge from what the wizard displays. To keep
   * every screen consistent with the wizard, we refresh the SS rates (unless
   * the user explicitly flagged `overrideManual`) and drop the hidden
   * deductions on load.
   */
  private applyDefaults(nomina: any): Nomina {
    const now = new Date().toISOString();
    const currentYear = new Date().getFullYear();
    const ssConfig = getSSDefaults(currentYear);

    const freshSs = {
      baseCotizacionMensual: getBaseMaxima(currentYear),
      contingenciasComunes: ssConfig.contingenciasComunes.trabajador,
      desempleo: ssConfig.desempleo.trabajador,
      formacionProfesional: ssConfig.formacionProfesional.trabajador,
      mei: ssConfig.mei.trabajador,
      overrideManual: false,
    };

    // Migrate old retencion format { irpfPorcentaje, cotizacionSS } → new RetencionNomina
    let retencion: RetencionNomina;
    if (nomina.retencion && typeof (nomina.retencion as any).cotizacionSS === 'number') {
      retencion = {
        irpfPorcentaje: nomina.retencion.irpfPorcentaje ?? 24,
        ss: freshSs,
      };
    } else if (nomina.retencion && nomina.retencion.ss) {
      const storedSs = nomina.retencion.ss;
      retencion = {
        ...(nomina.retencion as RetencionNomina),
        // Keep user-provided values only when they explicitly opted out of
        // automatic refresh. Otherwise normalise to current-year defaults so
        // the wizard preview matches what calculateSalary computes.
        ss: storedSs.overrideManual ? storedSs : freshSs,
      };
    } else {
      retencion = {
        irpfPorcentaje: 24,
        ss: freshSs,
      };
    }

    return {
      ...nomina,
      titular: nomina.titular ?? 'yo',
      fechaAntiguedad: nomina.fechaAntiguedad ?? nomina.fechaCreacion ?? now,
      beneficiosSociales: nomina.beneficiosSociales ?? [],
      // The wizard does not expose these; drop hidden entries so the form and
      // every downstream view (Gestión Personal, Supervisión, Presupuesto)
      // compute the same liquid.
      deduccionesAdicionales: [],
      retencion,
    } satisfies Nomina;
  }

  /**
   * V63 (TAREA 7 sub-tarea 4 · deuda sub-tarea 2): el store legacy
   * `nominas` ha sido eliminado. Los registros viven ahora en el store
   * unificado `ingresos` con `tipo='nomina'`. Este servicio actúa como
   * adaptador.
   */
  // === Constantes internas para el adaptador ============================
  private readonly STORE = 'ingresos' as const;
  private readonly TIPO = 'nomina' as const;

  /**
   * Get all nominas for a personal data ID
   */
  async getNominas(personalDataId: number): Promise<Nomina[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([this.STORE], 'readonly');
      const store = transaction.objectStore(this.STORE);
      const index = store.index('personalDataId');
      const all = await index.getAll(personalDataId);
      return (all || [])
        .filter((n: any) => n.tipo === this.TIPO)
        .map((n: any) => this.applyDefaults(n));
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
      const transaction = db.transaction([this.STORE], 'readonly');
      const store = transaction.objectStore(this.STORE);
      const allIngresos = await store.getAll();
      return (allIngresos || [])
        .filter((n: any) => n.tipo === this.TIPO && n.activa === true)
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
   * Get a single nomina by its primary key id
   */
  async getNominaById(id: number): Promise<Nomina | null> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.STORE], 'readonly');
      const store = tx.objectStore(this.STORE);
      const nomina = await store.get(id);
      if (!nomina || nomina.tipo !== this.TIPO) return null;
      return this.applyDefaults(nomina);
    } catch (error) {
      console.error('Error getting nomina by id:', error);
      return null;
    }
  }

  /**
   * Save or update a nomina
   */
  async saveNomina(nomina: Omit<Nomina, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Promise<Nomina> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.STORE], 'readwrite');
      const store = tx.objectStore(this.STORE);

      const now = new Date().toISOString();

      // PR-C4 · al alta inicializa `historial` con un snapshot anclado a
      // la fecha de antigüedad (o creación si no la hay). Mantiene el
      // invariante "última entrada coincide con campos top-level".
      const vigenciaInicial =
        (nomina.fechaAntiguedad ?? now).slice(0, 10);
      const historialInicial: NominaHistorialEntry[] = [
        {
          id: genHistorialEntryId(),
          vigenciaDesde: vigenciaInicial,
          motivo: 'Snapshot inicial · alta',
          snapshot: buildSnapshotFromNomina(nomina as Nomina),
          createdAt: now,
        },
      ];

      const newNomina: Nomina = {
        ...nomina,
        fechaCreacion: now,
        fechaActualizacion: now,
        historial: nomina.historial && nomina.historial.length > 0
          ? nomina.historial
          : historialInicial,
      };

      const result = await store.add({ ...newNomina, tipo: this.TIPO } as any);
      newNomina.id = result as number;

      await tx.done;
      // V4.3: Invalidate fiscal/treasury caches so IRPF and projections refresh
      invalidateCachedStores(['nominas', 'ingresos', 'ejerciciosFiscalesCoord', 'treasuryEvents']);
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
      const tx = db.transaction([this.STORE], 'readwrite');
      const store = tx.objectStore(this.STORE);

      const existing = await store.get(id);
      if (!existing || existing.tipo !== this.TIPO) {
        throw new Error('Nomina not found');
      }

      const now = new Date().toISOString();

      const updated = {
        ...existing,
        ...updates,
        tipo: this.TIPO,
        fechaActualizacion: now
      };

      await store.put(updated);
      await tx.done;

      // V4.3: Invalidate fiscal/treasury caches so IRPF and projections refresh
      invalidateCachedStores(['nominas', 'ingresos', 'ejerciciosFiscalesCoord', 'treasuryEvents']);
      const { tipo, ...rest } = updated;
      void tipo;
      return rest as Nomina;
    } catch (error) {
      this.db = null;
      console.error('Error updating nomina:', error);
      throw error;
    }
  }

  /**
   * PR-C4 · añade una entrada al historial de la nómina. NO sobrescribe
   * el último snapshot · NO toca los campos top-level salvo cuando la
   * entrada nueva sea la más reciente del historial (en cuyo caso los
   * top-level se sincronizan para que los lectores legacy sigan viendo
   * el "estado actual").
   *
   * Si `vigenciaDesde` < última entrada, el array se reordena y los
   * top-level NO cambian (es un cambio histórico tardío). Se loguea
   * un warning informativo.
   *
   * Si la nómina no tiene `historial` previo (pre-V70 sin migrar), se
   * inserta primero un baseline con los valores top-level actuales para
   * preservar el cálculo histórico.
   *
   * @param id ID de la nómina
   * @param cambio entrada del historial sin `id`/`createdAt` (los pone el service)
   * @param nonVersionedUpdates (review Copilot) · campos no versionados que
   *   también deben actualizarse al guardar (`nombre`, `fechaAntiguedad`,
   *   `beneficiosSociales`, `retencion`, `cuentaAbono`, `reglaCobroDia`...)
   *   · todo lo que la UI haya editado y NO forme parte del snapshot.
   */
  async addCambioNomina(
    id: number,
    cambio: Omit<NominaHistorialEntry, 'id' | 'createdAt'>,
    nonVersionedUpdates?: Partial<Nomina>,
  ): Promise<Nomina> {
    if (!cambio.vigenciaDesde) {
      throw new Error('addCambioNomina: vigenciaDesde es requerido');
    }
    if (
      typeof cambio.snapshot?.salarioBrutoAnual !== 'number' ||
      cambio.snapshot.salarioBrutoAnual <= 0
    ) {
      throw new Error('addCambioNomina: snapshot.salarioBrutoAnual debe ser > 0');
    }

    const existing = await this.getNominaById(id);
    if (!existing) {
      throw new Error(`Nomina ${id} no encontrada`);
    }

    const ahora = new Date().toISOString();

    // PR-C4 (review Copilot · correctness) · si la nómina no tiene
    // baseline en el historial (registro pre-V70 sin migrar, o historial
    // borrado manualmente), insertar primero un snapshot de los valores
    // top-level vigentes con `vigenciaDesde = fechaAntiguedad`. Sin esto,
    // tras añadir un cambio futuro y sincronizar top-level al snapshot
    // nuevo, los meses anteriores caerían a top-level (ya actualizado),
    // destruyendo el histórico.
    const baseExistente = existing.historial ?? [];
    const baselineEntries: NominaHistorialEntry[] =
      baseExistente.length === 0
        ? [
            {
              id: genHistorialEntryId(),
              vigenciaDesde: (
                existing.fechaAntiguedad ??
                existing.fechaCreacion ??
                '1970-01-01'
              ).slice(0, 10),
              motivo: 'Snapshot inicial · auto-baseline en addCambioNomina',
              snapshot: buildSnapshotFromNomina(existing),
              createdAt: ahora,
            },
          ]
        : [];

    const entrada: NominaHistorialEntry = {
      id: genHistorialEntryId(),
      createdAt: ahora,
      vigenciaDesde: cambio.vigenciaDesde.slice(0, 10),
      motivo: cambio.motivo,
      snapshot: cambio.snapshot,
    };

    const historial = [...baseExistente, ...baselineEntries, entrada].sort(
      (a, b) => a.vigenciaDesde.localeCompare(b.vigenciaDesde),
    );

    const esLaMasReciente =
      historial[historial.length - 1].id === entrada.id;

    // PR-C4 (review Copilot) · campos no versionados (nombre,
    // fechaAntiguedad, beneficiosSociales, retencion, cuentaAbono,
    // reglaCobroDia...) deben aplicarse SIEMPRE para que cambios
    // editados en la UI no se pierdan en modo cambio-con-vigencia.
    const updates: Partial<Nomina> = {
      ...(nonVersionedUpdates ?? {}),
      historial,
    };
    if (esLaMasReciente) {
      // Sincronizar campos top-level con el snapshot vigente.
      Object.assign(updates, entrada.snapshot);
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        '[nominaService] addCambioNomina · entrada con vigenciaDesde anterior al historial existente · ' +
          'no se sincronizan campos top-level (siguen reflejando el estado actual más reciente)',
      );
    }

    return this.updateNomina(id, updates);
  }

  /**
   * Delete a nomina
   */
  async deleteNomina(id: number): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([this.STORE], 'readwrite');
      const store = tx.objectStore(this.STORE);

      const existing = await store.get(id);
      if (existing && existing.tipo !== this.TIPO) {
        await tx.done;
        return;
      }
      await store.delete(id);
      await tx.done;
      // V4.3: Invalidate fiscal/treasury caches
      invalidateCachedStores(['nominas', 'ingresos', 'ejerciciosFiscalesCoord', 'treasuryEvents']);
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
   *
   * PR-C4 · si la nómina tiene `historial`, cada mes se resuelve contra
   * el snapshot vigente (`vigenciaDesde <= primerDiaDelMes` más reciente).
   * El parámetro `year` ancla la resolución al ejercicio que se está
   * calculando; default = año en curso. Con `historial` vacío o ausente,
   * se usan los campos top-level (retrocompatibilidad pre-V70).
   */
  calculateSalary(nomina: Nomina, year?: number): CalculoNominaResult {
    const resolutionYear = year ?? new Date().getFullYear();
    const { distribucion } = nomina;
    const retencion = nomina.retencion;
    const beneficiosSociales = nomina.beneficiosSociales ?? [];
    const deduccionesAdicionales = nomina.deduccionesAdicionales ?? [];

    // How many salary units to divide the annual base into
    const mesesDistribucion =
      distribucion.tipo === 'personalizado'
        ? distribucion.meses || 12
        : distribucion.tipo === 'catorce'
        ? 14
        : 12;

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

    // PR-C4 (review Copilot · perf) · ordenar el historial UNA SOLA VEZ
    // fuera del loop. Antes hacía hasta 12 sorts por cómputo, lo que se
    // multiplicaba en pantallas que recalculan muchas nóminas.
    const historialOrdenado = getSortedHistorial(nomina);

    for (let mes = 1; mes <= 12; mes++) {
      // PR-C4 · per-month resolution del snapshot retributivo. Si no hay
      // historial, `efectiva === nomina` (retrocompatibilidad).
      const ymd = `${resolutionYear}-${String(mes).padStart(2, '0')}-01`;
      const snapshotMes = resolveSnapshotForFechaSorted(historialOrdenado, ymd);
      const efectiva = applySnapshot(nomina, snapshotMes);
      const salarioBrutoAnual = efectiva.salarioBrutoAnual;
      const variables = efectiva.variables;
      const bonus = efectiva.bonus;
      const planPensiones = efectiva.planPensiones;
      const salarioBaseMensual = salarioBrutoAnual / mesesDistribucion;

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
