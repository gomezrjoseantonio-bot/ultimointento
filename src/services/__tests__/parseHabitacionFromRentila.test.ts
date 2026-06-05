import { parseHabitacionFromRentila } from '../rentilaParserService';

describe('parseHabitacionFromRentila · § 3.1', () => {
  test.each<[string, number | null]>([
    ['4-ACEVEDO-H2', 2],
    ['FA32 H1', 1],
    ['Fuertes Acevedo 32 1 2 Dr Oviedo H3', 3],
    ['Tenderina 64 4Iz Hab4', 4],
    ['T64-4D-H1', 1],
    ["Sant Joan d'En Coll", null], // sin HX
    ['Carles Buigas 15 A 0 2', null], // sin HX (el 2 final no es habitación)
    ['Tenderina 48 1 5 Dr', null], // 5 al final pero no es HX
    ['H2-ACEVEDO', null], // H al principio · no al final
    ['Casa H99', null], // número fuera de rango
  ])('parsea "%s" → %s', (input, esperado) => {
    expect(parseHabitacionFromRentila(input)).toBe(esperado);
  });

  test('tolera entrada vacía o nula', () => {
    expect(parseHabitacionFromRentila('')).toBeNull();
    expect(parseHabitacionFromRentila(undefined as unknown as string)).toBeNull();
  });
});
