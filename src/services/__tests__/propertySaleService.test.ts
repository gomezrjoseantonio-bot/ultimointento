import { initDB } from '../db';
import {
  cancelPropertySale,
  confirmPropertySale,
  finalizePropertySaleLoanCancellationFromTreasuryEvent,
  getLatestConfirmedSaleForProperty,
  preparePropertySale,
} from '../propertySaleService';

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
    expect(updatedLoan?.activo).toBe(true);
    expect(updatedLoan?.principalVivo).toBe(48000);
    expect(updatedLoan?.estado).toBe('pendiente_cancelacion_venta');
  });


  it('cierra préstamo automáticamente cuando la venta ya crea cancelación confirmada', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Auto Punteo' })));
    const accountId = Number(await db.add('accounts', createAccount({ iban: 'ES7700491500051234567892' })));

    await db.add('prestamos', {
      id: 'loan-auto-close-1',
      inmuebleId: String(propertyId),
      activo: true,
      principalVivo: 50000,
      estado: 'vivo',
      ambito: 'INMUEBLE',
    } as any);

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-02-10',
      salePrice: 180000,
      settlementAccountId: accountId,
      source: 'cartera',
      loanPayoffAmount: 50000,
    });

    const loanAfter = await db.get('prestamos', 'loan-auto-close-1');
    expect(loanAfter?.activo).toBe(false);
    expect(loanAfter?.estado).toBe('cancelado');
    expect(loanAfter?.principalVivo).toBe(0);
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
    expect(movementsAfterSale).toHaveLength(4);
    expect(movementsAfterSale.some((m: any) => m.description.includes('Comisión agencia venta inmueble'))).toBe(true);
    expect(movementsAfterSale.some((m: any) => m.description.includes('Plusvalía municipal venta inmueble'))).toBe(true);

    const eventAfterSale = (await db.getAll('treasuryEvents')).find((e: any) => e.sourceId === sale!.id);
    expect(eventAfterSale).toBeTruthy();

    const loanAfterSale = await db.get('prestamos', 'loan-revert-1');
    expect(loanAfterSale?.activo).toBe(false);
    expect(loanAfterSale?.estado).toBe('cancelado');
    expect(loanAfterSale?.principalVivo).toBe(0);

    const updatedPlanAfterSale = await db.get('keyval', 'planpagos_loan-revert-1') as any;
    expect(updatedPlanAfterSale.periodos.some((p: any) => !p.pagado)).toBe(false);
    expect(updatedPlanAfterSale.resumen.fechaFinalizacion).toBe('2026-03-10');
    expect(updatedPlanAfterSale.periodos[updatedPlanAfterSale.periodos.length - 1].fechaCargo).toBe('2026-03-10');
    expect(updatedPlanAfterSale.periodos[updatedPlanAfterSale.periodos.length - 1].principalFinal).toBe(0);

    const stillScheduledLoanForecast = await db.get('treasuryEvents', loanForecastEventId);
    expect(stillScheduledLoanForecast).toBeUndefined();

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

  it('restaura gastos previstos y reactiva el préstamo al anular una venta legacy con executionJournal crudo', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Journal Legacy' })));
    const accountId = Number(await db.add('accounts', createAccount({ iban: 'ES1200491500051234567892' })));

    const loanId = 'loan-legacy-journal-1';
    await db.add('prestamos', {
      id: loanId,
      inmuebleId: String(propertyId),
      activo: true,
      principalVivo: 81234.56,
      estado: 'vivo',
      ambito: 'INMUEBLE',
      notas: 'Configuración original | tramo variable',
    } as any);

    const opexRuleId = Number(await db.add('opexRules', {
      propertyId,
      categoria: 'impuesto',
      concepto: 'IBI | cuota anual',
      importeEstimado: 1200,
      frecuencia: 'anual',
      activo: true,
      accountId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any));

    const gastoId = Number(await db.add('gastos', {
      contraparte_nombre: 'Seguro hogar | anual',
      fecha_emision: '2026-04-01',
      fecha_pago_prevista: '2026-04-15',
      total: 430,
      categoria_AEAT: '0114',
      destino: 'inmueble_id',
      destino_id: propertyId,
      estado: 'completo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any));

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-03-10',
      salePrice: 210000,
      settlementAccountId: accountId,
      source: 'detalle',
      loanPayoffAmount: 81234.56,
    });

    const sale = await getLatestConfirmedSaleForProperty(propertyId);
    expect(sale?.id).toBeDefined();
    expect(sale?.notes).toContain('executionJournalEncoded:');

    const encodedJournal = String(sale?.notes)
      .split('executionJournalEncoded:')[1]
      ?.split(' | ')[0];
    const rawJournal = decodeURIComponent(escape(atob(encodedJournal)));

    await db.put('property_sales', {
      ...sale!,
      notes: [sale!.notes?.split(' | executionJournalEncoded:')[0], `executionJournal:${rawJournal}`]
        .filter(Boolean)
        .join(' | '),
    });

    const loanAfterSale = await db.get('prestamos', loanId);
    expect(loanAfterSale?.activo).toBe(false);
    expect(loanAfterSale?.estado).toBe('cancelado');

    const opexAfterSale = await db.get('opexRules', opexRuleId);
    expect(opexAfterSale?.activo).toBe(false);

    const gastoAfterSale = await db.get('gastos', gastoId);
    expect(gastoAfterSale?.estado).toBe('incompleto');

    await cancelPropertySale(sale!.id!);

    const restoredLoan = await db.get('prestamos', loanId);
    expect(restoredLoan?.activo).toBe(true);
    expect(restoredLoan?.estado).toBe('vivo');
    expect(restoredLoan?.principalVivo).toBe(81234.56);

    const restoredOpex = await db.get('opexRules', opexRuleId);
    expect(restoredOpex?.activo).toBe(true);

    const restoredGasto = await db.get('gastos', gastoId);
    expect(restoredGasto?.estado).toBe('completo');
  });


  it('finaliza cancelación de préstamo al puntear gasto de cancelación de venta', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Punteo Cancelación' })));
    const accountId = Number(await db.add('accounts', createAccount({ iban: 'ES1100491500051234567892' })));

    await db.add('prestamos', {
      id: 'loan-punteo-1',
      inmuebleId: String(propertyId),
      activo: true,
      principalVivo: 60000,
      estado: 'vivo',
      ambito: 'INMUEBLE',
      tipo: 'FIJO',
      tipoNominalAnualFijo: 6,
      fechaFirma: '2026-01-01',
      fechaUltimaCuotaPagada: '2026-02-01',
    } as any);

    await db.put('keyval', {
      prestamoId: 'loan-punteo-1',
      fechaGeneracion: new Date().toISOString(),
      periodos: [
        {
          periodo: 1,
          fechaCargo: '2026-02-01',
          cuota: 500,
          interes: 300,
          amortizacion: 200,
          principalFinal: 60000,
          devengoDesde: '2026-01-01',
          devengoHasta: '2026-02-01',
          pagado: true,
        },
        {
          periodo: 2,
          fechaCargo: '2026-03-01',
          cuota: 500,
          interes: 295,
          amortizacion: 205,
          principalFinal: 59795,
          devengoDesde: '2026-02-02',
          devengoHasta: '2026-03-01',
          pagado: false,
        },
      ],
      resumen: { totalIntereses: 595, totalCuotas: 2, fechaFinalizacion: '2026-03-01' },
    }, 'planpagos_loan-punteo-1');

    const loanForecastEventId = Number(await db.add('treasuryEvents', {
      type: 'financing',
      amount: 500,
      predictedDate: '2026-03-01',
      description: 'Cuota Hipoteca – Piso Punteo',
      sourceType: 'hipoteca',
      sourceId: 1,
      accountId,
      status: 'predicted',
      prestamoId: 'loan-punteo-1',
      numeroCuota: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-02-10',
      salePrice: 160000,
      settlementAccountId: accountId,
      source: 'detalle',
      loanPayoffAmount: 60148,
    });

    const sale = await getLatestConfirmedSaleForProperty(propertyId);
    const cancellationMovement = (await db.getAll('movements')).find((m: any) =>
      m.reference === `property_sale:${sale!.id}` && m.description.includes('Cancelación deuda inmueble')
    );
    expect(cancellationMovement).toBeTruthy();

    const { performManualReconciliation } = await import('../movementLearningService');
    await performManualReconciliation(cancellationMovement!.id, 'Intereses', 'INMUEBLE', String(propertyId));

    const loanAfterPunteo = await db.get('prestamos', 'loan-punteo-1');
    expect(loanAfterPunteo?.activo).toBe(false);
    expect(loanAfterPunteo?.estado).toBe('cancelado');
    expect(loanAfterPunteo?.principalVivo).toBe(0);

    const updatedPlan = await db.get('keyval', 'planpagos_loan-punteo-1') as any;
    expect(updatedPlan.periodos.every((p: any) => p.pagado)).toBe(true);
    expect(updatedPlan.periodos).toHaveLength(2);
    expect(updatedPlan.resumen.fechaFinalizacion).toBe('2026-02-10');
    expect(updatedPlan.periodos[1].fechaCargo).toBe('2026-02-10');
    expect(updatedPlan.periodos[1].principalFinal).toBe(0);

    const removedForecastAfterPunteo = await db.get('treasuryEvents', loanForecastEventId);
    expect(removedForecastAfterPunteo).toBeUndefined();
  });

  it('finaliza cancelación al confirmar evento de tesorería de cancelación aunque el importe difiera del cuadro', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Diferencia Importe' })));
    const accountId = Number(await db.add('accounts', createAccount({ iban: 'ES9900491500051234567892' })));

    await db.add('prestamos', {
      id: 'loan-diff-amount-1',
      inmuebleId: String(propertyId),
      activo: true,
      principalVivo: 64005.37,
      estado: 'vivo',
      ambito: 'INMUEBLE',
    } as any);

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-03-17',
      salePrice: 210000,
      settlementAccountId: accountId,
      source: 'detalle',
      loanPayoffAmount: 63892.83,
    });

    const sale = await getLatestConfirmedSaleForProperty(propertyId);
    expect(sale?.id).toBeDefined();

    const cancellationEvent = (await db.getAll('treasuryEvents')).find((e: any) =>
      e.sourceId === sale!.id && e.type === 'financing' && e.description.includes('Cancelación deuda inmueble')
    );
    expect(cancellationEvent).toBeTruthy();

    const finalized = await finalizePropertySaleLoanCancellationFromTreasuryEvent(cancellationEvent!.id);
    expect(finalized).toBe(false);

    const loanAfter = await db.get('prestamos', 'loan-diff-amount-1');
    expect(loanAfter?.activo).toBe(false);
    expect(loanAfter?.estado).toBe('cancelado');
    expect(loanAfter?.principalVivo).toBe(0);
  });

  it('al revertir venta tras cancelación finalizada restaura el préstamo sin dejarlo a 0', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Revert Marker' })));
    const accountId = Number(await db.add('accounts', createAccount({ iban: 'ES8800491500051234567892' })));

    await db.add('prestamos', {
      id: 'loan-revert-marker-1',
      inmuebleId: String(propertyId),
      activo: true,
      principalVivo: 64005.37,
      estado: 'vivo',
      ambito: 'INMUEBLE',
      capitalVivoAlImportar: 64005.37,
    } as any);

    await confirmPropertySale({
      propertyId,
      saleDate: '2026-03-17',
      salePrice: 210000,
      settlementAccountId: accountId,
      source: 'detalle',
      loanPayoffAmount: 63892.83,
    });

    const sale = await getLatestConfirmedSaleForProperty(propertyId);
    expect(sale?.id).toBeDefined();

    const cancellationEvent = (await db.getAll('treasuryEvents')).find((e: any) =>
      e.sourceId === sale!.id && e.type === 'financing' && e.description.includes('Cancelación deuda inmueble')
    );
    expect(cancellationEvent).toBeTruthy();

    const finalized = await finalizePropertySaleLoanCancellationFromTreasuryEvent(cancellationEvent!.id);
    expect(finalized).toBe(false);

    await cancelPropertySale(sale!.id!);

    const restoredLoan = await db.get('prestamos', 'loan-revert-marker-1');
    expect(restoredLoan?.activo).toBe(true);
    expect(restoredLoan?.estado).toBe('vivo');
    expect(restoredLoan?.principalVivo).toBe(64005.37);
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


  it('elimina movimientos y eventos de tesorería al anular venta legacy sin journal', async () => {
    const db = await initDB();
    const propertyId = Number(await db.add('properties', createProperty({ alias: 'Piso Legacy Movs', state: 'vendido' })));
    const accountId = Number(await db.add('accounts', createAccount({ iban: 'ES3300491500051234567892' })));

    const saleId = Number(await db.add('property_sales', {
      propertyId,
      saleDate: '2026-02-12',
      salePrice: 200000,
      saleCosts: { agencyCommission: 2000, municipalTax: 1000, saleNotaryCosts: 500, otherCosts: 0 },
      loanSettlement: { payoffAmount: 0, cancellationFee: 0, total: 0 },
      grossProceeds: 200000,
      netProceeds: 196500,
      status: 'confirmed',
      source: 'cartera',
      notes: 'Venta legacy sin executionJournal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any));

    await db.add('movements', {
      accountId,
      date: '2026-02-12',
      valueDate: '2026-02-12',
      amount: 200000,
      description: `Cobro venta inmueble #${propertyId}`,
      counterparty: 'Venta inmueble',
      reference: `property_sale:${saleId}`,
      status: 'conciliado',
      unifiedStatus: 'conciliado',
      source: 'manual',
      category: { tipo: 'Venta inmueble' },
      type: 'Ingreso',
      origin: 'Manual',
      movementState: 'Conciliado',
      ambito: 'INMUEBLE',
      inmuebleId: String(propertyId),
      statusConciliacion: 'match_manual',
      tags: ['property_sale'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    await db.add('movements', {
      accountId,
      date: '2026-02-12',
      valueDate: '2026-02-12',
      amount: -3500,
      description: `Costes venta inmueble #${propertyId}`,
      counterparty: 'Venta inmueble',
      reference: `property_sale:${saleId}`,
      status: 'conciliado',
      unifiedStatus: 'conciliado',
      source: 'manual',
      category: { tipo: 'Costes venta inmueble' },
      type: 'Gasto',
      origin: 'Manual',
      movementState: 'Conciliado',
      ambito: 'INMUEBLE',
      inmuebleId: String(propertyId),
      statusConciliacion: 'match_manual',
      tags: ['property_sale'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    await db.add('treasuryEvents', {
      type: 'income',
      amount: 200000,
      predictedDate: '2026-02-12',
      description: `Cobro venta inmueble #${propertyId}`,
      sourceType: 'manual',
      sourceId: saleId,
      accountId,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    await cancelPropertySale(saleId);

    const saleLinkedMovements = (await db.getAll('movements')).filter((m: any) => m.reference === `property_sale:${saleId}`);
    expect(saleLinkedMovements).toHaveLength(0);

    const saleLinkedEvents = (await db.getAll('treasuryEvents')).filter((e: any) => e.sourceId === saleId);
    expect(saleLinkedEvents).toHaveLength(0);
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
