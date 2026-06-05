import { ingresosPorAnio, proyeccionAnual, esRentaConfirmada } from '../ingresosAnualesService';
import type { TreasuryEvent } from '../../../../services/db';

const ev = (over: Partial<TreasuryEvent>): TreasuryEvent =>
  ({
    type: 'income',
    amount: 1000,
    predictedDate: '2025-03-10',
    description: 'Renta',
    sourceType: 'contract',
    status: 'confirmed',
    año: 2025,
    mes: 3,
    ...over,
  }) as TreasuryEvent;

describe('esRentaConfirmada', () => {
  it('solo income · de contrato · confirmado/ejecutado', () => {
    expect(esRentaConfirmada(ev({}))).toBe(true);
    expect(esRentaConfirmada(ev({ status: 'executed' }))).toBe(true);
    expect(esRentaConfirmada(ev({ status: 'predicted' }))).toBe(false);
    expect(esRentaConfirmada(ev({ type: 'expense' }))).toBe(false);
    expect(esRentaConfirmada(ev({ sourceType: 'manual' }))).toBe(false);
  });
});

describe('ingresosPorAnio', () => {
  it('agrupa por año y mes · ignora previsiones y gastos', () => {
    const events = [
      ev({ año: 2025, mes: 1, amount: 500 }),
      ev({ año: 2025, mes: 1, amount: 300 }),
      ev({ año: 2025, mes: 6, amount: 800 }),
      ev({ año: 2026, mes: 2, amount: 900 }),
      ev({ status: 'predicted', año: 2025, mes: 2, amount: 9999 }), // ignorado
      ev({ type: 'expense', año: 2025, mes: 3, amount: 9999 }), // ignorado
    ];
    const [s25, s26] = ingresosPorAnio(events, [2025, 2026]);
    expect(s25.mensual[0]).toBe(800); // ene
    expect(s25.mensual[5]).toBe(800); // jun
    expect(s25.total).toBe(1600);
    expect(s26.mensual[1]).toBe(900); // feb
    expect(s26.total).toBe(900);
  });
});

describe('proyeccionAnual', () => {
  it('anualiza el run-rate del año actual vs total del anterior', () => {
    // 2025 total 1200 · 2026 lleva 300 en 3 meses (run-rate 100/mes → 1200/año → +0%)
    const anterior = { anio: 2025, mensual: new Array(12).fill(100), total: 1200 };
    const actual = { anio: 2026, mensual: [100, 100, 100, ...new Array(9).fill(0)], total: 300 };
    const p = proyeccionAnual(actual, anterior, 2); // mes actual = marzo (índice 2)
    expect(p.pct).toBe(0);
    expect(p.hayDatos).toBe(true);
  });

  it('sin datos del año anterior → pct null', () => {
    const actual = { anio: 2026, mensual: [100, ...new Array(11).fill(0)], total: 100 };
    const p = proyeccionAnual(actual, undefined, 0);
    expect(p.pct).toBeNull();
  });
});
