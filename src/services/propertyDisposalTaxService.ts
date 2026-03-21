import { initDB, Property } from './db';
import { calculateAEATAmortization, getRentalDaysForYear } from './aeatAmortizationService';
import { getTotalMejorasHastaEjercicio } from './mejoraActivoService';
import { getLatestConfirmedSaleForProperty } from './propertySaleService';

export interface PropertyDisposalTaxResult {
  inmuebleId: number;
  alias: string;
  precioVenta: number;
  gastosVenta: number;
  gastosVentaDesglose: {
    agencia: number;
    plusvaliaMunicipal: number;
    notariaRegistro: number;
    otros: number;
  };
  valorTransmision: number;
  precioCompra: number;
  gastosAdquisicion: number;
  mejoras: number;
  amortizacionMinima: number;
  valorAdquisicion: number;
  gananciaPatrimonial: number;
  esPerdida: boolean;
  fechaVenta: string;
  fechaCompra: string;
  añosTenencia: number;
  ejercicioFiscal: number;
  integracion: 'base_ahorro';
  amortizacionDeducida: number;
  amortizacionEstandar: number;
  amortizacionAplicada: number;
}

type SaleBreakdown = PropertyDisposalTaxResult['gastosVentaDesglose'];

type SimulatedSaleInput = {
  saleDate: string;
  salePrice: number;
  saleExpenses?: number | Partial<SaleBreakdown>;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function parseIsoDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffDaysInclusive(from: string, to: string): number {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeExpenses(input?: number | Partial<SaleBreakdown>): SaleBreakdown {
  if (typeof input === 'number') {
    return {
      agencia: 0,
      plusvaliaMunicipal: 0,
      notariaRegistro: 0,
      otros: round2(input),
    };
  }

  return {
    agencia: round2(Number(input?.agencia ?? 0)),
    plusvaliaMunicipal: round2(Number(input?.plusvaliaMunicipal ?? 0)),
    notariaRegistro: round2(Number(input?.notariaRegistro ?? 0)),
    otros: round2(Number(input?.otros ?? 0)),
  };
}

function sumExpenses(expenses: SaleBreakdown): number {
  return round2(expenses.agencia + expenses.plusvaliaMunicipal + expenses.notariaRegistro + expenses.otros);
}

function isSoldState(state: unknown): boolean {
  return state === 'vendido' || state === 'sold' || state === 'inactive';
}

function resolveAlias(property: Property): string {
  return property.alias || property.globalAlias || `Inmueble ${property.id ?? ''}`.trim();
}

function extractAcquisitionData(property: Property): {
  purchaseDate: string;
  purchasePrice: number;
  acquisitionExpenses: number;
} {
  const costs = property.acquisitionCosts || ({} as Property['acquisitionCosts']);
  const acquisitionExpenses = round2(
    Number(costs.itp || 0) +
    Number(costs.iva || 0) +
    Number(costs.notary || 0) +
    Number(costs.registry || 0) +
    Number(costs.management || 0) +
    Number(costs.psi || 0) +
    Number(costs.realEstate || 0) +
    (costs.other?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0)
  );

  return {
    purchaseDate: property.purchaseDate || property.fiscalData?.acquisitionDate || '',
    purchasePrice: round2(Number(costs.price || 0)),
    acquisitionExpenses,
  };
}

async function getTotalMejorasConFallback(propertyId: number, ejercicio: number): Promise<number> {
  try {
    return round2(await getTotalMejorasHastaEjercicio(propertyId, ejercicio));
  } catch {
    const db = await initDB();
    const legacy = await db.getAllFromIndex('propertyImprovements', 'propertyId', propertyId).catch(() => [] as any[]);
    return round2(
      legacy
        .filter((item: any) => Number(item?.year) <= ejercicio)
        .reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0)
    );
  }
}

async function calcularAmortizacionesAcumuladas(
  propertyId: number,
  fechaCompra: string,
  fechaVenta: string
): Promise<{ deducida: number; estandar: number; aplicada: number }> {
  const compra = parseIsoDate(fechaCompra);
  const venta = parseIsoDate(fechaVenta);
  if (!compra || !venta || venta < compra) {
    return { deducida: 0, estandar: 0, aplicada: 0 };
  }

  const añoCompra = compra.getUTCFullYear();
  const añoVenta = venta.getUTCFullYear();
  let totalDeducida = 0;
  let totalEstandar = 0;

  for (let año = añoCompra; año <= añoVenta; año += 1) {
    const inicioAño = `${año}-01-01`;
    const finAño = `${año}-12-31`;
    const inicioTenencia = año === añoCompra ? fechaCompra : inicioAño;
    const finTenencia = año === añoVenta ? fechaVenta : finAño;
    const diasDisponibles = isLeapYear(año) ? 366 : 365;
    const diasTenencia = clamp(diffDaysInclusive(inicioTenencia, finTenencia), 0, diasDisponibles);

    if (diasTenencia <= 0) continue;

    let diasArrendados = diasTenencia;
    try {
      const diasReales = await getRentalDaysForYear(propertyId, año);
      if (diasReales > 0) {
        diasArrendados = Math.min(diasTenencia, diasReales);
      }
    } catch {
      diasArrendados = diasTenencia;
    }

    const calc = await calculateAEATAmortization(propertyId, año, Math.max(0, diasArrendados));
    totalDeducida += Number(calc.propertyAmortization || 0) + Number(calc.improvementsAmortization || 0);
    totalEstandar += (Number(calc.baseAmount || 0) * 0.03 * Math.max(0, diasArrendados)) / diasDisponibles;
  }

  const deducida = round2(totalDeducida);
  const estandar = round2(totalEstandar);
  return {
    deducida,
    estandar,
    aplicada: round2(Math.max(deducida, estandar)),
  };
}

async function buildResult(
  property: Property,
  saleData: { saleDate: string; salePrice: number; expenses: SaleBreakdown }
): Promise<PropertyDisposalTaxResult> {
  if (typeof property.id !== 'number') {
    throw new Error('El inmueble debe tener un identificador numérico');
  }

  const acqData = extractAcquisitionData(property);
  if (!acqData.purchaseDate) {
    throw new Error(`Inmueble ${property.id}: falta fecha de compra para calcular la transmisión`);
  }

  const ejercicioFiscal = new Date(`${saleData.saleDate}T00:00:00`).getFullYear();
  const mejoras = await getTotalMejorasConFallback(property.id, ejercicioFiscal);
  const amortizaciones = await calcularAmortizacionesAcumuladas(property.id, acqData.purchaseDate, saleData.saleDate);

  const gastosVenta = sumExpenses(saleData.expenses);
  const valorTransmision = round2(saleData.salePrice - gastosVenta);
  const valorAdquisicion = round2(acqData.purchasePrice + acqData.acquisitionExpenses + mejoras - amortizaciones.aplicada);
  const gananciaPatrimonial = round2(valorTransmision - valorAdquisicion);
  const diasTenencia = diffDaysInclusive(acqData.purchaseDate, saleData.saleDate);

  return {
    inmuebleId: property.id,
    alias: resolveAlias(property),
    precioVenta: round2(saleData.salePrice),
    gastosVenta,
    gastosVentaDesglose: saleData.expenses,
    valorTransmision,
    precioCompra: acqData.purchasePrice,
    gastosAdquisicion: acqData.acquisitionExpenses,
    mejoras,
    amortizacionMinima: amortizaciones.aplicada,
    valorAdquisicion,
    gananciaPatrimonial,
    esPerdida: gananciaPatrimonial < 0,
    fechaVenta: saleData.saleDate,
    fechaCompra: acqData.purchaseDate,
    añosTenencia: round2(diasTenencia / 365.25),
    ejercicioFiscal,
    integracion: 'base_ahorro',
    amortizacionDeducida: amortizaciones.deducida,
    amortizacionEstandar: amortizaciones.estandar,
    amortizacionAplicada: amortizaciones.aplicada,
  };
}

export async function calcularGananciaPatrimonialVenta(propertyId: number): Promise<PropertyDisposalTaxResult | null> {
  const db = await initDB();
  const property = await db.get('properties', propertyId);

  if (!property) {
    throw new Error(`Inmueble ${propertyId} no encontrado`);
  }

  if (!isSoldState((property as any).state || (property as any).estado)) {
    return null;
  }

  const sale = await getLatestConfirmedSaleForProperty(propertyId);
  if (!sale) {
    return null;
  }

  return buildResult(property, {
    saleDate: sale.saleDate,
    salePrice: Number(sale.salePrice || 0),
    expenses: normalizeExpenses({
      agencia: Number(sale.saleCosts?.agencyCommission || 0),
      plusvaliaMunicipal: Number(sale.saleCosts?.municipalTax || 0),
      notariaRegistro: Number(sale.saleCosts?.saleNotaryCosts || 0),
      otros: Number(sale.saleCosts?.otherCosts || 0),
    }),
  });
}

export async function calcularGananciaPatrimonialVentaSimulada(
  propertyId: number,
  salePrice: number,
  saleExpenses: number | Partial<SaleBreakdown> = 0,
  saleDate?: string
): Promise<PropertyDisposalTaxResult> {
  const db = await initDB();
  const property = await db.get('properties', propertyId);

  if (!property) {
    throw new Error(`Inmueble ${propertyId} no encontrado`);
  }

  const defaultSaleDate = saleDate || new Date().toISOString().slice(0, 10);
  return buildResult(property, {
    saleDate: defaultSaleDate,
    salePrice: round2(Number(salePrice || 0)),
    expenses: normalizeExpenses(saleExpenses),
  });
}

export async function getGananciasPatrimonialesInmueblesEjercicio(
  ejercicio: number
): Promise<PropertyDisposalTaxResult[]> {
  const db = await initDB();
  const properties = await db.getAll('properties');
  const resultados = await Promise.all(
    properties
      .filter((property) => isSoldState((property as any).state || (property as any).estado) && typeof property.id === 'number')
      .map(async (property) => {
        try {
          return await calcularGananciaPatrimonialVenta(property.id as number);
        } catch (error) {
          console.warn(`Error calculando venta del inmueble ${property.id}:`, error);
          return null;
        }
      })
  );

  return resultados.filter((item): item is PropertyDisposalTaxResult => !!item && item.ejercicioFiscal === ejercicio);
}

export async function calcularGananciaPatrimonialVentaDesdeDatos(
  propertyId: number,
  input: SimulatedSaleInput
): Promise<PropertyDisposalTaxResult> {
  return calcularGananciaPatrimonialVentaSimulada(propertyId, input.salePrice, input.saleExpenses ?? 0, input.saleDate);
}
