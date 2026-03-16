import { initDB } from '../db';
import { cancelPropertySale, confirmPropertySale, getLatestConfirmedSaleForProperty, preparePropertySale } from '../propertySaleService';

const createProperty = (overrides: Record<string, any> = {}) => ({
  alias: 'Piso Centro',
  address: 'Calle Mayor 1',
  postalCode: '28001',
  province: 'Madrid',
  municipality: 'Madrid',
  ccaa: 'Comunidad de Madrid',
  purchaseDate: '2020-01-01',
  transmissionRegime: 'usada' as const,
  state: 'activo' as const,
  documents: [],
  acquisitionCosts: {
    price: 120000,
  },
  ...overrides,
});

const createAccount = (overrides: Record<string, any> = {}) => ({
  iban: 'ES6600491500051234567892',
  status: 'ACTIVE' as const,
  activa: true,
  isActive: true,
  alias: 'Cuenta principal',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('propertySaleService', () => {
  beforeEach(async () => {
    const db = await initDB();
    await Promise.all([
      db.clear('properties'),
      db.clear('property_sales'),
      db.clear('accounts'),
      db.clear('prestamos'),
      db.clear('contracts'),
      db.clear('movements'),
      db.clear('opexRules'),
      db.clear('ingresos'),
      db.clear('gastos'),
      db.clear('treasuryEvents'),
      db.clear('fiscalSummaries'),
    ]);
  });

  it('cancela préstamo vinculado por alias al confirmar la venta', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty()));
    const accountId = Number(await db.add('accounts', createAccount()));

    await db.add('prestamos', {
      id: 'loan-alias-1',
      inmuebleId: 'Piso Centro',
      activo: true,
      principalVivo: 48000,
      estado: 'vivo',
      ambito: 'INMUEBLE',
    } as any);

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-02-10',
      salePrice: 180000,
      settlementAccountId: accountId,
      source: 'cartera',
    });

    const updatedLoan = await db.get('prestamos', 'loan-alias-1');
    expect(updatedLoan?.activo).toBe(false);
    expect(updatedLoan?.principalVivo).toBe(0);
    expect(updatedLoan?.estado).toBe('cancelado');
  });

  it('permite revertir una venta confirmada y reactivar el inmueble', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Retorno' })));
    const accountId = Number(await db.add('accounts', createAccount({ iban: 'ES2101823401123456789012' })));

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-01-15',
      salePrice: 165000,
      settlementAccountId: accountId,
      source: 'analisis',
    });

    const latestSale = await getLatestConfirmedSaleForProperty(propertyId);
    expect(latestSale?.id).toBeDefined();

    const prepareAfterSale = await preparePropertySale(propertyId, '2026-01-16');
    expect(prepareAfterSale.property.state).toBe('vendido');

    await cancelPropertySale(latestSale!.id!);

    const revertedProperty = await db.get('properties', propertyId);
    expect(revertedProperty?.state).toBe('activo');

    const revertedSale = await db.get('property_sales', latestSale!.id!);
    expect(revertedSale?.status).toBe('reverted');
  });

  it('genera movimientos y revierte completamente los efectos al anular', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Completo' })));
    const accountId = Number(await db.add('accounts', createAccount({ iban: 'ES1000491500051234567892' })));

    await db.add('prestamos', {
      id: 'loan-revert-1',
      inmuebleId: String(propertyId),
      activo: true,
      principalVivo: 72500,
      estado: 'vivo',
      ambito: 'INMUEBLE',
    } as any);

    await db.put('keyval', {
      prestamoId: 'loan-revert-1',
      fechaGeneracion: new Date().toISOString(),
      periodos: [
        {
          periodo: 1,
          fechaCargo: '2026-03-20',
          cuota: 999,
          interes: 200,
          amortizacion: 799,
          principalFinal: 71701,
          devengoDesde: '2026-02-21',
          devengoHasta: '2026-03-20',
          pagado: false,
        },
        {
          periodo: 2,
          fechaCargo: '2026-04-20',
          cuota: 999,
          interes: 198,
          amortizacion: 801,
          principalFinal: 70900,
          devengoDesde: '2026-03-21',
          devengoHasta: '2026-04-20',
          pagado: false,
        },
      ],
      resumen: { totalIntereses: 398, totalCuotas: 2, fechaFinalizacion: '2026-04-20' },
    }, 'planpagos_loan-revert-1');

    const loanForecastEventId = Number(await db.add('treasuryEvents', {
      type: 'financing',
      amount: 999,
      predictedDate: '2026-03-20',
      description: 'Cuota Hipoteca – Piso Completo',
      sourceType: 'hipoteca',
      sourceId: 1,
      accountId,
      status: 'predicted',
      prestamoId: 'loan-revert-1',
      numeroCuota: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-03-10',
      salePrice: 210000,
      agencyCommission: 5000,
      municipalTax: 1800,
      loanPayoffAmount: 72500,
      loanCancellationFee: 250,
      settlementAccountId: accountId,
      source: 'detalle',
    });

    const sale = await getLatestConfirmedSaleForProperty(propertyId);
    expect(sale?.id).toBeDefined();

    const movementsAfterSale = (await db.getAll('movements')).filter((m: any) => m.reference === `property_sale:${sale!.id}`);
    expect(movementsAfterSale).toHaveLength(3);

    const eventAfterSale = (await db.getAll('treasuryEvents')).find((e: any) => e.sourceId === sale!.id);
    expect(eventAfterSale).toBeTruthy();

    const loanAfterSale = await db.get('prestamos', 'loan-revert-1');
    expect(loanAfterSale?.activo).toBe(false);
    expect(loanAfterSale?.principalVivo).toBe(0);

    const updatedPlanAfterSale = await db.get('keyval', 'planpagos_loan-revert-1') as any;
    expect(updatedPlanAfterSale.periodos.every((p: any) => p.pagado)).toBe(true);

    const removedLoanForecast = await db.get('treasuryEvents', loanForecastEventId);
    expect(removedLoanForecast).toBeUndefined();

    await cancelPropertySale(sale!.id!);

    const loanAfterCancel = await db.get('prestamos', 'loan-revert-1');
    expect(loanAfterCancel?.activo).toBe(true);
    expect(loanAfterCancel?.principalVivo).toBe(72500);

    const restoredPlanAfterCancel = await db.get('keyval', 'planpagos_loan-revert-1') as any;
    expect(restoredPlanAfterCancel.periodos.some((p: any) => !p.pagado)).toBe(true);

    const restoredLoanForecast = await db.get('treasuryEvents', loanForecastEventId);
    expect(restoredLoanForecast).toBeTruthy();

    const movementsAfterCancel = (await db.getAll('movements')).filter((m: any) => m.reference === `property_sale:${sale!.id}`);
    expect(movementsAfterCancel).toHaveLength(0);

    const eventsAfterCancel = (await db.getAll('treasuryEvents')).filter((e: any) => e.sourceId === sale!.id);
    expect(eventsAfterCancel).toHaveLength(0);
  });

  it('reactiva préstamos al anular una venta antigua sin executionJournal', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Legacy', state: 'vendido' })));

    await db.add('prestamos', {
      id: 'loan-legacy-1',
      inmuebleId: String(propertyId),
      activo: false,
      principalVivo: 0,
      capitalVivoAlImportar: 60500,
      estado: 'cancelado',
      ambito: 'INMUEBLE',
    } as any);

    const saleId = Number(await db.add('property_sales', {
      propertyId,
      saleDate: '2026-02-12',
      salePrice: 200000,
      saleCosts: { agencyCommission: 0, municipalTax: 0, saleNotaryCosts: 0, otherCosts: 0 },
      loanSettlement: { payoffAmount: 0, cancellationFee: 0, total: 0 },
      grossProceeds: 200000,
      netProceeds: 200000,
      status: 'confirmed',
      source: 'cartera',
      notes: 'Venta antigua sin journal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any));

    await cancelPropertySale(saleId);

    const restoredLoan = await db.get('prestamos', 'loan-legacy-1');
    expect(restoredLoan?.activo).toBe(true);
    expect(restoredLoan?.estado).toBe('vivo');
    expect(restoredLoan?.principalVivo).toBe(60500);
  });



  it('calcula deuda sugerida con capital proyectado según fecha de venta', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Proyección' })));

    await db.add('prestamos', {
      id: 'loan-projected-1',
      inmuebleId: String(propertyId),
      activo: true,
      principalVivo: 100000,
      capitalVivoAlImportar: 100000,
      estado: 'vivo',
      ambito: 'INMUEBLE',
    } as any);

    await db.put('keyval', {
      prestamoId: 'loan-projected-1',
      fechaGeneracion: new Date().toISOString(),
      periodos: [
        {
          periodo: 1,
          fechaCargo: '2026-01-15',
          cuota: 1000,
          interes: 200,
          amortizacion: 800,
          principalFinal: 92000,
          devengoDesde: '2025-12-16',
          devengoHasta: '2026-01-15',
          pagado: false,
        },
        {
          periodo: 2,
          fechaCargo: '2026-02-15',
          cuota: 1000,
          interes: 180,
          amortizacion: 820,
          principalFinal: 84000,
          devengoDesde: '2026-01-16',
          devengoHasta: '2026-02-15',
          pagado: false,
        },
      ],
      resumen: { totalIntereses: 380, totalCuotas: 2, fechaFinalizacion: '2026-02-15' },
    }, 'planpagos_loan-projected-1');

    const salePreview = await preparePropertySale(propertyId, '2026-02-20');
    expect(salePreview.automationPreview.suggestedOutstandingDebt).toBe(84000);
  });

  it('abre fiscalidad del año siguiente al confirmar una venta', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Fiscal' })));
    const accountId = Number(await db.add('accounts', createAccount({ iban: 'ES2212341234123412341234' })));

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-03-16',
      salePrice: 200000,
      settlementAccountId: accountId,
      source: 'cartera',
    });

    const summaries2027 = await db.getAllFromIndex('fiscalSummaries', 'property-year', [propertyId, 2027]);
    expect(summaries2027).toHaveLength(1);
  });

  it('falla si no se informa cuenta de tesorería', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Sin Cuenta' })));

    await expect(confirmPropertySale({
      propertyId,
      saleDate: '2026-02-10',
      salePrice: 180000,
      source: 'cartera',
    })).rejects.toThrow('Selecciona una cuenta de tesorería para registrar la venta');
  });
});
