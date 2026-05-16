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
  ImputacionRenta,
  Liquidacion,
  Retenciones,
  MinimosPersonales,
} from './irpfCalculationService';
import type { Property } from './db';

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function diasDelAño(ejercicio: number): number {
  return isLeapYear(ejercicio) ? 366 : 365;
}

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
  // La 0007 "retribuciones en especie computables" = 0004 valoración + 0005
  // ingresos a cuenta − repercutidos. El XML AEAT la pre-calcula en
  // `retribucionEspecieNeta`. Antes mapeábamos `especieAnual = valoracionEspecie`
  // (0004), lo que infracontaba la 0012 total (caso Jose 2024: 137.762,82
  // en vez de 138.670,33 correcto = 0003 + 0007 + 0008).
  const especieNeta = t.retribucionEspecieNeta
    ?? ((t.valoracionEspecie ?? 0) + (t.ingresosACuentaEspecie ?? 0));
  // ppEmpresa (0008) viene de `contribucionesPPEmpresa` (rama RendimientoTrabajo
  // del XML), no de `planPensiones.contribucionesEmpresa` (rama RedRegimenGeneral)
  // que en producción se ve invertida (IEIP mal interpretado como aportación
  // titular en lugar de empresa). 0008 es la fuente fiable para 0427.
  //
  // Cuidado: el parser usa `num()` que devuelve `0` cuando el campo está
  // ausente del XML. Por eso `??` no basta: distinguimos "campo presente
  // con 0 explícito" (sin PP empresa, caso legítimo) vs "campo ausente
  // que vuelve 0" (caer al fallback de planPensiones). Si el total de
  // reducción es > 0 y `t.contribucionesPPEmpresa` es 0, asumimos que
  // ese campo no estaba en el XML y caemos al fallback.
  const ppEmpresaFromT = t.contribucionesPPEmpresa ?? 0;
  const ppEmpresa = ppEmpresaFromT > 0
    ? ppEmpresaFromT
    : (decl.planPensiones?.contribucionesEmpresa ?? 0);
  const pp = decl.planPensiones;
  const totalReduccion = decl.integracion?.reduccionPP ?? pp?.totalConDerechoReduccion ?? 0;
  // 0426 trabajador = total − empresa. Derivar evita la inversión y aplica
  // la identidad que la AEAT garantiza (RSUMAD = titular + empresa).
  const ppEmpleado = Math.max(0, round2(totalReduccion - ppEmpresa));
  return {
    salarioBrutoAnual: t.retribucionesDinerarias ?? 0,
    especieAnual: round2(especieNeta),
    cotizacionSS: t.cotizacionesSS ?? 0,
    irpfRetenido: t.retenciones ?? 0,
    rendimientoNeto: t.rendimientoNeto ?? 0,
    ppEmpleado,
    ppEmpresa,
    ppTotalReduccion: totalReduccion,
    // Campos auxiliares para que el builder de F2 sección A pueda
    // renderizar las 9 filas con sus números de casilla correctos.
    valoracionEspecie: t.valoracionEspecie,
    ingresosACuentaEspecie: t.ingresosACuentaEspecie,
    otrosGastosDeducibles: t.otrosGastosDeducibles,
  };
}

