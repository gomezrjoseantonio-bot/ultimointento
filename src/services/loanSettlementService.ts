import { initDB, LoanSettlement } from './db';
import { triggerTreasuryUpdate } from './treasuryEventsService';
import { prestamosCalculationService } from './prestamosCalculationService';
import { prestamosService } from './prestamosService';
import { PlanPagos, PeriodoPago, Prestamo } from '../types/prestamos';

export interface PrepareLoanSettlementResult {
  prestamo: Prestamo;
  planPagos: PlanPagos | null;
  principalPendienteEstimado: number;
  interesesCorridosEstimados: number;
  cuotaActualEstimada: number;
  plazoRestanteEstimado: number;
}

export interface LoanSettlementSimulationInput {
  loanId: string;
  operationType: 'TOTAL' | 'PARTIAL';
  operationDate: string;
  partialMode?: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  principalAmount?: number;
  feeAmount?: number;
  fixedCosts?: number;
}

export interface LoanSettlementSimulationResult {
  operationType: 'TOTAL' | 'PARTIAL';
  partialMode?: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  operationDate: string;
  principalBefore: number;
  principalApplied: number;
  accruedInterest: number;
  feeAmount: number;
  fixedCosts: number;
  totalCashOut: number;
  principalAfter: number;
  monthlyPaymentBefore?: number;
  monthlyPaymentAfter?: number;
  termMonthsBefore?: number;
  termMonthsAfter?: number;
  interestSavings?: number;
}

export interface ConfirmLoanSettlementInput extends LoanSettlementSimulationInput {
  settlementAccountId: number;
  source?: 'financiacion' | 'inmueble_venta';
  notes?: string;
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeDate = (isoDate?: string): string => {
  if (!isoDate) return new Date().toISOString().slice(0, 10);
  return isoDate.slice(0, 10);
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
};

const addMonthsWithClampedDay = (baseIsoDate: string, monthsToAdd: number, dayOfMonth: number): string => {
  const baseDate = new Date(baseIsoDate);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth() + monthsToAdd;
  const firstOfTargetMonth = new Date(year, month, 1);
  const lastDay = new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth() + 1,
    0,
  ).getDate();
  const safeDay = Math.max(1, Math.min(dayOfMonth, lastDay));

  return formatLocalDate(new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth(),
    safeDay,
  ));
};

