// §2.3 · hasta dónde se retrocede.
//
// Tesorería mira hacia delante. Se retrocede solo si queda TRABAJO atrás.

import { mesMinimo, puedeRetroceder } from '../limiteMeses';
import type { TreasuryEvent } from '../../../../services/db';

const HOY = '2026-08-15';

const ev = (fecha: string, over: Partial<TreasuryEvent> = {}): TreasuryEvent =>
  ({
    id: 1,
    type: 'expense',
    amount: 100,
    predictedDate: fecha,
    description: 'Recibo',
    sourceType: 'manual',
    status: 'predicted',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as TreasuryEvent;

describe('el tope de retroceso', () => {
  it('sin pendientes atrás no se sale del mes en curso · no habría nada que hacer', () => {
    expect(mesMinimo({ eventos: [], hoy: HOY })).toEqual({ year: 2026, month0: 7 });
  });

  it('llega hasta el pendiente vencido más antiguo', () => {
    const m = mesMinimo({
      eventos: [ev('2026-03-10'), ev('2026-06-01'), ev('2026-07-20')],
      hoy: HOY,
    });
    expect(m).toEqual({ year: 2026, month0: 2 });
  });

  it('un previsto FUTURO no abre el pasado · vive hacia delante', () => {
    expect(mesMinimo({ eventos: [ev('2026-12-01')], hoy: HOY }))
      .toEqual({ year: 2026, month0: 7 });
  });

  it('lo confirmado no cuenta · ya no es trabajo', () => {
    expect(mesMinimo({ eventos: [ev('2025-01-10', { status: 'executed' })], hoy: HOY }))
      .toEqual({ year: 2026, month0: 7 });
  });

  it('lo descartado tampoco', () => {
    expect(mesMinimo({ eventos: [ev('2025-01-10', { descartado: true })], hoy: HOY }))
      .toEqual({ year: 2026, month0: 7 });
  });

  it('el saldo inicial es un suelo duro · antes no hay saldo del que partir', () => {
    // Hay un pendiente de enero, pero las cuentas arrancan en marzo: pintar el
    // cierre de enero sería inventarlo.
    const m = mesMinimo({
      eventos: [ev('2026-01-10')],
      hoy: HOY,
      saldoDesde: '2026-03-01',
    });
    expect(m).toEqual({ year: 2026, month0: 2 });
  });

  it('cruza el año sin liarse', () => {
    expect(mesMinimo({ eventos: [ev('2025-11-10')], hoy: HOY }))
      .toEqual({ year: 2025, month0: 10 });
  });
});

describe('la flecha de retroceder', () => {
  it('se apaga justo en el tope', () => {
    const min = { year: 2026, month0: 2 };
    expect(puedeRetroceder({ year: 2026, month0: 3 }, min)).toBe(true);
    expect(puedeRetroceder({ year: 2026, month0: 2 }, min)).toBe(false);
    // Y no deja pasar de largo si se llegara por otra vía.
    expect(puedeRetroceder({ year: 2026, month0: 1 }, min)).toBe(false);
  });
});
