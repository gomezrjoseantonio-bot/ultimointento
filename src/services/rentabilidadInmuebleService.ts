// ATLAS — T25: Rentabilidad real por inmueble después de impuestos
// Calcula cashflow neto y rentabilidad sobre inversión para cada inmueble.

import { initDB } from './db';
import { round2, RendimientoInmueble, DeclaracionIRPF } from './irpfCalculationService';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface RentabilidadInmueble {
  inmuebleId: number;
  alias: string;
  ingresosBrutos: number;
  gastosOperativos: number;       // OPEX (comunidad, IBI, seguro, etc.)
  gastosFinancieros: number;      // Intereses del préstamo
  amortizacion: number;
  rendimientoNetoAntesReduccion: number;
  reduccion: number;
  rendimientoNetoReducido: number;
  tipoMarginal: number;
  impuestoEstimado: number;
  // Cashflow
  cuotasPrestamo: number;         // Capital + intereses (cuotas reales)
  cashflowNeto: number;
  // Rentabilidad
  inversionTotal: number;
  rentabilidadPorcentaje: number | null; // null si falta inversión
  datosCompletos: boolean;
  datosFaltantes: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTipoMarginal(baseImponible: number): number {
  const tramos = [
    { hasta: 12450, tipo: 0.19 },
    { hasta: 20200, tipo: 0.24 },
    { hasta: 35200, tipo: 0.30 },
    { hasta: 60000, tipo: 0.37 },
    { hasta: 300000, tipo: 0.45 },
    { hasta: Infinity, tipo: 0.47 },
  ];
  for (const tramo of tramos) {
    if (baseImponible <= tramo.hasta) return tramo.tipo;
  }
  return 0.47;
}

export function getRentabilidadColor(pct: number | null): string {
  if (pct === null) return 'var(--n-500)';
  if (pct > 8) return 'var(--s-pos)';
  if (pct >= 4) return 'var(--n-700)';
  return 'var(--s-neg)';
}

// ─── Cálculo principal ───────────────────────────────────────────────────────

export async function calcularRentabilidadInmueble(
  inmueble: RendimientoInmueble,
  declaracion: DeclaracionIRPF,
): Promise<RentabilidadInmueble> {
  const db = await initDB();
  const datosFaltantes: string[] = [];

  // Ingresos brutos
  const ingresosBrutos = inmueble.ingresosIntegros;

  // Gastos operativos (OPEX) = gastos deducibles - financieros
  // gastosDeducibles includes everything prorated
  // Try to get actual loan data for this property
  let cuotasPrestamo = 0;
  let interesesReales = 0;
  try {
    const loans = await db.getAll('prestamos' as any);
    const propertyLoans = (loans as any[]).filter((l: any) =>
      l.inmuebleId === inmueble.inmuebleId || l.propertyId === inmueble.inmuebleId
    );
    for (const loan of propertyLoans) {
      const cuotaMensual = loan.cuotaMensual ?? loan.monthlyPayment ?? 0;
      cuotasPrestamo += cuotaMensual * 12;
      interesesReales += loan.interesesAnuales ?? (cuotaMensual * 12 * 0.3); // Approx if not available
    }
  } catch {
    // Try gastosInmueble for interest data
    try {
      const gastosInmuebleService = (await import('./gastosInmuebleService')).gastosInmuebleService;
      const casillas = await gastosInmuebleService.getSumaPorCasilla(inmueble.inmuebleId, declaracion.ejercicio);
      if (casillas['0105']) {
        interesesReales = casillas['0105'];
      }
    } catch { /* ignore */ }
  }

  const gastosOperativos = round2(inmueble.gastosDeducibles - interesesReales);
  const amortizacion = inmueble.amortizacion;

  // Rendimiento neto antes de reducción
  const rendimientoNetoAntesReduccion = round2(
    ingresosBrutos - gastosOperativos - interesesReales - amortizacion
  );

  // Reducción por vivienda habitual
  const reduccion = inmueble.reduccionHabitual;
  const rendimientoNetoReducido = round2(rendimientoNetoAntesReduccion - reduccion);

  // Tipo marginal real del usuario
  const tipoMarginal = getTipoMarginal(declaracion.liquidacion.baseImponibleGeneral);

  // Impuesto estimado sobre el rendimiento reducido
  const impuestoEstimado = round2(Math.max(0, rendimientoNetoReducido) * tipoMarginal);

  // Inversión total (precio compra + gastos)
  let inversionTotal = 0;
  try {
    const properties = await db.getAll('properties');
    const prop = properties.find((p: any) => p.id === inmueble.inmuebleId) as any;
    if (prop) {
      inversionTotal = round2(
        (prop.precioCompra ?? prop.purchasePrice ?? prop.fiscalData?.purchasePrice ?? 0) +
        (prop.gastosCompra ?? prop.purchaseCosts ?? prop.fiscalData?.purchaseCosts ?? 0)
      );
    }
  } catch { /* ignore */ }

  // Identify missing data
  if (ingresosBrutos === 0) datosFaltantes.push('ingresos');
  if (gastosOperativos === 0) datosFaltantes.push('gastos operativos');
  if (inversionTotal === 0) datosFaltantes.push('precio de compra');
  if (cuotasPrestamo === 0 && interesesReales > 0) datosFaltantes.push('cuotas préstamo');

  // Cashflow neto
  const cashflowNeto = round2(
    ingresosBrutos - gastosOperativos - cuotasPrestamo - impuestoEstimado
  );

  // Rentabilidad
  const rentabilidadPorcentaje = inversionTotal > 0
    ? round2((cashflowNeto / inversionTotal) * 100 * 10) / 10
    : null;

  return {
    inmuebleId: inmueble.inmuebleId,
    alias: inmueble.alias,
    ingresosBrutos,
    gastosOperativos,
    gastosFinancieros: interesesReales,
    amortizacion,
    rendimientoNetoAntesReduccion,
    reduccion,
    rendimientoNetoReducido,
    tipoMarginal,
    impuestoEstimado,
    cuotasPrestamo: round2(cuotasPrestamo),
    cashflowNeto,
    inversionTotal,
    rentabilidadPorcentaje,
    datosCompletos: datosFaltantes.length === 0,
    datosFaltantes,
  };
}

export async function calcularRentabilidadTodosInmuebles(
  declaracion: DeclaracionIRPF
): Promise<RentabilidadInmueble[]> {
  const resultados: RentabilidadInmueble[] = [];

  for (const inmueble of declaracion.baseGeneral.rendimientosInmuebles) {
    // Skip synthetic entries (entidades atribuidas)
    if (inmueble.inmuebleId < 0) continue;
    // Only process rented properties
    if (inmueble.ingresosIntegros <= 0) continue;

    const rentabilidad = await calcularRentabilidadInmueble(inmueble, declaracion);
    resultados.push(rentabilidad);
  }

  return resultados;
}
