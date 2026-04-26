// ATLAS — T23: Estimación fiscal del ejercicio en curso (tiempo real)
// Recalcula cada vez que se abre la vista Estado o se registra un dato nuevo.

import { initDB } from './db';
import { calcularDeclaracionIRPF, round2, DeclaracionIRPF } from './irpfCalculationService';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EstimacionEjercicioEnCurso {
  ejercicio: number;
  fechaCalculo: string;
  ingresosAcumulados: {
    trabajo: number;
    inmuebles: number;
    actividades: number;
    capitalMobiliario: number;
  };
  ingresosProyectados: {
    trabajo: number;
    inmuebles: number;
    actividades: number;
    capitalMobiliario: number;
  };
  resultadoEstimado: {
    baseImponibleGeneral: number;
    cuotaLiquida: number;
    retencionesEstimadas: number;
    resultadoEstimado: number; // + pagar, - devolver
    tipoMedioEstimado: number;
  };
  cobertura: {
    mesesConDatos: number;
    inmueblesConGastos: number;
    retencionesConfirmadas: boolean;
  };
  declaracionCompleta: DeclaracionIRPF;
}

export type NivelConfianza = 'alta' | 'estimacion' | 'parcial';

export function getNivelConfianza(mesesConDatos: number): NivelConfianza {
  if (mesesConDatos >= 9) return 'alta';
  if (mesesConDatos >= 6) return 'estimacion';
  return 'parcial';
}

export function getConfianzaLabel(nivel: NivelConfianza): string {
  switch (nivel) {
    case 'alta': return 'Alta confianza';
    case 'estimacion': return 'Estimación';
    case 'parcial': return 'Datos parciales';
  }
}

export function getConfianzaStyles(nivel: NivelConfianza): { background: string; color: string } {
  switch (nivel) {
    case 'alta':
      return { background: 'var(--s-pos-bg)', color: 'var(--s-pos)' };
    case 'estimacion':
      return { background: 'var(--s-warn-bg)', color: 'var(--s-warn)' };
    case 'parcial':
      return { background: 'var(--n-100)', color: 'var(--n-500)' };
  }
}

// ─── Cálculo de meses con datos ──────────────────────────────────────────────

/**
 * BUG-07 · Decisión A: usa treasuryEvents para determinar meses con datos de renta.
 * Filtro: type='income' + (categoryKey IN ['renta','alquiler'] OR sourceType='contrato')
 * + status IN ['confirmed','executed'] + año del evento = ejercicio.
 * AMBIGÜEDAD DOCUMENTADA: spec dice categoryKey='renta' pero el catálogo usa 'alquiler';
 * se acepta ambos para garantizar compatibilidad con datos históricos de distinto origen.
 * Ref: docs/CIERRE-DEUDAS-PRE-RESET.md · BUG-07.
 */
async function calcularMesesConDatos(ejercicio: number): Promise<number> {
  const db = await initDB();
  const mesesConDatos = new Set<number>();

  // Load all data sources in parallel
  // V5.6: rentaMensual is DEPRECATED — use treasuryEvents for rent income
  const [treasuryEvts, movements, gastos] = await Promise.all([
    db.getAll('treasuryEvents').catch(() => [] as any[]),
    db.getAll('movements').catch(() => [] as any[]),
    (await import('./gastosInmuebleService')).gastosInmuebleService.getAll().catch(() => [] as any[]),
  ]);

  // V5.6: Use treasuryEvents for rent income months (replaces rentaMensual)
  // Filter: type='income', confirmed/executed status, rent-related category, year matches
  const RENTA_CATEGORY_KEYS = new Set(['renta', 'alquiler', 'renta_inmueble']);
  for (const evt of treasuryEvts as any[]) {
    const evtType = String(evt?.type ?? '').toLowerCase();
    const evtStatus = String(evt?.status ?? '').toLowerCase();
    const evtCategoryKey = String(evt?.categoryKey ?? '').toLowerCase();
    const evtSourceType = String(evt?.sourceType ?? '').toLowerCase();

    if (evtType !== 'income') continue;
    if (evtStatus !== 'confirmed' && evtStatus !== 'executed') continue;
    const isRentEvent = RENTA_CATEGORY_KEYS.has(evtCategoryKey) || evtSourceType === 'contrato';
    if (!isRentEvent) continue;

    // Extract year/month from actualDate (confirmed) or predictedDate
    const fechaStr: string | undefined = evt?.actualDate ?? evt?.predictedDate;
    if (fechaStr) {
      const d = new Date(fechaStr);
      if (d.getFullYear() === ejercicio) mesesConDatos.add(d.getMonth());
    } else if (evt?.año === ejercicio && evt?.mes != null) {
      mesesConDatos.add(evt.mes - 1); // mes is 1-indexed
    }
  }

  const extractMonths = (records: any[], fechaKeys: string[]) => {
    for (const r of records) {
      const fecha = fechaKeys.reduce<string | undefined>((acc, k) => acc ?? (r as any)[k], undefined);
      if (fecha) {
        const d = new Date(fecha);
        if (d.getFullYear() === ejercicio) mesesConDatos.add(d.getMonth());
      }
    }
  };

  extractMonths(movements, ['fecha', 'date']);
  extractMonths(gastos, ['fecha', 'date']);

  return mesesConDatos.size;
}

