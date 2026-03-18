import { initDB } from '../db';
import { prestamosService } from '../prestamosService';
import {
  confirmLoanSettlement,
  getLoanSettlementsByLoanId,
  prepareLoanSettlement,
  simulateLoanSettlement,
} from '../loanSettlementService';
import { Prestamo } from '../../types/prestamos';

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

const baseLoanData: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> = {
  ambito: 'INMUEBLE',
  inmuebleId: 'property_loan_settlement',
  nombre: 'Hipoteca Test Settlement',
  principalInicial: 120000,
  principalVivo: 120000,
  fechaFirma: '2025-01-01',
  fechaPrimerCargo: '2025-02-01',
  plazoMesesTotal: 240,
  diaCargoMes: 1,
  esquemaPrimerRecibo: 'NORMAL',
  carencia: 'NINGUNA',
  sistema: 'FRANCES',
  cuotasPagadas: 0,
  origenCreacion: 'MANUAL',
  activo: true,
  tipo: 'FIJO',
  tipoNominalAnualFijo: 3.2,
  cuentaCargoId: 'account_1',
  comisionAmortizacionAnticipada: 0.005,
  comisionCancelacionTotal: 0.01,
  gastosFijosOperacion: 25,
};

describe('loanSettlementService', () => {
  beforeEach(async () => {
    const db = await initDB();
    await Promise.all([
      db.clear('accounts'),
      db.clear('movements'),
      db.clear('treasuryEvents'),
      db.clear('prestamos'),
      db.clear('loan_settlements'),
      db.clear('keyval'),
    ]);
    prestamosService.clearCache();
  });

  it('prepara y simula una cancelación total con intereses corridos', async () => {
    const loan = await prestamosService.createPrestamo(baseLoanData);

    const prepared = await prepareLoanSettlement(loan.id, '2025-03-15');
    expect(prepared.principalPendienteEstimado).toBeGreaterThan(0);
    expect(prepared.interesesCorridosEstimados).toBeGreaterThanOrEqual(0);

    const simulation = await simulateLoanSettlement({
      loanId: loan.id,
      operationType: 'TOTAL',
      operationDate: '2025-03-15',
      feeAmount: 250,
      fixedCosts: 30,
    });

    expect(simulation.operationType).toBe('TOTAL');
    expect(simulation.principalAfter).toBe(0);
    expect(simulation.totalCashOut).toBeCloseTo(
      simulation.principalBefore + simulation.accruedInterest + 250 + 30,
      2,
    );
  });

  it('confirma una cancelación total y deja el préstamo cancelado con movimiento e histórico', async () => {
    const db = await initDB();
    const accountId = Number(await db.add('accounts', createAccount()));
    const loan = await prestamosService.createPrestamo(baseLoanData);

    const settlement = await confirmLoanSettlement({
      loanId: loan.id,
      operationType: 'TOTAL',
      operationDate: '2025-03-15',
      settlementAccountId: accountId,
      feeAmount: 180,
      fixedCosts: 20,
      notes: 'Cancelación anticipada manual',
    });

    expect(settlement.id).toBeDefined();
    expect(settlement.operationType).toBe('TOTAL');
    expect(settlement.totalCashOut).toBeGreaterThan(settlement.principalApplied);

    const updatedLoan = await db.get('prestamos', loan.id) as any;
    expect(updatedLoan.activo).toBe(false);
    expect(updatedLoan.estado).toBe('cancelado');
    expect(updatedLoan.principalVivo).toBe(0);
    expect(updatedLoan.fechaCancelacion).toBe('2025-03-15');

    const paymentPlan = await prestamosService.getPaymentPlan(loan.id);
    expect(paymentPlan?.resumen.fechaFinalizacion).toBe('2025-03-15');
    expect(paymentPlan?.periodos[paymentPlan.periodos.length - 1].principalFinal).toBe(0);

    const movements = await db.getAll('movements') as any[];
    expect(movements.some((movement) => String(movement.reference).includes(`loan_settlement:${loan.id}:2025-03-15`))).toBe(true);

    const history = await getLoanSettlementsByLoanId(loan.id);
    expect(history).toHaveLength(1);
    expect(history[0].notes).toBe('Cancelación anticipada manual');
  });

  it('confirma una amortización parcial reduciendo cuota y persiste un plan custom', async () => {
    const db = await initDB();
    const accountId = Number(await db.add('accounts', createAccount({ iban: 'ES7700491500051234567892' })));
    const loan = await prestamosService.createPrestamo(baseLoanData);

    const simulation = await simulateLoanSettlement({
      loanId: loan.id,
      operationType: 'PARTIAL',
      operationDate: '2025-06-15',
      partialMode: 'REDUCIR_CUOTA',
      principalAmount: 10000,
      feeAmount: 50,
      fixedCosts: 10,
    });

    expect(simulation.monthlyPaymentAfter).toBeLessThan(simulation.monthlyPaymentBefore || Infinity);
    expect(simulation.principalAfter).toBeCloseTo(simulation.principalBefore - 10000, 2);

    const settlement = await confirmLoanSettlement({
      loanId: loan.id,
      operationType: 'PARTIAL',
      operationDate: '2025-06-15',
      partialMode: 'REDUCIR_CUOTA',
      principalAmount: 10000,
      feeAmount: 50,
      fixedCosts: 10,
      settlementAccountId: accountId,
      notes: 'Amortización parcial con reducción de cuota',
    });

    expect(settlement.operationType).toBe('PARTIAL');
    expect(settlement.partialMode).toBe('REDUCIR_CUOTA');
    expect(settlement.principalAfter).toBeCloseTo(simulation.principalAfter, 2);

    const updatedLoan = await db.get('prestamos', loan.id) as any;
    expect(updatedLoan.activo).toBe(true);
    expect(updatedLoan.estado ?? 'vivo').toBe('vivo');
    expect(updatedLoan.principalVivo).toBeCloseTo(simulation.principalAfter, 2);

    const paymentPlan = await prestamosService.getPaymentPlan(loan.id);
    expect(paymentPlan?.metadata?.source).toBe('loan_settlement');
    expect(paymentPlan?.metadata?.partialMode).toBe('REDUCIR_CUOTA');
    expect(paymentPlan?.periodos.some((periodo) => periodo.fechaCargo === '2025-06-15' && periodo.pagado)).toBe(true);

    const firstFuturePeriod = paymentPlan?.periodos.find((periodo) => !periodo.pagado);
    expect(firstFuturePeriod?.cuota).toBeCloseTo(settlement.monthlyPaymentAfter || 0, 1);

    const history = await getLoanSettlementsByLoanId(loan.id);
    expect(history).toHaveLength(1);
    expect(history[0].notes).toBe('Amortización parcial con reducción de cuota');
  });
});
