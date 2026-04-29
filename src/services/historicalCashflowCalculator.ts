/**
 * historicalCashflowCalculator.ts
 *
 * Calcula el cuadre de caja histórico (2020-2025) leyendo datos de los stores
 * existentes. NO genera eventos — solo devuelve el análisis del cashflow y los
 * gastos personales implícitos para que el wizard los presente al usuario.
 */

import { initDB } from './db';
import type { DeclaracionCompleta } from '../types/declaracionCompleta';

export interface CashflowAño {
  año: number;
  // Ingresos
  nominaNeta: number;           // retribucionesDinerarias - retenciones - cotizacionesSS
  autonomoNeto: number;         // totalIngresos actividad económica - retenciones
  rentasAlquiler: number;       // suma de contracts.ejerciciosFiscales[año].importeDeclarado
  otrosIngresos: number;
  // Gastos
  cuotasPrestamos: number;      // suma cuadroAmortizacion del año
  gastosInmuebles: number;      // suma gastos operativos (sin amortización)
  // Resultado parcial (sin gastos personales)
  cashflowParcial: number;
  // Fuente de datos
  fuenteNomina: 'xml_aeat' | 'atlas_nativo' | 'no_disponible';
  fuenteRentas: 'xml_aeat' | 'atlas_nativo' | 'no_disponible';
  prestamosConDatos: number;    // préstamos con cuadro de amortización
  prestamosSinDatos: number;    // préstamos sin cuadro de amortización
}

export interface CuadreCaja {
  años: CashflowAño[];
  totalCashflow: number;            // suma cashflowParcial todos los años
  // Ajustes extraordinarios
  ventasNetas: number;              // de property_sales
  aportacionesInversion: number;   // salidas a inversiones conocidas
  prestamosOtorgados: number;       // salidas conocidas a terceros
  otrosSalidasConocidas: number;
  // Situación actual declarada por el usuario
  saldoCuentasActual: number;
  inversionesActuales: number;
  // Resultado
  totalDisponible: number;          // totalCashflow + ajustes
  gastosPersonalesImplicitos: number;
  mediaGastosPersonalesMes: number; // gastosPersonalesImplicitos / meses totales
  // Distribución estimada por año (proporcional a ingresos)
  gastosPersonalesPorAño: Record<number, number>; // €/mes estimados por año
}

// Normaliza el cuadro de amortización de un préstamo a [{fecha, cuota}].
// Soporta dos formatos:
//   - Antiguo (loanService): prestamo.cuadro_amortizacion[] con {fecha?, cuota?, cuotaTotal?}
//   - Nuevo (PrestamosWizard, T15.3): prestamo.planPagos → PlanPagos.periodos[]
//     con {fechaCargo, cuota} (antes vivía en keyval[planpagos_*]).
async function resolveSchedule(
  _db: Awaited<ReturnType<typeof initDB>>,
  prestamo: any
): Promise<{ fecha: string; cuota: number }[]> {
  const old = prestamo.cuadro_amortizacion ?? prestamo.cuadroAmortizacion;
  if (Array.isArray(old) && old.length > 0) {
    return old.map((c: any) => ({
      fecha: String(c.fecha ?? c.fechaCargo ?? ''),
      cuota: Number(c.cuota ?? c.cuotaTotal ?? 0),
    }));
  }
  const plan = prestamo.planPagos;
  if (plan?.periodos?.length > 0) {
    return (plan.periodos as any[]).map(p => ({
      fecha: String(p.fechaCargo ?? ''),
      cuota: Number(p.cuota ?? 0),
    }));
  }
  return [];
}

