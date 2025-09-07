// Préstamos Calculation Service Tests

import { prestamosCalculationService } from '../prestamosCalculationService';
import { Prestamo } from '../../types/prestamos';

describe('PrestamosCalculationService', () => {
  
  describe('calculateFrenchPayment', () => {
    test('calculates correct payment for standard case', () => {
      // 100,000€ at 3.2% for 300 months
      const payment = prestamosCalculationService.calculateFrenchPayment(100000, 0.032, 300);
      
      // Expected payment should be around 485€ (rough calculation)
      expect(payment).toBeGreaterThan(480);
      expect(payment).toBeLessThan(490);
      expect(payment).toEqual(Math.round(payment * 100) / 100); // Properly rounded
    });

    test('handles zero interest rate', () => {
      const payment = prestamosCalculationService.calculateFrenchPayment(120000, 0, 240);
      expect(payment).toBe(500); // 120000 / 240
    });

    test('handles edge cases', () => {
      expect(prestamosCalculationService.calculateFrenchPayment(0, 0.03, 300)).toBe(0);
      expect(prestamosCalculationService.calculateFrenchPayment(100000, 0.03, 0)).toBe(0);
    });
  });

  describe('calculateBaseRate', () => {
    test('calculates FIJO rate correctly', () => {
      const prestamo: Prestamo = {
        id: 'test',
        inmuebleId: 'prop1',
        nombre: 'Test Fijo',
        principalInicial: 100000,
        principalVivo: 95000,
        fechaFirma: '2024-01-01',
        plazoMesesTotal: 300,
        tipo: 'FIJO',
        tipoNominalAnualFijo: 0.035,
        cuentaCargoId: 'cuenta1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const rate = prestamosCalculationService.calculateBaseRate(prestamo);
      expect(rate).toBe(0.035);
    });

    test('calculates VARIABLE rate correctly', () => {
      const prestamo: Prestamo = {
        id: 'test',
        inmuebleId: 'prop1',
        nombre: 'Test Variable',
        principalInicial: 100000,
        principalVivo: 95000,
        fechaFirma: '2024-01-01',
        plazoMesesTotal: 300,
        tipo: 'VARIABLE',
        indice: 'EURIBOR',
        valorIndiceActual: 0.025,
        diferencial: 0.012,
        cuentaCargoId: 'cuenta1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const rate = prestamosCalculationService.calculateBaseRate(prestamo);
      expect(rate).toBe(0.037); // 0.025 + 0.012
    });

    test('calculates MIXTO rate correctly in fixed period', () => {
      const prestamo: Prestamo = {
        id: 'test',
        inmuebleId: 'prop1',
        nombre: 'Test Mixto',
        principalInicial: 100000,
        principalVivo: 95000,
        fechaFirma: '2024-01-01',
        plazoMesesTotal: 300,
        tipo: 'MIXTO',
        tramoFijoMeses: 60,
        tipoNominalAnualMixtoFijo: 0.032,
        indice: 'EURIBOR',
        valorIndiceActual: 0.025,
        diferencial: 0.015,
        cuentaCargoId: 'cuenta1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      // Within fixed period (1 year after signing)
      const dateInFixed = new Date('2024-06-01');
      const rate = prestamosCalculationService.calculateBaseRate(prestamo, dateInFixed);
      expect(rate).toBe(0.032);

      // After fixed period (6 years after signing)
      const dateAfterFixed = new Date('2029-06-01');
      const rateVariable = prestamosCalculationService.calculateBaseRate(prestamo, dateAfterFixed);
      expect(rateVariable).toBe(0.04); // 0.025 + 0.015
    });
  });

  describe('generatePaymentSchedule', () => {
    test('generates basic schedule for fixed loan', () => {
      const prestamo: Prestamo = {
        id: 'test',
        inmuebleId: 'prop1',
        nombre: 'Test Basic',
        principalInicial: 120000,
        principalVivo: 120000,
        fechaFirma: '2024-08-10',
        plazoMesesTotal: 12, // Short term for testing
        tipo: 'FIJO',
        tipoNominalAnualFijo: 0.036,
        diaCargoMes: 10,
        cuentaCargoId: 'cuenta1',
        createdAt: '2024-08-10T00:00:00Z',
        updatedAt: '2024-08-10T00:00:00Z'
      };

      const plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
      
      expect(plan.periodos).toHaveLength(12);
      expect(plan.prestamoId).toBe('test');
      expect(plan.resumen.totalCuotas).toBe(12);
      
      // First period should start from signing date
      expect(plan.periodos[0].periodo).toBe(1);
      expect(plan.periodos[0].fechaCargo).toBe('2024-09-10'); // First payment next month
      
      // Last period should have zero remaining principal
      const lastPeriod = plan.periodos[plan.periodos.length - 1];
      expect(lastPeriod.principalFinal).toBe(0);
      
      // Total payments should equal principal + interests
      const totalPagado = plan.periodos.reduce((sum, p) => sum + p.cuota, 0);
      expect(totalPagado).toBeGreaterThan(120000); // More than principal due to interest
    });

    test('handles deferred first payment', () => {
      const prestamo: Prestamo = {
        id: 'test',
        inmuebleId: 'prop1',
        nombre: 'Test Deferred',
        principalInicial: 100000,
        principalVivo: 100000,
        fechaFirma: '2024-08-10',
        plazoMesesTotal: 6,
        tipo: 'FIJO',
        tipoNominalAnualFijo: 0.036,
        diferirPrimeraCuotaMeses: 2, // Defer 2 months
        diaCargoMes: 10,
        cuentaCargoId: 'cuenta1',
        createdAt: '2024-08-10T00:00:00Z',
        updatedAt: '2024-08-10T00:00:00Z'
      };

      const plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
      
      // First payment should be 2 months after signing
      expect(plan.periodos[0].fechaCargo).toBe('2024-10-10');
    });

    test('handles interest-only periods', () => {
      const prestamo: Prestamo = {
        id: 'test',
        inmuebleId: 'prop1',
        nombre: 'Test Interest Only',
        principalInicial: 100000,
        principalVivo: 100000,
        fechaFirma: '2024-08-10',
        plazoMesesTotal: 6,
        tipo: 'FIJO',
        tipoNominalAnualFijo: 0.036,
        mesesSoloIntereses: 2, // First 2 months interest only
        diaCargoMes: 10,
        cuentaCargoId: 'cuenta1',
        createdAt: '2024-08-10T00:00:00Z',
        updatedAt: '2024-08-10T00:00:00Z'
      };

      const plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
      
      // First 2 periods should be interest-only
      expect(plan.periodos[0].esSoloIntereses).toBe(true);
      expect(plan.periodos[0].amortizacion).toBe(0);
      expect(plan.periodos[1].esSoloIntereses).toBe(true);
      expect(plan.periodos[1].amortizacion).toBe(0);
      
      // From 3rd period, should amortize principal
      expect(plan.periodos[2].esSoloIntereses).toBe(false);
      expect(plan.periodos[2].amortizacion).toBeGreaterThan(0);
    });

    test('handles prorated first period', () => {
      const prestamo: Prestamo = {
        id: 'test',
        inmuebleId: 'prop1',
        nombre: 'Test Prorated',
        principalInicial: 100000,
        principalVivo: 100000,
        fechaFirma: '2024-08-10',
        plazoMesesTotal: 3,
        tipo: 'FIJO',
        tipoNominalAnualFijo: 0.036,
        prorratearPrimerPeriodo: true,
        diferirPrimeraCuotaMeses: 1, // Defer to create days difference
        diaCargoMes: 10,
        cuentaCargoId: 'cuenta1',
        createdAt: '2024-08-10T00:00:00Z',
        updatedAt: '2024-08-10T00:00:00Z'
      };

      const plan = prestamosCalculationService.generatePaymentSchedule(prestamo);
      
      // First period should be prorated
      expect(plan.periodos[0].esProrrateado).toBe(true);
      expect(plan.periodos[0].diasDevengo).toBeDefined();
      expect(plan.periodos[0].diasDevengo).toBeGreaterThan(0);
    });
  });

  describe('simulateAmortization', () => {
    const basePrestamo: Prestamo = {
      id: 'test',
      inmuebleId: 'prop1',
      nombre: 'Test Amortization',
      principalInicial: 100000,
      principalVivo: 80000,
      fechaFirma: '2023-01-01',
      plazoMesesTotal: 240,
      tipo: 'FIJO',
      tipoNominalAnualFijo: 0.036,
      comisionAmortizacionParcial: 0.01,
      gastosFijosOperacion: 50,
      diaCargoMes: 10,
      cuentaCargoId: 'cuenta1',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    test('simulates REDUCIR_CUOTA correctly', () => {
      const simulation = prestamosCalculationService.simulateAmortization(
        basePrestamo,
        10000, // Amortize 10k
        '2024-06-01',
        'REDUCIR_CUOTA'
      );

      expect(simulation.modo).toBe('REDUCIR_CUOTA');
      expect(simulation.importeAmortizar).toBe(10000);
      expect(simulation.penalizacion).toBe(150); // 1% of 10k + 50 fixed
      expect(simulation.nuevaCuota).toBeDefined();
      expect(simulation.nuevaCuota).toBeGreaterThan(0);
      expect(simulation.interesesAhorrados).toBeGreaterThan(0);
    });

    test('simulates REDUCIR_PLAZO correctly', () => {
      const simulation = prestamosCalculationService.simulateAmortization(
        basePrestamo,
        15000,
        '2024-06-01',
        'REDUCIR_PLAZO'
      );

      expect(simulation.modo).toBe('REDUCIR_PLAZO');
      expect(simulation.nuevoplazo).toBeDefined();
      expect(simulation.nuevoplazo).toBeGreaterThan(0);
      expect(simulation.nuevaFechaFin).toBeDefined();
      expect(simulation.interesesAhorrados).toBeGreaterThan(0);
    });
  });
});