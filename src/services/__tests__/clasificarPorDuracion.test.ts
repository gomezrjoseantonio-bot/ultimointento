// De cuánto dura un contrato a qué tipo de alquiler es.
//
// El tipo lo elige el arrendador, pero teclearlo cuando las fechas ya lo dicen
// es pedirle dos veces el mismo dato — y es donde se cuela la incoherencia: un
// contrato de tres días marcado como vivienda habitual reclamaría una reducción
// del art. 23.2 que no le toca.
//
// Esto PROPONE, no decide. La ley mira el uso, no solo el calendario: un piso
// alquilado nueve meses a un estudiante y otro alquilado nueve meses a alguien
// que se muda por trabajo duran lo mismo y no tienen por qué declararse igual.
// Por eso el usuario puede sobrescribir la propuesta.

import { clasificarPorDuracion } from '../db/types-alquiler';

/** Duración en días CONTANDO los dos extremos · del 1 al 31 son 31 días. */
const del = (inicio: string, fin: string) => clasificarPorDuracion(inicio, fin);

describe('los tres tramos', () => {
  it('un fin de semana es corta estancia', () => {
    expect(del('2026-03-06', '2026-03-08')).toBe('corta_estancia');
  });

  it('el curso de un estudiante es media estancia', () => {
    // Septiembre a junio · nueve meses y pico.
    expect(del('2026-09-01', '2027-06-30')).toBe('media_estancia');
  });

  it('un contrato de vivienda a cinco años es larga estancia', () => {
    expect(del('2026-01-01', '2030-12-31')).toBe('larga_estancia');
  });
});

describe('las fronteras exactas', () => {
  it('31 días es corta · 32 ya es media', () => {
    // Enero entero son 31 días contando los dos extremos.
    expect(del('2026-01-01', '2026-01-31')).toBe('corta_estancia');
    expect(del('2026-01-01', '2026-02-01')).toBe('media_estancia');
  });

  it('364 días es media · 365 ya es larga', () => {
    expect(del('2026-01-01', '2026-12-30')).toBe('media_estancia');
    expect(del('2026-01-01', '2026-12-31')).toBe('larga_estancia');
  });

  it('el año bisiesto no mueve la frontera · sigue siendo un año natural', () => {
    // 2028 tiene 366 días y el contrato del 1-ene al 31-dic sigue siendo largo.
    expect(del('2028-01-01', '2028-12-31')).toBe('larga_estancia');
    // Y un año natural que cruza el 29 de febrero también.
    expect(del('2028-03-01', '2029-02-28')).toBe('larga_estancia');
  });

  it('el mismo día de entrada y salida es un día, no cero', () => {
    expect(del('2026-05-10', '2026-05-10')).toBe('corta_estancia');
  });
});

describe('cuando no hay con qué proponer, no se propone', () => {
  it('sin fecha de fin el contrato es indefinido · no se clasifica por días', () => {
    // Un indefinido no dura «lo que va de hoy a nada»: no hay duración que
    // medir, y proponer «corta estancia» porque falta el dato sería lo peor
    // que podría pasar — es el tramo que NO reduce.
    expect(del('2026-01-01', '')).toBeNull();
    expect(del('2026-01-01', undefined)).toBeNull();
  });

  it('sin fecha de inicio tampoco', () => {
    expect(del('', '2026-12-31')).toBeNull();
  });

  it('una fecha ilegible no se adivina', () => {
    expect(del('2026-13-45', '2026-12-31')).toBeNull();
    expect(del('ayer', 'mañana')).toBeNull();
  });

  it('un fin anterior al inicio no es una duración', () => {
    expect(del('2026-06-01', '2026-01-01')).toBeNull();
  });

  it('el centinela de «sin fecha de fin» no se toma por una fecha real', () => {
    // `2099-12-31` es como el repo marca un contrato sin fin conocido. Medirlo
    // daría setenta y tres años de larga estancia por un dato que no existe.
    expect(del('2026-01-01', '2099-12-31')).toBeNull();
  });
});