export async function getCashflowAño(año: number): Promise<CashflowAño> {
  const db = await initDB();

  const ejercicio = await db.get('ejerciciosFiscalesCoord', año);

  // Nómina: leer desde declaracionCompleta.trabajo (campo rico con todos los datos)
  // Fallback al snapshot (casillas AEAT o Atlas) para casos sin declaracionCompleta
  const decl: DeclaracionCompleta | undefined = ejercicio?.aeat?.declaracionCompleta;

  let nominaBruta = 0;
  let nominaRetenciones = 0;
  let nominaSS = 0;
  let autonomoIngresos = 0;
  let autonomoRet = 0;
  let fuenteNomina: CashflowAño['fuenteNomina'] = 'no_disponible';

  if (decl?.trabajo) {
    nominaBruta = Number(decl.trabajo.retribucionesDinerarias ?? 0);
    nominaRetenciones = Number(decl.trabajo.retenciones ?? 0);
    nominaSS = Number(decl.trabajo.cotizacionesSS ?? 0);
    if (nominaBruta > 0) fuenteNomina = 'xml_aeat';
  }

  if (decl?.actividadEconomica) {
    autonomoIngresos = Number(decl.actividadEconomica.totalIngresos ?? 0);
    autonomoRet = Number(decl.actividadEconomica.retenciones ?? 0);
    if (autonomoIngresos > 0 && fuenteNomina === 'no_disponible') fuenteNomina = 'xml_aeat';
  }

  // Fallback: snapshot (aeat o atlas) si no hay declaracionCompleta
  if (!decl) {
    const casillas: Record<string, number> =
      ejercicio?.aeat?.snapshot ?? ejercicio?.atlas?.snapshot ?? {};
    nominaBruta = Number(casillas['0003'] ?? 0);
    nominaRetenciones = Number(casillas['0596'] ?? 0);
    nominaSS = Number(casillas['0013'] ?? 0);
    autonomoIngresos = Number(casillas['VE1II1'] ?? 0);
    autonomoRet = Number(casillas['RETENED'] ?? 0);
    if (nominaBruta > 0 || autonomoIngresos > 0) fuenteNomina = 'atlas_nativo';
  }

  const nominaNeta = nominaBruta - nominaRetenciones - nominaSS;
  const autonomoNeto = autonomoIngresos - autonomoRet;

  // Rentas de alquiler desde contracts.ejerciciosFiscales[año]
  const contracts = await db.getAll('contracts');
  let rentasAlquiler = 0;
  for (const contract of contracts) {
    const efAño = contract.ejerciciosFiscales?.[año];
    if (efAño?.importeDeclarado) {
      rentasAlquiler += efAño.importeDeclarado;
    }
  }

  // Cuotas de préstamos:
  // - Formato antiguo (loanService): prestamo.cuadro_amortizacion[] con campos {fecha, cuota}
  // - Formato nuevo (PrestamosWizard, T15.3): prestamo.planPagos → PlanPagos.periodos[] con {fechaCargo, cuota}
  //   (antes vivía en keyval[planpagos_*]).
  const prestamos = await db.getAll('prestamos');
  let cuotasPrestamos = 0;
  let prestamosConDatos = 0;
  let prestamosSinDatos = 0;
  for (const prestamo of prestamos) {
    const schedule = await resolveSchedule(db, prestamo);
    if (schedule.length === 0) {
      prestamosSinDatos++;
      continue;
    }
    prestamosConDatos++;
    const cuotasDelAño = schedule.filter(c => c.fecha.startsWith(`${año}`));
    for (const c of cuotasDelAño) {
      cuotasPrestamos += c.cuota;
    }
  }

  // Gastos operativos de inmuebles (excluye amortización — no es salida de caja)
  const gastosInmueble = await db.getAll('gastosInmueble');
  let gastosInmuebles = 0;
  for (const gasto of gastosInmueble) {
    if ((gasto.año ?? gasto.ejercicio) !== año) continue;
    gastosInmuebles += Number(gasto.interesesFinanciacion ?? 0);
    gastosInmuebles += Number(gasto.reparacionConservacion ?? 0);
    gastosInmuebles += Number(gasto.ibiTasas ?? 0);
    gastosInmuebles += Number(gasto.comunidad ?? 0);
    gastosInmuebles += Number(gasto.suministros ?? 0);
    gastosInmuebles += Number(gasto.seguros ?? 0);
    gastosInmuebles += Number(gasto.serviciosTerceros ?? 0);
    // amortización (0117) excluida — gasto contable, no salida de caja
  }

  const cashflowParcial = nominaNeta + autonomoNeto + rentasAlquiler
    - cuotasPrestamos - gastosInmuebles;

  return {
    año,
    nominaNeta,
    autonomoNeto,
    rentasAlquiler,
    otrosIngresos: 0,
    cuotasPrestamos,
    gastosInmuebles,
    cashflowParcial,
    fuenteNomina,
    fuenteRentas: rentasAlquiler > 0 ? 'xml_aeat' : 'no_disponible',
    prestamosConDatos,
    prestamosSinDatos,
  };
}

