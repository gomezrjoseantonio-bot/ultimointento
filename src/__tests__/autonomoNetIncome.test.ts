/**
 * Tests for Autónomo net income calculation.
 * Validates that:
 * - calculateEstimatedAnnual returns correct rendimientoNeto (gross billing - expenses)
 * - getMonthlyDistribution returns correct neto per month
 * These are the domain values used by PersonalResumenView to show net income
 * in "Fuentes de Ingresos" and the KPI "Ingresos Anuales".
 */

import { autonomoService } from '../services/autonomoService';
import { Autonomo } from '../types/personal';

const BASE_AUTONOMO: Autonomo = {
  id: 1,
  personalDataId: 1,
  nombre: 'Test Autónomo',
  titular: 'Yo',
  ingresosFacturados: [],
  gastosDeducibles: [],
  fuentesIngreso: [],
  gastosRecurrentesActividad: [],
  cuotaAutonomos: 300,
  cuentaCobro: 1,
  cuentaPago: 1,
  reglaCobroDia: { tipo: 'fijo', dia: 1 },
  reglaPagoDia: { tipo: 'fijo', dia: 1 },
  activo: true,
  fechaCreacion: '2024-01-01T00:00:00.000Z',
  fechaActualizacion: '2024-01-01T00:00:00.000Z',
};

describe('Autónomo net income - calculateEstimatedAnnual', () => {
  it('returns rendimientoNeto = facturacionBruta - totalGastos with monthly sources', () => {
    const autonomo: Autonomo = {
      ...BASE_AUTONOMO,
      fuentesIngreso: [
        { id: '1', nombre: 'Servicios', importeEstimado: 2000, meses: [1,2,3,4,5,6,7,8,9,10,11,12] },
      ],
      gastosRecurrentesActividad: [
        { id: '1', descripcion: 'Software', importe: 100, categoria: 'software' },
      ],
      cuotaAutonomos: 300,
    };

    const result = autonomoService.calculateEstimatedAnnual(autonomo);

    // facturacionBruta = 2000 * 12 = 24000
    expect(result.facturacionBruta).toBe(24000);
    // totalGastos = 300 * 12 (cuota) + 100 * 12 (recurrente) = 3600 + 1200 = 4800
    expect(result.totalGastos).toBe(4800);
    // rendimientoNeto = 24000 - 4800 = 19200
    expect(result.rendimientoNeto).toBe(19200);
  });

  it('returns rendimientoNeto = facturacionBruta - totalGastos when only cuota (no recurrentes)', () => {
    const autonomo: Autonomo = {
      ...BASE_AUTONOMO,
      fuentesIngreso: [
        { id: '1', nombre: 'Consultoría', importeEstimado: 3000, meses: [1,2,3,4,5,6,7,8,9,10,11,12] },
      ],
      gastosRecurrentesActividad: [],
      cuotaAutonomos: 350,
    };

    const result = autonomoService.calculateEstimatedAnnual(autonomo);

    expect(result.facturacionBruta).toBe(36000);
    expect(result.totalGastos).toBe(4200); // 350 * 12
    expect(result.rendimientoNeto).toBe(31800);
  });

  it('returns negative rendimientoNeto when expenses exceed income', () => {
    const autonomo: Autonomo = {
      ...BASE_AUTONOMO,
      fuentesIngreso: [
        { id: '1', nombre: 'Venta', importeEstimado: 100, meses: [1,2,3,4,5,6,7,8,9,10,11,12] },
      ],
      gastosRecurrentesActividad: [],
      cuotaAutonomos: 300,
    };

    const result = autonomoService.calculateEstimatedAnnual(autonomo);

    expect(result.facturacionBruta).toBe(1200);
    expect(result.totalGastos).toBe(3600); // 300 * 12
    expect(result.rendimientoNeto).toBe(-2400);
  });


  it('aggregates multiple active activities and counts the shared cuota only once', () => {
    const actividadPrincipal: Autonomo = {
      ...BASE_AUTONOMO,
      id: 1,
      nombre: 'Consultoría',
      descripcionActividad: 'Consultoría',
      cuotaAutonomos: 300,
      cuotaAutonomosCompartida: true,
      fuentesIngreso: [
        { id: '1', nombre: 'Clientes recurrentes', importeEstimado: 2000, meses: [1,2,3,4,5,6,7,8,9,10,11,12] },
      ],
      gastosRecurrentesActividad: [
        { id: '1', descripcion: 'Software', importe: 100, categoria: 'software' },
      ],
    };

    const actividadSecundaria: Autonomo = {
      ...BASE_AUTONOMO,
      id: 2,
      nombre: 'Formación',
      descripcionActividad: 'Formación',
      cuotaAutonomos: 0,
      cuotaAutonomosCompartida: false,
      fuentesIngreso: [
        { id: '2', nombre: 'Cursos', importeEstimado: 500, meses: [1,2,3,4,5,6,7,8,9,10,11,12] },
      ],
      gastosRecurrentesActividad: [
        { id: '2', descripcion: 'Material', importe: 50, categoria: 'material' },
      ],
    };

    const result = autonomoService.calculateEstimatedAnnualForAutonomos([actividadPrincipal, actividadSecundaria]);

    expect(result.facturacionBruta).toBe(30000);
    expect(result.totalGastos).toBe(5400);
    expect(result.rendimientoNeto).toBe(24600);
  });
  it('handles seasonal income sources (only some months)', () => {
    const autonomo: Autonomo = {
      ...BASE_AUTONOMO,
      fuentesIngreso: [
        // Only active in 6 months (bimestral)
        { id: '1', nombre: 'Verano', importeEstimado: 5000, meses: [6, 7, 8, 9, 10, 11] },
      ],
      gastosRecurrentesActividad: [],
      cuotaAutonomos: 200,
    };

    const result = autonomoService.calculateEstimatedAnnual(autonomo);

    expect(result.facturacionBruta).toBe(30000); // 5000 * 6
    expect(result.totalGastos).toBe(2400); // 200 * 12
    expect(result.rendimientoNeto).toBe(27600);
  });
});

