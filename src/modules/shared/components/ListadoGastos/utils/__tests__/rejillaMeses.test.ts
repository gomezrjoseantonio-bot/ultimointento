import {
  patronToMeses,
  mesesToPatron,
  mesesDeAtajo,
  diaDePatron,
} from '../rejillaMeses';

describe('rejillaMeses · patronToMeses', () => {
  it('mensual → los 12 meses', () => {
    expect(patronToMeses({ tipo: 'mensualDiaFijo', dia: 2 })).toHaveLength(12);
  });
  it('anualMesesConcretos → sus meses ordenados', () => {
    expect(patronToMeses({ tipo: 'anualMesesConcretos', mesesPago: [11, 7, 9], diaPago: 27 })).toEqual([7, 9, 11]);
  });
  it('cadaNMeses bimestral anclado en julio → meses impares', () => {
    expect(patronToMeses({ tipo: 'cadaNMeses', cadaNMeses: 2, mesAncla: 7, dia: 27 })).toEqual([1, 3, 5, 7, 9, 11]);
  });
});

describe('rejillaMeses · mesesToPatron', () => {
  it('los 12 meses → mensualDiaFijo', () => {
    expect(mesesToPatron([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 2)).toEqual({ tipo: 'mensualDiaFijo', dia: 2 });
  });
  it('un subconjunto → anualMesesConcretos', () => {
    expect(mesesToPatron([6], 5)).toEqual({ tipo: 'anualMesesConcretos', mesesPago: [6], diaPago: 5 });
  });
  it('clampa el día a 1-31 (los cargos en España van del 1 al 31)', () => {
    expect((mesesToPatron([1], 31) as { diaPago: number }).diaPago).toBe(31);
    expect((mesesToPatron([1], 45) as { diaPago: number }).diaPago).toBe(31);
    expect((mesesToPatron([1], 0) as { diaPago: number }).diaPago).toBe(1);
  });
});

describe('rejillaMeses · atajos', () => {
  it('todos', () => {
    expect(mesesDeAtajo('todos')).toHaveLength(12);
  });
  it('cada 2 desde julio → meses impares (el patrón se repite todo el año)', () => {
    expect(mesesDeAtajo('cada2', 7)).toEqual([1, 3, 5, 7, 9, 11]);
  });
  it('cada 3 desde enero → ene·abr·jul·oct', () => {
    expect(mesesDeAtajo('cada3', 1)).toEqual([1, 4, 7, 10]);
  });
  it('una vez al año en el mes del primer cobro', () => {
    expect(mesesDeAtajo('unaVezAlAnio', 6)).toEqual([6]);
  });
});

// Los 5 calendarios reales de §4 · criterio 3, cerrados de punta a punta:
// rejilla (atajo o a mano) → patrón → meses proyectados.
describe('rejillaMeses · los 5 calendarios reales (§4)', () => {
  const ida = (meses: number[], dia: number) => patronToMeses(mesesToPatron(meses, dia));

  it('1 · mensual día 2', () => {
    const meses = mesesDeAtajo('todos');
    expect(ida(meses, 2)).toHaveLength(12);
  });
  it('2 · bimestral, primer cobro 27 de julio → impares, día 27', () => {
    const meses = mesesDeAtajo('cada2', 7);
    expect(ida(meses, 27)).toEqual([1, 3, 5, 7, 9, 11]);
    expect(diaDePatron(mesesToPatron(meses, 27))).toBe(27);
  });
  it('3 · IBI en junio', () => {
    expect(ida([6], 5)).toEqual([6]);
  });
  it('4 · dos veces al año (abril y octubre)', () => {
    expect(ida([4, 10], 1)).toEqual([4, 10]);
  });
  it('5 · once meses sin agosto', () => {
    const meses = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12];
    expect(ida(meses, 1)).toEqual(meses);
  });
});
