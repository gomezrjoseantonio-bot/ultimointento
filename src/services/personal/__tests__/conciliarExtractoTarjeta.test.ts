// Emparejar el extracto de la tarjeta con sus piezas/compras · por importe exacto
// y fecha cercana, 1:1.

import { emparejarExtractoTarjeta, type ObjetivoConciliacion } from '../conciliarExtractoTarjeta';
import type { LineaExtractoTarjeta } from '../extractoTarjeta';

const linea = (fecha: string, importe: number, concepto = 'X'): LineaExtractoTarjeta => ({ fecha, importe, concepto });
const obj = (id: number, kind: 'pieza' | 'compra', fecha: string, importe: number): ObjetivoConciliacion => ({ id, kind, fecha, importe });

it('casa una línea con la pieza del mismo importe y fecha cercana', () => {
  const m = emparejarExtractoTarjeta(
    [linea('2026-07-04', 53.5)],
    [obj(1, 'pieza', '2026-07-05', 53.5)]
  );
  expect(m.get(0)).toMatchObject({ id: 1, kind: 'pieza' });
});

it('sin el mismo importe no casa', () => {
  const m = emparejarExtractoTarjeta([linea('2026-07-04', 53.5)], [obj(1, 'pieza', '2026-07-04', 50)]);
  expect(m.size).toBe(0);
});

it('lejos en el tiempo no casa', () => {
  const m = emparejarExtractoTarjeta([linea('2026-07-04', 53.5)], [obj(1, 'pieza', '2026-08-20', 53.5)]);
  expect(m.size).toBe(0);
});

it('1:1 · dos líneas iguales casan con objetivos distintos (el más cercano cada una)', () => {
  const m = emparejarExtractoTarjeta(
    [linea('2026-07-04', 20), linea('2026-07-10', 20)],
    [obj(1, 'pieza', '2026-07-04', 20), obj(2, 'compra', '2026-07-10', 20)]
  );
  expect(m.get(0)?.id).toBe(1);
  expect(m.get(1)?.id).toBe(2);
});

it('un objetivo no se usa dos veces', () => {
  const m = emparejarExtractoTarjeta(
    [linea('2026-07-04', 20), linea('2026-07-05', 20)],
    [obj(1, 'pieza', '2026-07-04', 20)]
  );
  // Solo una de las dos líneas casa; la otra queda suelta.
  expect(m.size).toBe(1);
});
