// Test Enhanced Amortization Schedule Generation
// Tests the automatic generation and persistence of amortization schedules

import { prestamosService } from '../services/prestamosService';
import { Prestamo } from '../types/prestamos';

describe('Enhanced Amortization Schedule Generation', () => {
  
  const mockLoanData: Omit<Prestamo, 'id' | 'createdAt' | 'updatedAt'> = {
    inmuebleId: 'property_1',
    nombre: 'Test Loan',
    principalInicial: 200000,
    principalVivo: 200000,
    fechaFirma: '2024-01-01',
    plazoMesesTotal: 360, // 30 years
    tipo: 'FIJO',
    tipoNominalAnualFijo: 0.032, // 3.2%
    diaCargoMes: 15,
    cuentaCargoId: 'account_1'
  };

  beforeEach(() => {
    // Clear any cached plans
    prestamosService.clearCache();
  });

  describe('Automatic Schedule Generation on Loan Creation', () => {
    it('should automatically generate amortization schedule when creating loan', async () => {
      // Create loan
      const loan = await prestamosService.createPrestamo(mockLoanData);
      expect(loan).toBeDefined();
      expect(loan.id).toBeDefined();

      // Verify amortization schedule was auto-generated
      const paymentPlan = await prestamosService.getPaymentPlan(loan.id);
      expect(paymentPlan).toBeDefined();
      expect(paymentPlan!.periodos).toHaveLength(360);
      expect(paymentPlan!.resumen.totalIntereses).toBeGreaterThan(0);
      expect(paymentPlan!.resumen.fechaFinalizacion).toBeDefined();
    });

    it('should handle different loan types in auto-generation', async () => {
      const variableLoanData = {
        ...mockLoanData,
        tipo: 'VARIABLE' as const,
        tipoNominalAnualFijo: undefined,
        indice: 'EURIBOR' as const,
        valorIndiceActual: 0.025,
        diferencial: 0.012
      };

      const loan = await prestamosService.createPrestamo(variableLoanData);
      const paymentPlan = await prestamosService.getPaymentPlan(loan.id);
      
      expect(paymentPlan).toBeDefined();
      expect(paymentPlan!.periodos).toHaveLength(360);
    });
  });

  describe('Schedule Regeneration on Parameter Changes', () => {
    it('should regenerate schedule when critical parameters change', async () => {
      // Create initial loan
      const loan = await prestamosService.createPrestamo(mockLoanData);
      const initialPlan = await prestamosService.getPaymentPlan(loan.id);
      const initialInterest = initialPlan!.resumen.totalIntereses;

      // Update interest rate (critical parameter)
      await prestamosService.updatePrestamo(loan.id, {
        tipoNominalAnualFijo: 0.040 // Change from 3.2% to 4.0%
      });

      // Get updated plan
      const updatedPlan = await prestamosService.getPaymentPlan(loan.id);
      const updatedInterest = updatedPlan!.resumen.totalIntereses;

      // Should have different total interest due to rate change
      expect(updatedInterest).toBeGreaterThan(initialInterest);
      expect(updatedPlan!.periodos).toHaveLength(360);
    });

    it('should not regenerate schedule for non-critical changes', async () => {
      const loan = await prestamosService.createPrestamo(mockLoanData);
      const initialPlan = await prestamosService.getPaymentPlan(loan.id);
      const initialGenerationTime = initialPlan!.fechaGeneracion;

      // Update non-critical parameter
      await prestamosService.updatePrestamo(loan.id, {
        nombre: 'Updated Test Loan'
      });

      // Plan should be cleared but not automatically regenerated
      const planAfterUpdate = await prestamosService.getPaymentPlan(loan.id);
      
      // Should still have valid plan (new generation time indicates fresh calculation)
      expect(planAfterUpdate).toBeDefined();
      expect(planAfterUpdate!.fechaGeneracion).not.toBe(initialGenerationTime);
    });
  });

  describe('Enhanced Payment Plan Access', () => {
    it('should provide amortization summary', async () => {
      const loan = await prestamosService.createPrestamo(mockLoanData);
      const summary = await prestamosService.getAmortizationSummary(loan.id);

      expect(summary).toBeDefined();
      expect(summary!.totalPayments).toBe(360);
      expect(summary!.totalInterest).toBeGreaterThan(0);
      expect(summary!.monthlyPayment).toBeGreaterThan(0);
      expect(summary!.finalPaymentDate).toBeDefined();
      expect(summary!.principalRemaining).toBeCloseTo(0, 2); // Should be near 0 at end
    });

    it('should cache recent plans efficiently', async () => {
      const loan = await prestamosService.createPrestamo(mockLoanData);
      
      // First access - should generate
      const plan1 = await prestamosService.getPaymentPlan(loan.id);
      const generation1 = plan1!.fechaGeneracion;
      
      // Second access within cache period - should use cached
      const plan2 = await prestamosService.getPaymentPlan(loan.id);
      const generation2 = plan2!.fechaGeneracion;
      
      expect(generation2).toBe(generation1); // Same generation time = cached
    });

    it('should allow forced regeneration', async () => {
      const loan = await prestamosService.createPrestamo(mockLoanData);
      const initialPlan = await prestamosService.getPaymentPlan(loan.id);
      
      // Force regeneration
      const regeneratedPlan = await prestamosService.regeneratePaymentPlan(loan.id);
      
      expect(regeneratedPlan).toBeDefined();
      expect(regeneratedPlan!.fechaGeneracion).not.toBe(initialPlan!.fechaGeneracion);
      expect(regeneratedPlan!.periodos).toHaveLength(360);
    });
  });

  describe('Schedule Persistence and Logging', () => {
    it('should log schedule generation details', async () => {
      // Mock console.log to capture logs
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const loan = await prestamosService.createPrestamo(mockLoanData);
      await prestamosService.getPaymentPlan(loan.id);
      
      // Verify logging occurred
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PRESTAMOS] Auto-generating amortization schedule')
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('total interest: €')
      );
      
      logSpy.mockRestore();
    });

    it('should handle generation errors gracefully', async () => {
      const invalidLoanData = {
        ...mockLoanData,
        principalInicial: 0, // Invalid principal
        principalVivo: 0
      };

      // Should not fail loan creation even if schedule generation fails
      const loan = await prestamosService.createPrestamo(invalidLoanData);
      expect(loan).toBeDefined();
      expect(loan.id).toBeDefined();
    });
  });
});