export async function calcularCuadreCaja(params: {
  saldoCuentasActual: number;
  inversionesActuales: number;
  ventasNetas?: number;
  aportacionesInversion?: number;
  prestamosOtorgados?: number;
  otrosSalidasConocidas?: number;
  cashflowAñoActualEstimado?: number;
}): Promise<CuadreCaja> {
  const db = await initDB();

  // Bug fix: solo años cerrados (< año en curso)
  const añoActual = new Date().getFullYear();
  const ejercicios = await db.getAll('ejerciciosFiscalesCoord');
  const añosDisponibles = ejercicios
    .map(e => e.año)
    .filter(Boolean)
    .filter((a: number) => a < añoActual)
    .sort((a: number, b: number) => a - b);

  const cashflowPorAño: CashflowAño[] = [];
  for (const año of añosDisponibles) {
    cashflowPorAño.push(await getCashflowAño(año));
  }

  const totalCashflow = cashflowPorAño.reduce((s, a) => s + a.cashflowParcial, 0);
  const totalIngresos = cashflowPorAño.reduce(
    (s, a) => s + a.nominaNeta + a.autonomoNeto + a.rentasAlquiler,
    0
  );

  // Bug fix: inversiones → usar coste de adquisición (total_aportado), no valor actual.
  // Se lee desde DB para garantizar coherencia; el param del wizard sirve de override.
  const posiciones = await db.getAll('inversiones');
  const inversionesCoste = Math.round(
    posiciones.reduce((s: number, p: any) =>
      s + Number(p.total_aportado ?? p.costeAdquisicion ?? p.valor_actual ?? 0), 0
    )
  );
  const inversionesActuales = params.inversionesActuales > 0
    ? params.inversionesActuales
    : inversionesCoste;

  const {
    saldoCuentasActual,
    ventasNetas = 0,
    aportacionesInversion = 0,
    prestamosOtorgados = 0,
    otrosSalidasConocidas = 0,
    cashflowAñoActualEstimado = 0,
  } = params;

  const totalDisponible =
    totalCashflow +
    ventasNetas +
    cashflowAñoActualEstimado -
    aportacionesInversion -
    prestamosOtorgados -
    otrosSalidasConocidas;

  const gastosPersonalesImplicitos =
    totalDisponible - saldoCuentasActual - inversionesActuales;

  const mesesTotales = cashflowPorAño.length * 12;
  const mediaGastosPersonalesMes =
    mesesTotales > 0
      ? Math.round(gastosPersonalesImplicitos / mesesTotales)
      : 0;

  // Distribuir gastos personales por año proporcional a ingresos
  const gastosPersonalesPorAño: Record<number, number> = {};
  for (const a of cashflowPorAño) {
    const ingresoAño = a.nominaNeta + a.autonomoNeto + a.rentasAlquiler;
    const fraccion =
      totalIngresos > 0
        ? ingresoAño / totalIngresos
        : 1 / cashflowPorAño.length;
    gastosPersonalesPorAño[a.año] = Math.round(
      (gastosPersonalesImplicitos * fraccion) / 12
    );
  }

  return {
    años: cashflowPorAño,
    totalCashflow,
    ventasNetas,
    aportacionesInversion,
    prestamosOtorgados,
    otrosSalidasConocidas,
    saldoCuentasActual,
    inversionesActuales,
    totalDisponible,
    gastosPersonalesImplicitos,
    mediaGastosPersonalesMes,
    gastosPersonalesPorAño,
  };
}

