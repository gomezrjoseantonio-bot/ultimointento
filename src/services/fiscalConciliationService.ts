// ATLAS HORIZON: Conciliación Fiscal (Tarea 1.9 Epic #414)
// Produce una estructura de conciliación partida a partida: estimado vs real (Tesorería).

import { initDB } from './db';
import { nominaService } from './nominaService';
import { getGastosRecurrentesFiscales } from './recurringExpensesFiscalService';
import { prestamosService } from './prestamosService';
import { prestamosCalculationService } from './prestamosCalculationService';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type FiscalDataSource = 'estimado' | 'real' | 'mixto';

export interface FiscalLineItem {
  concepto: string;
  categoria: 'ingresos_alquiler' | 'nomina' | 'autonomo' | 'gastos_opex' | 'intereses_hipoteca' | 'otros';
  mes: number;                       // 1–12
  estimado: number;
  real: number | null;               // null = no punteado aún
  fuente: FiscalDataSource;          // 'estimado' | 'real' | 'mixto'
  desviacion: number | null;         // real - estimado
  desviacionPct: number | null;      // % desviación
  // Trazabilidad
  sourceType?: string;
  sourceId?: number;
  movementId?: number | null;
  ingresoId?: number | null;
  gastoId?: number | null;
}

export interface FiscalConciliationResult {
  ejercicio: number;
  generatedAt: string;
  lineas: FiscalLineItem[];
  resumen: {
    totalEstimado: number;
    totalReal: number;
    totalDesviacion: number;
    coberturaPunteo: number;   // % de líneas con dato real vs total líneas
    mesesConReal: number;
    mesesTotales: number;
  };
  porCategoria: Record<string, {
    estimado: number;
    real: number;
    desviacion: number;
    cobertura: number;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Devuelve true si el mes/año es pasado o presente respecto a hoy.
 * Para meses futuros el dato real no puede existir.
 */
export function esMesPasadoOPresente(mes: number, ejercicio: number): boolean {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1; // 1-based
  if (ejercicio < anioActual) return true;
  if (ejercicio > anioActual) return false;
  return mes <= mesActual;
}

/**
 * Construye un FiscalLineItem calculando desviación y fuente.
 */
export function buildLineItem(
  params: Omit<FiscalLineItem, 'fuente' | 'desviacion' | 'desviacionPct'> & {
    ejercicio: number;
  }
): FiscalLineItem {
  const { ejercicio, mes, estimado, real, ...rest } = params;

  // Si el mes es futuro, nunca puede tener dato real
  const esPasado = esMesPasadoOPresente(mes, ejercicio);
  const realEfectivo = esPasado ? real : null;

  let fuente: FiscalDataSource = 'estimado';
  let desviacion: number | null = null;
  let desviacionPct: number | null = null;

  if (realEfectivo !== null) {
    fuente = 'real';
    desviacion = round2(realEfectivo - estimado);
    desviacionPct = estimado !== 0 ? round2((desviacion / Math.abs(estimado)) * 100) : null;
  }

  return {
    ...rest,
    mes,
    estimado,
    real: realEfectivo,
    fuente,
    desviacion,
    desviacionPct,
  };
}

// ─── A) Ingresos alquiler ─────────────────────────────────────────────────────

async function conciliarIngresosAlquiler(
  ejercicio: number,
  properties: any[],
  contracts: any[],
  ingresos: any[]
): Promise<FiscalLineItem[]> {
  const lineas: FiscalLineItem[] = [];

  for (const prop of properties) {
    // Contratos activos para este inmueble en el ejercicio
    const propContracts = contracts.filter((c: any) => {
      if ((c.inmuebleId ?? c.propertyId) !== prop.id) return false;
      const inicio = new Date(c.fechaInicio ?? c.startDate);
      const fin = new Date(c.fechaFin ?? c.endDate ?? `${ejercicio}-12-31`);
      return inicio.getFullYear() <= ejercicio && fin.getFullYear() >= ejercicio;
    });

    if (propContracts.length === 0) continue;

    // Ingresos cobrados para este inmueble en el ejercicio
    const ingresosInmueble = ingresos.filter((i: any) =>
      i.destino === 'inmueble_id' &&
      i.destino_id === prop.id &&
      i.estado === 'cobrado' &&
      i.movement_id != null &&
      (i.ejercicioFiscal == null || i.ejercicioFiscal === ejercicio) &&
      (i.tipoFiscal == null || i.tipoFiscal === 'alquiler')
    );

    for (let mes = 1; mes <= 12; mes++) {
      // ¿Hay algún contrato activo en este mes?
      const contratosDelMes = propContracts.filter((c: any) => {
        const inicio = new Date(c.fechaInicio ?? c.startDate);
        const fin = new Date(c.fechaFin ?? c.endDate ?? `${ejercicio}-12-31`);
        const mesInicio = inicio.getFullYear() < ejercicio ? 1 : inicio.getMonth() + 1;
        const mesFin = fin.getFullYear() > ejercicio ? 12 : fin.getMonth() + 1;
        return mes >= mesInicio && mes <= mesFin;
      });

      if (contratosDelMes.length === 0) continue;

      const contrato = contratosDelMes[0];
      const estimado = round2(contrato.rentaMensual ?? 0);

      // Buscar ingreso cobrado en ese mes
      const ingresoMes = ingresosInmueble.find((i: any) => {
        const fechaCobro = i.fecha_prevista_cobro ?? i.fecha_emision;
        if (!fechaCobro) return false;
        const d = new Date(fechaCobro);
        return d.getFullYear() === ejercicio && d.getMonth() + 1 === mes;
      });

      lineas.push(buildLineItem({
        ejercicio,
        concepto: `Alquiler ${prop.alias ?? prop.id}`,
        categoria: 'ingresos_alquiler',
        mes,
        estimado,
        real: ingresoMes ? round2(ingresoMes.importe) : null,
        sourceType: 'contrato',
        sourceId: contrato.id,
        movementId: ingresoMes?.movement_id ?? null,
        ingresoId: ingresoMes?.id ?? null,
        gastoId: null,
      }));
    }
  }

  return lineas;
}

// ─── B) Nómina ────────────────────────────────────────────────────────────────

async function conciliarNominas(
  ejercicio: number,
  treasuryEvents: any[]
): Promise<FiscalLineItem[]> {
  const lineas: FiscalLineItem[] = [];
  const nominas = await nominaService.getAllActiveNominas();

  for (const nomina of nominas) {
    const calculo = nominaService.calculateSalary(nomina);

    // Eventos de tesorería de tipo nómina confirmados/ejecutados para el ejercicio
    const nominaEvents = treasuryEvents.filter((e: any) =>
      e.sourceType === 'nomina' &&
      (e.status === 'confirmed' || e.status === 'executed') &&
      e.sourceId === nomina.id
    );

    for (const dist of calculo.distribucionMensual) {
      const mes = dist.mes;
      const estimado = round2(dist.netoTotal);

      // Buscar evento de tesorería para este mes
      const eventoMes = nominaEvents.find((e: any) => {
        const fecha = e.actualDate ?? e.predictedDate;
        if (!fecha) return false;
        const d = new Date(fecha);
        return d.getFullYear() === ejercicio && d.getMonth() + 1 === mes;
      });

      lineas.push(buildLineItem({
        ejercicio,
        concepto: `Nómina ${nomina.nombre ?? nomina.id}`,
        categoria: 'nomina',
        mes,
        estimado,
        real: eventoMes ? round2(eventoMes.actualAmount ?? eventoMes.amount) : null,
        sourceType: 'nomina',
        sourceId: nomina.id,
        movementId: eventoMes?.movementId ?? null,
        ingresoId: null,
        gastoId: null,
      }));
    }
  }

  return lineas;
}

// ─── C) Gastos OPEX recurrentes ───────────────────────────────────────────────

async function conciliarGastosOPEX(
  ejercicio: number,
  properties: any[],
  gastos: any[],
  treasuryEvents: any[]
): Promise<FiscalLineItem[]> {
  const lineas: FiscalLineItem[] = [];

  for (const prop of properties) {
    const gastosAnualesPorCasilla = await getGastosRecurrentesFiscales(prop.id!, ejercicio);

    const totalAnualGastos = Object.values(gastosAnualesPorCasilla).reduce((s, v) => s + v, 0);
    if (totalAnualGastos === 0) continue;

    const estimadoMensual = round2(totalAnualGastos / 12);

    // Gastos pagados de Tesorería para este inmueble en el ejercicio
    const gastosPagados = gastos.filter((g: any) =>
      g.destino === 'inmueble_id' &&
      g.destino_id === prop.id &&
      g.estado === 'pagado' &&
      g.movement_id != null &&
      (g.ejercicioFiscal == null || g.ejercicioFiscal === ejercicio)
    );

    // Eventos OPEX confirmados/ejecutados para este inmueble
    const opexEvents = treasuryEvents.filter((e: any) =>
      (e.sourceType === 'opex_rule' || e.sourceType === 'gasto_recurrente') &&
      (e.status === 'confirmed' || e.status === 'executed') &&
      e.sourceId === prop.id
    );

    for (let mes = 1; mes <= 12; mes++) {
      // Buscar gasto pagado en este mes
      const gastoMes = gastosPagados.find((g: any) => {
        const fecha = g.fecha_pago_prevista ?? g.fecha_emision;
        if (!fecha) return false;
        const d = new Date(fecha);
        return d.getFullYear() === ejercicio && d.getMonth() + 1 === mes;
      });

      // Buscar evento OPEX confirmado en este mes
      const eventoMes = !gastoMes ? opexEvents.find((e: any) => {
        const fecha = e.actualDate ?? e.predictedDate;
        if (!fecha) return false;
        const d = new Date(fecha);
        return d.getFullYear() === ejercicio && d.getMonth() + 1 === mes;
      }) : null;

      const realImporte = gastoMes
        ? round2(gastoMes.total)
        : eventoMes
          ? round2(eventoMes.actualAmount ?? eventoMes.amount)
          : null;

      lineas.push(buildLineItem({
        ejercicio,
        concepto: `OPEX ${prop.alias ?? prop.id}`,
        categoria: 'gastos_opex',
        mes,
        estimado: estimadoMensual,
        real: realImporte,
        sourceType: 'opex_rule',
        sourceId: prop.id,
        movementId: gastoMes?.movement_id ?? eventoMes?.movementId ?? null,
        ingresoId: null,
        gastoId: gastoMes?.id ?? null,
      }));
    }
  }

  return lineas;
}

// ─── D) Intereses hipoteca ────────────────────────────────────────────────────

async function conciliarInteresesHipoteca(
  ejercicio: number,
  properties: any[],
  treasuryEvents: any[]
): Promise<FiscalLineItem[]> {
  const lineas: FiscalLineItem[] = [];

  for (const prop of properties) {
    const inmuebleIdStr = prop.id!.toString();
    const prestamos = await prestamosService.getPrestamosByProperty(inmuebleIdStr);
    const prestamoActivos = (prestamos ?? []).filter((p: any) => p.activo);
    if (prestamoActivos.length === 0) continue;

    // Eventos de hipoteca confirmados/ejecutados para el ejercicio
    const hipotecaEvents = treasuryEvents.filter((e: any) =>
      (e.sourceType === 'hipoteca' || e.sourceType === 'prestamo') &&
      (e.status === 'confirmed' || e.status === 'executed') &&
      e.sourceId != null
    );

    // Construir mapa mes → interés estimado desde los planes de pago
    const interesesPorMes: Record<number, number> = {};
    const prestamoIdPorMes: Record<number, string> = {};

    for (const prestamo of prestamoActivos) {
      let plan = await prestamosService.getPaymentPlan(prestamo.id);
      if (!plan) {
        plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
      }
      for (const periodo of plan.periodos) {
        const year = new Date(periodo.fechaCargo).getFullYear();
        const mes = new Date(periodo.fechaCargo).getMonth() + 1;
        if (year === ejercicio) {
          interesesPorMes[mes] = round2((interesesPorMes[mes] ?? 0) + periodo.interes);
          prestamoIdPorMes[mes] = prestamo.id;
        }
      }
    }

    for (let mes = 1; mes <= 12; mes++) {
      const estimado = interesesPorMes[mes] ?? 0;
      if (estimado === 0) continue;

      // Buscar evento de hipoteca confirmado en este mes
      const eventoMes = hipotecaEvents.find((e: any) => {
        const fecha = e.actualDate ?? e.predictedDate;
        if (!fecha) return false;
        const d = new Date(fecha);
        return d.getFullYear() === ejercicio && d.getMonth() + 1 === mes;
      });

      lineas.push(buildLineItem({
        ejercicio,
        concepto: `Intereses hipoteca ${prop.alias ?? prop.id}`,
        categoria: 'intereses_hipoteca',
        mes,
        estimado,
        real: eventoMes ? round2(eventoMes.actualAmount ?? eventoMes.amount) : null,
        sourceType: 'prestamo',
        sourceId: prop.id,
        movementId: eventoMes?.movementId ?? null,
        ingresoId: null,
        gastoId: null,
      }));
    }
  }

  return lineas;
}

// ─── E) Autónomo ──────────────────────────────────────────────────────────────

async function conciliarAutonomo(
  ejercicio: number,
  treasuryEvents: any[]
): Promise<FiscalLineItem[]> {
  const lineas: FiscalLineItem[] = [];

  const db = await initDB();
  const allAutonomos = await db.getAll('autonomos');
  const activo = allAutonomos.find((a: any) => a.activo);
  if (!activo) return lineas;

  // Eventos autónomo confirmados/ejecutados
  const autoEvents = treasuryEvents.filter((e: any) =>
    (e.sourceType === 'autonomo' || e.sourceType === 'autonomo_ingreso') &&
    (e.status === 'confirmed' || e.status === 'executed')
  );

  // Ingresos estimados por mes
  for (const fuente of activo.fuentesIngreso ?? []) {
    const meses: number[] = Array.isArray(fuente.meses) && fuente.meses.length > 0
      ? fuente.meses
      : Array.from({ length: 12 }, (_, i) => i + 1);
    const estimadoMes = round2(fuente.importeEstimado ?? 0);

    for (const mes of meses) {
      const eventoMes = autoEvents.find((e: any) => {
        const fecha = e.actualDate ?? e.predictedDate;
        if (!fecha) return false;
        const d = new Date(fecha);
        return d.getFullYear() === ejercicio && d.getMonth() + 1 === mes && e.type === 'income';
      });

      lineas.push(buildLineItem({
        ejercicio,
        concepto: `Ingreso autónomo ${fuente.nombre ?? fuente.id ?? ''}`,
        categoria: 'autonomo',
        mes,
        estimado: estimadoMes,
        real: eventoMes ? round2(eventoMes.actualAmount ?? eventoMes.amount) : null,
        sourceType: 'autonomo_ingreso',
        sourceId: activo.id,
        movementId: eventoMes?.movementId ?? null,
        ingresoId: null,
        gastoId: null,
      }));
    }
  }

  return lineas;
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Concilia el ejercicio fiscal completo: para cada partida, devuelve el importe
 * estimado (contratos/nóminas/reglas) y el importe real (movimientos punteados
 * en Tesorería), con la desviación entre ambos.
 */
export async function conciliarEjercicioFiscal(
  ejercicio: number
): Promise<FiscalConciliationResult> {
  const db = await initDB();

  const [properties, contracts, ingresos, gastos, treasuryEvents] = await Promise.all([
    db.getAll('properties'),
    db.getAll('contracts'),
    db.getAll('ingresos'),
    db.getAll('gastos'),
    db.getAll('treasuryEvents'),
  ]);

  const activeProperties = (properties as any[]).filter((p: any) => p.state === 'activo');

  const [
    lineasAlquiler,
    lineasNomina,
    lineasOPEX,
    lineasHipoteca,
    lineasAutonomo,
  ] = await Promise.all([
    conciliarIngresosAlquiler(ejercicio, activeProperties, contracts as any[], ingresos as any[]),
    conciliarNominas(ejercicio, treasuryEvents as any[]),
    conciliarGastosOPEX(ejercicio, activeProperties, gastos as any[], treasuryEvents as any[]),
    conciliarInteresesHipoteca(ejercicio, activeProperties, treasuryEvents as any[]),
    conciliarAutonomo(ejercicio, treasuryEvents as any[]),
  ]);

  const lineas: FiscalLineItem[] = [
    ...lineasAlquiler,
    ...lineasNomina,
    ...lineasOPEX,
    ...lineasHipoteca,
    ...lineasAutonomo,
  ];

  // ─── Resumen global ───────────────────────────────────────────────────────
  const mesesTotales = lineas.length;
  const mesesConReal = lineas.filter(l => l.real !== null).length;
  const totalEstimado = round2(lineas.reduce((s, l) => s + l.estimado, 0));
  const totalReal = round2(lineas.filter(l => l.real !== null).reduce((s, l) => s + l.real!, 0));
  const totalDesviacion = round2(lineas.filter(l => l.desviacion !== null).reduce((s, l) => s + l.desviacion!, 0));
  const coberturaPunteo = mesesTotales > 0 ? round2((mesesConReal / mesesTotales) * 100) : 0;

  // ─── Por categoría ────────────────────────────────────────────────────────
  const categorias = ['ingresos_alquiler', 'nomina', 'autonomo', 'gastos_opex', 'intereses_hipoteca', 'otros'] as const;
  const porCategoria: FiscalConciliationResult['porCategoria'] = {};

  for (const cat of categorias) {
    const catLineas = lineas.filter(l => l.categoria === cat);
    if (catLineas.length === 0) continue;
    const catEstimado = round2(catLineas.reduce((s, l) => s + l.estimado, 0));
    const catReal = round2(catLineas.filter(l => l.real !== null).reduce((s, l) => s + l.real!, 0));
    const catDesviacion = round2(catLineas.filter(l => l.desviacion !== null).reduce((s, l) => s + l.desviacion!, 0));
    const catConReal = catLineas.filter(l => l.real !== null).length;
    const catCobertura = catLineas.length > 0 ? round2((catConReal / catLineas.length) * 100) : 0;
    porCategoria[cat] = { estimado: catEstimado, real: catReal, desviacion: catDesviacion, cobertura: catCobertura };
  }

  return {
    ejercicio,
    generatedAt: new Date().toISOString(),
    lineas,
    resumen: {
      totalEstimado,
      totalReal,
      totalDesviacion,
      coberturaPunteo,
      mesesConReal,
      mesesTotales,
    },
    porCategoria,
  };
}

// ─── Helper de consulta ───────────────────────────────────────────────────────

/**
 * Devuelve el importe "mejor disponible" para una categoría (y opcionalmente mes).
 * Usa dato real si existe, si no usa el estimado.
 */
export function obtenerImporteFiscalConciliado(
  lineas: FiscalLineItem[],
  categoria: string,
  mes?: number
): number {
  const filtered = lineas.filter(l =>
    l.categoria === categoria && (mes === undefined || l.mes === mes)
  );
  return round2(filtered.reduce((sum, l) => {
    return sum + (l.real !== null ? l.real : l.estimado);
  }, 0));
}
