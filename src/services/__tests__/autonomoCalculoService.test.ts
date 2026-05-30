// ============================================================================
// Tests · autonomoCalculoService (ÚNICA FUENTE DE VERDAD · decisión F7)
// ============================================================================
//
//   neto = ingresos − cuotaRETA − gastosDeducibles − retenciónIRPF
//
// Incluye el patrón del caso Jose · autónomo con cuota RETA y sin ingreso en
// mayo → neto negativo (−cuota), que el panel resta a la nómina.
// ============================================================================

import type { Autonomo } from '../../types/personal';
import {
  calcularNetoMesAutonomo,
  calcularNetoAnualAutonomo,
} from '../autonomoCalculoService';

function buildAutonomo(overrides: Partial<Autonomo> = {}): Autonomo {
  return {
    id: 1,
    personalDataId: 1,
    nombre: 'Actividad consultoría',
    titular: 'yo',
    ingresosFacturados: [],
    gastosDeducibles: [],
    fuentesIngreso: [],
    gastosRecurrentesActividad: [],
    cuotaAutonomos: 315,
    irpfRetencionPorcentaje: 15,
    cuentaCobro: 1,
    cuentaPago: 1,
    reglaCobroDia: { tipo: 'fijo', dia: 1 },
    reglaPagoDia: { tipo: 'fijo', dia: 1 },
    activo: true,
    fechaCreacion: '2020-01-01T00:00:00.000Z',
    fechaActualizacion: '2020-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const AÑO = 2026;

describe('autonomoCalculoService', () => {
  test('ingreso mensual fijo · neto = ingreso − cuota − gastos − retención', () => {
    const autonomo = buildAutonomo({
      fuentesIngreso: [
        {
          id: 'f1',
          nombre: 'Cliente A',
          importeEstimado: 3000,
          meses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          aplIrpf: true,
        },
      ],
      gastosRecurrentesActividad: [
        { id: 'g1', descripcion: 'Software', importe: 100, categoria: 'otros' },
      ],
      cuotaAutonomos: 315,
      irpfRetencionPorcentaje: 15,
    });
    const { netoMes, desglose } = calcularNetoMesAutonomo(autonomo, 5, AÑO);
    expect(desglose.ingresoMes).toBe(3000);
    expect(desglose.cuotaRETA).toBe(315);
    expect(desglose.gastosDeducibles).toBe(100);
    expect(desglose.retencionIRPF).toBeCloseTo(450, 2); // 3000 × 15%
    expect(netoMes).toBeCloseTo(3000 - 315 - 100 - 450, 2); // 2135
  });

  test('caso Jose · sin ingreso en mayo → neto = −cuota (−315 €)', () => {
    const autonomo = buildAutonomo({
      fuentesIngreso: [
        { id: 'f1', nombre: 'Proyecto puntual', importeEstimado: 5000, meses: [2], aplIrpf: true },
      ],
      gastosRecurrentesActividad: [],
      cuotaAutonomos: 315,
    });
    expect(calcularNetoMesAutonomo(autonomo, 5, AÑO).netoMes).toBeCloseTo(-315, 2);
    // En febrero sí hay ingreso.
    expect(calcularNetoMesAutonomo(autonomo, 2, AÑO).desglose.ingresoMes).toBe(5000);
  });

  test('ingreso irregular · sólo cuenta en sus meses activos', () => {
    const autonomo = buildAutonomo({
      fuentesIngreso: [
        { id: 'f1', nombre: 'Estacional', importeEstimado: 2000, meses: [6, 7, 8], aplIrpf: false },
      ],
      cuotaAutonomos: 200,
    });
    expect(calcularNetoMesAutonomo(autonomo, 7, AÑO).desglose.ingresoMes).toBe(2000);
    expect(calcularNetoMesAutonomo(autonomo, 1, AÑO).desglose.ingresoMes).toBe(0);
    // Sin aplIrpf no hay retención.
    expect(calcularNetoMesAutonomo(autonomo, 7, AÑO).desglose.retencionIRPF).toBe(0);
  });

  test('gastos > ingresos → neto negativo', () => {
    const autonomo = buildAutonomo({
      fuentesIngreso: [
        { id: 'f1', nombre: 'X', importeEstimado: 500, meses: [], aplIrpf: false },
      ],
      gastosRecurrentesActividad: [
        { id: 'g1', descripcion: 'Alquiler local', importe: 1200, categoria: 'otros' },
      ],
      cuotaAutonomos: 300,
    });
    const { netoMes } = calcularNetoMesAutonomo(autonomo, 5, AÑO);
    expect(netoMes).toBe(500 - 300 - 1200); // −1000
  });

  test('neto anual = suma de los 12 meses reales', () => {
    const autonomo = buildAutonomo({
      fuentesIngreso: [
        { id: 'f1', nombre: 'Mensual', importeEstimado: 3000, meses: [], aplIrpf: true },
      ],
      cuotaAutonomos: 315,
      irpfRetencionPorcentaje: 15,
    });
    const anual = calcularNetoAnualAutonomo(autonomo, AÑO);
    expect(anual.ingresosAnuales).toBe(3000 * 12);
    expect(anual.totalRETA).toBe(315 * 12);
    expect(anual.totalRetencion).toBeCloseTo(3000 * 0.15 * 12, 2);
    const sumaMeses = anual.porMes.reduce((s, m) => s + m.neto, 0);
    expect(anual.netoAnual).toBeCloseTo(sumaMeses, 6);
  });

  test('fallback legacy · usa ingresosFacturados si no hay fuentesIngreso', () => {
    const autonomo = buildAutonomo({
      fuentesIngreso: [],
      ingresosFacturados: [
        { id: 'i1', descripcion: 'Factura mayo', importe: 1000, conIva: true, fecha: '2026-05-15' },
      ],
      cuotaAutonomos: 300,
      irpfRetencionPorcentaje: 15,
    });
    const { desglose } = calcularNetoMesAutonomo(autonomo, 5, AÑO);
    expect(desglose.ingresoMes).toBe(1000);
    expect(desglose.retencionIRPF).toBeCloseTo(150, 2);
    expect(calcularNetoMesAutonomo(autonomo, 4, AÑO).desglose.ingresoMes).toBe(0);
  });

  test('mes fuera de rango → neto 0', () => {
    const autonomo = buildAutonomo();
    expect(calcularNetoMesAutonomo(autonomo, 0, AÑO).netoMes).toBe(0);
    expect(calcularNetoMesAutonomo(autonomo, 13, AÑO).netoMes).toBe(0);
  });
});