const diffDaysBetweenIsoDates = (fromIso: string, toIso: string): number => {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const diffMs = to.getTime() - from.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const sortPeriods = (periodos: PeriodoPago[]): PeriodoPago[] => (
  [...periodos].sort((a, b) => new Date(a.fechaCargo).getTime() - new Date(b.fechaCargo).getTime())
);

const resolveProjectedOutstandingPrincipal = (
  prestamo: Prestamo,
  paymentPlan: PlanPagos | null,
  operationDate: string,
): number => {
  const opTs = new Date(operationDate).getTime();
  if (Number.isNaN(opTs)) {
    return round2(Number(prestamo.principalVivo || prestamo.capitalVivoAlImportar || prestamo.principalInicial || 0));
  }

  const lastProjectedInstallment = sortPeriods(paymentPlan?.periodos ?? [])
    .filter((periodo) => new Date(periodo.fechaCargo).getTime() <= opTs)
    .at(-1);

  if (lastProjectedInstallment && Number.isFinite(lastProjectedInstallment.principalFinal)) {
    return round2(Math.max(0, lastProjectedInstallment.principalFinal));
  }

  return round2(Number(prestamo.principalVivo || prestamo.capitalVivoAlImportar || prestamo.principalInicial || 0));
};

const resolveAccruedInterestUntilDate = (
  prestamo: Prestamo,
  paymentPlan: PlanPagos | null,
  operationDate: string,
  outstandingPrincipal: number,
): number => {
  if (outstandingPrincipal <= 0) return 0;

  const annualRate = prestamosCalculationService.calculateBaseRate(prestamo);
  if (!Number.isFinite(annualRate) || annualRate <= 0) return 0;

  const sortedPeriods = sortPeriods(paymentPlan?.periodos ?? []);
  const lastInstallment = sortedPeriods
    .filter((periodo) => new Date(periodo.fechaCargo).getTime() <= new Date(operationDate).getTime())
    .at(-1);

  const accrualStartDate =
    lastInstallment?.fechaCargo ??
    prestamo.fechaUltimaCuotaPagada ??
    prestamo.fechaPrimerCargo ??
    prestamo.fechaFirma;

  if (!accrualStartDate) return 0;

  const daysAccrued = diffDaysBetweenIsoDates(accrualStartDate, operationDate);
  if (daysAccrued <= 0) return 0;

  return round2(outstandingPrincipal * (annualRate / 100) * (daysAccrued / 365));
};

const resolveCurrentInstallment = (prestamo: Prestamo, paymentPlan: PlanPagos | null, operationDate: string): number => {
  const nextRegularPeriod = sortPeriods(paymentPlan?.periodos ?? []).find((periodo) => {
    const chargeDate = new Date(periodo.fechaCargo).getTime();
    return chargeDate >= new Date(operationDate).getTime() && !periodo.esProrrateado && !periodo.esSoloIntereses;
  });

  if (nextRegularPeriod?.cuota && nextRegularPeriod.cuota > 0) {
    return round2(nextRegularPeriod.cuota);
  }

  const principal = resolveProjectedOutstandingPrincipal(prestamo, paymentPlan, operationDate);
  const endDate = paymentPlan?.resumen?.fechaFinalizacion || prestamo.fechaCancelacion || prestamo.fechaPrimerCargo;
  const months = Math.max(1, diffDaysBetweenIsoDates(operationDate, endDate) / 30 || (prestamo.plazoMesesTotal - prestamo.cuotasPagadas));
  const rate = prestamosCalculationService.calculateBaseRate(prestamo);
  return round2(prestamosCalculationService.calculateFrenchPayment(principal, rate, Math.max(1, Math.round(months))));
};

const resolveRemainingTermMonths = (prestamo: Prestamo, paymentPlan: PlanPagos | null, operationDate: string): number => {
  const futurePeriods = sortPeriods(paymentPlan?.periodos ?? []).filter((periodo) => new Date(periodo.fechaCargo).getTime() >= new Date(operationDate).getTime());
  if (futurePeriods.length > 0) return futurePeriods.length;

  const fechaFin = paymentPlan?.resumen?.fechaFinalizacion || prestamo.fechaCancelacion || prestamo.fechaPrimerCargo;
  const opDate = new Date(operationDate);
  const endDate = new Date(fechaFin);
  const monthDiff = (endDate.getFullYear() - opDate.getFullYear()) * 12 + (endDate.getMonth() - opDate.getMonth());
  return Math.max(1, monthDiff || (prestamo.plazoMesesTotal - prestamo.cuotasPagadas));
};

const createMovement = ({
  settlementAccountId,
  operationDate,
  totalCashOut,
  loanId,
  prestamo,
  operationType,
}: {
  settlementAccountId: number;
  operationDate: string;
  totalCashOut: number;
  loanId: string;
  prestamo: Prestamo;
  operationType: 'TOTAL' | 'PARTIAL';
}) => ({
  accountId: settlementAccountId,
  date: operationDate,
  valueDate: operationDate,
  amount: -round2(totalCashOut),
  description: operationType === 'TOTAL'
    ? `Cancelación total préstamo ${prestamo.nombre}`
    : `Amortización parcial préstamo ${prestamo.nombre}`,
  counterparty: 'Entidad financiera',
  reference: `loan_settlement:${loanId}:${operationDate}`,
  status: 'conciliado' as const,
  unifiedStatus: 'conciliado' as const,
  source: 'manual' as const,
  category: {
    tipo: operationType === 'TOTAL' ? 'Cancelación préstamo' : 'Amortización préstamo',
  },
  type: 'Gasto' as const,
  origin: 'Manual' as const,
  movementState: 'Conciliado' as const,
  ambito: prestamo.ambito,
  inmuebleId: prestamo.inmuebleId,
  statusConciliacion: 'match_manual' as const,
  tags: ['loan_settlement'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createTreasuryEvent = ({
  settlementAccountId,
  operationDate,
  totalCashOut,
  loanId,
  prestamo,
  operationType,
}: {
  settlementAccountId: number;
  operationDate: string;
  totalCashOut: number;
  loanId: string;
  prestamo: Prestamo;
  operationType: 'TOTAL' | 'PARTIAL';
}) => ({
  type: 'financing' as const,
  amount: round2(totalCashOut),
  predictedDate: operationDate,
  description: operationType === 'TOTAL'
    ? `Cancelación total préstamo ${prestamo.nombre}`
    : `Amortización parcial préstamo ${prestamo.nombre}`,
  sourceType: 'manual' as const,
  sourceId: loanId,
  accountId: settlementAccountId,
  status: 'confirmed' as const,
  prestamoId: loanId,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const buildTotalCancellationPlan = (
  currentPlan: PlanPagos | null,
  operationDate: string,
  principalBefore: number,
): PlanPagos | null => {
  if (!currentPlan?.periodos?.length) return null;

  const opTs = new Date(operationDate).getTime();
  const paidPeriods = sortPeriods(currentPlan.periodos).filter((periodo) => {
    const chargeTs = new Date(periodo.fechaCargo).getTime();
    return chargeTs < opTs || (periodo.pagado && chargeTs <= opTs);
  });

  const lastPaidPeriod = paidPeriods.at(-1) ?? null;
  const templatePeriod = sortPeriods(currentPlan.periodos).find((periodo) => new Date(periodo.fechaCargo).getTime() >= opTs)
    ?? currentPlan.periodos[currentPlan.periodos.length - 1];

  const cancellationPeriod: PeriodoPago = {
    ...templatePeriod,
    periodo: (lastPaidPeriod?.periodo ?? 0) + 1,
    devengoDesde: lastPaidPeriod?.fechaCargo ?? templatePeriod.devengoDesde,
    devengoHasta: operationDate,
    fechaCargo: operationDate,
    cuota: round2(principalBefore),
    interes: 0,
    amortizacion: round2(principalBefore),
    principalFinal: 0,
    pagado: true,
    fechaPagoReal: operationDate,
    esProrrateado: false,
    esSoloIntereses: false,
    diasDevengo: undefined,
  };

  const periodos = principalBefore > 0 ? [...paidPeriods, cancellationPeriod] : paidPeriods;
  return {
    ...currentPlan,
    fechaGeneracion: new Date().toISOString(),
    periodos,
    resumen: {
      totalIntereses: round2(periodos.reduce((sum, periodo) => sum + (periodo.interes || 0), 0)),
      totalCuotas: periodos.length,
      fechaFinalizacion: operationDate,
    },
    metadata: {
      source: 'loan_settlement',
      operationType: 'TOTAL',
      operationDate,
    },
  };
};

const buildPartialAmortizationPlan = ({
  prestamo,
  currentPlan,
  operationDate,
  principalBefore,
  amortizationAmount,
  partialMode,
  monthlyPaymentBefore,
  monthlyPaymentAfter,
  termMonthsAfter,
}: {
  prestamo: Prestamo;
  currentPlan: PlanPagos | null;
  operationDate: string;
  principalBefore: number;
  amortizationAmount: number;
  partialMode: 'REDUCIR_PLAZO' | 'REDUCIR_CUOTA';
  monthlyPaymentBefore: number;
  monthlyPaymentAfter: number;
  termMonthsAfter: number;
}): PlanPagos => {
  const sortedPeriods = sortPeriods(currentPlan?.periodos ?? []);
  const opTs = new Date(operationDate).getTime();
  const preservedPeriods = sortedPeriods.filter((periodo) => {
    const chargeTs = new Date(periodo.fechaCargo).getTime();
    return chargeTs < opTs || (periodo.pagado && chargeTs <= opTs);
  });
  const lastPreserved = preservedPeriods.at(-1) ?? null;

  const principalAfter = round2(Math.max(0, principalBefore - amortizationAmount));
  const extraAmortizationPeriod: PeriodoPago = {
    periodo: (lastPreserved?.periodo ?? 0) + 1,
    devengoDesde: lastPreserved?.fechaCargo ?? operationDate,
    devengoHasta: operationDate,
    fechaCargo: operationDate,
    cuota: round2(amortizationAmount),
    interes: 0,
    amortizacion: round2(amortizationAmount),
    principalFinal: principalAfter,
    pagado: true,
    fechaPagoReal: operationDate,
    esProrrateado: false,
    esSoloIntereses: false,
  };

  const nextTemplate = sortedPeriods.find((periodo) => new Date(periodo.fechaCargo).getTime() > opTs);
  let nextChargeDate = nextTemplate?.fechaCargo;
  if (!nextChargeDate || new Date(nextChargeDate).getTime() <= opTs) {
    nextChargeDate = addMonthsWithClampedDay(operationDate, 1, prestamo.diaCargoMes);
  }

  const baseRate = prestamosCalculationService.calculateBaseRate(prestamo, new Date(operationDate));
  const monthlyRate = baseRate / 100 / 12;
  const futurePeriods: PeriodoPago[] = [];
  let outstanding = principalAfter;
  let previousReferenceDate = operationDate;
  let currentChargeDate = nextChargeDate;
  const targetPayment = partialMode === 'REDUCIR_CUOTA' ? monthlyPaymentAfter : monthlyPaymentBefore;

  for (let index = 0; index < termMonthsAfter; index += 1) {
    const isLast = index === termMonthsAfter - 1;
    const interes = monthlyRate > 0 ? round2(outstanding * monthlyRate) : 0;
    let cuota = round2(targetPayment);
    let amortizacion = round2(cuota - interes);

    if (isLast || amortizacion >= outstanding) {
      amortizacion = round2(outstanding);
      cuota = round2(amortizacion + interes);
    }

    if (amortizacion < 0) amortizacion = 0;

    outstanding = round2(Math.max(0, outstanding - amortizacion));

    futurePeriods.push({
      periodo: extraAmortizationPeriod.periodo + 1 + index,
      devengoDesde: previousReferenceDate,
      devengoHasta: addDays(currentChargeDate, -1),
      fechaCargo: currentChargeDate,
      cuota,
      interes,
      amortizacion,
      principalFinal: outstanding,
      pagado: false,
      esProrrateado: false,
      esSoloIntereses: false,
    });

    previousReferenceDate = currentChargeDate;
    currentChargeDate = addMonthsWithClampedDay(currentChargeDate, 1, prestamo.diaCargoMes);
  }

  const periodos = [...preservedPeriods, extraAmortizationPeriod, ...futurePeriods];
  return {
    prestamoId: prestamo.id,
    fechaGeneracion: new Date().toISOString(),
    periodos,
    resumen: {
      totalIntereses: round2(periodos.reduce((sum, periodo) => sum + (periodo.interes || 0), 0)),
      totalCuotas: periodos.length,
      fechaFinalizacion: futurePeriods.at(-1)?.fechaCargo ?? operationDate,
    },
    metadata: {
      source: 'loan_settlement',
      operationType: 'PARTIAL',
      operationDate,
      partialMode,
    },
  };
};

const assertValidAccount = async (accountId: number): Promise<void> => {
  const db = await initDB();
  const account = await db.get('accounts', accountId);
  if (!account || account.deleted_at || account.isActive === false) {
    throw new Error('Selecciona una cuenta de tesorería válida');
  }
};

export const prepareLoanSettlement = async (
  loanId: string,
  operationDate?: string,
): Promise<PrepareLoanSettlementResult> => {
  const prestamo = await prestamosService.getPrestamoById(loanId);
  if (!prestamo) throw new Error('Préstamo no encontrado');

  const effectiveDate = normalizeDate(operationDate);
  const planPagos = await prestamosService.getPaymentPlan(loanId);
  const principalPendienteEstimado = resolveProjectedOutstandingPrincipal(prestamo, planPagos, effectiveDate);
  const interesesCorridosEstimados = resolveAccruedInterestUntilDate(prestamo, planPagos, effectiveDate, principalPendienteEstimado);
  const cuotaActualEstimada = resolveCurrentInstallment(prestamo, planPagos, effectiveDate);
  const plazoRestanteEstimado = resolveRemainingTermMonths(prestamo, planPagos, effectiveDate);

  return {
    prestamo,
    planPagos,
    principalPendienteEstimado,
    interesesCorridosEstimados,
    cuotaActualEstimada,
    plazoRestanteEstimado,
  };
};

export const simulateLoanSettlement = async (
  input: LoanSettlementSimulationInput,
): Promise<LoanSettlementSimulationResult> => {
  const prepared = await prepareLoanSettlement(input.loanId, input.operationDate);
  const effectiveDate = normalizeDate(input.operationDate);
  const feeAmount = round2(Number(input.feeAmount ?? 0));
  const fixedCosts = round2(Number(input.fixedCosts ?? prepared.prestamo.gastosFijosOperacion ?? 0));

  if (input.operationType === 'TOTAL') {
    const principalBefore = prepared.principalPendienteEstimado;
    const accruedInterest = prepared.interesesCorridosEstimados;
    const principalApplied = principalBefore;
    const totalCashOut = round2(principalApplied + accruedInterest + feeAmount + fixedCosts);

    return {
      operationType: 'TOTAL',
      operationDate: effectiveDate,
      principalBefore,
      principalApplied,
      accruedInterest,
      feeAmount,
      fixedCosts,
      totalCashOut,
      principalAfter: 0,
      monthlyPaymentBefore: prepared.cuotaActualEstimada,
      monthlyPaymentAfter: 0,
      termMonthsBefore: prepared.plazoRestanteEstimado,
      termMonthsAfter: 0,
      interestSavings: undefined,
    };
  }

  if (!input.partialMode) {
    throw new Error('Selecciona el modo de amortización parcial');
  }

  const principalBefore = prepared.principalPendienteEstimado;
  const principalApplied = round2(Number(input.principalAmount ?? 0));
  if (principalApplied <= 0) {
    throw new Error('El importe a amortizar debe ser mayor que 0');
  }
  if (principalApplied > principalBefore) {
    throw new Error('El importe a amortizar no puede superar el principal vivo');
  }

  const simulationBaseLoan: Prestamo = {
    ...prepared.prestamo,
    principalVivo: principalBefore,
  };

  const simulation = prestamosCalculationService.simulateAmortization(
    simulationBaseLoan,
    principalApplied,
    effectiveDate,
    input.partialMode,
  );

  const totalCashOut = round2(principalApplied + feeAmount + fixedCosts);

  return {
    operationType: 'PARTIAL',
    partialMode: input.partialMode,
    operationDate: effectiveDate,
    principalBefore,
    principalApplied,
    accruedInterest: 0,
    feeAmount,
    fixedCosts,
    totalCashOut,
    principalAfter: round2(principalBefore - principalApplied),
    monthlyPaymentBefore: prepared.cuotaActualEstimada,
    monthlyPaymentAfter: input.partialMode === 'REDUCIR_CUOTA'
      ? round2(simulation.nuevaCuota || prepared.cuotaActualEstimada)
      : prepared.cuotaActualEstimada,
    termMonthsBefore: prepared.plazoRestanteEstimado,
    termMonthsAfter: input.partialMode === 'REDUCIR_PLAZO'
      ? Math.max(1, simulation.nuevoplazo || prepared.plazoRestanteEstimado)
      : prepared.plazoRestanteEstimado,
    interestSavings: round2(simulation.interesesAhorrados || 0),
  };
};

export const confirmLoanSettlement = async (
  input: ConfirmLoanSettlementInput,
): Promise<LoanSettlement> => {
  const prestamo = await prestamosService.getPrestamoById(input.loanId);
  if (!prestamo) throw new Error('Préstamo no encontrado');
  if (prestamo.activo === false || prestamo.estado === 'cancelado') {
    throw new Error('El préstamo ya está cancelado');
  }

  await assertValidAccount(input.settlementAccountId);
  const simulation = await simulateLoanSettlement(input);
  const currentPlan = await prestamosService.getPaymentPlan(input.loanId);
  const effectiveDate = normalizeDate(input.operationDate);

  const db = await initDB();
  const tx = db.transaction(['prestamos', 'keyval', 'movements', 'treasuryEvents'], 'readwrite');

  const movementId = Number(await tx.objectStore('movements').add(createMovement({
    settlementAccountId: input.settlementAccountId,
    operationDate: effectiveDate,
    totalCashOut: simulation.totalCashOut,
    loanId: input.loanId,
    prestamo,
    operationType: input.operationType,
  })));

  const treasuryEventId = Number(await tx.objectStore('treasuryEvents').add(createTreasuryEvent({
    settlementAccountId: input.settlementAccountId,
    operationDate: effectiveDate,
    totalCashOut: simulation.totalCashOut,
    loanId: input.loanId,
    prestamo,
    operationType: input.operationType,
  })));

  const now = new Date().toISOString();
  // V63 (sub-tarea 4): los settlements se persisten dentro de
  // `prestamos.liquidacion[]` (campo añadido en sub-tarea 1) en lugar del
  // store eliminado `loan_settlements`. El id sintético se genera con
  // `Date.now()` para mantener unicidad por préstamo (no se cruzan ids
  // entre préstamos distintos porque los consumidores siempre filtran por
  // loanId).
  const settlementId = Date.now();
  const settlementToPersist: LoanSettlement = {
    id: settlementId,
    loanId: input.loanId,
    operationType: simulation.operationType,
    partialMode: simulation.partialMode,
    operationDate: effectiveDate,
    settlementAccountId: input.settlementAccountId,
    principalBefore: simulation.principalBefore,
    principalApplied: simulation.principalApplied,
    accruedInterest: simulation.accruedInterest,
    feeAmount: simulation.feeAmount,
    fixedCosts: simulation.fixedCosts,
    totalCashOut: simulation.totalCashOut,
    principalAfter: simulation.principalAfter,
    monthlyPaymentBefore: simulation.monthlyPaymentBefore,
    monthlyPaymentAfter: simulation.monthlyPaymentAfter,
    termMonthsBefore: simulation.termMonthsBefore,
    termMonthsAfter: simulation.termMonthsAfter,
    interestSavings: simulation.interestSavings,
    status: 'confirmed',
    source: input.source || 'financiacion',
    notes: input.notes,
    movementId,
    treasuryEventId,
    createdAt: now,
    updatedAt: now,
  };

  const treasuryEventsStore = tx.objectStore('treasuryEvents');
  const allEvents = await treasuryEventsStore.getAll() as any[];
  for (const event of allEvents) {
    if (
      (event.sourceType === 'hipoteca' || event.sourceType === 'prestamo') &&
      event.prestamoId === input.loanId &&
      event.predictedDate >= effectiveDate &&
      event.status !== 'executed' &&
      typeof event.id === 'number'
    ) {
      await treasuryEventsStore.delete(event.id);
    }
  }

  // Lectura del préstamo dentro de la transacción para añadir el settlement
  // al array `liquidacion` de forma atómica con el resto de cambios.
  const prestamoTx = (await tx.objectStore('prestamos').get(input.loanId)) as any;
  const liquidacionPrev = Array.isArray(prestamoTx?.liquidacion) ? prestamoTx.liquidacion : [];
  const prestamoBaseForUpdate = prestamoTx ?? prestamo;

  if (simulation.operationType === 'TOTAL') {
    const totalPlan = buildTotalCancellationPlan(currentPlan, effectiveDate, simulation.principalBefore);
    if (totalPlan) {
      await tx.objectStore('keyval').put(totalPlan, `planpagos_${input.loanId}`);
    }

    await tx.objectStore('prestamos').put({
      ...prestamoBaseForUpdate,
      activo: false,
      estado: 'cancelado',
      fechaCancelacion: effectiveDate,
      principalVivo: 0,
      cuotasPagadas: totalPlan?.periodos.length ?? prestamo.cuotasPagadas,
      fechaUltimaCuotaPagada: effectiveDate,
      liquidacion: [...liquidacionPrev, settlementToPersist],
      updatedAt: now,
    });
  } else {
    const partialPlan = buildPartialAmortizationPlan({
      prestamo,
      currentPlan,
      operationDate: effectiveDate,
      principalBefore: simulation.principalBefore,
      amortizationAmount: simulation.principalApplied,
      partialMode: simulation.partialMode!,
      monthlyPaymentBefore: simulation.monthlyPaymentBefore || 0,
      monthlyPaymentAfter: simulation.monthlyPaymentAfter || 0,
      termMonthsAfter: simulation.termMonthsAfter || 1,
    });
    await tx.objectStore('keyval').put(partialPlan, `planpagos_${input.loanId}`);

    const paidPeriods = partialPlan.periodos.filter((periodo) => periodo.pagado);
    const lastPaid = paidPeriods.at(-1);

    await tx.objectStore('prestamos').put({
      ...prestamoBaseForUpdate,
      principalVivo: simulation.principalAfter,
      cuotasPagadas: paidPeriods.length,
      fechaUltimaCuotaPagada: lastPaid?.fechaCargo ?? prestamo.fechaUltimaCuotaPagada,
      liquidacion: [...liquidacionPrev, settlementToPersist],
      updatedAt: now,
    });
  }

  await tx.done;
  prestamosService.clearCache();
  await triggerTreasuryUpdate([input.settlementAccountId]);

  return settlementToPersist;
};

export const getLoanSettlementsByLoanId = async (loanId: string): Promise<LoanSettlement[]> => {
  const db = await initDB();
  const prestamo = (await db.get('prestamos', loanId)) as any;
  const settlements: LoanSettlement[] = Array.isArray(prestamo?.liquidacion) ? prestamo.liquidacion : [];
  return settlements.slice().sort((a, b) => {
    const dateDiff = new Date(b.operationDate).getTime() - new Date(a.operationDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

/**
 * V63 (TAREA 7 sub-tarea 4): helper para consumidores que necesitan
 * recorrer todas las liquidaciones (e.g. `treasuryOverviewService`).
 * Sustituye al `db.getAll('loan_settlements')` previo a la eliminación
 * del store. Devuelve un array plano de settlements agregados de
 * todos los préstamos.
 */
export const getAllLoanSettlements = async (): Promise<LoanSettlement[]> => {
  const db = await initDB();
  const prestamos = (await db.getAll('prestamos')) as Array<any>;
  const out: LoanSettlement[] = [];
  for (const p of prestamos) {
    if (Array.isArray(p?.liquidacion)) {
      for (const s of p.liquidacion as LoanSettlement[]) {
        out.push(s);
      }
    }
  }
  return out;
};
