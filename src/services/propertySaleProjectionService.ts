export type AccountCode =
  | 'OTROS'
  | 'ICASH'
  | 'CASH'
  | 'PER/OPS'
  | 'IRPF_DEVENGADO'
  | string;

export interface LedgerEvent {
  month: string; // YYYY-MM format
  account: AccountCode;
  amount: number;
  metadata?: Record<string, unknown>;
}

export interface LoanScheduleEntry {
  month: string; // YYYY-MM
  payment: number; // Total payment (principal + interest)
  principal: number; // Principal component of the payment
}

export interface LoanRecord {
  id: string;
  startMonth: string; // YYYY-MM
  schedule: LoanScheduleEntry[];
  terminatedOn?: string; // YYYY-MM inclusive month of sale
  outstandingOnSale?: number;
  includePaymentInTerminationMonth?: boolean;
}

export interface SaleApplicationInput {
  month: string; // YYYY-MM of the sale closing
  price: number;
  agenciaFija?: number;
  otrosCostes?: number;
  penalizacion?: number;
  deudaPendiente: number;
  loanId?: string;
  hasProductAccount?: boolean; // true → ICASH, false → CASH
  chargeScheduledPayment?: boolean; // true if the scheduled payment occurs in the sale month
  irpf?: number; // tax accrued on the sale (positive = liability)
  irpfAccrualMonth?: string; // Optional custom accrual month
  irpfPaymentAccount?: AccountCode; // Defaults to PER/OPS when provided
}

export interface SaleContext {
  loans: LoanRecord[];
  ledger: LedgerEvent[];
}

export interface MonthlyRow {
  month: string;
  OTROS: number;
  ICASH: number;
  CASH: number;
  'PER/OPS': number;
  MTG: number;
  DEBT: number;
}

const ACCOUNT_ICASH = 'ICASH';
const ACCOUNT_CASH = 'CASH';
const ACCOUNT_OTROS = 'OTROS';
const ACCOUNT_PER_OPS = 'PER/OPS';
const ACCOUNT_IRPF_DEVENGADO = 'IRPF_DEVENGADO';

const monthRegex = /^\d{4}-\d{2}$/;

const normaliseMonth = (month: string): string => {
  if (!monthRegex.test(month)) {
    const [rawYear, rawMonth] = month.split('-');
    const year = Number(rawYear);
    const monthNum = Number(rawMonth);
    if (!Number.isFinite(year) || !Number.isFinite(monthNum)) {
      throw new Error(`Invalid month format: ${month}`);
    }
    return `${year.toString().padStart(4, '0')}-${monthNum.toString().padStart(2, '0')}`;
  }
  return month;
};

const compareYearMonth = (a: string, b: string): number => {
  const [aYear, aMonth] = a.split('-').map(Number);
  const [bYear, bMonth] = b.split('-').map(Number);
  if (aYear !== bYear) {
    return aYear - bYear;
  }
  return aMonth - bMonth;
};

const getNextYearJune = (month: string): string => {
  const [yearStr] = month.split('-');
  const year = Number(yearStr);
  if (!Number.isFinite(year)) {
    throw new Error(`Invalid month provided for IRPF scheduling: ${month}`);
  }
  const nextYear = year + 1;
  return `${nextYear.toString().padStart(4, '0')}-06`;
};

const sumEventsForAccount = (events: LedgerEvent[], month: string, account: AccountCode): number => {
  return events
    .filter((event) => event.month === month && event.account === account)
    .reduce((acc, event) => acc + event.amount, 0);
};

const findScheduleEntry = (loan: LoanRecord, month: string): LoanScheduleEntry | undefined => {
  return loan.schedule.find((entry) => entry.month === month);
};

const isLoanActiveInMonth = (loan: LoanRecord, month: string): boolean => {
  if (compareYearMonth(month, loan.startMonth) < 0) {
    return false;
  }

  if (!loan.terminatedOn) {
    return true;
  }

  const comparison = compareYearMonth(month, loan.terminatedOn);

  if (comparison < 0) {
    return true;
  }

  if (comparison === 0) {
    return Boolean(loan.includePaymentInTerminationMonth);
  }

  return false;
};

