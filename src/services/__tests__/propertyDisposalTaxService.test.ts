import { initDB } from '../db';
import * as aeatAmortizationService from '../aeatAmortizationService';
import * as mejoraActivoService from '../mejoraActivoService';
import {
  calcularGananciaPatrimonialVenta,
  calcularGananciaPatrimonialVentaSimulada,
  getGananciasPatrimonialesInmueblesEjercicio,
} from '../propertyDisposalTaxService';

const createProperty = (overrides: Record<string, any> = {}) => ({
  alias: 'Tenderina 48',
  address: 'Tenderina 48',
  postalCode: '33010',
  province: 'Asturias',
  municipality: 'Oviedo',
  ccaa: 'Asturias',
  purchaseDate: '2022-09-23',
  transmissionRegime: 'usada' as const,
  state: 'vendido' as const,
  documents: [],
  acquisitionCosts: {
    price: 139000,
    itp: 10000,
    notary: 800,
    registry: 600,
    management: 980.36,
  },
  aeatAmortization: {
    acquisitionType: 'onerosa' as const,
    firstAcquisitionDate: '2022-09-23',
    cadastralValue: 52000,
    constructionCadastralValue: 21796.3,
    constructionPercentage: 41.69,
    onerosoAcquisition: {
      acquisitionAmount: 139000,
      acquisitionExpenses: 12380.36,
    },
  },
  ...overrides,
});

describe('propertyDisposalTaxService', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    const db = await initDB();
    await Promise.all([
      db.clear('properties'),
      db.clear('property_sales'),
      db.clear('propertyImprovements'),
      db.clear('mejorasActivo'),
    ]);
  });

  it('calcula la ganancia patrimonial de un inmueble vendido y la integra en el ejercicio correcto', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty()));
    await db.add('property_sales', {
      propertyId,
      saleDate: '2025-11-27',
      salePrice: 185000,
      saleCosts: {
        agencyCommission: 2117.5,
        municipalTax: 1000,
        saleNotaryCosts: 600,
        otherCosts: 150,
      },
      loanSettlement: { payoffAmount: 0, cancellationFee: 0, total: 0 },
      grossProceeds: 185000,
      netProceeds: 181132.5,
      status: 'confirmed',
      source: 'cartera',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    jest.spyOn(mejoraActivoService, 'getTotalMejorasHastaEjercicio').mockResolvedValue(0);
    jest.spyOn(aeatAmortizationService, 'getRentalDaysForYear').mockImplementation(async (_propertyId, year) => {
      if (year === 2022) return 365;
      if (year === 2023) return 365;
      if (year === 2024) return 366;
      if (year === 2025) return 331;
      return 0;
    });
    jest.spyOn(aeatAmortizationService, 'calculateAEATAmortization').mockImplementation(async (_propertyId, year, daysRented) => ({
      calculationMethod: 'general',
      baseAmount: 63110.47,
      percentageApplied: 0.03,
      daysRented,
      daysAvailable: year === 2024 ? 366 : 365,
      propertyAmortization: year === 2025 ? 1716.39 : 1893.31,
      improvementsAmortization: 0,
      furnitureAmortization: 0,
      totalAmortization: year === 2025 ? 1716.39 : 1893.31,
      accumulatedStandard: 0,
      accumulatedActual: 0,
      breakdown: {
        constructionCost: 63110.47,
        cadastralConstructionValue: 21796.3,
        historicalImprovements: 0,
        selectedBase: 'construction-cost' as const,
      },
    }));

    const result = await calcularGananciaPatrimonialVenta(propertyId);

    expect(result).not.toBeNull();
    expect(result?.gastosVenta).toBe(3867.5);
    expect(result?.valorTransmision).toBe(181132.5);
    expect(result?.amortizacionAplicada).toBe(7396.32);
    expect(result?.valorAdquisicion).toBe(143984.04);
    expect(result?.gananciaPatrimonial).toBe(37148.46);

    const ejercicio = await getGananciasPatrimonialesInmueblesEjercicio(2025);
    expect(ejercicio).toHaveLength(1);
    expect(ejercicio[0].inmuebleId).toBe(propertyId);
  });

  it('usa el fallback legacy de propertyImprovements cuando falla mejorasActivo', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Legacy' })));
    await db.add('property_sales', {
      propertyId,
      saleDate: '2025-06-30',
      salePrice: 160000,
      saleCosts: {
        agencyCommission: 1000,
        municipalTax: 0,
        saleNotaryCosts: 0,
        otherCosts: 0,
      },
      loanSettlement: { payoffAmount: 0, cancellationFee: 0, total: 0 },
      grossProceeds: 160000,
      netProceeds: 159000,
      status: 'confirmed',
      source: 'detalle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await db.add('propertyImprovements', {
      propertyId,
      year: 2024,
      amount: 2500,
      description: 'Cocina',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    jest.spyOn(mejoraActivoService, 'getTotalMejorasHastaEjercicio').mockRejectedValue(new Error('legacy'));
    jest.spyOn(aeatAmortizationService, 'getRentalDaysForYear').mockResolvedValue(0);
    jest.spyOn(aeatAmortizationService, 'calculateAEATAmortization').mockResolvedValue({
      calculationMethod: 'general',
      baseAmount: 0,
      percentageApplied: 0.03,
      daysRented: 0,
      daysAvailable: 365,
      propertyAmortization: 0,
      improvementsAmortization: 0,
      furnitureAmortization: 0,
      totalAmortization: 0,
      accumulatedStandard: 0,
      accumulatedActual: 0,
      breakdown: {
        constructionCost: 0,
        cadastralConstructionValue: 0,
        historicalImprovements: 0,
        selectedBase: 'construction-cost' as const,
      },
    });

    const result = await calcularGananciaPatrimonialVenta(propertyId);

    expect(result?.mejoras).toBe(2500);
    expect(result?.valorAdquisicion).toBe(153880.36);
  });

  it('permite simular una venta aunque el inmueble siga activo', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ state: 'activo', alias: 'Simulado' })));

    jest.spyOn(mejoraActivoService, 'getTotalMejorasHastaEjercicio').mockResolvedValue(0);
    jest.spyOn(aeatAmortizationService, 'getRentalDaysForYear').mockResolvedValue(0);
    jest.spyOn(aeatAmortizationService, 'calculateAEATAmortization').mockResolvedValue({
      calculationMethod: 'general',
      baseAmount: 0,
      percentageApplied: 0.03,
      daysRented: 0,
      daysAvailable: 365,
      propertyAmortization: 0,
      improvementsAmortization: 0,
      furnitureAmortization: 0,
      totalAmortization: 0,
      accumulatedStandard: 0,
      accumulatedActual: 0,
      breakdown: {
        constructionCost: 0,
        cadastralConstructionValue: 0,
        historicalImprovements: 0,
        selectedBase: 'construction-cost' as const,
      },
    });

    const result = await calcularGananciaPatrimonialVentaSimulada(propertyId, 200000, 5000, '2025-09-30');

    expect(result.precioVenta).toBe(200000);
    expect(result.gastosVenta).toBe(5000);
    expect(result.fechaVenta).toBe('2025-09-30');
    expect(result.integracion).toBe('base_ahorro');
  });
});