// ─── Proyección inteligente de inmuebles ─────────────────────────────────────

async function calcularIngresosProyectadosInmuebles(ejercicio: number): Promise<number> {
  const db = await initDB();
  const contracts = await db.getAll('contracts');
  const now = new Date();
  const mesActual = now.getFullYear() === ejercicio ? now.getMonth() : 11;

  let totalProyectado = 0;

  const contratosActivos = contracts.filter((c: any) => {
    const estado = c.estadoContrato ?? c.status;
    if (estado === 'finalizado' || estado === 'ended' || estado === 'cancelled') return false;
    const inicio = new Date(c.fechaInicio ?? c.startDate);
    const fin = new Date(c.fechaFin ?? c.endDate ?? `${ejercicio}-12-31`);
    return inicio.getFullYear() <= ejercicio && fin.getFullYear() >= ejercicio;
  });

  for (const contract of contratosActivos) {
    const renta = (contract as any).rentaMensual ?? 0;
    if (renta <= 0) continue;

    const fin = new Date((contract as any).fechaFin ?? (contract as any).endDate ?? `${ejercicio}-12-31`);

    // Meses restantes del año (desde mesActual+1 hasta el fin del contrato o diciembre)
    const mesFin = fin.getFullYear() > ejercicio ? 11 : fin.getMonth();
    const mesesRestantes = Math.max(0, mesFin - mesActual);

    totalProyectado += renta * mesesRestantes;
  }

  return round2(totalProyectado);
}

// ─── Cobertura de gastos por inmueble ────────────────────────────────────────

async function calcularInmueblesConGastos(ejercicio: number): Promise<number> {
  const db = await initDB();
  const gastosInmuebleService = (await import('./gastosInmuebleService')).gastosInmuebleService;
  const [properties, allGastos] = await Promise.all([
    db.getAll('properties'),
    gastosInmuebleService.getByEjercicio(ejercicio),
  ]);

  const activas = properties.filter((p: any) => p.state === 'activo');

  // Sum gastos by propertyId
  const gastosByProp = new Map<number, number>();
  for (const g of allGastos) {
    gastosByProp.set(g.inmuebleId, (gastosByProp.get(g.inmuebleId) || 0) + g.importe);
  }

  let count = 0;
  for (const prop of activas) {
    const totalGastos = gastosByProp.get(prop.id!) || 0;
    if (totalGastos > 0) count++;
  }

  return count;
}

// ─── Función principal ───────────────────────────────────────────────────────

export async function calcularEstimacionEnCurso(
  ejercicio?: number
): Promise<EstimacionEjercicioEnCurso | null> {
  const ej = ejercicio ?? new Date().getFullYear();

  try {
    // Calcular declaración IRPF completa con los datos disponibles
    const declaracion = await calcularDeclaracionIRPF(ej);

    // Calcular cobertura
    const [mesesConDatos, inmueblesConGastos] = await Promise.all([
      calcularMesesConDatos(ej),
      calcularInmueblesConGastos(ej),
    ]);

    // Ingresos acumulados (de la declaración calculada)
    const trabajo = declaracion.baseGeneral.rendimientosTrabajo;
    const autonomo = declaracion.baseGeneral.rendimientosAutonomo;
    const inmuebles = declaracion.baseGeneral.rendimientosInmuebles;
    const capitalMob = declaracion.baseAhorro.capitalMobiliario;

    const ingresosAcumulados = {
      trabajo: round2(trabajo?.salarioBrutoAnual ?? 0),
      inmuebles: round2(inmuebles.reduce((s, i) => s + i.ingresosIntegros, 0)),
      actividades: round2(autonomo?.ingresos ?? 0),
      capitalMobiliario: round2(capitalMob.total),
    };

    // Proyecciones inteligentes
    const ingresosProyectadosInmuebles = await calcularIngresosProyectadosInmuebles(ej);

    const ingresosProyectados = {
      trabajo: ingresosAcumulados.trabajo, // Nóminas son anuales, ya proyectadas
      inmuebles: round2(ingresosAcumulados.inmuebles + ingresosProyectadosInmuebles),
      actividades: ingresosAcumulados.actividades,
      capitalMobiliario: ingresosAcumulados.capitalMobiliario,
    };

    // Retenciones confirmadas si hay nóminas o M130
    const retencionesConfirmadas = (declaracion.retenciones.trabajo > 0) ||
      (declaracion.retenciones.autonomoM130 > 0);

    const resultadoEstimado = {
      baseImponibleGeneral: declaracion.liquidacion.baseImponibleGeneral,
      cuotaLiquida: declaracion.liquidacion.cuotaLiquida,
      retencionesEstimadas: declaracion.retenciones.total,
      resultadoEstimado: declaracion.resultado,
      tipoMedioEstimado: declaracion.tipoEfectivo,
    };

    return {
      ejercicio: ej,
      fechaCalculo: new Date().toISOString(),
      ingresosAcumulados,
      ingresosProyectados,
      resultadoEstimado,
      cobertura: {
        mesesConDatos,
        inmueblesConGastos,
        retencionesConfirmadas,
      },
      declaracionCompleta: declaracion,
    };
  } catch (error) {
    console.error('[EstimacionEnCurso] Error calculando estimación:', error);
    return null;
  }
}