function buildRendimientosAutonomo(decl: DeclaracionCompleta): RendimientosAutonomo | null {
  const a = decl.actividadEconomica;
  if (!a) return null;
  // Unificamos en `totalIngresos` (que en el XML AEAT incluye subvenciones)
  // tanto para el resumen top-level como para la entrada de `actividades[]`,
  // de modo que el desglose no diverja del agregado.
  const ingresos = a.totalIngresos ?? a.ingresosExplotacion ?? 0;
  return {
    ingresos,
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
        ingresos,
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
  ejercicio: number,
): RendimientoInmueble {
  const diasAlquilado = sumDiasPorTipo(inm, 'arrendado');
  const diasVacio = sumDiasPorTipo(inm, 'disposicion');
  const diasAccesorio = sumDiasPorTipo(inm, 'accesorio');
  const diasUsos = diasAlquilado + diasVacio + diasAccesorio;
  const arr = inm.arrendamientos?.[0];
  const esHabitual = Boolean(
    inm.arrendamientos?.some((a) => a.esResidenciaHabitual === true),
  );
  const reduccion = inm.reduccionVivienda ?? 0;
  const rendNetoAntes = (inm.rendimientoNeto ?? 0) + reduccion;
  // Imputación de renta del propio inmueble (días a disposición) · suma de
  // `usos[].rentaImputada` para los tramos `disposicion`. Esto NO sustituye
  // a `imputacionRentas[]` global (que recoge inmuebles 100 % a disposición),
  // pero deja la información disponible aquí cuando el inmueble combina
  // arrendamiento + disposición parcial.
  const imputacionRenta = (inm.usos ?? [])
    .filter((u) => u.tipo === 'disposicion')
    .reduce((s, u) => s + (u.rentaImputada ?? 0), 0);
  return {
    inmuebleId,
    alias,
    diasAlquilado,
    diasVacio,
    diasEnObras: 0,
    // `diasTotal` debe ser 365 o 366 según el ejercicio (año bisiesto). El
    // XML AEAT puede traer `usos[]` sumando un total > 0; lo usamos sólo si
    // coincide con el calendario, si no normalizamos al año del ejercicio.
    diasTotal: diasUsos > 0 ? diasUsos : diasDelAño(ejercicio),
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
    // `porcentajeReduccionHabitual` se expresa como fracción 0–1 (0.6 = 60 %)
    // alineado con `calcularReduccionArrendamientoVivienda.porcentajeNormalizado`
    // del motor Atlas (`irpfCalculationService.ts`). Cualquier UI que muestre
    // un porcentaje debe multiplicar por 100.
    porcentajeReduccionHabitual: reduccion > 0 && rendNetoAntes > 0
      ? Math.round((reduccion / rendNetoAntes) * 10000) / 10000
      : 0,
    esHabitual,
    imputacionRenta: round2(imputacionRenta),
    rendimientoNeto: inm.rendimientoNeto ?? 0,
  };
}

function buildImputacionesRenta(
  decl: DeclaracionCompleta,
  propertyByRefCatastral: Map<string, Property>,
): ImputacionRenta[] {
  // Inmuebles 100 % a disposición (sin ningún uso 'arrendado' ni 'accesorio')
  // generan una entrada de imputación de renta. Los inmuebles con uso mixto
  // ya llevan el `imputacionRenta` integrado en su `RendimientoInmueble`.
  const out: ImputacionRenta[] = [];
  (decl.inmuebles ?? []).forEach((inm, idx) => {
    const usos = inm.usos ?? [];
    const tieneArrendado = usos.some((u) => u.tipo === 'arrendado');
    const tieneAccesorio = usos.some((u) => u.tipo === 'accesorio');
    if (tieneArrendado || tieneAccesorio) return;
    const disposicion = usos.filter((u) => u.tipo === 'disposicion');
    if (disposicion.length === 0) return;
    const imputacion = disposicion.reduce((s, u) => s + (u.rentaImputada ?? 0), 0);
    if (imputacion <= 0) return;
    const diasVacio = disposicion.reduce((s, u) => s + (u.dias ?? 0), 0);
    const ref = normalizeRef(inm.refCatastral);
    const prop = propertyByRefCatastral.get(ref);
    const inmuebleId = prop?.id ?? -(idx + 1);
    out.push({
      inmuebleId,
      alias: prop?.alias || prop?.address || inm.direccion || ref || `Inmueble ${inmuebleId}`,
      valorCatastral: inm.valorCatastralTotal ?? inm.valorCatastral ?? 0,
      porcentajeImputacion: inm.catastralRevisado ? 0.011 : 0.02,
      diasVacio,
      imputacion: round2(imputacion),
    });
  });
  return out;
}

function buildBaseGeneral(
  decl: DeclaracionCompleta,
  propertyByRefCatastral: Map<string, Property>,
): BaseGeneral {
  const ejercicio = decl.meta?.ejercicio ?? new Date().getFullYear();
  const trabajo = buildRendimientosTrabajo(decl);
  const autonomo = buildRendimientosAutonomo(decl);
  // Fallback `inmuebleId = -(idx + 1)` cuando no hay match por refCatastral:
  // mantiene cada inmueble distinguible (sin colisión por id=0) y los hace
  // detectables como "sin Property persistida" (id negativo).
  const inmuebles: RendimientoInmueble[] = (decl.inmuebles ?? []).map((inm, idx) => {
    const ref = normalizeRef(inm.refCatastral);
    const prop = propertyByRefCatastral.get(ref);
    const inmuebleId = prop?.id ?? -(idx + 1);
    const alias = prop?.alias || prop?.address || inm.direccion || ref || `Inmueble ${inmuebleId}`;
    return buildRendimientoInmueble(inm, inmuebleId, alias, ejercicio);
  });
  return {
    rendimientosTrabajo: trabajo,
    rendimientosAutonomo: autonomo,
    rendimientosInmuebles: inmuebles,
    imputacionRentas: buildImputacionesRenta(decl, propertyByRefCatastral),
    // `total` autoritativo desde AEAT (`integracion.baseImponibleGeneral`)
    // para evitar drift con `Liquidacion.baseImponibleGeneral` cuando hay
    // imputaciones de renta o capital mobiliario integrado en base general.
    total: round2(decl.integracion?.baseImponibleGeneral ?? 0),
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
    // `total` autoritativo desde AEAT (`integracion.baseImponibleAhorro`)
    // para evitar drift con `Liquidacion.baseImponibleAhorro` y evitar
    // double-counting de gain/loss ya compensadas a nivel AEAT.
    total: round2(decl.integracion?.baseImponibleAhorro ?? 0),
  };
}

function buildReducciones(decl: DeclaracionCompleta): DeclaracionIRPF['reducciones'] {
  const pp = decl.planPensiones;
  const total = decl.integracion?.reduccionPP ?? pp?.totalConDerechoReduccion ?? 0;
  // Misma derivación que en `buildRendimientosTrabajo`: 0427 (empresa) viene
  // de la 0008 (rama `RendimientoTrabajo` del XML, fuente fiable) y 0426
  // (trabajador) se deriva como total − empresa. Evita el cruce observado
  // cuando `planPensiones.aportacionesTrabajador`/`contribucionesEmpresa`
  // están invertidas en el parser.
  //
  // Manejo de "0 = campo ausente" del parser: si la 0008 vuelve 0 pero el
  // total indica que hay PP de empresa, caer al fallback. Mantiene el caso
  // legítimo "sin PP empresa, todo trabajador" cuando ambos son 0 (en ese
  // caso `ppEmpleado = total − 0 = total`, correcto).
  const ppEmpresaFromT = decl.trabajo?.contribucionesPPEmpresa ?? 0;
  const ppEmpresa = ppEmpresaFromT > 0
    ? ppEmpresaFromT
    : (pp?.contribucionesEmpresa ?? 0);
  const ppEmpleado = Math.max(0, round2(total - ppEmpresa));
  return {
    ppEmpleado,
    ppEmpresa,
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
  // Los campos `cuotaBaseGeneral` y `cuotaBaseAhorro` del motor Atlas son
  // las cuotas íntegras sobre la base general y sobre la base ahorro
  // respectivamente (eje base) · NO el split estatal/autonómico (eje
  // territorial). El XML AEAT no expone ese desglose por base, por lo que
  // los dejamos en 0 antes que producir valores engañosos. Cualquier
  // consumidor que necesite el desglose por base debe leer directamente
  // del motor en años en curso, no de un import AEAT.
  return {
    baseImponibleGeneral: i?.baseImponibleGeneral ?? 0,
    baseImponibleAhorro: i?.baseImponibleAhorro ?? 0,
    cuotaBaseGeneral: 0,
    cuotaBaseAhorro: 0,
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
  // `total` autoritativo desde AEAT (`resultado.totalRetencionesPagos`) que
  // incluye también retenciones inmobiliarias y otros conceptos no
  // desglosados en la interfaz `Retenciones` del motor. Si AEAT no lo
  // expone, caemos a la suma de las 3 categorías.
  const totalAEAT = decl.resultado?.totalRetencionesPagos;
  const total = typeof totalAEAT === 'number' && Number.isFinite(totalAEAT)
    ? round2(totalAEAT)
    : round2(trabajo + autonomo + capMob);
  return {
    trabajo,
    autonomoM130: autonomo,
    capitalMobiliario: capMob,
    total,
  };
}

function buildMinimoPersonal(decl: DeclaracionCompleta): MinimosPersonales {
  // El XML AEAT no desglosa el mínimo personal por componentes (cónyuge,
  // descendientes, etc.); sólo expone el global por administración (estatal
  // y autonómico). Poblamos `contribuyente` y `total` con la suma de ambos
  // para no perder el dato. Los demás componentes quedan a 0 al no estar
  // disponibles · cualquier consumidor que los necesite debe recalcular.
  const estatal = decl.integracion?.minimoPersonalEstatal ?? 0;
  const autonomico = decl.integracion?.minimoPersonalAutonomico ?? 0;
  const total = round2(estatal + autonomico);
  return {
    contribuyente: total,
    descendientes: 0,
    ascendientes: 0,
    discapacidad: 0,
    total,
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
    minimoPersonal: buildMinimoPersonal(decl),
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