export const applySale = (context: SaleContext, input: SaleApplicationInput): SaleContext => {
  const month = normaliseMonth(input.month);
  const price = input.price;
  const agencia = input.agenciaFija ?? 0;
  const otrosCostes = input.otrosCostes ?? 0;
  const penalizacion = input.penalizacion ?? 0;
  const deudaPendiente = input.deudaPendiente;

  const neto = price - agencia - otrosCostes - penalizacion - deudaPendiente;

  const ledgerUpdates: LedgerEvent[] = [
    {
      month,
      account: ACCOUNT_OTROS,
      amount: neto,
      metadata: { type: 'SALE_NET', loanId: input.loanId }
    },
    {
      month,
      account: input.hasProductAccount === false ? ACCOUNT_CASH : ACCOUNT_ICASH,
      amount: neto,
      metadata: { type: 'SALE_NET', loanId: input.loanId }
    }
  ];

  if (input.irpf && input.irpf !== 0) {
    const accrualMonth = normaliseMonth(input.irpfAccrualMonth ?? month);
    ledgerUpdates.push({
      month: accrualMonth,
      account: ACCOUNT_IRPF_DEVENGADO,
      amount: input.irpf,
      metadata: { type: 'SALE_IRPF_ACCRUAL', saleMonth: month }
    });

    const paymentAccount = input.irpfPaymentAccount ?? ACCOUNT_PER_OPS;
    ledgerUpdates.push({
      month: getNextYearJune(month),
      account: paymentAccount,
      amount: -input.irpf,
      metadata: { type: 'SALE_IRPF_PAYMENT', saleMonth: month }
    });
  }

  let updatedLoans = context.loans;

  if (input.loanId) {
    const targetIndex = context.loans.findIndex((loan) => loan.id === input.loanId);
    if (targetIndex === -1) {
      throw new Error(`Loan ${input.loanId} not found when applying sale`);
    }

    const existing = context.loans[targetIndex];
    const terminatedLoan: LoanRecord = {
      ...existing,
      terminatedOn: month,
      outstandingOnSale: deudaPendiente,
      includePaymentInTerminationMonth: Boolean(input.chargeScheduledPayment)
    };

    updatedLoans = [
      ...context.loans.slice(0, targetIndex),
      terminatedLoan,
      ...context.loans.slice(targetIndex + 1)
    ];
  }

  return {
    loans: updatedLoans,
    ledger: [...context.ledger, ...ledgerUpdates]
  };
};

export const buildMonthlyRow = (
  context: SaleContext,
  monthInput: string,
  previousDebt: number
): MonthlyRow => {
  const month = normaliseMonth(monthInput);

  let mtg = 0;
  let principalPaid = 0;

  for (const loan of context.loans) {
    const scheduleEntry = findScheduleEntry(loan, month);
    if (!scheduleEntry) {
      continue;
    }

    if (!isLoanActiveInMonth(loan, month)) {
      continue;
    }

    mtg += scheduleEntry.payment;
    principalPaid += scheduleEntry.principal;
  }

  const outstandingSettled = context.loans
    .filter((loan) => loan.terminatedOn === month)
    .reduce((sum, loan) => sum + (loan.outstandingOnSale ?? 0), 0);

  const debt = previousDebt - principalPaid - outstandingSettled;

  return {
    month,
    OTROS: sumEventsForAccount(context.ledger, month, ACCOUNT_OTROS),
    ICASH: sumEventsForAccount(context.ledger, month, ACCOUNT_ICASH),
    CASH: sumEventsForAccount(context.ledger, month, ACCOUNT_CASH),
    'PER/OPS': sumEventsForAccount(context.ledger, month, ACCOUNT_PER_OPS),
    MTG: mtg,
    DEBT: debt
  };
};

export const buildIrpfPaymentRow = (
  context: SaleContext,
  monthInput: string
): { month: string; 'PER/OPS': number } => {
  const month = normaliseMonth(monthInput);
  return {
    month,
    'PER/OPS': sumEventsForAccount(context.ledger, month, ACCOUNT_PER_OPS)
  };
};

