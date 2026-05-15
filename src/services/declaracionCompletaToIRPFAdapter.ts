/**
 * declaracionCompletaToIRPFAdapter.ts
 *
 * Adapter de SOLO LECTURA · convierte la `DeclaracionCompleta` que
 * persistimos en `ejerciciosFiscalesCoord[año].aeat.declaracionCompleta`
 * (forma XML AEAT) a un `Partial<DeclaracionIRPF>` con la forma que
 * espera el motor de Atlas y, en particular, los builders de UI fiscal v2
 * (`ejercicioCasillasService`, `inmuebleCasillasService`, `MiIRPFPage`,
 * `ImpuestosSupervisionPage`).
 *
 * No cambia el flujo de escritura. No recalcula nada. Solo proyecta
 * campos de un esquema al otro para que las pantallas que ya leen
 * `DatosFiscalesEjercicio.declaracionCompleta` (asumiendo forma
 * `DeclaracionIRPF`) encuentren los datos que hoy se pierden porque
 * `declaracionResolverService` mira un store vacío
 * (`snapshotsDeclaracion`) en lugar del coord.
 *
 * Para el matching `refCatastral → inmuebleId` necesitamos el `Property`
 * store; pasamos la lista resuelta como argumento para no acoplar el
 * adapter a IDB.
 */

import type {
  DeclaracionCompleta,
  InmuebleDeclarado,
} from '../types/declaracionCompleta';
import type {
  DeclaracionIRPF,
  BaseGeneral,
  BaseAhorro,
  RendimientosTrabajo,
  RendimientosAutonomo,
  RendimientoInmueble,
  RendimientosCapitalMobiliario,
  GananciasPerdidasPatrimoniales,
  Liquidacion,
  Retenciones,
  MinimosPersonales,
} from './irpfCalculationService';
import type { Property } from './db';

