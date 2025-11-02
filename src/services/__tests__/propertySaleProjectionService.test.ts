import {
  applySale,
  buildIrpfPaymentRow,
  buildMonthlyRow,
  LoanRecord,
  SaleContext
} from '../../services/propertySaleProjectionService';

const createLoan = (overrides: Partial<LoanRecord> = {}): LoanRecord => ({
  id: 'loan-1',
  startMonth: '2024-01',
  schedule: [
    { month: '2024-12', payment: 750, principal: 400 },
    { month: '2025-01', payment: 750, principal: 420 },
    { month: '2025-02', payment: 750, principal: 430 },
    { month: '2025-03', payment: 750, principal: 450 },
    { month: '2025-04', payment: 750, principal: 460 }
  ],
  ...overrides
});

const freshContext = (): SaleContext => ({
  loans: [createLoan()],
  ledger: []
});

describe('propertySaleProjectionService', () => {

  it('applies sale events without double charging the mortgage', () => {
    const saleApplied = applySale(freshContext(), {
      month: '2025-03',
      price: 250000,
      agenciaFija: 8000,
      otrosCostes: 4000,
      penalizacion: 2000,
      deudaPendiente: 179000,
      loanId: 'loan-1',
      hasProductAccount: true,
      chargeScheduledPayment: true,
      irpf: 6000
    });

    const marchRow = buildMonthlyRow(saleApplied, '2025-03', 179450);

    const expectedNet = 250000 - 8000 - 4000 - 2000 - 179000;

    expect(marchRow.OTROS).toBe(expectedNet);
    expect(marchRow.ICASH).toBe(expectedNet);
    expect(marchRow.CASH).toBe(0);
    expect(marchRow.MTG).toBe(750);
    expect(marchRow.DEBT).toBeCloseTo(0);

    // Ensure IRPF is paid in June next year instead of sale month
    expect(marchRow['PER/OPS']).toBe(0);
    const juneRow = buildIrpfPaymentRow(saleApplied, '2026-06');
    expect(juneRow['PER/OPS']).toBe(-6000);

    // Loan should be terminated in sale month
    expect(saleApplied.loans[0].terminatedOn).toBe('2025-03');
    expect(saleApplied.loans[0].outstandingOnSale).toBe(179000);
  });

  it('routes net proceeds to CASH when there is no product account and skips scheduled payment on day-one sale', () => {
    const saleApplied = applySale(freshContext(), {
      month: '2025-02',
      price: 180000,
      deudaPendiente: 179000,
      loanId: 'loan-1',
      hasProductAccount: false,
      chargeScheduledPayment: false
    });

    const febRow = buildMonthlyRow(saleApplied, '2025-02', 179000);

    const expectedNet = 180000 - 179000;

    expect(febRow.OTROS).toBe(expectedNet);
    expect(febRow.ICASH).toBe(0);
    expect(febRow.CASH).toBe(expectedNet);
    expect(febRow.MTG).toBe(0);
    expect(febRow.DEBT).toBeCloseTo(0);
  });

  it('keeps mortgage off the books after the sale month', () => {
    const saleApplied = applySale(freshContext(), {
      month: '2025-03',
      price: 200000,
      deudaPendiente: 199500,
      loanId: 'loan-1',
      hasProductAccount: true
    });

    const marchRow = buildMonthlyRow(saleApplied, '2025-03', 199500);
    expect(marchRow.DEBT).toBeCloseTo(0);

    const aprilRow = buildMonthlyRow(saleApplied, '2025-04', marchRow.DEBT);
    expect(aprilRow.MTG).toBe(0);
    expect(aprilRow.DEBT).toBeCloseTo(0);
  });
});

