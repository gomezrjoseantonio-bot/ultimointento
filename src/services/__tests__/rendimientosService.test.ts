// Tests for RendimientosService - calculation logic

import { RendimientosService } from '../rendimientosService';
import { PagoRendimiento } from '../../types/inversiones-extended';

describe('RendimientosService', () => {
  let service: RendimientosService;

  beforeEach(() => {
    service = new RendimientosService();
  });

  describe('calcularImporte', () => {
    test('calculates monthly interest correctly', () => {
      // 90,000€ at 10% annual, monthly
      // Expected: 90000 * 0.10 / 12 = 750
      const result = service.calcularImporte(90000, 10, 'mensual');
      expect(result).toBeCloseTo(750, 2);
    });

    test('calculates quarterly interest correctly', () => {
      // 10,000€ at 4% annual, quarterly
      // Expected: 10000 * 0.04 / 4 = 100
      const result = service.calcularImporte(10000, 4, 'trimestral');
      expect(result).toBeCloseTo(100, 2);
    });

    test('calculates semestral interest correctly', () => {
      // 50,000€ at 6% annual, semestral
      // Expected: 50000 * 0.06 / 2 = 1500
      const result = service.calcularImporte(50000, 6, 'semestral');
      expect(result).toBeCloseTo(1500, 2);
    });

    test('calculates annual interest correctly', () => {
      // 100,000€ at 5% annual, annual
      // Expected: 100000 * 0.05 / 1 = 5000
      const result = service.calcularImporte(100000, 5, 'anual');
      expect(result).toBeCloseTo(5000, 2);
    });

    test('returns 0 for 0 capital', () => {
      expect(service.calcularImporte(0, 10, 'mensual')).toBe(0);
    });

    test('returns 0 for 0 interest rate', () => {
      expect(service.calcularImporte(100000, 0, 'mensual')).toBe(0);
    });

    test('Smartflip example: 90000€ at 10% monthly = 750€ bruto, 607.50€ neto after IRPF 19%', () => {
      const bruto = service.calcularImporte(90000, 10, 'mensual');
      const retencion = bruto * 0.19;
      const neto = bruto - retencion;
      expect(bruto).toBeCloseTo(750, 2);
      expect(retencion).toBeCloseTo(142.5, 2);
      expect(neto).toBeCloseTo(607.5, 2);
    });
  });

  describe('calcularProximaFecha', () => {
    test('adds one month for mensual frequency', () => {
      const base = '2024-01-15T00:00:00.000Z';
      const result = service.calcularProximaFecha(base, 'mensual');
      const fecha = new Date(result);
      expect(fecha.getUTCMonth()).toBe(1); // February (0-indexed)
    });

    test('adds three months for trimestral frequency', () => {
      const base = '2024-01-01T00:00:00.000Z';
      const result = service.calcularProximaFecha(base, 'trimestral');
      const fecha = new Date(result);
      expect(fecha.getUTCMonth()).toBe(3); // April
    });

    test('adds six months for semestral frequency', () => {
      const base = '2024-01-01T00:00:00.000Z';
      const result = service.calcularProximaFecha(base, 'semestral');
      const fecha = new Date(result);
      expect(fecha.getUTCMonth()).toBe(6); // July
    });

    test('adds one year for anual frequency', () => {
      const base = '2024-01-01T00:00:00.000Z';
      const result = service.calcularProximaFecha(base, 'anual');
      const fecha = new Date(result);
      expect(fecha.getUTCFullYear()).toBe(2025);
    });
  });

  describe('getUltimoPago', () => {
    test('returns null for empty array', () => {
      expect(service.getUltimoPago([])).toBeNull();
    });

    test('returns most recent payment', () => {
      const pagos: PagoRendimiento[] = [
        { id: 1, fecha_pago: '2024-01-01T00:00:00.000Z', importe_bruto: 100, retencion_fiscal: 19, importe_neto: 81, estado: 'pagado' },
        { id: 2, fecha_pago: '2024-03-01T00:00:00.000Z', importe_bruto: 100, retencion_fiscal: 19, importe_neto: 81, estado: 'pagado' },
        { id: 3, fecha_pago: '2024-02-01T00:00:00.000Z', importe_bruto: 100, retencion_fiscal: 19, importe_neto: 81, estado: 'pagado' },
      ];
      const result = service.getUltimoPago(pagos);
      expect(result?.id).toBe(2);
    });
  });

  describe('IRPF calculation', () => {
    test('IRPF is 19% of gross amount', () => {
      const bruto = service.calcularImporte(90000, 10, 'mensual'); // 750
      const irpf = bruto * 0.19;
      const neto = bruto - irpf;
      
      expect(irpf / bruto).toBeCloseTo(0.19, 5);
      expect(neto).toBeCloseTo(bruto * 0.81, 5);
    });
  });
});
