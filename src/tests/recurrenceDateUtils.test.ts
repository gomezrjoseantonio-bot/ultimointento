import { addMonthsClampedUTC, calculateNextRecurringDate, formatDateDDMMAAAA, toISODateLocal } from '../utils/recurrenceDateUtils';
import { rendimientosService } from '../services/rendimientosService';

describe('toISODateLocal · día de calendario sin desfase de zona horaria', () => {
  // El bug clásico: `new Date(2026, 0, 1).toISOString().slice(0,10)` en España
  // (UTC+1/+2) devuelve '2025-12-31' porque la medianoche local cae en el día
  // anterior en UTC. `toISODateLocal` usa componentes LOCALES → nunca se desfasa.
  it('el día 1 se conserva como día 1 (no retrocede al 31)', () => {
    expect(toISODateLocal(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
  it('el día 28 se conserva como día 28 (no retrocede al 25/27)', () => {
    expect(toISODateLocal(new Date(2026, 6, 28))).toBe('2026-07-28');
  });
  it('respeta el día 31 en meses de 31 días', () => {
    expect(toISODateLocal(new Date(2026, 0, 31))).toBe('2026-01-31');
  });
  it('fecha inválida → cadena vacía', () => {
    expect(toISODateLocal(new Date(NaN))).toBe('');
  });
});

describe('recurrenceDateUtils', () => {
  it('clamps monthly recurrence to previous valid day when month has fewer days', () => {
    const next = calculateNextRecurringDate('2026-01-30T00:00:00.000Z', 'mensual', 30);
    expect(next.slice(0, 10)).toBe('2026-02-28');
  });

  it('keeps requested day when target month contains it', () => {
    const next = calculateNextRecurringDate('2026-02-28T00:00:00.000Z', 'mensual', 30);
    expect(next.slice(0, 10)).toBe('2026-03-30');
  });

  it('supports leap year correctly for day 31', () => {
    const next = addMonthsClampedUTC('2024-01-31T00:00:00.000Z', 1, 31);
    expect(next.toISOString().slice(0, 10)).toBe('2024-02-29');
  });

  it('formats dates as ddmmaaaa', () => {
    expect(formatDateDDMMAAAA('2026-03-02T00:00:00.000Z')).toBe('02032026');
  });
});

describe('RendimientosService date rules', () => {
  it('uses day-of-charge preference for the next payment date', () => {
    const next = rendimientosService.calcularProximaFecha('2026-01-30T00:00:00.000Z', 'mensual', 30);
    expect(next.slice(0, 10)).toBe('2026-02-28');
  });

  it('never moves payment date after the configured day due to overflow', () => {
    const next = rendimientosService.calcularProximaFecha('2026-01-31T00:00:00.000Z', 'mensual', 31);
    expect(next.slice(0, 10)).toBe('2026-02-28');
  });
});
