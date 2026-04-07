/**
 * historicalCashflowCalculator.ts
 *
 * Calcula el cuadre de caja histórico (2020-2025) leyendo datos de los stores
 * existentes. NO genera eventos — solo devuelve el análisis del cashflow y los
 * gastos personales implícitos para que el wizard los presente al usuario.
 */

import { initDB } from './db';

export interface CashflowAño {
  año: number;
  // Ingresos
  nominaNeta: number;           // TPING - IDRE - GSS (neto de nómina)
  autonomoNeto: number;         // ingresos autónomo - retenciones
  rentasAlquiler: number;       // suma de contracts.ejerciciosFiscales[año].importeDeclarado
  otrosIngresos: number;
  // Gastos
  cuotasPrestamos: number;      // suma cuadroAmortizacion del año
  gastosInmuebles: number;      // suma gastos operativos (sin amortización)
  // Resultado parcial (sin gastos personales)
  cashflowParcial: number;
  // Fuente de datos
  fuenteNomina: 'xml_aeat' | 'no_disponible';
  fuenteRentas: 'xml_aeat' | 'no_disponible';
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

export async function getCashflowAño(año: number): Promise<CashflowAño> {
  const db = await initDB();

  // Casillas desde ejerciciosFiscalesCoord (almacenadas en aeat.snapshot)
  const ejercicio = await db.get('ejerciciosFiscalesCoord', año);
  const casillas: Record<string, number> = ejercicio?.aeat?.snapshot ?? {};

  // Nómina neta: rendimientos trabajo (0003) - retenciones (0596) - SS (0013)
  const nominaBruta = Number(casillas['0003'] ?? 0);
  const nominaRetenciones = Number(casillas['0596'] ?? 0);
  const nominaSS = Number(casillas['0013'] ?? 0);
  const nominaNeta = nominaBruta - nominaRetenciones - nominaSS;

  // Autónomo neto: ingresos (VE1II1) - retenciones (RETENED)
  const autIngresos = Number(casillas['VE1II1'] ?? 0);
  const autRet = Number(casillas['RETENED'] ?? 0);
  const autonomoNeto = autIngresos - autRet;

  // Rentas de alquiler desde contracts.ejerciciosFiscales[año]
  const contracts = await db.getAll('contracts');
  let rentasAlquiler = 0;
  for (const contract of contracts) {
    const efAño = contract.ejerciciosFiscales?.[año];
    if (efAño?.importeDeclarado) {
      rentasAlquiler += efAño.importeDeclarado;
    }
  }

  // Cuotas de préstamos desde cuadroAmortizacion
  const prestamos = await db.getAll('prestamos');
  let cuotasPrestamos = 0;
  let prestamosConDatos = 0;
  let prestamosSinDatos = 0;
  for (const prestamo of prestamos) {
    if (!prestamo.cuadroAmortizacion || prestamo.cuadroAmortizacion.length === 0) {
      prestamosSinDatos++;
      continue;
    }
    prestamosConDatos++;
    const cuotasDelAño = prestamo.cuadroAmortizacion.filter((c: { fecha?: string }) =>
      c.fecha?.startsWith(`${año}`)
    );
    for (const cuota of cuotasDelAño) {
      cuotasPrestamos += Number((cuota as { cuota?: number; cuotaTotal?: number }).cuota
        ?? (cuota as { cuota?: number; cuotaTotal?: number }).cuotaTotal
        ?? 0);
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
    fuenteNomina: nominaBruta > 0 ? 'xml_aeat' : 'no_disponible',
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

  // Obtener todos los ejercicios disponibles
  const ejercicios = await db.getAll('ejerciciosFiscalesCoord');
  const añosDisponibles = ejercicios
    .map(e => e.año)
    .filter(Boolean)
    .sort((a, b) => a - b);

  const cashflowPorAño: CashflowAño[] = [];
  for (const año of añosDisponibles) {
    cashflowPorAño.push(await getCashflowAño(año));
  }

  const totalCashflow = cashflowPorAño.reduce((s, a) => s + a.cashflowParcial, 0);
  const totalIngresos = cashflowPorAño.reduce(
    (s, a) => s + a.nominaNeta + a.autonomoNeto + a.rentasAlquiler,
    0
  );

  const {
    saldoCuentasActual,
    inversionesActuales,
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
