import { Contract, Property, TreasuryEvent, initDB, PropertySale } from './db';
import { PlanPagos } from '../types/prestamos';
import { triggerTreasuryUpdate } from './treasuryEventsService';

export interface SaleSimulationInput {
  salePrice: number;
  agencyCommission?: number;
  municipalTax?: number;
  saleNotaryCosts?: number;
  loanPayoffAmount?: number;
  loanCancellationFee?: number;
  otherCosts?: number;
}

export interface ConfirmPropertySaleInput extends SaleSimulationInput {
  propertyId: number;
  saleDate: string;
  source: 'cartera' | 'detalle' | 'analisis';
  settlementAccountId?: number;
  notes?: string;
  autoTerminateContracts?: boolean;
}

export interface PrepareSaleResult {
  property: Property;
  activeContracts: Contract[];
  automationPreview: {
    linkedLoansCount: number;
    suggestedOutstandingDebt: number;
    activeOpexRulesCount: number;
    futureIncomeCount: number;
    futureExpenseCount: number;
  };
}

interface SaleExecutionJournal {
  settlementAccountId?: number;
  movementIds: number[];
  treasuryEventIds: number[];
  autoTerminatedContracts: Array<{ id: number; previous: Contract }>;
  updatedLoans: Array<{ id: string; previous: Record<string, unknown> }>;
  deactivatedOpexRules: Array<{ id: number; previous: Record<string, unknown> }>;
  updatedIngresos: Array<{ id: number; previous: Record<string, unknown> }>;
  updatedGastos: Array<{ id: number; previous: Record<string, unknown> }>;
  updatedPaymentPlans: Array<{ key: string; previous: PlanPagos }>;
  deletedLoanForecastEvents: Array<{ id: number; previous: TreasuryEvent }>;
}

const normalizeToken = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const isLoanLinkedToProperty = (loan: any, property: Property): boolean => {
  if (!loan || typeof loan !== 'object') return false;
  const propertyIdAsString = String(property.id ?? '').trim();

  const linkedIds = [
    loan.inmuebleId,
    loan.propertyId,
    loan.activoAsociadoId,
    loan.activoId,
    loan.assetId,
    loan.inmueble?.id,
    loan.globalAlias,
    loan.alias,
    loan.nombre,
  ].filter((value) => value !== undefined && value !== null);

  if (Array.isArray(loan.afectacionesInmueble)) {
    linkedIds.push(...loan.afectacionesInmueble.map((item: any) => item?.inmuebleId));
  }

  const propertyAliasToken = normalizeToken(property.alias);
  const propertyGlobalAliasToken = normalizeToken(property.globalAlias);

  return linkedIds.some((rawLinkedId) => {
    const linkedId = String(rawLinkedId ?? '').trim();
    if (!linkedId) return false;
    if (linkedId === propertyIdAsString) return true;
    if (Number(linkedId) === Number(propertyIdAsString)) return true;

    const normalizedLinkedId = normalizeToken(linkedId);
    if (!normalizedLinkedId) return false;
    return normalizedLinkedId === propertyAliasToken || normalizedLinkedId === propertyGlobalAliasToken;
  });
};

const calculateTotalAcquisitionCost = (property: Property): number => {
  const costs = property.acquisitionCosts;
  return costs.price +
    (costs.itp || 0) +
    (costs.iva || 0) +
    (costs.notary || 0) +
    (costs.registry || 0) +
    (costs.management || 0) +
    (costs.psi || 0) +
    (costs.realEstate || 0) +
    (costs.other?.reduce((sum, item) => sum + item.amount, 0) || 0);
};

const getSaleIrpfPredictionDate = (saleDate: string): string => {
  const parsed = new Date(saleDate);
  const fiscalYear = Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
  return `${fiscalYear + 1}-06-30`;
};

const estimateSaleIrpf = (property: Property, salePrice: number): number => {
  const gain = salePrice - calculateTotalAcquisitionCost(property);
  if (gain <= 0) return 0;
  return Number((gain * 0.19).toFixed(2));
};

