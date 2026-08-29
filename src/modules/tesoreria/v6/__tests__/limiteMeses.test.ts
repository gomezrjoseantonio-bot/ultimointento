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

  // El suelo es el del EJERCICIO (C0), no la fecha de apertura de la cuenta.
  //
  // Antes mandaba el saldo inicial, con el argumento de que por debajo no hay
  // saldo del que partir. Pero eso ataba el trabajo pendiente a cuándo se dio
  // de alta la cuenta: quien abre ATLAS hoy con ocho meses de recibos por
  // cuadrar no podía ni verlos. El cierre de un mes anterior a la apertura es
  // orientativo —eso no cambia—; la lista de pendientes es real, y es a lo que
  // se va.
  it('el suelo del ejercicio corta por abajo', () => {
    const m = mesMinimo({
      eventos: [ev('2025-04-10')],
      hoy: HOY,
      suelo: '2026-01-01',
    });
    expect(m).toEqual({ year: 2026, month0: 0 });
  });

  it('con el suelo del ejercicio se llega a enero aunque la cuenta se abriera en agosto', () => {
    const m = mesMinimo({
      eventos: [ev('2026-01-10')],
      hoy: HOY,
      suelo: '2026-01-01',
    });
    expect(m).toEqual({ year: 2026, month0: 0 });
  });

  it('el suelo no ARRASTRA hacia atrás · sin pendientes no se retrocede', () => {
    // Que el ejercicio empiece en enero no es motivo para abrir enero: se
    // retrocede por trabajo, no por calendario.
    expect(mesMinimo({ eventos: [], hoy: HOY, suelo: '2026-01-01' }))
      .toEqual({ year: 2026, month0: 7 });
  });

  it('sin suelo se llega hasta donde haya trabajo', () => {
    expect(mesMinimo({ eventos: [ev('2025-11-10')], hoy: HOY }))
      .toEqual({ year: 2025, month0: 10 });
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
