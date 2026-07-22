// Tests · rentasContratosEngine (C-PROY-5 · Fase B3)
// Ciclo de vida de contratos: vencen · se renuevan (con vacancia) · indexan.

import {
  buildRentaPorMes,
  contratosSimuladosParaEjercicio,
  tasaIndexacionContrato,
} from '../rentasContratosEngine';
import type { Contract } from '../../../../../../services/db';
import type { SupuestosProyeccion } from '../../../../../../types/supuestosProyeccion';
import { SUPUESTOS_PROYECCION_DEFAULTS } from '../../../../../../types/supuestosProyeccion';

const START_YEAR = 2026;
const YEARS = 20;
const aliasMap = new Map<number, string>([[7, 'Piso Sol']]);

const SUPUESTOS: SupuestosProyeccion = {
  ...SUPUESTOS_PROYECCION_DEFAULTS,
  subidaRentasPct: 2.5,
  vacanciaPct: 5,
};

function contrato(overrides: Record<string, unknown> = {}): Contract {
  return {
    id: 1,
    inmuebleId: 7,
    inquilino: { nombre: 'Ana', apellidos: 'Pérez' },
    fechaInicio: '2025-01-01',
    fechaFin: '2030-12-31',
    rentaMensual: 1000,
    indexacion: 'ipc',
    estadoContrato: 'activo',
    ...overrides,
  } as unknown as Contract;
}

describe('tasaIndexacionContrato', () => {
  it("indexacion 'none' → 0 · explícito del contrato", () => {
    expect(tasaIndexacionContrato(contrato({ indexacion: 'none' }), SUPUESTOS)).toBe(0);
  });

  it("indexacion 'ipc' → global de B1", () => {
    expect(tasaIndexacionContrato(contrato(), SUPUESTOS)).toBe(2.5);
  });

  it("legacy rentUpdate 'fixed-percentage' → tasa propia del contrato", () => {
    const c = contrato({ rentUpdate: { type: 'fixed-percentage', ipcPercentage: 4 } });
    expect(tasaIndexacionContrato(c, SUPUESTOS)).toBe(4);
  });
});

describe('buildRentaPorMes · ciclo de vida', () => {
  it('indexa año a año con la tasa global · sin vacancia mientras el contrato firmado vive', () => {
    const map = buildRentaPorMes([contrato()], SUPUESTOS, aliasMap, START_YEAR, YEARS);

    expect(map.get('2026-03')!.total).toBeCloseTo(1000, 6);
    expect(map.get('2027-03')!.total).toBeCloseTo(1025, 6);
    expect(map.get('2028-03')!.total).toBeCloseTo(1050.625, 6);
    // 2030 aún bajo contrato (fin 2030-12-31) · sin descuento de vacancia
    expect(map.get('2030-12')!.total).toBeCloseTo(1000 * Math.pow(1.025, 4), 6);
  });

  it('al vencer se renueva indexado CON vacancia · la renta no muere (fallo del motor viejo) ni queda plana', () => {
    const map = buildRentaPorMes([contrato()], SUPUESTOS, aliasMap, START_YEAR, YEARS);

    // 2031-01: primer mes de renovación → indexado × (1 − 5 %)
    const esperado2031 = 1000 * Math.pow(1.025, 5) * 0.95;
    expect(map.get('2031-01')!.total).toBeCloseTo(esperado2031, 6);
    // El drill-down lo declara
    expect(map.get('2031-01')!.drillDown[0].concepto).toBe('Ana Pérez (renovación estimada)');
    // Sigue creciendo compuesto hasta el final del horizonte
    expect(map.get('2045-12')!.total).toBeCloseTo(1000 * Math.pow(1.025, 19) * 0.95, 6);
  });

  it("indexacion 'none' → renta plana bajo contrato y también en renovación (sin subida, con vacancia)", () => {
    const map = buildRentaPorMes(
      [contrato({ indexacion: 'none' })],
      SUPUESTOS,
      aliasMap,
      START_YEAR,
      YEARS,
    );
    expect(map.get('2029-06')!.total).toBeCloseTo(1000, 6);
    expect(map.get('2031-06')!.total).toBeCloseTo(950, 6); // renovación · solo vacancia
  });

  it('contrato futuro no genera renta antes de fechaInicio · rescindido queda fuera', () => {
    const futuro = contrato({ id: 2, fechaInicio: '2028-07-01', fechaFin: '2033-06-30' });
    const rescindido = contrato({ id: 3, estadoContrato: 'rescindido' });
    const map = buildRentaPorMes([futuro, rescindido], SUPUESTOS, aliasMap, START_YEAR, YEARS);

    expect(map.get('2028-06')).toBeUndefined();
    // 2028 = yearIndex 2 → indexado (simplificación año-natural declarada)
    expect(map.get('2028-07')!.total).toBeCloseTo(1000 * Math.pow(1.025, 2), 6);
  });
});

describe('contratosSimuladosParaEjercicio · coherencia fiscal (B0.4)', () => {
  it('extiende fechaFin al fin del ejercicio e indexa la renta · SIN vacancia (fiscal conservador)', () => {
    const sim = contratosSimuladosParaEjercicio([contrato()], SUPUESTOS, 2033, START_YEAR);

    expect(sim).toHaveLength(1);
    expect(sim[0].fechaFin).toBe('2033-12-31'); // renovado (fin original 2030)
    expect(sim[0].rentaMensual).toBeCloseTo(1000 * Math.pow(1.025, 7), 6); // sin ×0.95
  });

  it('un contrato aún vigente en el ejercicio conserva su fechaFin real', () => {
    const sim = contratosSimuladosParaEjercicio([contrato()], SUPUESTOS, 2028, START_YEAR);
    expect(sim[0].fechaFin).toBe('2030-12-31');
  });

  it('excluye rescindidos/finalizados y contratos que empiezan después del ejercicio', () => {
    const sim = contratosSimuladosParaEjercicio(
      [
        contrato({ id: 3, estadoContrato: 'finalizado' }),
        contrato({ id: 4, fechaInicio: '2035-01-01', fechaFin: '2040-12-31' }),
      ],
      SUPUESTOS,
      2030,
      START_YEAR,
    );
    expect(sim).toHaveLength(0);
  });
});
