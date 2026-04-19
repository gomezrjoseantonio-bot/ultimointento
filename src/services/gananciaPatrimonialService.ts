// src/services/gananciaPatrimonialService.ts
// Cálculo fiscal de la ganancia patrimonial (base ahorro IRPF) al vender un inmueble.
//
// Mecánica:
//   Coste fiscal = precio adquisición + gastos adquisición + mejoras CAPEX
//                  − amortización acumulada (híbrida XML + ATLAS)
//   Valor neto   = precio venta − gastos venta
//   Ganancia    = valor neto − coste fiscal
//   IRPF        = aplicar tramos base ahorro 2025 sobre la ganancia (si > 0)

import { initDB, type Contract, type GastoInmueble, type MejoraInmueble, type Property } from './db';

export interface AmortizacionAcumuladaResult {
  declarada: number;              // suma de casilla 0131 con origen xml_aeat
  calculadaAtlas: number;         // años sin declaración, ATLAS al 3%
  total: number;
  anosDeclaradosXml: number[];
  anosCalculadosAtlas: number[];
}

export interface GananciaPatrimonialInput {
  propertyId: number;
  sellDate: string;               // ISO YYYY-MM-DD
  salePrice: number;
  agencyCommission: number;
  municipalTax: number;
  saleNotaryCosts: number;
  otherCosts: number;
}

export interface GananciaPatrimonialResult {
  precioAdquisicion: number;
  gastosAdquisicion: number;
  mejorasCapexAcumuladas: number;
  amortizacionAcumuladaDeclarada: number;
  amortizacionAcumuladaAtlas: number;
  costeFiscalAdquisicion: number;

  gastosVenta: number;
  valorNetoTransmision: number;

  gananciaPatrimonial: number;

  anosDeclaradosXml: number[];
  anosCalculadosAtlas: number[];

  irpfEstimado: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const getGastosPorInmueble = async (propertyId: number): Promise<GastoInmueble[]> => {
  const db = await initDB();
  try {
    return (await db.getAllFromIndex('gastosInmueble', 'inmuebleId', propertyId)) as GastoInmueble[];
  } catch {
    return [];
  }
};

const getMejorasPorInmueble = async (propertyId: number): Promise<MejoraInmueble[]> => {
  const db = await initDB();
  try {
    return (await db.getAllFromIndex('mejorasInmueble', 'inmuebleId', propertyId)) as MejoraInmueble[];
  } catch {
    return [];
  }
};

const yearFromIso = (iso: string | undefined | null): number | null => {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
};

/**
 * Cuenta los días del año `anio` en que el inmueble estaba arrendado.
 * En el año de venta cuenta solo hasta `sellDate`.
 * Se apoya en `contracts` filtrando por (fechaInicio | startDate, fechaFin | endDate).
 */
const calcularDiasArrendadoAno = (
  contratos: Contract[],
  anio: number,
  sellDate: string,
): number => {
  const inicioAnio = new Date(`${anio}-01-01`);
  const finAnio = new Date(`${anio}-12-31`);
  const sellDateTs = new Date(sellDate).getTime();
  if (Number.isNaN(sellDateTs)) return 0;
  const finEfectivo = sellDateTs < finAnio.getTime() ? new Date(sellDateTs) : finAnio;
  if (inicioAnio.getTime() > finEfectivo.getTime()) return 0;

  const ranges: Array<{ start: number; end: number }> = [];
  for (const c of contratos) {
    const startIso = c.fechaInicio || c.startDate;
    if (!startIso) continue;
    const endIso = c.fechaFin || c.endDate || `${anio + 1}-12-31`;
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const clipStart = Math.max(start, inicioAnio.getTime());
    const clipEnd = Math.min(end, finEfectivo.getTime());
    if (clipStart <= clipEnd) ranges.push({ start: clipStart, end: clipEnd });
  }
  if (ranges.length === 0) return 0;

  // Merge overlapping ranges and sum days (inclusive).
  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end + 86_400_000) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  let days = 0;
  for (const r of merged) {
    days += Math.floor((r.end - r.start) / 86_400_000) + 1;
  }
  return days;
};

/**
 * Amortización acumulada híbrida:
 *   · Años con declaración XML (casilla 0131, origen xml_aeat): suma declarada.
 *   · Años sin declaración hasta sellDate: base amortización × 3% × díasArrendado / 365.
 */
