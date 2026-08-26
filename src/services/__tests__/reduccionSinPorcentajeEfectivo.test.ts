// El «26 %» deja de existir.
//
// `porcentajeReduccionHabitual` era el porcentaje EFECTIVO: reducción dividida
// entre rendimiento neto. En un inmueble con un tramo de larga estancia al 60 %
// y otro de temporada al 0 %, esa división da 26,07 %. El número es correcto
// como cociente y falso como porcentaje: no es la reducción de ningún tramo, no
// aparece en el Modelo 100, y no hay ley que lo respalde. Un usuario que lo
// leyera y buscara «reducción del 26 %» no encontraría nada.
//
// Aquí se comprueba que el adaptador de lo declarado ya no lo calcula, y que en
// su lugar entrega el desglose por tramo: el importe —que sí es exacto— y el
// porcentaje nominal solo cuando consta.

import { declaracionCompletaToIRPF } from '../declaracionCompletaToIRPFAdapter';
import { etiquetaTramo } from '../desgloseReduccion';
import type { DeclaracionCompleta } from '../../types/declaracionCompleta';

/** El FA32 de 2024, en lo que toca a la reducción. */
const declaracion = (arrendamientos: any[], reduccionVivienda: number, rendimientoNeto: number) =>
  ({
    meta: { ejercicio: 2024 },
    inmuebles: [
      {
        refCatastral: '7949807TP6074N0006YM',
        arrendamientos,
        usos: [{ tipo: 'arrendado', dias: 366 }],
        reduccionVivienda,
        rendimientoNeto,
        rendimientoNetoReducido: rendimientoNeto,
      },
    ],
  }) as unknown as DeclaracionCompleta;

const primerInmueble = (decl: DeclaracionCompleta) =>
  declaracionCompletaToIRPF(decl, new Map()).baseGeneral.rendimientosInmuebles[0];

describe('lo declarado se rotula por tramo, no con un cociente', () => {
  it('el mixto real · dos chips y el importe, sin rastro del 26 %', () => {
    const inm = primerInmueble(
      declaracion(
        [
          { tipoArrendamiento: 'vivienda', tieneReduccion: true },
          { tipoArrendamiento: 'no_vivienda', tieneReduccion: false },
        ],
        1390.94,
        3943.75,
      ),
    );

    expect(inm.reduccion.origen).toBe('declarado');
    expect(inm.reduccion.importe).toBe(1390.94);
    expect(inm.reduccion.tramos.map(etiquetaTramo)).toEqual([
      'larga estancia',
      '0% distinto de vivienda',
    ]);
    // El importe sigue siendo el mismo que la casilla: lo que se pierde es el
    // porcentaje inventado, no el dato.
    expect(inm.reduccionHabitual).toBe(1390.94);
  });

  it('un único arrendamiento de vivienda · el nominal se deriva y sale el 60 %', () => {
    const inm = primerInmueble(
      declaracion([{ tipoArrendamiento: 'vivienda', tieneReduccion: true }], 3200.81, 2133.88),
    );
    // 3.200,81 sobre 5.334,69 (neto + reducción) es el 60 % exacto.
    expect(inm.reduccion.tramos.map(etiquetaTramo)).toEqual(['60% larga estancia']);
  });

  it('sin reducción declarada · 0 % explícito, no un hueco', () => {
    const inm = primerInmueble(
      declaracion([{ tipoArrendamiento: 'no_vivienda', tieneReduccion: false }], 0, 4000),
    );
    expect(inm.reduccion.importe).toBe(0);
    expect(inm.reduccion.tramos.map(etiquetaTramo)).toEqual(['0% distinto de vivienda']);
  });

  it('`porcentajeReduccionHabitual` ya no viaja en el rendimiento', () => {
    const inm = primerInmueble(
      declaracion([{ tipoArrendamiento: 'vivienda', tieneReduccion: true }], 1390.94, 3943.75),
    );
    expect((inm as Record<string, unknown>).porcentajeReduccionHabitual).toBeUndefined();
  });
});