function normalizeRef(value?: string | null): string {
  return (value ?? '').replace(/[\s.-]/g, '').trim().toUpperCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumDiasPorTipo(
  inm: InmuebleDeclarado,
  tipo: 'arrendado' | 'disposicion' | 'accesorio',
): number {
  return (inm.usos ?? [])
    .filter((u) => u.tipo === tipo)
    .reduce((s, u) => s + (u.dias ?? 0), 0);
}

function buildRendimientosTrabajo(decl: DeclaracionCompleta): RendimientosTrabajo | null {
  const t = decl.trabajo;
  if (!t) return null;
  // `salarioBrutoAnual` ≡ dinerario (sin especie). La AEAT separa
  // dinerarias (0003) y valoración especie (0005). El motor Atlas mete
  // el especie aparte (`especieAnual`).
  return {
    salarioBrutoAnual: t.retribucionesDinerarias ?? 0,
    especieAnual: t.valoracionEspecie ?? 0,
    cotizacionSS: t.cotizacionesSS ?? 0,
    irpfRetenido: t.retenciones ?? 0,
    rendimientoNeto: t.rendimientoNeto ?? 0,
    ppEmpleado: 0, // En XML AEAT el desglose PP empleado/empresa vive en
    ppEmpresa: t.contribucionesPPEmpresa ?? 0,
    ppTotalReduccion: 0, // `decl.planPensiones` y `decl.integracion.reduccionPP`.
  };
}

function buildRendimientosAutonomo(decl: DeclaracionCompleta): RendimientosAutonomo | null {
  const a = decl.actividadEconomica;
  if (!a) return null;
  return {
    ingresos: a.ingresosExplotacion ?? a.totalIngresos ?? 0,
    gastos: a.totalGastos ?? 0,
    cuotaSS: a.gastosSS ?? 0,
    gastoDificilJustificacion: a.reduccionSimplificada,
    rendimientoNeto: a.rendimientoNetoReducido ?? a.rendimientoNeto ?? 0,
    pagosFraccionadosM130: a.pagosFraccionados ?? 0,
    actividades: [
      {
        nombre: a.tipo || 'Actividad económica',
        epigrafe: a.iae,
        tipo: a.tipo,
        modalidad: a.modalidad,
        ingresos: a.totalIngresos ?? 0,
        gastos: a.totalGastos ?? 0,
        cuotaSS: a.gastosSS ?? 0,
      },
    ],
  };
}

function buildRendimientoInmueble(
  inm: InmuebleDeclarado,
  inmuebleId: number,
  alias: string,
): RendimientoInmueble {
  const diasAlquilado = sumDiasPorTipo(inm, 'arrendado');
  const diasVacio = sumDiasPorTipo(inm, 'disposicion');
  const diasAccesorio = sumDiasPorTipo(inm, 'accesorio');
  const diasTotal = diasAlquilado + diasVacio + diasAccesorio;
  const arr = inm.arrendamientos?.[0];
  const esHabitual = Boolean(
    inm.arrendamientos?.some((a) => a.esResidenciaHabitual === true),
  );
  const reduccion = inm.reduccionVivienda ?? 0;
  const rendNetoAntes = (inm.rendimientoNeto ?? 0) + reduccion;
  return {
    inmuebleId,
    alias,
    diasAlquilado,
    diasVacio,
    diasEnObras: 0,
    diasTotal: diasTotal > 0 ? diasTotal : 365,
    ingresosIntegros: arr?.ingresos ?? 0,
    gastosDeducibles:
      (inm.gastos?.interesesFinanciacion ?? 0) +
      (inm.gastos?.reparacionConservacion ?? 0) +
      (inm.gastos?.comunidad ?? 0) +
      (inm.gastos?.suministros ?? 0) +
      (inm.gastos?.seguros ?? 0) +
      (inm.gastos?.ibiTasas ?? 0) +
      (inm.gastos?.serviciosTerceros ?? 0),
    amortizacion:
      (inm.amortizacionAnualInmueble ?? inm.amortizacionManual ?? 0) +
      (inm.amortizacionMobiliario ?? 0),
    reduccionHabitual: reduccion,
    rendimientoNetoAlquiler: round2(rendNetoAntes),
    rendimientoNetoReducido: inm.rendimientoNetoReducido ?? inm.rendimientoNeto ?? 0,
    porcentajeReduccionHabitual: reduccion > 0 && rendNetoAntes > 0
      ? round2((reduccion / rendNetoAntes) * 100) / 100
      : 0,
    esHabitual,
    imputacionRenta: 0,
    rendimientoNeto: inm.rendimientoNeto ?? 0,
  };
}

function buildBaseGeneral(
  decl: DeclaracionCompleta,
  propertyByRefCatastral: Map<string, Property>,
): BaseGeneral {
  const trabajo = buildRendimientosTrabajo(decl);
  const autonomo = buildRendimientosAutonomo(decl);
  const inmuebles: RendimientoInmueble[] = (decl.inmuebles ?? []).map((inm) => {
    const ref = normalizeRef(inm.refCatastral);
    const prop = propertyByRefCatastral.get(ref);
    const inmuebleId = prop?.id ?? 0;
    const alias = prop?.alias || prop?.address || inm.direccion || ref || `Inmueble ${inmuebleId}`;
    return buildRendimientoInmueble(inm, inmuebleId, alias);
  });
  const totalRendimientosInmuebles = inmuebles.reduce(
    (s, i) => s + (i.rendimientoNetoReducido ?? i.rendimientoNeto ?? 0),
    0,
  );
  const totalTrabajo = trabajo?.rendimientoNeto ?? 0;
  const totalAutonomo = autonomo?.rendimientoNeto ?? 0;
  return {
    rendimientosTrabajo: trabajo,
    rendimientosAutonomo: autonomo,
    rendimientosInmuebles: inmuebles,
    imputacionRentas: [],
    total: round2(totalTrabajo + totalAutonomo + totalRendimientosInmuebles),
  };
}

function buildBaseAhorro(decl: DeclaracionCompleta): BaseAhorro {
  const cm = decl.capitalMobiliario;
  const intereses = (cm?.intereses ?? []).reduce((s, f) => s + (f.importe ?? 0), 0);
  const dividendos = (cm?.dividendos ?? []).reduce((s, f) => s + (f.importe ?? 0), 0);
  const capitalMobiliario: RendimientosCapitalMobiliario = {
    intereses: round2(intereses),
    dividendos: round2(dividendos),
    retenciones: cm?.retenciones ?? 0,
    total: cm?.rendimientoNetoReducido ?? cm?.rendimientoNeto ?? 0,
  };
  const gyp = decl.gananciasPerdidas;
  const gananciasYPerdidas: GananciasPerdidasPatrimoniales = {
    plusvalias: gyp?.totalGananciasAhorro ?? 0,
    minusvalias: gyp?.totalPerdidasAhorro ?? 0,
    minusvaliasPendientes: 0,
    compensado: gyp?.saldoNetoAhorro ?? 0,
  };
  return {
    capitalMobiliario,
    gananciasYPerdidas,
    total: round2(capitalMobiliario.total + gananciasYPerdidas.compensado),
  };
}

function buildReducciones(decl: DeclaracionCompleta): DeclaracionIRPF['reducciones'] {
  const pp = decl.planPensiones;
  const total = decl.integracion?.reduccionPP ?? pp?.totalConDerechoReduccion ?? 0;
  return {
    ppEmpleado: pp?.aportacionesTrabajador ?? 0,
    ppEmpresa: pp?.contribucionesEmpresa ?? 0,
    ppIndividual: 0,
    planPensiones: total,
    total,
  };
}

function buildLiquidacion(decl: DeclaracionCompleta): Liquidacion {
  const i = decl.integracion;
  const r = decl.resultado;
  const cuotaIntegra = (r?.cuotaIntegraEstatal ?? 0) + (r?.cuotaIntegraAutonomica ?? 0);
  const cuotaLiquida = (r?.cuotaLiquidaEstatal ?? 0) + (r?.cuotaLiquidaAutonomica ?? 0);
  return {
    baseImponibleGeneral: i?.baseImponibleGeneral ?? 0,
    baseImponibleAhorro: i?.baseImponibleAhorro ?? 0,
    cuotaBaseGeneral: r?.cuotaIntegraEstatal ?? 0,
    cuotaBaseAhorro: r?.cuotaIntegraAutonomica ?? 0,
    cuotaMinimosBaseGeneral: 0,
    cuotaIntegra,
    deduccionesDobleImposicion: 0,
    cuotaLiquida,
  };
}

function buildRetenciones(decl: DeclaracionCompleta): Retenciones {
  const trabajo = decl.trabajo?.retenciones ?? 0;
  const autonomo = decl.actividadEconomica?.retenciones ?? 0;
  const capMob = decl.capitalMobiliario?.retenciones ?? 0;
  return {
    trabajo,
    autonomoM130: autonomo,
    capitalMobiliario: capMob,
    total: round2(trabajo + autonomo + capMob),
  };
}

function buildMinimoPersonal(): MinimosPersonales {
  return {
    contribuyente: 0,
    descendientes: 0,
    ascendientes: 0,
    discapacidad: 0,
    total: 0,
  };
}

/**
 * Convierte `DeclaracionCompleta` (forma XML AEAT, lo que se guarda en
 * `aeat.declaracionCompleta`) a `DeclaracionIRPF` (forma motor Atlas, lo
 * que los builders de la UI consumen).
 *
 * `propertyByRefCatastral` debe estar pre-construido por el caller a
 * partir del store `properties`, normalizando refCatastral con la misma
 * función que usa `declaracionDistributorService` (sin espacios, sin
 * puntos, sin guiones, mayúsculas).
 */
export function declaracionCompletaToIRPF(
  decl: DeclaracionCompleta,
  propertyByRefCatastral: Map<string, Property>,
): DeclaracionIRPF {
  return {
    ejercicio: decl.meta?.ejercicio ?? 0,
    baseGeneral: buildBaseGeneral(decl, propertyByRefCatastral),
    baseAhorro: buildBaseAhorro(decl),
    reducciones: buildReducciones(decl),
    minimoPersonal: buildMinimoPersonal(),
    liquidacion: buildLiquidacion(decl),
    retenciones: buildRetenciones(decl),
    resultado: decl.resultado?.resultadoDeclaracion ?? 0,
    tipoEfectivo: decl.resultado?.tipoMedioEstatal ?? 0,
    warnings: [],
  };
}

/**
 * Helper · construye el Map refCatastral→Property desde el array completo
 * de `db.getAll('properties')`. Util para callers que ya tienen la lista.
 */
export function buildPropertyMap(properties: Property[]): Map<string, Property> {
  const map = new Map<string, Property>();
  for (const p of properties) {
    const ref = normalizeRef(p.cadastralReference);
    if (ref) map.set(ref, p);
  }
  return map;
}
