// ============================================================================
// La cuenta no forma parte de la identidad de una previsión
// ============================================================================
//
// `claveOrigenPrevision` es la unidad de idempotencia del motor de recurrentes:
// como mucho UNA previsión viva por clave. La clave llevaba dentro la cuenta, y
// eso la volvía frágil justo donde no debía.
//
// Un compromiso tiene UNA `cuentaCargo` y un cargo por periodo, así que el
// origen y el mes ya lo identifican. La cuenta ahí no distinguía nada, y en
// cambio hacía que mover el cargo a otra cuenta —cobrar el recibo desde la
// cuenta que tocaba, que es un gesto normal— cambiara la clave y dejara el mes
// libre otra vez: la regeneración volvía a emitir una previsión de algo ya
// pagado.
//
// Se descubrió arreglando B13: al reasignar el evento a su cuenta real (para
// que el saldo no lo contara dos veces) reaparecía la previsión del mes. Medido.
// ============================================================================

import { claveOrigenPrevision } from '../previsionesIdempotencia';
import type { TreasuryEvent } from '../../db';

const ev = (over: Partial<TreasuryEvent>): TreasuryEvent =>
  ({
    type: 'expense', amount: 60, predictedDate: '2026-09-10', description: 'Comunidad',
    accountId: 1, status: 'predicted', sourceType: 'gasto_recurrente', sourceId: 42,
    año: 2026, mes: 9, createdAt: '', updatedAt: '', ...over,
  }) as TreasuryEvent;

describe('claveOrigenPrevision', () => {
  it('el mismo cargo es el mismo cargo, se pague desde donde se pague', () => {
    expect(claveOrigenPrevision(ev({ accountId: 1 })))
      .toBe(claveOrigenPrevision(ev({ accountId: 2 })));
  });

  it('y da igual que una no tenga cuenta', () => {
    expect(claveOrigenPrevision(ev({ accountId: undefined })))
      .toBe(claveOrigenPrevision(ev({ accountId: 7 })));
  });

  // Lo que sí distingue · sin esto la clave no serviría para nada.
  it('el mes sí distingue', () => {
    expect(claveOrigenPrevision(ev({ mes: 9 })))
      .not.toBe(claveOrigenPrevision(ev({ mes: 10 })));
  });

  it('y el compromiso del que viene, también', () => {
    expect(claveOrigenPrevision(ev({ sourceId: 42 })))
      .not.toBe(claveOrigenPrevision(ev({ sourceId: 43 })));
  });

  it('un opex_rule cuenta como el mismo origen que un gasto recurrente', () => {
    expect(claveOrigenPrevision(ev({ sourceType: 'opex_rule' as never })))
      .toBe(claveOrigenPrevision(ev({ sourceType: 'gasto_recurrente' })));
  });

  it('sin año/mes propios los saca de la fecha', () => {
    expect(claveOrigenPrevision(ev({ año: undefined, mes: undefined })))
      .toBe(claveOrigenPrevision(ev({})));
  });
});