describe('Autónomo net income - getMonthlyDistribution', () => {
  it('returns neto = ingresos - gastos for each month', () => {
    const autonomo: Autonomo = {
      ...BASE_AUTONOMO,
      fuentesIngreso: [
        { id: '1', nombre: 'Servicios', importeEstimado: 2000, meses: [1,2,3,4,5,6,7,8,9,10,11,12] },
      ],
      gastosRecurrentesActividad: [
        { id: '1', descripcion: 'Software', importe: 100, categoria: 'software' },
      ],
      cuotaAutonomos: 300,
    };

    const distribution = autonomoService.getMonthlyDistribution(autonomo);

    expect(distribution).toHaveLength(12);
    for (const entry of distribution) {
      // ingresos = 2000, gastos = 100 (recurrente) + 300 (cuota) = 400
      expect(entry.ingresos).toBe(2000);
      expect(entry.gastos).toBe(400);
      expect(entry.neto).toBe(1600); // net = ingresos - gastos
    }
  });

  it('returns neto = ingresos - gastos for months with seasonal income', () => {
    const autonomo: Autonomo = {
      ...BASE_AUTONOMO,
      fuentesIngreso: [
        { id: '1', nombre: 'Temporada', importeEstimado: 3000, meses: [6, 7, 8] },
      ],
      gastosRecurrentesActividad: [],
      cuotaAutonomos: 250,
    };

    const distribution = autonomoService.getMonthlyDistribution(autonomo);

    expect(distribution).toHaveLength(12);
    // Month 6 (index 5): income active
    expect(distribution[5].ingresos).toBe(3000);
    expect(distribution[5].gastos).toBe(250);
    expect(distribution[5].neto).toBe(2750);

    // Month 1 (index 0): income inactive
    expect(distribution[0].ingresos).toBe(0);
    expect(distribution[0].gastos).toBe(250); // cuota still applies
    expect(distribution[0].neto).toBe(-250);
  });


  it('aggregates monthly distributions from multiple active activities and applies the cuota once', () => {
    const actividadPrincipal: Autonomo = {
      ...BASE_AUTONOMO,
      id: 1,
      nombre: 'Consultoría',
      cuotaAutonomos: 300,
      cuotaAutonomosCompartida: true,
      fuentesIngreso: [
        { id: '1', nombre: 'Servicios', importeEstimado: 2000, meses: [1,2,3,4,5,6,7,8,9,10,11,12] },
      ],
      gastosRecurrentesActividad: [
        { id: '1', descripcion: 'Software', importe: 100, categoria: 'software' },
      ],
    };

    const actividadSecundaria: Autonomo = {
      ...BASE_AUTONOMO,
      id: 2,
      nombre: 'Formación',
      cuotaAutonomos: 0,
      cuotaAutonomosCompartida: false,
      fuentesIngreso: [
        { id: '2', nombre: 'Cursos', importeEstimado: 500, meses: [6, 7, 8] },
      ],
      gastosRecurrentesActividad: [
        { id: '2', descripcion: 'Material', importe: 50, categoria: 'material', meses: [6, 7, 8] },
      ],
    };

    const distribution = autonomoService.getMonthlyDistributionForAutonomos([actividadPrincipal, actividadSecundaria]);

    expect(distribution[0]).toEqual({ mes: 1, ingresos: 2000, gastos: 400, neto: 1600 });
    expect(distribution[5]).toEqual({ mes: 6, ingresos: 2500, gastos: 450, neto: 2050 });
  });
  it('net annual sum matches rendimientoNeto from calculateEstimatedAnnual', () => {
    const autonomo: Autonomo = {
      ...BASE_AUTONOMO,
      fuentesIngreso: [
        { id: '1', nombre: 'Consultoría', importeEstimado: 1500, meses: [1,2,3,4,5,6,7,8,9,10,11,12] },
      ],
      gastosRecurrentesActividad: [
        { id: '1', descripcion: 'Oficina', importe: 200, categoria: 'oficina' },
      ],
      cuotaAutonomos: 300,
    };

    const annual = autonomoService.calculateEstimatedAnnual(autonomo);
    const monthly = autonomoService.getMonthlyDistribution(autonomo);
    const monthlyNetoSum = monthly.reduce((sum, m) => sum + m.neto, 0);

    expect(monthlyNetoSum).toBe(annual.rendimientoNeto);
  });
});
