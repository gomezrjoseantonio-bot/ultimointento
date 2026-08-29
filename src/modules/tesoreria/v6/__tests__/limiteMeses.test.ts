// §2.3 · hasta dónde se retrocede.
//
// Tesorería mira hacia delante. Se retrocede solo si queda TRABAJO atrás.

import { mesMinimo, puedeRetroceder, sueloDeMovimientos } from '../limiteMeses';
import type { Movement, TreasuryEvent } from '../../../../services/db';

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

  // El suelo lo pone el DINERO QUE CONSTA, no el calendario.
  //
  // Por debajo del movimiento más antiguo que hay en la cuenta no hay nada:
  // ni saldo del que partir ni realidad contra la que cuadrar, así que un mes
  // pintado ahí sería inventado. Y hacia arriba se mueve solo: el día que
  // entra un extracto de enero, enero pasa a ser navegable sin tocar nada.
  it('el suelo corta por abajo', () => {
    const m = mesMinimo({
      eventos: [ev('2025-04-10')],
      hoy: HOY,
      suelo: '2026-01-01',
    });
    expect(m).toEqual({ year: 2026, month0: 0 });
  });

  it('el suelo no ARRASTRA hacia atrás · sin pendientes no se retrocede', () => {
    // Que haya movimientos desde enero no es motivo para abrir enero: se
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

// ============================================================================
// El suelo · hasta dónde hay dinero del que hablar
// ============================================================================
//
// Sustituye al suelo del EJERCICIO (C0, retirado): el pasado ya no se genera
// como previsión, entra desde el fichero del banco. Así que hasta dónde se
// puede mirar atrás lo dice lo que el banco ha traído, no una fecha fiscal.

const mov = (fecha: string, over: Partial<Movement> = {}): Movement =>
  ({
    id: 1,
    accountId: 1,
    date: fecha,
    amount: -10,
    description: 'Recibo',
    ...over,
  }) as Movement;

describe('el suelo · el movimiento real más antiguo', () => {
  it('sin movimientos no hay suelo · no se inventa una fecha', () => {
    expect(sueloDeMovimientos([])).toBeUndefined();
  });

  it('es la fecha del movimiento más antiguo', () => {
    expect(sueloDeMovimientos([mov('2026-05-10'), mov('2026-01-03'), mov('2026-08-01')]))
      .toBe('2026-01-03');
  });

  it('el saldo inicial cuenta · es el punto de partida de la cuenta', () => {
    // Con solo el saldo inicial, el suelo es el de siempre: la apertura. Lo que
    // cambia es que ya no es un tope FIJO — cuando entre el extracto de enero,
    // baja solo.
    expect(sueloDeMovimientos([mov('2026-08-01', { isOpeningBalance: true })]))
      .toBe('2026-08-01');
  });

  it('un extracto viejo BAJA el suelo por debajo de la apertura', () => {
    // Es lo que arregla: quien abre ATLAS en agosto y sube ocho meses de banco
    // llega a enero, sin tener que tocar nada.
    expect(
      sueloDeMovimientos([
        mov('2026-08-01', { isOpeningBalance: true }),
        mov('2026-01-15'),
      ])
    ).toBe('2026-01-15');
  });

  it('recorta la hora si la fecha viene con ella', () => {
    expect(sueloDeMovimientos([mov('2026-03-04T10:00:00.000Z')])).toBe('2026-03-04');
  });

  it('una fecha vacía no se cuela como suelo', () => {
    expect(sueloDeMovimientos([mov(''), mov('2026-06-01')])).toBe('2026-06-01');
  });
});
