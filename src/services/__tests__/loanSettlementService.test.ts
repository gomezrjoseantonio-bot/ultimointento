import { initDB } from '../db';
import { prestamosService } from '../prestamosService';
import {
  confirmLoanSettlement,
  getLoanSettlementsByLoanId,
  prepareLoanSettlement,
  saveLoanAmortizationPlan,
  simulateLoanAmortizationPlan,
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
      // V63 (sub-tarea 4): el store `loan_settlements` se eliminó; las
      // liquidaciones viven en `prestamos.liquidacion[]`, así que basta
      // con haber limpiado `prestamos`.
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

    // El recibo se localiza por la fecha que la propia liquidación guarda, no
    // buscando «el primero sin pagar»: un adelanto no toca el recibo a caballo,
    // y un recibo viejo que nadie punteó tampoco es el siguiente. Suponerlo es
    // lo que hacía que el modal enseñara la cuota de otro tramo.
    expect(settlement.monthlyPaymentFrom).toBeTruthy();
    const elQueCambia = paymentPlan?.periodos.find(
      (periodo) => periodo.fechaCargo === settlement.monthlyPaymentFrom,
    );
    expect(elQueCambia?.cuota).toBeCloseTo(settlement.monthlyPaymentAfter || 0, 1);

    const history = await getLoanSettlementsByLoanId(loan.id);
    expect(history).toHaveLength(1);
    expect(history[0].notes).toBe('Amortización parcial con reducción de cuota');
  });

  // ── Un PLAN de amortizaciones se simula · no se confirma ──────────────────
  //
  // Es la línea que separa esta pestaña de las otras dos, y la que hay que
  // vigilar: ciento veinte operaciones que aún no han ocurrido no pueden dejar
  // rastro en tesorería ni cambiar el cuadro con el que se cuentan las cuotas.

  it('simula un plan recurrente por los dos caminos y no escribe nada', async () => {
    const db = await initDB();
    const loan = await prestamosService.createPrestamo(baseLoanData);
    const planAntes = await prestamosService.getPaymentPlan(loan.id);

    const { reducirPlazo, reducirCuota } = await simulateLoanAmortizationPlan({
      loanId: loan.id,
      reglas: [
        { id: 'mensual', cadencia: 'MENSUAL', importe: 200, desde: '2026-01-01' },
        { id: 'extra', cadencia: 'ANUAL', mes: 6, importe: 3000, desde: '2026-01-01' },
      ],
      limiteAnualExento: { base: 'ANUALIDAD', porcentajeDelCapitalInicial: 20 },
    });

    // Junio lleva las dos reglas en una sola operación.
    const junio = reducirPlazo.adelantos.find((a) => a.fecha === '2026-06-01');
    expect(junio?.aplicado).toBe(3200);

    expect(reducirPlazo.ahorroNeto).toBeGreaterThan(0);
    expect(reducirPlazo.mesesGanados).toBeGreaterThan(reducirCuota.mesesGanados);
    expect(reducirCuota.cuotaEnUnAnio).toBeLessThan(reducirCuota.antes.cuota);

    // Y ahora lo que de verdad importa: el préstamo sigue como estaba.
    const loanDespues = await db.get('prestamos', loan.id) as any;
    expect(loanDespues.principalVivo).toBe(baseLoanData.principalVivo);
    expect(loanDespues.activo).toBe(true);

    expect(await prestamosService.getPaymentPlan(loan.id)).toEqual(planAntes);
    expect(await db.getAll('movements')).toHaveLength(0);
    expect(await db.getAll('treasuryEvents')).toHaveLength(0);
    expect(await getLoanSettlementsByLoanId(loan.id)).toHaveLength(0);
  });

  it('un plan sin reglas con importe no se simula a medias · lo dice', async () => {
    const loan = await prestamosService.createPrestamo(baseLoanData);

    await expect(
      simulateLoanAmortizationPlan({
        loanId: loan.id,
        reglas: [{ id: 'vacia', cadencia: 'MENSUAL', importe: 0, desde: '2026-01-01' }],
      }),
    ).rejects.toThrow(/al menos una regla/);
  });

  // ── Guardar el plan · y lo que eso hace (y no hace) en tesorería ──────────
  //
  // Guardar un plan es decir «voy a hacer esto», no «lo he hecho». La línea
  // está aquí: salen previsiones `predicted` para que el saldo cuente con
  // ellas, y NO se toca ni el cuadro ni el capital vivo.

  const planMensual = {
    reglas: [
      {
        id: 'mensual',
        cadencia: 'MENSUAL' as const,
        importe: 300,
        // En el futuro a propósito: `planificarEventos` no emite lo vencido, y
        // con razón — un adelanto planificado para el año pasado no proyecta
        // nada. Con fechas pasadas este test no probaría nada.
        desde: '2027-01-01',
        veces: 6,
      },
    ],
    modo: 'REDUCIR_PLAZO' as const,
    gastosFijosPorOperacion: 10,
    generaPrevisiones: true,
  };

  it('guardar el plan emite previsiones con la salida de caja entera, sin tocar el cuadro', async () => {
    const db = await initDB();
    const loan = await prestamosService.createPrestamo(baseLoanData);
    const cuadroAntes = await prestamosService.getPaymentPlan(loan.id);

    const { emitidas } = await saveLoanAmortizationPlan(loan.id, planMensual);
    expect(emitidas).toBe(6);

    const eventos = (await db.getAll('treasuryEvents') as any[])
      .filter((e) => e.sourceType === 'amortizacion_anticipada');
    expect(eventos).toHaveLength(6);
    expect(eventos.every((e) => e.status === 'predicted')).toBe(true);
    expect(eventos.every((e) => e.prestamoId === loan.id)).toBe(true);

    // El importe previsto es lo que SALE de la cuenta, no el capital solo: una
    // previsión corta deja el saldo en rojo sin avisar. Son 300 € de capital,
    // 10 € de gastos y la comisión pactada — que va en PUNTOS PORCENTUALES,
    // así que el `0.005` de este préstamo es un 0,005 %, no un 0,5 %.
    expect(eventos[0].amount).toBeCloseTo(300 + 10 + 300 * (0.005 / 100), 2);

    // Y el préstamo sigue exactamente como estaba.
    const despues = await db.get('prestamos', loan.id) as any;
    expect(despues.principalVivo).toBe(baseLoanData.principalVivo);
    expect(despues.planDeAmortizaciones.reglas).toHaveLength(1);
    expect(despues.planDeAmortizaciones.actualizadoEn).toBeTruthy();
    expect(await prestamosService.getPaymentPlan(loan.id)).toEqual(cuadroAntes);
  });

  it('sin marcar la casilla, el plan se guarda pero no llena la tesorería', async () => {
    const db = await initDB();
    const loan = await prestamosService.createPrestamo(baseLoanData);

    const { emitidas } = await saveLoanAmortizationPlan(loan.id, {
      ...planMensual,
      generaPrevisiones: false,
    });

    expect(emitidas).toBe(0);
    expect(await db.getAll('treasuryEvents')).toHaveLength(0);
    expect(((await db.get('prestamos', loan.id)) as any).planDeAmortizaciones).toBeTruthy();
  });

  it('volver a guardar rehace las pendientes y respeta lo ya confirmado', async () => {
    const db = await initDB();
    const loan = await prestamosService.createPrestamo(baseLoanData);
    await saveLoanAmortizationPlan(loan.id, planMensual);

    // El usuario confirma la primera: ese apunte ya es suyo.
    const primera = (await db.getAll('treasuryEvents') as any[])
      .filter((e) => e.sourceType === 'amortizacion_anticipada')
      .sort((a, b) => a.predictedDate.localeCompare(b.predictedDate))[0];
    await db.put('treasuryEvents', { ...primera, status: 'confirmed' });

    // Y cambia de idea sobre el resto.
    await saveLoanAmortizationPlan(loan.id, {
      ...planMensual,
      reglas: [{ ...planMensual.reglas[0], importe: 500 }],
    });

    const eventos = (await db.getAll('treasuryEvents') as any[])
      .filter((e) => e.sourceType === 'amortizacion_anticipada')
      .sort((a, b) => a.predictedDate.localeCompare(b.predictedDate));

    // La confirmada sigue ahí con su importe viejo · no se resucita ni se pisa.
    expect(eventos[0].status).toBe('confirmed');
    expect(eventos[0].amount).toBeCloseTo(300 + 10 + 300 * (0.005 / 100), 2);
    // Y no se ha duplicado: sigue habiendo una sola por fecha.
    expect(new Set(eventos.map((e) => e.predictedDate)).size).toBe(eventos.length);
    // Las demás son ya del importe nuevo.
    expect(eventos[1].amount).toBeCloseTo(500 + 10 + 500 * (0.005 / 100), 2);
  });

  it('borrar el plan se lleva sus previsiones pendientes', async () => {
    const db = await initDB();
    const loan = await prestamosService.createPrestamo(baseLoanData);
    await saveLoanAmortizationPlan(loan.id, planMensual);

    await saveLoanAmortizationPlan(loan.id, null);

    expect(((await db.get('prestamos', loan.id)) as any).planDeAmortizaciones).toBeUndefined();
    const quedan = (await db.getAll('treasuryEvents') as any[])
      .filter((e) => e.sourceType === 'amortizacion_anticipada');
    expect(quedan).toHaveLength(0);
  });

  it('las previsiones del plan no borran ni tapan las cuotas del préstamo', async () => {
    const db = await initDB();
    const loan = await prestamosService.createPrestamo(baseLoanData);

    // Una cuota prevista del cuadro, como la emite el guardado del préstamo.
    await db.add('treasuryEvents', {
      type: 'financing',
      amount: 700,
      predictedDate: '2027-01-01',
      description: 'Cuota 24',
      sourceType: 'prestamo',
      prestamoId: loan.id,
      numeroCuota: 24,
      status: 'predicted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    await saveLoanAmortizationPlan(loan.id, planMensual);

    const eventos = await db.getAll('treasuryEvents') as any[];
    // La cuota sigue viva y el adelanto del mismo día convive con ella.
    expect(eventos.filter((e) => e.sourceType === 'prestamo')).toHaveLength(1);
    expect(
      eventos.filter((e) => e.sourceType === 'amortizacion_anticipada' && e.predictedDate === '2027-01-01'),
    ).toHaveLength(1);
  });
});
