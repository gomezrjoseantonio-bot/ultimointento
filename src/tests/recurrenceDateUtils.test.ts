import { addMonthsClampedUTC, calculateNextRecurringDate, formatDateDDMMAAAA } from '../utils/recurrenceDateUtils';
import { rendimientosService } from '../services/rendimientosService';

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
