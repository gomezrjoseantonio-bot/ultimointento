import { Contract, Property, TreasuryEvent, initDB, PropertySale } from './db';
import { PlanPagos, Prestamo } from '../types/prestamos';
import { triggerTreasuryUpdate } from './treasuryEventsService';
import { getFiscalSummary } from './fiscalSummaryService';
import { prestamosCalculationService } from './prestamosCalculationService';
import { getAllocationFactor, prestamosService } from './prestamosService';
import {
  calcularGananciaPatrimonial,
  type GananciaPatrimonialResult,
} from './gananciaPatrimonialService';

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
  source: 'cartera' | 'detalle' | 'analisis' | 'wizard';
  settlementAccountId?: number;
  notes?: string;
  autoTerminateContracts?: boolean;
  // Snapshot fiscal ya calculado por el wizard (step 3). Si está presente
  // se persiste en el registro de venta y se usa su irpfEstimado para el
  // treasuryEvent de previsión IRPF.
  fiscalSnapshot?: GananciaPatrimonialResult;
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
  updatedLoans: Array<{ id: string; previous: Prestamo }>;
  deactivatedOpexRules: Array<{ id: number; previous: Record<string, unknown> }>;
  // Legacy field kept for backward compatibility while decoding existing
  // journals from already-confirmed sales. New sales no longer populate it.
  updatedIngresos?: Array<{ id: number; previous: Record<string, unknown> }>;
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