export async function calcularAmortizacionAcumulada(
  propertyId: number,
  sellDate: string,
): Promise<AmortizacionAcumuladaResult> {
  const db = await initDB();
  const property = (await db.get('properties', propertyId)) as Property | undefined;
  if (!property) throw new Error('Inmueble no encontrado');

  const purchaseYear = yearFromIso(property.purchaseDate) ?? yearFromIso(sellDate) ?? new Date().getFullYear();
  const sellYear = yearFromIso(sellDate) ?? new Date().getFullYear();

  const gastos = await getGastosPorInmueble(propertyId);
  const amortXml = gastos.filter(
    (g) => g.casillaAEAT === '0131' && g.origen === 'xml_aeat',
  );

  const declarada = amortXml.reduce((sum, g) => sum + (g.importe || 0), 0);
  const anosDeclaradosXml = Array.from(
    new Set(
      amortXml
        .map((g) => yearFromIso(g.fecha) ?? (g as any).ejercicio)
        .filter((y): y is number => typeof y === 'number' && Number.isFinite(y)),
    ),
  ).sort((a, b) => a - b);

  const todosLosAnos: number[] = [];
  for (let y = purchaseYear; y <= sellYear; y++) todosLosAnos.push(y);
  const anosCalculadosAtlas = todosLosAnos.filter((a) => !anosDeclaradosXml.includes(a));

  const baseAmortizacion = property.aeatAmortization?.baseAmortizacion ?? 0;
  const TASA = 0.03;

  let calculadaAtlas = 0;
  if (baseAmortizacion > 0 && anosCalculadosAtlas.length > 0) {
    const allContracts = (await db.getAll('contracts')) as Contract[];
    const contratosDelInmueble = allContracts.filter(
      (c) => c.inmuebleId === propertyId || c.propertyId === propertyId,
    );
    for (const anio of anosCalculadosAtlas) {
      const dias = calcularDiasArrendadoAno(contratosDelInmueble, anio, sellDate);
      if (dias <= 0) continue;
      calculadaAtlas += (baseAmortizacion * TASA * dias) / 365;
    }
  }

  return {
    declarada: round2(declarada),
    calculadaAtlas: round2(calculadaAtlas),
    total: round2(declarada + calculadaAtlas),
    anosDeclaradosXml,
    anosCalculadosAtlas,
  };
}

/**
 * Tramos base ahorro IRPF 2025 (AEAT, vigentes):
 *      0 –   6.000 € → 19%
 *   6.000 –  50.000 € → 21%
 *  50.000 – 200.000 € → 23%
 * 200.000 – 300.000 € → 27%
 * 300.000 + → 28%
 */
export function calcularIrpfBaseAhorro2025(ganancia: number): number {
  if (ganancia <= 0) return 0;

  const tramos: Array<{ hasta: number; tipo: number }> = [
    { hasta: 6000, tipo: 0.19 },
    { hasta: 50000, tipo: 0.21 },
    { hasta: 200000, tipo: 0.23 },
    { hasta: 300000, tipo: 0.27 },
    { hasta: Number.POSITIVE_INFINITY, tipo: 0.28 },
  ];

  let restante = ganancia;
  let prev = 0;
  let irpf = 0;
  for (const tramo of tramos) {
    const slice = Math.min(restante, tramo.hasta - prev);
    if (slice <= 0) break;
    irpf += slice * tramo.tipo;
    restante -= slice;
    prev = tramo.hasta;
    if (restante <= 0) break;
  }
  return round2(irpf);
}

export async function calcularGananciaPatrimonial(
  input: GananciaPatrimonialInput,
): Promise<GananciaPatrimonialResult> {
  const db = await initDB();
  const property = (await db.get('properties', input.propertyId)) as Property | undefined;
  if (!property) throw new Error('Inmueble no encontrado');

  // 1. Coste de adquisición
  const costs = property.acquisitionCosts;
  const precioAdquisicion = costs.price || 0;
  const gastosAdquisicion =
    (costs.itp || 0) +
    (costs.iva || 0) +
    (costs.notary || 0) +
    (costs.registry || 0) +
    (costs.management || 0) +
    (costs.psi || 0) +
    (costs.realEstate || 0) +
    (costs.other?.reduce((s, o) => s + (o.amount || 0), 0) || 0);

  // 2. Mejoras CAPEX acumuladas (excluimos tipo='reparacion')
  const mejoras = await getMejorasPorInmueble(input.propertyId);
  const mejorasCapexAcumuladas = mejoras
    .filter((m) => m.tipo !== 'reparacion')
    .reduce((s, m) => s + (m.importe || 0), 0);

  // 3. Amortización acumulada
  const amort = await calcularAmortizacionAcumulada(input.propertyId, input.sellDate);

  // 4. Coste fiscal de adquisición
  const costeFiscalAdquisicion = round2(
    precioAdquisicion + gastosAdquisicion + mejorasCapexAcumuladas - amort.total,
  );

  // 5. Valor neto de transmisión
  const gastosVenta = round2(
    (input.agencyCommission || 0) +
      (input.municipalTax || 0) +
      (input.saleNotaryCosts || 0) +
      (input.otherCosts || 0),
  );
  const valorNetoTransmision = round2((input.salePrice || 0) - gastosVenta);

  // 6. Ganancia patrimonial
  const gananciaPatrimonial = round2(valorNetoTransmision - costeFiscalAdquisicion);

  // 7. IRPF estimado por tramos base ahorro 2025
  const irpfEstimado = calcularIrpfBaseAhorro2025(gananciaPatrimonial);

  return {
    precioAdquisicion: round2(precioAdquisicion),
    gastosAdquisicion: round2(gastosAdquisicion),
    mejorasCapexAcumuladas: round2(mejorasCapexAcumuladas),
    amortizacionAcumuladaDeclarada: amort.declarada,
    amortizacionAcumuladaAtlas: amort.calculadaAtlas,
    costeFiscalAdquisicion,
    gastosVenta,
    valorNetoTransmision,
    gananciaPatrimonial,
    anosDeclaradosXml: amort.anosDeclaradosXml,
    anosCalculadosAtlas: amort.anosCalculadosAtlas,
    irpfEstimado,
  };
}
