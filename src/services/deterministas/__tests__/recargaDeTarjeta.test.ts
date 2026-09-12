// E3.1 · la recarga de una cuenta propia con una tarjeta propia.
//
// Recargar el Revolut con la tarjeta del Santander deja dos apuntes que son el
// mismo dinero, y ninguno de los dos se reconocía:
//
//   Santander · «Compra Revolut**0940*, Dublin, Tarjeta 5489010341469623» −35 €
//   Revolut   · «Recarga de *9623»                                        +35 €
//
// El cargo caía en «comisiones bancarias» por llevar la palabra Revolut, y la
// recarga se quedaba sin pareja. El cruce a ciegas no podía tocarlos: «COMPRA»
// y «TARJETA» están en la lista de lo que NUNCA es un traspaso, y con razón,
// porque ahí solo hay importe y fecha.
//
// Aquí hay más que importe y fecha: los dos extractos escriben los MISMOS
// cuatro últimos de la tarjeta, y el cargo NOMBRA a la cuenta que recibe. Con
// esas dos señales el cruce está anclado en un identificador y no en una
// casualidad, así que la lista de vetos deja de aplicar.
//
// La segunda señal es la que separa la recarga de una comida pagada con la
// misma tarjeta, el mismo día y por el mismo importe: la comida no nombra
// ninguna cuenta tuya.

import { cruzarPatas } from '../traspasosPropios';
import type { Movement } from '../../db';
import type { Account } from '../../db/types-contratos';

const NOMBRES = ['Jose Antonio Gomez Ramirez'];

const cuenta = (id: number, alias: string): Account =>
  ({ id, alias, iban: `ES6021037003520030084${430 + id}`, tipo: 'CORRIENTE' }) as unknown as Account;

const mov = (id: number, accountId: number, amount: number, description: string, date = '2026-03-10'): Movement =>
  ({ id, accountId, amount, description, date }) as Movement;

const SANTANDER = cuenta(1, 'Santander');
const REVOLUT = cuenta(2, 'Revolut');
const CUENTAS = [SANTANDER, REVOLUT];
const PROPIAS = new Set([1, 2]);

// Un número de tarjeta INVENTADO que acaba en 9623 · aquí no entra uno real.
const CARGO = 'Compra Revolut**0940*, Dublin, Tarjeta 4000000000009623 , Comision 0,00';
const RECARGA = 'Recarga de *9623';

describe('E3.1 · la recarga de una cuenta propia con una tarjeta propia', () => {
  it('cruza el cargo con la recarga aunque el banco lo llame «Compra»', () => {
    const cargo = mov(10, 1, -35, CARGO, '2026-03-10');
    const recarga = mov(11, 2, 35, RECARGA, '2026-03-10');

    const cruces = cruzarPatas([cargo, recarga], PROPIAS, NOMBRES, CUENTAS);

    expect(cruces).toHaveLength(1);
    expect([cruces[0].salida.id, cruces[0].entrada.id]).toEqual([10, 11]);
  });

  it('no cruza una compra normal hecha con la MISMA tarjeta el mismo día', () => {
    // Mismo importe, mismo día, misma tarjeta · lo único que cambia es que la
    // comida no nombra ninguna cuenta suya. Y es justo lo que la salva.
    const comida = mov(10, 1, -35, 'Compra Meson A Reta De Cobas, O Pino, Tarjeta 4000000000009623', '2026-03-10');
    const recarga = mov(11, 2, 35, RECARGA, '2026-03-10');

    expect(cruzarPatas([comida, recarga], PROPIAS, NOMBRES, CUENTAS)).toHaveLength(0);
  });

  it('no cruza si las tarjetas son DISTINTAS', () => {
    const cargo = mov(10, 1, -35, 'Compra Revolut**0940*, Dublin, Tarjeta 4000000000001111', '2026-03-10');
    const recarga = mov(11, 2, 35, RECARGA, '2026-03-10');

    expect(cruzarPatas([cargo, recarga], PROPIAS, NOMBRES, CUENTAS)).toHaveLength(0);
  });

  it('recargas GEMELAS · se cruzan todas, no se anulan entre ellas', () => {
    // Tres recargas de 30 € el mismo día con la misma tarjeta y sus tres
    // cargos. El cruce a ciegas las descartaría por ambiguas —y hace bien,
    // porque allí no sabe qué es cada una—; aquí las tres patas están probadas
    // y cualquier emparejamiento dice lo mismo: es dinero tuyo cambiando de
    // sitio. Dejarlas sin cruzar sería perder seis apuntes por no elegir.
    const movimientos = [
      mov(1, 1, -30, CARGO, '2026-03-10'),
      mov(2, 1, -30, CARGO, '2026-03-10'),
      mov(3, 1, -30, CARGO, '2026-03-11'),
      mov(4, 2, 30, RECARGA, '2026-03-10'),
      mov(5, 2, 30, RECARGA, '2026-03-10'),
      mov(6, 2, 30, RECARGA, '2026-03-11'),
    ];

    expect(cruzarPatas(movimientos, PROPIAS, NOMBRES, CUENTAS)).toHaveLength(3);
  });

  it('sin las cuentas no se cruza · no hay con qué comprobar el nombre', () => {
    const cargo = mov(10, 1, -35, CARGO, '2026-03-10');
    const recarga = mov(11, 2, 35, RECARGA, '2026-03-10');

    expect(cruzarPatas([cargo, recarga], PROPIAS, NOMBRES)).toHaveLength(0);
  });

  it('un alias de tres letras no prueba nada · no basta con que salga en el texto', () => {
    const cuentas = [SANTANDER, cuenta(2, 'ING')];
    const cargo = mov(10, 1, -35, 'Compra ING**0940*, Tarjeta 4000000000009623', '2026-03-10');
    const recarga = mov(11, 2, 35, RECARGA, '2026-03-10');

    expect(cruzarPatas([cargo, recarga], PROPIAS, NOMBRES, cuentas)).toHaveLength(0);
  });

  it('el cruce a ciegas sigue igual de estricto · dos candidatas siguen siendo una duda', () => {
    const salida = mov(1, 1, -500, 'Ahorros mensuales', '2026-03-10');
    const e1 = mov(2, 2, 500, 'Abono', '2026-03-10');
    const e2 = mov(3, 2, 500, 'Abono', '2026-03-11');

    expect(cruzarPatas([salida, e1, e2], PROPIAS, NOMBRES, CUENTAS)).toHaveLength(0);
  });
});