const isActiveContract = (contract: Contract, referenceDateIso?: string): boolean => {
  const referenceDate = referenceDateIso ? new Date(referenceDateIso) : new Date();
  if (Number.isNaN(referenceDate.getTime())) return false;

  const startDate = contract.fechaInicio || contract.startDate;
  const endDate = contract.fechaFin || contract.endDate;

  if (startDate) {
    const parsedStart = new Date(startDate);
    if (!Number.isNaN(parsedStart.getTime()) && parsedStart > referenceDate) {
      return false;
    }
  }

  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!Number.isNaN(parsedEnd.getTime()) && parsedEnd < referenceDate) {
      return false;
    }
  }

  if (contract.estadoContrato === 'rescindido' || contract.status === 'terminated') {
    return false;
  }

  if (contract.estadoContrato === 'activo' || contract.status === 'active') {
    return true;
  }

  return !endDate;
};

const createTreasuryMovement = ({
  accountId,
  amount,
  date,
  description,
  propertyId,
  saleId,
}: {
  accountId: number;
  amount: number;
  date: string;
  description: string;
  propertyId: number;
  saleId: number;
}) => ({
  accountId,
  date,
  valueDate: date,
  amount,
  description,
  counterparty: 'Venta inmueble',
  reference: `property_sale:${saleId}`,
  status: 'conciliado' as const,
  unifiedStatus: 'conciliado' as const,
  source: 'manual' as const,
  category: {
    tipo: amount >= 0 ? 'Venta inmueble' : 'Costes venta inmueble',
  },
  type: amount >= 0 ? 'Ingreso' as const : 'Gasto' as const,
  origin: 'Manual' as const,
  movementState: 'Conciliado' as const,
  ambito: 'INMUEBLE' as const,
  inmuebleId: String(propertyId),
  statusConciliacion: 'match_manual' as const,
  tags: ['property_sale'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const simulatePropertySale = (input: SaleSimulationInput) => {
  const salePrice = Number(input.salePrice || 0);
  const agencyCommission = Number(input.agencyCommission || 0);
  const municipalTax = Number(input.municipalTax || 0);
  const saleNotaryCosts = Number(input.saleNotaryCosts || 0);
  const loanPayoffAmount = Number(input.loanPayoffAmount || 0);
  const loanCancellationFee = Number(input.loanCancellationFee || 0);
  const otherCosts = Number(input.otherCosts || 0);

  const totalSaleCosts = agencyCommission + municipalTax + saleNotaryCosts + otherCosts;
  const totalLoanSettlement = loanPayoffAmount + loanCancellationFee;
  const netProceeds = salePrice - totalSaleCosts - totalLoanSettlement;

  return {
    grossProceeds: salePrice,
    totalSaleCosts,
    totalLoanSettlement,
    netProceeds,
  };
};

export const preparePropertySale = async (propertyId: number, saleDate?: string): Promise<PrepareSaleResult> => {
  const db = await initDB();
  const property = await db.get('properties', propertyId);

  if (!property) {
    throw new Error('Inmueble no encontrado');
  }

  const contracts = await db.getAll('contracts');
  const referenceDate = saleDate ?? new Date().toISOString().slice(0, 10);
  const activeContracts = contracts.filter(
    (contract) =>
      (contract.inmuebleId === propertyId || contract.propertyId === propertyId) &&
      isActiveContract(contract, referenceDate)
  );

  const allLoans = await db.getAll('prestamos');
  const linkedLoans = allLoans.filter((loan: any) => isLoanLinkedToProperty(loan, property));

  const suggestedOutstandingDebt = linkedLoans
    .filter((loan: any) => loan.activo !== false)
    .reduce((sum: number, loan: any) => sum + Number(loan.principalVivo || 0), 0);

  const [allOpexRules, allIngresos, allGastos] = await Promise.all([
    db.getAll('opexRules').catch(() => []),
    db.getAll('ingresos').catch(() => []),
    db.getAll('gastos').catch(() => []),
  ]);

  const activeOpexRulesCount = allOpexRules.filter(
    (rule: any) => rule.propertyId === propertyId && rule.activo !== false
  ).length;
  const futureIncomeCount = allIngresos.filter((ingreso: any) =>
    ingreso.destino === 'inmueble_id' &&
    ingreso.destino_id === propertyId &&
    ingreso.estado === 'previsto' &&
    ingreso.fecha_prevista_cobro >= referenceDate
  ).length;
  const futureExpenseCount = allGastos.filter((gasto: any) =>
    gasto.destino === 'inmueble_id' &&
    gasto.destino_id === propertyId &&
    gasto.estado !== 'pagado' &&
    gasto.fecha_pago_prevista >= referenceDate
  ).length;

  return {
    property,
    activeContracts,
    automationPreview: {
      linkedLoansCount: linkedLoans.length,
      suggestedOutstandingDebt,
      activeOpexRulesCount,
      futureIncomeCount,
      futureExpenseCount,
    },
  };
};

export const confirmPropertySale = async (input: ConfirmPropertySaleInput): Promise<PropertySale> => {
  if (!input.saleDate) {
    throw new Error('La fecha de venta es obligatoria');
  }

  if (!input.salePrice || input.salePrice <= 0) {
    throw new Error('El precio de venta debe ser mayor que 0');
  }

  const db = await initDB();
  const tx = db.transaction(['properties', 'contracts', 'property_sales', 'accounts', 'movements', 'prestamos', 'opexRules', 'ingresos', 'gastos', 'treasuryEvents', 'keyval'], 'readwrite');

  const property = await tx.objectStore('properties').get(input.propertyId);
  if (!property) {
    throw new Error('Inmueble no encontrado');
  }

  if (property.state !== 'activo') {
    throw new Error('Solo se pueden vender inmuebles activos');
  }

  const allContracts = await tx.objectStore('contracts').getAll();
  const activeContracts = allContracts.filter(
    (contract) =>
      (contract.inmuebleId === input.propertyId || contract.propertyId === input.propertyId) &&
      isActiveContract(contract, input.saleDate)
  );

  if (input.settlementAccountId !== undefined) {
    const settlementAccount = await tx.objectStore('accounts').get(input.settlementAccountId);
    if (!settlementAccount || settlementAccount.deleted_at || settlementAccount.isActive === false) {
      throw new Error('Selecciona una cuenta de tesorería válida para registrar la venta');
    }
  }

  if (activeContracts.length > 0 && !input.autoTerminateContracts) {
    throw new Error('Existen contratos activos. Ciérralos antes de vender o activa el cierre automático.');
  }

  if (input.settlementAccountId === undefined) {
    throw new Error('Selecciona una cuenta de tesorería para registrar la venta');
  }

  const autoTerminatedContracts: SaleExecutionJournal['autoTerminatedContracts'] = [];
  if (activeContracts.length > 0 && input.autoTerminateContracts) {
    for (const contract of activeContracts) {
      if (typeof contract.id !== 'number') {
        continue;
      }
      autoTerminatedContracts.push({ id: contract.id, previous: contract });
      await tx.objectStore('contracts').put({
        ...contract,
        fechaFin: input.saleDate,
        endDate: input.saleDate,
        estadoContrato: 'rescindido',
        status: 'terminated',
        rescision: {
          fecha: input.saleDate,
          motivo: 'Venta del inmueble',
        },
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const simulation = simulatePropertySale(input);
  const now = new Date().toISOString();

  const sale: Omit<PropertySale, 'id'> = {
    propertyId: input.propertyId,
    saleDate: input.saleDate,
    salePrice: input.salePrice,
    saleCosts: {
      agencyCommission: Number(input.agencyCommission || 0),
      municipalTax: Number(input.municipalTax || 0),
      saleNotaryCosts: Number(input.saleNotaryCosts || 0),
      otherCosts: Number(input.otherCosts || 0),
    },
    loanSettlement: {
      payoffAmount: Number(input.loanPayoffAmount || 0),
      cancellationFee: Number(input.loanCancellationFee || 0),
      total: simulation.totalLoanSettlement,
    },
    grossProceeds: simulation.grossProceeds,
    netProceeds: simulation.netProceeds,
    status: 'confirmed',
    source: input.source,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };

  const rawSaleId = await tx.objectStore('property_sales').add(sale);
  const saleId = typeof rawSaleId === 'number' ? rawSaleId : undefined;

  const executionJournal: SaleExecutionJournal = {
    settlementAccountId: input.settlementAccountId,
    movementIds: [],
    treasuryEventIds: [],
    autoTerminatedContracts,
    updatedLoans: [],
    deactivatedOpexRules: [],
    updatedIngresos: [],
    updatedGastos: [],
    updatedPaymentPlans: [],
    deletedLoanForecastEvents: [],
  };

  if (saleId) {
    const saleCostsTotal = simulation.totalSaleCosts;
    const loanSettlementTotal = simulation.totalLoanSettlement;
    const movementStore = tx.objectStore('movements');

    const movementsToCreate = [
      createTreasuryMovement({
        accountId: input.settlementAccountId,
        amount: simulation.grossProceeds,
        date: input.saleDate,
        description: `Cobro venta inmueble #${input.propertyId}`,
        propertyId: input.propertyId,
        saleId,
      }),
      ...(saleCostsTotal > 0
        ? [
            createTreasuryMovement({
              accountId: input.settlementAccountId,
              amount: -saleCostsTotal,
              date: input.saleDate,
              description: `Costes venta inmueble #${input.propertyId}`,
              propertyId: input.propertyId,
              saleId,
            }),
          ]
        : []),
      ...(loanSettlementTotal > 0
        ? [
            createTreasuryMovement({
              accountId: input.settlementAccountId,
              amount: -loanSettlementTotal,
              date: input.saleDate,
              description: `Cancelación deuda inmueble #${input.propertyId}`,
              propertyId: input.propertyId,
              saleId,
            }),
          ]
        : []),
    ];

    for (const movement of movementsToCreate) {
      const createdId = await movementStore.add(movement);
      if (typeof createdId === 'number') {
        executionJournal.movementIds.push(createdId);
      }
    }
  }

  const loanStore = tx.objectStore('prestamos');
  const allLoans = await loanStore.getAll();
  const linkedLoans = allLoans.filter((loan: any) => isLoanLinkedToProperty(loan, property));

  for (const loan of linkedLoans) {
    if (!loan?.id) continue;
    executionJournal.updatedLoans.push({ id: loan.id, previous: loan });

    const paymentPlanKey = `planpagos_${loan.id}`;
    const paymentPlan = await tx.objectStore('keyval').get(paymentPlanKey) as PlanPagos | undefined;
    if (paymentPlan?.periodos?.length) {
      executionJournal.updatedPaymentPlans.push({ key: paymentPlanKey, previous: paymentPlan });
      const updatedPlan: PlanPagos = {
        ...paymentPlan,
        periodos: paymentPlan.periodos.map((periodo) => {
          if (periodo.fechaCargo < input.saleDate) {
            return periodo;
          }
          return {
            ...periodo,
            pagado: true,
            fechaPagoReal: periodo.fechaPagoReal ?? input.saleDate,
          };
        }),
      };
      await tx.objectStore('keyval').put(updatedPlan, paymentPlanKey);
    }

    const loanForecastEvents = (await tx.objectStore('treasuryEvents').getAll() as TreasuryEvent[])
      .filter((event) =>
        (event.sourceType === 'hipoteca' || event.sourceType === 'prestamo') &&
        event.prestamoId === loan.id &&
        event.predictedDate >= input.saleDate &&
        event.status !== 'executed' &&
        typeof event.id === 'number'
      );
    for (const event of loanForecastEvents) {
      executionJournal.deletedLoanForecastEvents.push({ id: event.id as number, previous: event });
      await tx.objectStore('treasuryEvents').delete(event.id as number);
    }

    await loanStore.put({
      ...loan,
      activo: false,
      estado: 'cancelado',
      principalVivo: 0,
      cuotasPagadas: paymentPlan?.periodos?.length ?? loan.cuotasPagadas,
      fechaUltimaCuotaPagada: input.saleDate,
      updatedAt: new Date().toISOString(),
    });
  }

  const opexStore = tx.objectStore('opexRules');
  const allOpexRules = await opexStore.getAll();
  for (const rule of allOpexRules as any[]) {
    if (rule?.propertyId !== input.propertyId || rule.activo === false || typeof rule.id !== 'number') {
      continue;
    }
    executionJournal.deactivatedOpexRules.push({ id: rule.id, previous: rule });
    await opexStore.put({
      ...rule,
      activo: false,
      updatedAt: new Date().toISOString(),
    });
  }

  const ingresoStore = tx.objectStore('ingresos');
  const allIngresos = await ingresoStore.getAll();
  for (const ingreso of allIngresos as any[]) {
    if (
      ingreso?.destino !== 'inmueble_id' ||
      ingreso?.destino_id !== input.propertyId ||
      ingreso?.estado !== 'previsto' ||
      ingreso?.fecha_prevista_cobro < input.saleDate ||
      typeof ingreso.id !== 'number'
    ) {
      continue;
    }
    executionJournal.updatedIngresos.push({ id: ingreso.id, previous: ingreso });
    await ingresoStore.put({
      ...ingreso,
      estado: 'incompleto',
      updatedAt: new Date().toISOString(),
    });
  }

  const gastoStore = tx.objectStore('gastos');
  const allGastos = await gastoStore.getAll();
  for (const gasto of allGastos as any[]) {
    if (
      gasto?.destino !== 'inmueble_id' ||
      gasto?.destino_id !== input.propertyId ||
      gasto?.estado === 'pagado' ||
      gasto?.fecha_pago_prevista < input.saleDate ||
      typeof gasto.id !== 'number'
    ) {
      continue;
    }
    executionJournal.updatedGastos.push({ id: gasto.id, previous: gasto });
    await gastoStore.put({
      ...gasto,
      estado: 'incompleto',
      updatedAt: new Date().toISOString(),
    });
  }

  const estimatedIrpf = estimateSaleIrpf(property, input.salePrice);
  if (estimatedIrpf > 0) {
    const treasuryEventId = await tx.objectStore('treasuryEvents').add({
      type: 'expense',
      amount: estimatedIrpf,
      predictedDate: getSaleIrpfPredictionDate(input.saleDate),
      description: `IRPF estimado por venta inmueble #${input.propertyId}`,
      sourceType: 'irpf_prevision',
      sourceId: saleId,
      accountId: input.settlementAccountId,
      status: 'predicted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (typeof treasuryEventId === 'number') {
      executionJournal.treasuryEventIds.push(treasuryEventId);
    }
  }

  if (saleId) {
    const saleTreasuryEvents: Array<Omit<TreasuryEvent, 'id'>> = [
      {
        type: 'income',
        amount: simulation.grossProceeds,
        predictedDate: input.saleDate,
        description: `Cobro venta inmueble #${input.propertyId}`,
        sourceType: 'manual',
        sourceId: saleId,
        accountId: input.settlementAccountId,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...(simulation.totalSaleCosts > 0
        ? [{
            type: 'expense' as const,
            amount: simulation.totalSaleCosts,
            predictedDate: input.saleDate,
            description: `Costes venta inmueble #${input.propertyId}`,
            sourceType: 'manual' as const,
            sourceId: saleId,
            accountId: input.settlementAccountId,
            status: 'confirmed' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }]
        : []),
      ...(simulation.totalLoanSettlement > 0
        ? [{
            type: 'financing' as const,
            amount: simulation.totalLoanSettlement,
            predictedDate: input.saleDate,
            description: `Cancelación deuda inmueble #${input.propertyId}`,
            sourceType: 'manual' as const,
            sourceId: saleId,
            accountId: input.settlementAccountId,
            status: 'confirmed' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }]
        : []),
    ];

    for (const event of saleTreasuryEvents) {
      const treasuryEventId = await tx.objectStore('treasuryEvents').add(event);
      if (typeof treasuryEventId === 'number') {
        executionJournal.treasuryEventIds.push(treasuryEventId);
      }
    }
  }

  const updatedProperty: Property = {
    ...property,
    state: 'vendido',
    notes: [property.notes, `Vendido el ${input.saleDate}.${saleId ? ` SaleId: ${saleId}.` : ''}`].filter(Boolean).join(' | '),
  };

  await tx.objectStore('properties').put(updatedProperty);
  if (saleId) {
    await tx.objectStore('property_sales').put({
      ...sale,
      id: saleId,
      notes: [sale.notes, `executionJournal:${JSON.stringify(executionJournal)}`].filter(Boolean).join(' | '),
      updatedAt: new Date().toISOString(),
    });
  }
  await tx.done;

  await triggerTreasuryUpdate([input.settlementAccountId]);

  return {
    ...sale,
    id: saleId,
  };
};


export const getLatestConfirmedSaleForProperty = async (propertyId: number): Promise<PropertySale | null> => {
  const db = await initDB();
  const sales = await db.getAllFromIndex('property_sales', 'property-status', [propertyId, 'confirmed']);

  if (!sales.length) {
    return null;
  }

  return sales
    .slice()
    .sort((a, b) => {
      const aSaleDate = new Date(a.saleDate).getTime();
      const bSaleDate = new Date(b.saleDate).getTime();

      if (aSaleDate !== bSaleDate) {
        return bSaleDate - aSaleDate;
      }

      const aCreatedAt = new Date(a.createdAt).getTime();
      const bCreatedAt = new Date(b.createdAt).getTime();
      return bCreatedAt - aCreatedAt;
    })[0];
};

export const cancelPropertySale = async (saleId: number): Promise<PropertySale> => {
  const db = await initDB();
  const tx = db.transaction(['properties', 'property_sales', 'contracts', 'movements', 'prestamos', 'opexRules', 'ingresos', 'gastos', 'treasuryEvents', 'keyval'], 'readwrite');

  const saleStore = tx.objectStore('property_sales');
  const propertyStore = tx.objectStore('properties');

  const sale = await saleStore.get(saleId);
  if (!sale) {
    throw new Error('No se encontró la venta seleccionada');
  }

  if (sale.status !== 'confirmed') {
    throw new Error('Solo se pueden anular ventas confirmadas');
  }

  const property = await propertyStore.get(sale.propertyId);
  if (!property) {
    throw new Error('Inmueble no encontrado');
  }

  const extractJournalFromNotes = (): SaleExecutionJournal | null => {
    if (!sale.notes) return null;
    const marker = 'executionJournal:';
    const markerIndex = sale.notes.lastIndexOf(marker);
    if (markerIndex === -1) return null;
    const payload = sale.notes.slice(markerIndex + marker.length).trim();
    try {
      return JSON.parse(payload) as SaleExecutionJournal;
    } catch {
      return null;
    }
  };

  const journal = extractJournalFromNotes();

  if (journal?.movementIds?.length) {
    for (const movementId of journal.movementIds) {
      await tx.objectStore('movements').delete(movementId);
    }
  }

  if (journal?.treasuryEventIds?.length) {
    for (const eventId of journal.treasuryEventIds) {
      await tx.objectStore('treasuryEvents').delete(eventId);
    }
  }

  if (journal?.autoTerminatedContracts?.length) {
    for (const snapshot of journal.autoTerminatedContracts) {
      await tx.objectStore('contracts').put(snapshot.previous);
    }
  }

  if (journal?.updatedLoans?.length) {
    for (const snapshot of journal.updatedLoans) {
      await tx.objectStore('prestamos').put(snapshot.previous as any);
    }
  }

  if (journal?.updatedPaymentPlans?.length) {
    for (const snapshot of journal.updatedPaymentPlans) {
      await tx.objectStore('keyval').put(snapshot.previous, snapshot.key);
    }
  }

  if (journal?.deactivatedOpexRules?.length) {
    for (const snapshot of journal.deactivatedOpexRules) {
      await tx.objectStore('opexRules').put(snapshot.previous as any);
    }
  }

  if (journal?.updatedIngresos?.length) {
    for (const snapshot of journal.updatedIngresos) {
      await tx.objectStore('ingresos').put(snapshot.previous as any);
    }
  }

  if (journal?.updatedGastos?.length) {
    for (const snapshot of journal.updatedGastos) {
      await tx.objectStore('gastos').put(snapshot.previous as any);
    }
  }

  if (journal?.deletedLoanForecastEvents?.length) {
    for (const snapshot of journal.deletedLoanForecastEvents) {
      await tx.objectStore('treasuryEvents').put(snapshot.previous);
    }
  }

  const now = new Date().toISOString();
  const revertedSale: PropertySale = {
    ...sale,
    status: 'reverted',
    updatedAt: now,
    notes: [sale.notes, `Venta anulada el ${now}.`].filter(Boolean).join(' | '),
  };

  await saleStore.put(revertedSale);
  await propertyStore.put({
    ...property,
    state: 'activo',
    notes: [property.notes, `Reactivado por anulación de venta (${sale.saleDate}).`].filter(Boolean).join(' | '),
  });

  await tx.done;

  if (journal?.settlementAccountId !== undefined) {
    await triggerTreasuryUpdate([journal.settlementAccountId]);
  }

  return revertedSale;
};