export const isLoanLinkedToProperty = (loan: any, property: Property): boolean => {
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

  // V2 Financiación model: destinos[].inmuebleId for ADQUISICION/REFORMA
  // destinations, and garantias[].inmuebleId for HIPOTECARIA guarantees.
  // These are the canonical links for modern loans created after the V2
  // migration; legacy loans continue to use the fields above.
  if (Array.isArray(loan.destinos)) {
    for (const destino of loan.destinos as any[]) {
      if (!destino) continue;
      const tipo = String(destino.tipo ?? '').toUpperCase();
      if (tipo === 'ADQUISICION' || tipo === 'REFORMA') {
        if (destino.inmuebleId !== undefined && destino.inmuebleId !== null) {
          linkedIds.push(destino.inmuebleId);
        }
      }
    }
  }
  if (Array.isArray(loan.garantias)) {
    for (const garantia of loan.garantias as any[]) {
      if (!garantia) continue;
      const tipo = String(garantia.tipo ?? '').toUpperCase();
      if (tipo === 'HIPOTECARIA') {
        if (garantia.inmuebleId !== undefined && garantia.inmuebleId !== null) {
          linkedIds.push(garantia.inmuebleId);
        }
      }
    }
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


const resolveLoanAllocationFactorForProperty = (loan: Prestamo, property: Property): number => {
  const propertyId = String(property.id ?? '').trim();
  const directFactor = propertyId ? getAllocationFactor(loan, propertyId) : 0;

  if (directFactor > 0 || loan.afectacionesInmueble?.length) {
    return directFactor;
  }

  return isLoanLinkedToProperty(loan, property) ? 1 : 0;
};

const roundToTwoDecimals = (value: number): number => Math.round(value * 100) / 100;

const rebalanceLoanAllocationsAfterPropertySale = (loan: Prestamo, propertyId: string): Prestamo | null => {
  if (!loan.afectacionesInmueble?.length) {
    return null;
  }

  const remainingAllocations = loan.afectacionesInmueble
    .filter((allocation) => allocation.inmuebleId !== propertyId)
    .map((allocation) => ({ ...allocation }));

  if (remainingAllocations.length === 0) {
    return null;
  }

  const totalRemainingPercentage = remainingAllocations.reduce((sum, allocation) => sum + Number(allocation.porcentaje || 0), 0);
  if (totalRemainingPercentage <= 0) {
    return null;
  }

  let accumulated = 0;
  const normalizedAllocations = remainingAllocations.map((allocation, index) => {
    if (index === remainingAllocations.length - 1) {
      return {
        ...allocation,
        porcentaje: roundToTwoDecimals(100 - accumulated),
      };
    }

    const normalizedPercentage = roundToTwoDecimals((Number(allocation.porcentaje || 0) * 100) / totalRemainingPercentage);
    accumulated += normalizedPercentage;
    return {
      ...allocation,
      porcentaje: normalizedPercentage,
    };
  });

  const singleRemainingAllocation = normalizedAllocations.length === 1 ? normalizedAllocations[0] : null;

  return {
    ...loan,
    afectacionesInmueble: normalizedAllocations,
    inmuebleId: singleRemainingAllocation?.inmuebleId,
    activo: true,
    estado: 'vivo',
    cancelacionPendienteVenta: false,
    fechaSolicitudCancelacionVenta: undefined,
  } as Prestamo;
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

const truncatePaymentPlanAtCancellation = (
  paymentPlan: PlanPagos,
  saleDate: string,
  outstandingPrincipal: number,
): PlanPagos => {
  if (!paymentPlan?.periodos?.length) {
    return paymentPlan;
  }

  const saleDateTs = new Date(saleDate).getTime();
  const paidPeriods = paymentPlan.periodos.filter((periodo) => {
    const chargeTs = new Date(periodo.fechaCargo).getTime();
    return chargeTs < saleDateTs || (periodo.pagado && chargeTs <= saleDateTs);
  });

  const lastPaidPeriod = paidPeriods[paidPeriods.length - 1] ?? null;
  const futurePeriods = paymentPlan.periodos.filter((periodo) => new Date(periodo.fechaCargo).getTime() >= saleDateTs);
  const templatePeriod = futurePeriods[0] ?? paymentPlan.periodos[paymentPlan.periodos.length - 1];
  const cancellationPeriodNumber = (lastPaidPeriod?.periodo ?? 0) + 1;

  const cancellationPeriod = {
    ...templatePeriod,
    periodo: cancellationPeriodNumber,
    devengoDesde: lastPaidPeriod?.fechaCargo ?? templatePeriod.devengoDesde,
    devengoHasta: saleDate,
    fechaCargo: saleDate,
    cuota: outstandingPrincipal,
    interes: 0,
    amortizacion: outstandingPrincipal,
    principalFinal: 0,
    pagado: true,
    fechaPagoReal: saleDate,
    movimientoTesoreriaId: templatePeriod.movimientoTesoreriaId,
    esProrrateado: false,
    esSoloIntereses: false,
    diasDevengo: undefined,
  };

  const periodos = outstandingPrincipal > 0
    ? [...paidPeriods, cancellationPeriod]
    : paidPeriods;

  const totalIntereses = periodos.reduce((sum, periodo) => sum + (periodo.interes || 0), 0);
  const totalCuotas = periodos.reduce((sum, periodo) => sum + (periodo.cuota || 0), 0);

  return {
    ...paymentPlan,
    fechaGeneracion: new Date().toISOString(),
    periodos,
    resumen: {
      totalIntereses,
      totalCuotas,
      fechaFinalizacion: saleDate,
    },
    metadata: {
      source: 'property_sale',
      operationType: 'TOTAL',
      operationDate: saleDate,
    },
  };
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

export const resolveProjectedLoanPayoffAmount = (
  loan: any,
  paymentPlan: PlanPagos | undefined,
  saleDate: string
): number => {
  const outstandingPrincipal = resolveProjectedOutstandingPrincipal(loan, paymentPlan, saleDate);
  const accruedInterest = resolveAccruedInterestUntilDate(loan, paymentPlan, saleDate, outstandingPrincipal);
  return Number((outstandingPrincipal + accruedInterest).toFixed(2));
};

export interface LinkedLoanInfo {
  loanId: string;
  alias: string;
  banco?: string;
  outstandingPrincipal: number;        // proyectado a saleDate, aplicando allocationFactor
  comisionContrato: number;            // comisión de cancelación contractual informativa (0 si no se puede inferir)
}

/**
 * Devuelve los préstamos vinculados al inmueble con su saldo vivo proyectado a
 * la fecha de venta. Se usa por el wizard step 2 para mostrar los préstamos a
 * cancelar y editar la comisión final aplicada por el usuario.
 */
export const getLinkedLoansForPropertySale = async (
  propertyId: number,
  saleDate: string,
): Promise<LinkedLoanInfo[]> => {
  const db = await initDB();
  const property = await db.get('properties', propertyId);
  if (!property) return [];

  const allLoans = await db.getAll('prestamos');
  const linked = allLoans.filter((loan: any) => isLoanLinkedToProperty(loan, property));

  const rows: LinkedLoanInfo[] = [];
  for (const loan of linked as Prestamo[]) {
    if (!loan?.id) continue;
    if (loan.activo === false) continue;

    const allocationFactor = resolveLoanAllocationFactorForProperty(loan, property);
    if (allocationFactor <= 0) continue;

    // T15.3 · planPagos vive como campo del préstamo.
    const paymentPlan = (loan as unknown as { planPagos?: PlanPagos }).planPagos;
    const payoff = resolveProjectedLoanPayoffAmount(loan, paymentPlan, saleDate) * allocationFactor;

    const anyLoan = loan as any;
    const comisionRate = Number(
      anyLoan.comisionCancelacionTotal ?? anyLoan.comisionCancelacion ?? anyLoan.comisionAmortizacion ?? 0,
    );
    // Normalizamos para cubrir tanto rates decimales (0.01 = 1% como los usa
    // LoanSettlementModal) como porcentajes "humanos" (1 = 1%). Si el valor
    // parece un importe fijo en euros (>100) lo dejamos tal cual.
    const normalizedRate =
      Number.isFinite(comisionRate) && comisionRate > 0
        ? comisionRate <= 1
          ? comisionRate
          : comisionRate <= 100
          ? comisionRate / 100
          : null
        : null;
    const comisionContrato =
      normalizedRate !== null
        ? Number((payoff * normalizedRate).toFixed(2))
        : Number.isFinite(comisionRate) && comisionRate > 0
        ? comisionRate
        : 0;

    rows.push({
      loanId: String(loan.id),
      alias: String(anyLoan.alias || anyLoan.globalAlias || anyLoan.nombre || `Préstamo ${loan.id}`),
      banco: anyLoan.banco || anyLoan.entidad || anyLoan.bancoNombre || undefined,
      outstandingPrincipal: Number(payoff.toFixed(2)),
      comisionContrato,
    });
  }
  return rows;
};

const getSaleIrpfPredictionDate = (saleDate: string): string => {
  const parsed = new Date(saleDate);
  const fiscalYear = Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
  return `${fiscalYear + 1}-06-30`;
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

// PR3: `createTreasuryMovement` eliminado — la venta ya no crea movements
// directamente. Los movements se generan al puntear cada treasuryEvent vía
// treasuryConfirmationService.confirmTreasuryEvent.

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
      .map(async (loan: Prestamo) => {
        const allocationFactor = resolveLoanAllocationFactorForProperty(loan, property);
        if (allocationFactor <= 0) {
          return 0;
        }

        if (!loan?.id) {
          return resolveFallbackOutstandingPrincipal(loan) * allocationFactor;
        }
        // T15.3 · planPagos vive como campo del préstamo.
        const paymentPlan = (loan as unknown as { planPagos?: PlanPagos }).planPagos;
        return resolveProjectedLoanPayoffAmount(loan, paymentPlan, referenceDate) * allocationFactor;
      })
  );
  const suggestedOutstandingDebt = suggestedOutstandingDebtByLoan.reduce((sum, debt) => sum + debt, 0);

  const gastosInmuebleService = (await import('./gastosInmuebleService')).gastosInmuebleService;
  const [allCompromisos, allGastosRaw] = await Promise.all([
    db.getAll('compromisosRecurrentes').catch(() => []),
    gastosInmuebleService.getAll().catch(() => []),
  ]);
  const allGastos = allGastosRaw.map((g: any) => ({ id: g.id, destino: g.inmuebleId ? 'inmueble_id' : 'personal', destino_id: g.inmuebleId, estado: g.estado === 'confirmado' ? 'pagado' : 'pendiente', fecha_pago_prevista: g.fecha }));

  const activeOpexRulesCount = allCompromisos.filter(
    (comp: any) => comp.ambito === 'inmueble' && comp.inmuebleId === propertyId && comp.estado !== 'baja'
  ).length;

  // Future rental income derived from active contracts of this property.
  // rentaMensual store eliminated in V62; use active contracts as proxy.
  const referenceMonth = referenceDate.slice(0, 7);
  const futureIncomeCount = activeContracts.filter(
    (c) => !c.fechaFin || c.fechaFin >= referenceMonth,
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

  // Defensive pre-check: if a required store is missing the IDB transaction
  // fails with the opaque "One of the specified object stores was not found".
  // We surface a friendlier error and bail out before opening the tx.
  // T15.3 · `keyval` ya no se requiere · planPagos vive en prestamos.planPagos.
  const REQUIRED_STORES = [
    'properties', 'contracts', 'property_sales', 'accounts', 'movements',
    'prestamos', 'compromisosRecurrentes', 'gastosInmueble', 'treasuryEvents',
  ] as const;
  const existingStores = new Set(Array.from(db.objectStoreNames));
  const missingStores = REQUIRED_STORES.filter((name) => !existingStores.has(name));
  if (missingStores.length > 0) {
    throw new Error(
      `La base de datos local no tiene los siguientes stores necesarios: ${missingStores.join(', ')}. ` +
      `Recarga la página para forzar la migración.`,
    );
  }

  const tx = db.transaction([...REQUIRED_STORES], 'readwrite');

  const property = await tx.objectStore('properties').get(input.propertyId);
  if (!property) {
    throw new Error('Inmueble no encontrado');
  }

  const propLabel = (property as { alias?: string }).alias
    ? String((property as { alias?: string }).alias)
    : `inmueble #${input.propertyId}`;

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
    { amount: Number(input.agencyCommission || 0), description: `Comisión agencia venta ${propLabel}` },
    { amount: Number(input.municipalTax || 0), description: `Plusvalía municipal venta ${propLabel}` },
    { amount: Number(input.saleNotaryCosts || 0), description: `Notaría venta ${propLabel}` },
    { amount: Number(input.otherCosts || 0), description: `Otros costes venta ${propLabel}` },
  ].filter((item) => item.amount > 0);
  const now = new Date().toISOString();

  // Snapshot fiscal: si el caller (wizard) lo aporta, se usa; si no (callers
  // legacy, tests), se calcula al vuelo con el servicio de ganancia
  // patrimonial para mantener compatibilidad y no perder la previsión IRPF.
  let resolvedSnapshot: GananciaPatrimonialResult | undefined = input.fiscalSnapshot;
  if (!resolvedSnapshot) {
    try {
      resolvedSnapshot = await calcularGananciaPatrimonial({
        propertyId: input.propertyId,
        sellDate: input.saleDate,
        salePrice: Number(input.salePrice || 0),
        agencyCommission: Number(input.agencyCommission || 0),
        municipalTax: Number(input.municipalTax || 0),
        saleNotaryCosts: Number(input.saleNotaryCosts || 0),
        otherCosts: Number(input.otherCosts || 0),
      });
    } catch (err) {
      console.warn('No se pudo calcular fiscalSnapshot al confirmar la venta:', err);
      resolvedSnapshot = undefined;
    }
  }

  const fiscalSnapshot = resolvedSnapshot
    ? {
        precioAdquisicion: resolvedSnapshot.precioAdquisicion,
        gastosAdquisicion: resolvedSnapshot.gastosAdquisicion,
        mejorasCapexAcumuladas: resolvedSnapshot.mejorasCapexAcumuladas,
        amortizacionAcumuladaDeclarada: resolvedSnapshot.amortizacionAcumuladaDeclarada,
        amortizacionAcumuladaAtlas: resolvedSnapshot.amortizacionAcumuladaAtlas,
        costeFiscalAdquisicion: resolvedSnapshot.costeFiscalAdquisicion,
        gastosVenta: resolvedSnapshot.gastosVenta,
        valorNetoTransmision: resolvedSnapshot.valorNetoTransmision,
        gananciaPatrimonial: resolvedSnapshot.gananciaPatrimonial,
        irpfEstimado: resolvedSnapshot.irpfEstimado,
        anosDeclaradosXml: resolvedSnapshot.anosDeclaradosXml,
        anosCalculadosAtlas: resolvedSnapshot.anosCalculadosAtlas,
        calculatedAt: now,
      }
    : undefined;

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
    fiscalSnapshot,
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
    updatedGastos: [],
    updatedPaymentPlans: [],
    deletedLoanForecastEvents: [],
  };

  // PR3: la venta ya no crea movements directamente. Los 5+ movimientos de
  // venta (cobro bruto, gastos, cancelación préstamo) nacen como
  // treasuryEvents predicted más abajo, con ambito=INMUEBLE + inmuebleId.
  // El usuario los puntea desde Conciliación cuando llegan al banco, y
  // entonces confirmTreasuryEvent genera el movement real. Así el flujo es
  // coherente con el resto de la arquitectura unificada.

  const loanStore = tx.objectStore('prestamos');
  const allLoans = await loanStore.getAll();
  const linkedLoans = allLoans.filter((loan: any) => isLoanLinkedToProperty(loan, property));

  for (const loan of linkedLoans as Prestamo[]) {
    if (!loan?.id) continue;

    const allocationFactor = resolveLoanAllocationFactorForProperty(loan, property);
    if (allocationFactor <= 0) continue;

    executionJournal.updatedLoans.push({ id: loan.id, previous: loan });

    const isSharedLoan = Boolean(loan.afectacionesInmueble?.length) && allocationFactor < 1;

    if (isSharedLoan) {
      const rebalancedLoan = rebalanceLoanAllocationsAfterPropertySale(loan, String(input.propertyId));
      if (!rebalancedLoan) {
        continue;
      }

      await loanStore.put({
        ...rebalancedLoan,
        updatedAt: new Date().toISOString(),
      });
      continue;
    }

    // T15.3 · planPagos vive como campo del préstamo · journal mantiene la
    // clave histórica `planpagos_${id}` para compatibilidad con journals
    // antiguos · el restore (cancelPropertySale) detecta el prefijo y
    // recoloca el plan en prestamos.planPagos.
    const paymentPlanKey = `planpagos_${loan.id}`;
    const paymentPlan = (loan as unknown as { planPagos?: PlanPagos }).planPagos;
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

  const compromisosStore = tx.objectStore('compromisosRecurrentes');
  const allCompromisos = await compromisosStore.getAll();
  for (const comp of allCompromisos as any[]) {
    if (comp?.ambito !== 'inmueble' || comp?.inmuebleId !== input.propertyId || comp?.estado === 'baja' || typeof comp.id !== 'number') {
      continue;
    }
    executionJournal.deactivatedOpexRules.push({ id: comp.id, previous: comp });
    await compromisosStore.put({
      ...comp,
      estado: 'baja',
      updatedAt: new Date().toISOString(),
    });
  }

  // NOTE: el bloque antiguo de `ingresos` se elimina: el store nunca existió
  // en la DB (el nombre real es `rentaMensual`, indexado por contratoId no
  // por inmuebleId). Las rentas futuras quedan cubiertas por el cierre
  // automático de los contratos del inmueble (autoTerminateContracts).

  const gastoStore = tx.objectStore('gastosInmueble');
  const allGastosInm = await gastoStore.getAll();
  for (const gasto of allGastosInm as any[]) {
    if (
      gasto?.inmuebleId !== input.propertyId ||
      gasto?.estado === 'confirmado' ||
      gasto?.fecha < input.saleDate ||
      typeof gasto.id !== 'number'
    ) {
      continue;
    }
    executionJournal.updatedGastos.push({ id: gasto.id, previous: gasto });
    await gastoStore.put({
      ...gasto,
      estado: 'previsto',
      updatedAt: new Date().toISOString(),
    });
  }

  const estimatedIrpf = fiscalSnapshot?.irpfEstimado ?? 0;
  if (estimatedIrpf > 0) {
    const treasuryEventId = await tx.objectStore('treasuryEvents').add({
      type: 'expense',
      amount: estimatedIrpf,
      predictedDate: getSaleIrpfPredictionDate(input.saleDate),
      description: `IRPF estimado por venta ${propLabel}`,
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
    // PR3: cada línea de la venta nace como treasuryEvent predicted con
    // ambito=INMUEBLE para que aparezca también en la ficha del inmueble
    // y se puntee desde Conciliación cuando el usuario lo vea en el banco.
    const baseMeta = {
      sourceType: 'manual' as const,
      sourceId: saleId,
      accountId: settlementAccountId,
      status: 'predicted' as const,
      ambito: 'INMUEBLE' as const,
      inmuebleId: input.propertyId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saleTreasuryEvents: Array<Omit<TreasuryEvent, 'id'>> = [
      {
        type: 'income',
        amount: simulation.grossProceeds,
        predictedDate: input.saleDate,
        description: `Cobro venta ${propLabel}`,
        categoryLabel: 'Venta inmueble',
        ...baseMeta,
      },
      ...saleExpenseBreakdown.map((expense) => ({
        type: 'expense' as const,
        amount: expense.amount,
        predictedDate: input.saleDate,
        description: expense.description,
        categoryLabel: 'Gasto venta inmueble',
        ...baseMeta,
      })),
      ...(simulation.totalLoanSettlement > 0
        ? [{
            type: 'financing' as const,
            amount: simulation.totalLoanSettlement,
            predictedDate: input.saleDate,
            description: `Cancelación deuda ${propLabel}`,
            categoryLabel: 'Cancelación préstamo',
            ...baseMeta,
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
  prestamosService.clearCache();

  // PR3: la cancelación del préstamo no se finaliza automáticamente. El
  // treasuryEvent 'Cancelación deuda' nace predicted y al puntearlo desde
  // Conciliación (confirmTreasuryEvent) se cierra el movement y se llama
  // a finalizePropertySaleLoanCancellationFromTreasuryEvent, que cancela
  // el préstamo en prestamosService.

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
  // T15.3 · `keyval` ya no se requiere · planPagos vive en prestamos.planPagos.
  const tx = db.transaction(['properties', 'property_sales', 'contracts', 'movements', 'prestamos', 'compromisosRecurrentes', 'gastosInmueble', 'mejorasInmueble', 'mueblesInmueble', 'treasuryEvents'], 'readwrite');

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

  // PR3: si el usuario había punteado algunos events (executed), sus
  // movements tienen reference `treasury_event:{eventId}`. Los buscamos
  // y borramos, junto con las líneas de inmueble que hubiera creado
  // confirmTreasuryEvent (gastosInmueble/mejorasInmueble/mueblesInmueble).
  const eventIdsToCleanup = new Set<number>();
  if (journal?.treasuryEventIds?.length) {
    for (const eventId of journal.treasuryEventIds) {
      eventIdsToCleanup.add(eventId);
    }
  }
  if (typeof sale.id === 'number') {
    const linkedTreasuryEvents = (await tx.objectStore('treasuryEvents').getAll() as TreasuryEvent[])
      .filter((event) => event.sourceId === sale.id && typeof event.id === 'number');
    for (const event of linkedTreasuryEvents) {
      eventIdsToCleanup.add(event.id as number);
    }
  }

  if (eventIdsToCleanup.size > 0) {
    const allMovements = await tx.objectStore('movements').getAll() as any[];
    for (const mv of allMovements) {
      const ref = String(mv?.reference || '');
      const match = ref.match(/^treasury_event:(\d+)$/);
      if (!match) continue;
      const evId = Number(match[1]);
      if (eventIdsToCleanup.has(evId) && typeof mv.id === 'number') {
        await tx.objectStore('movements').delete(mv.id);
      }
    }

    // Limpia las líneas de inmueble que confirmTreasuryEvent pudiera haber
    // creado como efecto colateral de puntear la venta.
    const lineStores: Array<'gastosInmueble' | 'mejorasInmueble' | 'mueblesInmueble'> = [
      'gastosInmueble',
      'mejorasInmueble',
      'mueblesInmueble',
    ];
    for (const storeName of lineStores) {
      const all = (await tx.objectStore(storeName).getAll()) as any[];
      for (const linea of all) {
        const tid = typeof linea?.treasuryEventId === 'number' ? linea.treasuryEventId : undefined;
        if (tid != null && eventIdsToCleanup.has(tid) && typeof linea.id === 'number') {
          await tx.objectStore(storeName).delete(linea.id);
        }
      }
    }

    for (const eventId of eventIdsToCleanup) {
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
    // T15.3 · journal mantiene clave histórica `planpagos_${id}` ·
    // restauramos el plan en `prestamos[id].planPagos` parseando el
    // prefijo de la clave. Compatible con journals pre-migración.
    const restoreLoanStore = tx.objectStore('prestamos');
    for (const snapshot of journal.updatedPaymentPlans) {
      const loanId = String(snapshot.key).replace(/^planpagos_/, '').trim();
      if (!loanId) continue;
      // Defensivo · si el loanId parsea a entero canónico, probamos también
      // la key numérica para soportar préstamos legacy con id numérico residual.
      let loanRecord = (await restoreLoanStore.get(loanId)) as Prestamo | undefined;
      if (!loanRecord) {
        const numericKey =
          loanId !== '' &&
          Number.isFinite(Number(loanId)) &&
          String(Number(loanId)) === loanId
            ? (Number(loanId) as IDBValidKey)
            : undefined;
        if (numericKey !== undefined) {
          loanRecord = (await restoreLoanStore.get(numericKey)) as Prestamo | undefined;
        }
      }
      if (!loanRecord) continue;
      await restoreLoanStore.put({
        ...loanRecord,
        planPagos: snapshot.previous as PlanPagos,
      });
    }
  }

  if (journal?.deactivatedOpexRules?.length) {
    for (const snapshot of journal.deactivatedOpexRules) {
      await tx.objectStore('compromisosRecurrentes').put(snapshot.previous as any);
    }
  }

  // journal.updatedIngresos: se omite adrede — el store `ingresos` nunca
  // existió, así que no hay nada que revertir en ese store. Los journals
  // antiguos con este campo se ignoran sin error.

  if (journal?.updatedGastos?.length) {
    for (const snapshot of journal.updatedGastos) {
      await tx.objectStore('gastosInmueble').put(snapshot.previous as any);
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

  prestamosService.clearCache();

  return revertedSale;
};

export const finalizePropertySaleLoanCancellation = async (movementId: number): Promise<boolean> => {
  const db = await initDB();
  const movement = await db.get('movements', movementId) as any;

  if (!movement || movement.amount >= 0) return false;
  if (!String(movement.reference || '').startsWith('property_sale:')) return false;
  if (!String(movement.description || '').startsWith('Cancelación deuda ')) return false;

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

  // T15.3 · `keyval` ya no es necesario · planPagos vive en prestamos.planPagos.
  const tx = db.transaction(['prestamos', 'treasuryEvents', 'property_sales'], 'readwrite');
  const loanStore = tx.objectStore('prestamos');
  const allLoans = await loanStore.getAll();
  const linkedLoans = allLoans.filter((loan: any) => isLoanLinkedToProperty(loan, property));

  for (const loan of linkedLoans) {
    if (!loan?.id) continue;
    if (loan.estado === 'cancelado' && loan.activo === false) continue;

    const paymentPlan = (loan as unknown as { planPagos?: PlanPagos }).planPagos;
    const outstandingPrincipal = resolveProjectedOutstandingPrincipal(loan, paymentPlan, sale.saleDate);
    const truncatedPlan = paymentPlan?.periodos?.length
      ? truncatePaymentPlanAtCancellation(paymentPlan, sale.saleDate, outstandingPrincipal)
      : null;

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
      fechaCancelacion: sale.saleDate,
      principalVivo: 0,
      cuotasPagadas: truncatedPlan?.periodos.length ?? loan.cuotasPagadas,
      fechaUltimaCuotaPagada: sale.saleDate,
      cancelacionPendienteVenta: false,
      // T15.3 · planPagos vive como campo del préstamo · si truncamos,
      // sobrescribimos; si no había plan, conservamos el actual.
      planPagos: truncatedPlan ?? (loan as any).planPagos,
      updatedAt: new Date().toISOString(),
    });
  }

  await tx.objectStore('property_sales').put({
    ...sale,
    notes: [sale.notes, LOAN_CANCELLATION_FINALIZED_MARKER].filter(Boolean).join(' | '),
    updatedAt: new Date().toISOString(),
  });

  await tx.done;
  prestamosService.clearCache();
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
    String(treasuryEvent.description || '').startsWith('Cancelación deuda ');

  if (!isSaleLoanCancellationEvent) return false;

  return finalizePropertySaleLoanCancellationBySaleId(treasuryEvent.sourceId as number);
};

const ensureSaleTaxFiscalYearOpen = async (propertyId: number, saleDate: string): Promise<void> => {
  const saleYear = new Date(saleDate).getFullYear();
  if (!Number.isFinite(saleYear)) return;

  const paymentFiscalYear = saleYear + 1;
  await getFiscalSummary(propertyId, paymentFiscalYear);
};
