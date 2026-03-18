import { Contract, Property, TreasuryEvent, initDB, PropertySale } from './db';
import { PlanPagos } from '../types/prestamos';
import { triggerTreasuryUpdate } from './treasuryEventsService';
import { getFiscalSummary } from './fiscalSummaryService';
import { prestamosCalculationService } from './prestamosCalculationService';

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

const LOAN_CANCELLATION_FINALIZED_MARKER = 'loanCancellationFinalized:true';
const EXECUTION_JOURNAL_MARKER = 'executionJournal:';
const EXECUTION_JOURNAL_ENCODED_MARKER = 'executionJournalEncoded:';

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

const resolveFallbackOutstandingPrincipal = (loan: any): number => {
  const candidates = [
    loan?.principalVivo,
    loan?.capitalVivoAlImportar,
    loan?.principalPendiente,
    loan?.principalInicial,
    loan?.importePrincipal,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate ?? 0);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
};

const resolveProjectedOutstandingPrincipal = (
  loan: any,
  paymentPlan: PlanPagos | undefined,
  saleDate: string
): number => {
  const saleTimestamp = new Date(saleDate).getTime();
  if (Number.isNaN(saleTimestamp)) {
    return resolveFallbackOutstandingPrincipal(loan);
  }

  const periodos = paymentPlan?.periodos ?? [];
  const lastProjectedInstallment = periodos
    .filter((periodo) => {
      const installmentTimestamp = new Date(periodo.fechaCargo).getTime();
      return Number.isFinite(installmentTimestamp) && installmentTimestamp <= saleTimestamp;
    })
    .sort((a, b) => new Date(a.fechaCargo).getTime() - new Date(b.fechaCargo).getTime())
    .at(-1);

  if (lastProjectedInstallment && Number.isFinite(lastProjectedInstallment.principalFinal)) {
    return Math.max(0, Number(lastProjectedInstallment.principalFinal));
  }

  return resolveFallbackOutstandingPrincipal(loan);
};

const diffDaysBetweenIsoDates = (fromIso: string, toIso: string): number => {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const diffMs = to.getTime() - from.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const resolveAccruedInterestUntilDate = (
  loan: any,
  paymentPlan: PlanPagos | undefined,
  saleDate: string,
  outstandingPrincipal: number
): number => {
  if (outstandingPrincipal <= 0) return 0;

  const annualRate = prestamosCalculationService.calculateBaseRate(loan);
  if (!Number.isFinite(annualRate) || annualRate <= 0) return 0;

  const sortedPeriods = [...(paymentPlan?.periodos ?? [])]
    .filter((periodo) => periodo?.fechaCargo)
    .sort((a, b) => new Date(a.fechaCargo).getTime() - new Date(b.fechaCargo).getTime());

  const lastInstallment = sortedPeriods
    .filter((periodo) => new Date(periodo.fechaCargo).getTime() <= new Date(saleDate).getTime())
    .at(-1);

  const accrualStartDate =
    lastInstallment?.fechaCargo ??
    loan?.fechaUltimaCuotaPagada ??
    loan?.fechaPrimerCargo ??
    loan?.fechaFirma;

  if (!accrualStartDate) return 0;

  const daysAccrued = diffDaysBetweenIsoDates(accrualStartDate, saleDate);
  if (daysAccrued <= 0) return 0;

  const accruedInterest = outstandingPrincipal * (annualRate / 100) * (daysAccrued / 365);
  return Number(accruedInterest.toFixed(2));
};

const resolveProjectedLoanPayoffAmount = (
  loan: any,
  paymentPlan: PlanPagos | undefined,
  saleDate: string
): number => {
  const outstandingPrincipal = resolveProjectedOutstandingPrincipal(loan, paymentPlan, saleDate);
  const accruedInterest = resolveAccruedInterestUntilDate(loan, paymentPlan, saleDate, outstandingPrincipal);
  return Number((outstandingPrincipal + accruedInterest).toFixed(2));
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

const encodeExecutionJournal = (journal: SaleExecutionJournal): string => {
  const payload = JSON.stringify(journal);
  return `${EXECUTION_JOURNAL_ENCODED_MARKER}${btoa(unescape(encodeURIComponent(payload)))}`;
};

const decodeExecutionJournal = (encodedPayload: string): SaleExecutionJournal | null => {
  try {
    const decodedPayload = decodeURIComponent(escape(atob(encodedPayload)));
    return JSON.parse(decodedPayload) as SaleExecutionJournal;
  } catch {
    return null;
  }
};

const extractLegacyRawJournalPayload = (notes: string, markerIndex: number): string | null => {
  const payloadStart = markerIndex + EXECUTION_JOURNAL_MARKER.length;
  const rawPayload = notes.slice(payloadStart).trimStart();
  const firstBraceIndex = rawPayload.indexOf('{');

  if (firstBraceIndex === -1) {
    return null;
  }

  let inString = false;
  let isEscaped = false;
  let depth = 0;
  let started = false;

  for (let index = firstBraceIndex; index < rawPayload.length; index += 1) {
    const char = rawPayload[index];

    if (!started) {
      if (char !== '{') continue;
      started = true;
      depth = 1;
      continue;
    }

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return rawPayload.slice(firstBraceIndex, index + 1);
      }
    }
  }

  return null;
};

