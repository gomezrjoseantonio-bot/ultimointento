// La huella con la que se detecta un duplicado entre importaciones.
//
// Sobrevive de los candados de la 2.0.1 (el resto de aquel fichero probaba
// `mapHeaders`, que se ha borrado con el parser muerto). Este sigue siendo la
// garantía que importa: al llevar el identificador del banco al movimiento, lo
// único que no podía pasar era que la huella cambiara — un extracto solapado
// dejaría de reconocer sus propias líneas y duplicaría los cargos.

import { hashMovement } from '../bankStatementOrchestrator';
import type { Movement } from '../db';

const movimiento = (reference?: string): Movement =>
  ({
    accountId: 7,
    date: '2026-02-02',
    amount: -285.4,
    description: 'Cargo por amortizacion de prestamo/credito',
    reference,
  }) as Movement;

describe('reimportar el mismo extracto no duplica', () => {
  it('la huella NO mira `reference`', () => {
    expect(hashMovement(movimiento('0182-5322-27-0830842450'))).toBe(hashMovement(movimiento(undefined)));
  });

  it('dos cuotas iguales con distinto nº de recibo dan la misma huella', () => {
    // Lo que las distingue es la fecha, no la referencia.
    expect(hashMovement(movimiento('N 2026126000711287 BANKINTER CONSUMER FINANCE'))).toBe(
      hashMovement(movimiento('N 2026099000268072 BANKINTER CONSUMER FINANCE')),
    );
  });

  it('y sigue distinguiendo lo que de verdad es distinto', () => {
    const otro = { ...movimiento('x'), amount: -351.43 } as Movement;
    expect(hashMovement(otro)).not.toBe(hashMovement(movimiento('x')));
  });
});