const extractJournalFromSaleNotes = (notes?: string): SaleExecutionJournal | null => {
  if (!notes) return null;

  const encodedMarkerIndex = notes.lastIndexOf(EXECUTION_JOURNAL_ENCODED_MARKER);
  if (encodedMarkerIndex !== -1) {
    const encodedPayload = notes
      .slice(encodedMarkerIndex + EXECUTION_JOURNAL_ENCODED_MARKER.length)
      .split(' | ')[0]
      ?.trim();

    if (encodedPayload) {
      const encodedJournal = decodeExecutionJournal(encodedPayload);
      if (encodedJournal) return encodedJournal;
    }
  }

  const markerIndex = notes.lastIndexOf(EXECUTION_JOURNAL_MARKER);
  if (markerIndex === -1) return null;

  const payload = extractLegacyRawJournalPayload(notes, markerIndex);
  if (!payload) return null;

  try {
    return JSON.parse(payload) as SaleExecutionJournal;
  } catch {
    return null;
  }
};

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

  const suggestedOutstandingDebtByLoan = await Promise.all(
    linkedLoans
      .filter((loan: any) => loan.activo !== false)
      .map(async (loan: any) => {
        if (!loan?.id) {
          return resolveFallbackOutstandingPrincipal(loan);
        }
        const paymentPlan = await db.get('keyval', `planpagos_${loan.id}`) as PlanPagos | undefined;
        return resolveProjectedLoanPayoffAmount(loan, paymentPlan, referenceDate);
      })
  );
  const suggestedOutstandingDebt = suggestedOutstandingDebtByLoan.reduce((sum, debt) => sum + debt, 0);

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

  const settlementAccountId: number = input.settlementAccountId;

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
  const saleExpenseBreakdown = [
    { amount: Number(input.agencyCommission || 0), description: `Comisión agencia venta inmueble #${input.propertyId}` },
    { amount: Number(input.municipalTax || 0), description: `Plusvalía municipal venta inmueble #${input.propertyId}` },
    { amount: Number(input.saleNotaryCosts || 0), description: `Notaría venta inmueble #${input.propertyId}` },
    { amount: Number(input.otherCosts || 0), description: `Otros costes venta inmueble #${input.propertyId}` },
  ].filter((item) => item.amount > 0);
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
    settlementAccountId,
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
    const loanSettlementTotal = simulation.totalLoanSettlement;
    const movementStore = tx.objectStore('movements');

    const movementsToCreate = [
      createTreasuryMovement({
        accountId: settlementAccountId,
        amount: simulation.grossProceeds,
        date: input.saleDate,
        description: `Cobro venta inmueble #${input.propertyId}`,
        propertyId: input.propertyId,
        saleId,
      }),
      ...saleExpenseBreakdown.map((expense) =>
        createTreasuryMovement({
          accountId: settlementAccountId,
          amount: -expense.amount,
          date: input.saleDate,
          description: expense.description,
          propertyId: input.propertyId,
          saleId,
        })
      ),
      ...(loanSettlementTotal > 0
        ? [
            createTreasuryMovement({
              accountId: settlementAccountId,
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
    }

    await loanStore.put({
      ...loan,
      activo: true,
      estado: 'pendiente_cancelacion_venta',
      cancelacionPendienteVenta: true,
      fechaSolicitudCancelacionVenta: input.saleDate,
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
      accountId: settlementAccountId,
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
        accountId: settlementAccountId,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...saleExpenseBreakdown.map((expense) => ({
        type: 'expense' as const,
        amount: expense.amount,
        predictedDate: input.saleDate,
        description: expense.description,
        sourceType: 'manual' as const,
        sourceId: saleId,
        accountId: settlementAccountId,
        status: 'confirmed' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      ...(simulation.totalLoanSettlement > 0
        ? [{
            type: 'financing' as const,
            amount: simulation.totalLoanSettlement,
            predictedDate: input.saleDate,
            description: `Cancelación deuda inmueble #${input.propertyId}`,
            sourceType: 'manual' as const,
            sourceId: saleId,
            accountId: settlementAccountId,
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
      notes: [sale.notes, encodeExecutionJournal(executionJournal)].filter(Boolean).join(' | '),
      updatedAt: new Date().toISOString(),
    });
  }
  await tx.done;

  if (saleId && simulation.totalLoanSettlement > 0) {
    await finalizePropertySaleLoanCancellationBySaleId(saleId);
  }

  await triggerTreasuryUpdate([settlementAccountId]);
  await ensureSaleTaxFiscalYearOpen(input.propertyId, input.saleDate);

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

  const journal = extractJournalFromSaleNotes(sale.notes);

  if (journal?.movementIds?.length) {
    for (const movementId of journal.movementIds) {
      await tx.objectStore('movements').delete(movementId);
    }
  }

  if (typeof sale.id === 'number') {
    const linkedSaleMovements = (await tx.objectStore('movements').getAll() as any[])
      .filter((movement) => movement.reference === `property_sale:${sale.id}` && typeof movement.id === 'number');

    for (const movement of linkedSaleMovements) {
      await tx.objectStore('movements').delete(movement.id as number);
    }
  }

  if (journal?.treasuryEventIds?.length) {
    for (const eventId of journal.treasuryEventIds) {
      await tx.objectStore('treasuryEvents').delete(eventId);
    }
  }

  if (typeof sale.id === 'number') {
    const linkedTreasuryEvents = (await tx.objectStore('treasuryEvents').getAll() as TreasuryEvent[])
      .filter((event) => event.sourceId === sale.id && typeof event.id === 'number');

    for (const event of linkedTreasuryEvents) {
      await tx.objectStore('treasuryEvents').delete(event.id as number);
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
  } else {
    const loanStore = tx.objectStore('prestamos');
    const allLoans = await loanStore.getAll();
    const linkedLoans = allLoans.filter((loan: any) => isLoanLinkedToProperty(loan, property));

    for (const loan of linkedLoans) {
      if (!loan?.id) continue;

      const shouldReactivate = loan.activo === false || String(loan.estado ?? '').toLowerCase() === 'cancelado';
      if (!shouldReactivate) continue;

      const restoredPrincipal = resolveFallbackOutstandingPrincipal(loan);
      await loanStore.put({
        ...loan,
        activo: true,
        estado: 'vivo',
        principalVivo: restoredPrincipal,
        updatedAt: new Date().toISOString(),
      });
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

export const finalizePropertySaleLoanCancellation = async (movementId: number): Promise<boolean> => {
  const db = await initDB();
  const movement = await db.get('movements', movementId) as any;

  if (!movement || movement.amount >= 0) return false;
  if (!String(movement.reference || '').startsWith('property_sale:')) return false;
  if (!String(movement.description || '').includes('Cancelación deuda inmueble')) return false;

  const saleId = Number(String(movement.reference).replace('property_sale:', ''));
  if (!Number.isFinite(saleId)) return false;

  return finalizePropertySaleLoanCancellationBySaleId(saleId);
};

const finalizePropertySaleLoanCancellationBySaleId = async (saleId: number): Promise<boolean> => {
  if (!Number.isFinite(saleId)) return false;

  const db = await initDB();

  const sale = await db.get('property_sales', saleId);
  if (!sale || sale.status !== 'confirmed') return false;
  if (String(sale.notes || '').includes(LOAN_CANCELLATION_FINALIZED_MARKER)) return false;

  const property = await db.get('properties', sale.propertyId);
  if (!property) return false;

  const tx = db.transaction(['prestamos', 'keyval', 'treasuryEvents', 'property_sales'], 'readwrite');
  const loanStore = tx.objectStore('prestamos');
  const allLoans = await loanStore.getAll();
  const linkedLoans = allLoans.filter((loan: any) => isLoanLinkedToProperty(loan, property));

  for (const loan of linkedLoans) {
    if (!loan?.id) continue;
    if (loan.estado === 'cancelado' && loan.activo === false) continue;

    const paymentPlanKey = `planpagos_${loan.id}`;
    const paymentPlan = await tx.objectStore('keyval').get(paymentPlanKey) as PlanPagos | undefined;
    if (paymentPlan?.periodos?.length) {
      const updatedPlan: PlanPagos = {
        ...paymentPlan,
        periodos: paymentPlan.periodos.map((periodo) => {
          if (periodo.fechaCargo < sale.saleDate) {
            return periodo;
          }
          return {
            ...periodo,
            pagado: true,
            fechaPagoReal: periodo.fechaPagoReal ?? sale.saleDate,
          };
        }),
      };
      await tx.objectStore('keyval').put(updatedPlan, paymentPlanKey);
    }

    const loanForecastEvents = (await tx.objectStore('treasuryEvents').getAll() as TreasuryEvent[])
      .filter((event) =>
        (event.sourceType === 'hipoteca' || event.sourceType === 'prestamo') &&
        event.prestamoId === loan.id &&
        event.predictedDate >= sale.saleDate &&
        event.status !== 'executed' &&
        typeof event.id === 'number'
      );
    for (const event of loanForecastEvents) {
      await tx.objectStore('treasuryEvents').delete(event.id as number);
    }

    await loanStore.put({
      ...loan,
      activo: false,
      estado: 'cancelado',
      principalVivo: 0,
      cuotasPagadas: paymentPlan?.periodos?.length ?? loan.cuotasPagadas,
      fechaUltimaCuotaPagada: sale.saleDate,
      cancelacionPendienteVenta: false,
      updatedAt: new Date().toISOString(),
    });
  }

  await tx.objectStore('property_sales').put({
    ...sale,
    notes: [sale.notes, LOAN_CANCELLATION_FINALIZED_MARKER].filter(Boolean).join(' | '),
    updatedAt: new Date().toISOString(),
  });

  await tx.done;
  return true;
};

export const finalizePropertySaleLoanCancellationFromTreasuryEvent = async (treasuryEventId: number): Promise<boolean> => {
  if (!Number.isFinite(treasuryEventId)) return false;

  const db = await initDB();
  const treasuryEvent = await db.get('treasuryEvents', treasuryEventId) as TreasuryEvent | undefined;
  if (!treasuryEvent) return false;

  const isSaleLoanCancellationEvent =
    treasuryEvent.type === 'financing' &&
    treasuryEvent.sourceType === 'manual' &&
    typeof treasuryEvent.sourceId === 'number' &&
    String(treasuryEvent.description || '').includes('Cancelación deuda inmueble');

  if (!isSaleLoanCancellationEvent) return false;

  return finalizePropertySaleLoanCancellationBySaleId(treasuryEvent.sourceId as number);
};

const ensureSaleTaxFiscalYearOpen = async (propertyId: number, saleDate: string): Promise<void> => {
  const saleYear = new Date(saleDate).getFullYear();
  if (!Number.isFinite(saleYear)) return;

  const paymentFiscalYear = saleYear + 1;
  await getFiscalSummary(propertyId, paymentFiscalYear);
};
