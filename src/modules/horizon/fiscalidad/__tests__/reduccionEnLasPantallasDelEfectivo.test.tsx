// Las cuatro pantallas que enseñaban el «26 %».
//
// Supervisión, Declaración completa, Fiscalidad del inmueble y el mapper de
// hidratación leían `porcentajeReduccionHabitual` —el % efectivo— y lo pintaban
// como si fuera la reducción del contrato: «Red. 26%», «Reducción 26%»,
// «reducción 26,07%». Aquí se comprueba que ninguna vuelve a hacerlo, y que
// todas dicen lo mismo: el importe exacto y los tramos con su nominal.

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { buildSecciones } from '../declaracion/DeclaracionCompletaPage';
import { buildInmueblesFiscales } from '../supervision/ImpuestosSupervisionPage';
import { desgloseAusente, desgloseDeclarado } from '../../../../services/desgloseReduccion';
import { porcentajeParaElFormulario } from '../../../../components/tax/taxHydrationMapper';
import RotuloReduccion from '../../../../components/fiscal/RotuloReduccion';
import type { DatosFiscalesEjercicio } from '../../../../services/fiscalResolverService';

const texto = (): string => (document.body.textContent ?? '').replace(/\s/g, ' ').replace(/\./g, '');

/** FA32 2024: 1.390,94 € reducidos sobre 5.334,69 · el que daba 26,07 %. */
const mixto = () =>
  desgloseDeclarado({
    arrendamientos: [
      { tipo: 'larga_estancia', conReduccion: true },
      { tipo: 'otro', conReduccion: false },
    ],
    reduccion: 1390.94,
    rendimientoAntes: 5334.69,
  });

const inmueble = () => ({
  inmuebleId: 1,
  alias: 'FA32',
  diasAlquilado: 366, diasVacio: 0, diasEnObras: 0, diasTotal: 366,
  ingresosIntegros: 19675,
  gastosDeducibles: 14340.31,
  amortizacion: 0,
  reduccionHabitual: 1390.94,
  rendimientoNetoAlquiler: 5334.69,
  rendimientoNetoReducido: 3943.75,
  reduccion: mixto(),
  esHabitual: true,
  imputacionRenta: 0,
  rendimientoNeto: 3943.75,
});

const datos = (): DatosFiscalesEjercicio =>
  ({
    rendimientosTrabajo: null,
    rendimientosActividades: null,
    rendimientosInmuebles: 3943.75,
    declaracionCompleta: { baseGeneral: { rendimientosInmuebles: [inmueble()] } },
  }) as unknown as DatosFiscalesEjercicio;

// ───────────────────────────────────────────────────────────────────────────
describe('declaración completa · la fila de reducción', () => {
  const filas = () =>
    buildSecciones(datos()).find((s) => s.id === 'inmuebles')?.subsecciones?.[0]?.filas ?? [];

  it('la etiqueta ya no lleva el porcentaje pegado', () => {
    const fila = filas().find((f) => f.label.startsWith('Reducción'));
    expect(fila?.label).toBe('Reducción Ley Vivienda');
    expect(fila?.label).not.toMatch(/\d/);
  });

  it('el importe no cambia · lo que se pierde es el número inventado', () => {
    expect(filas().find((f) => f.label.startsWith('Reducción'))?.valor).toBe(-1390.94);
  });

  it('la fila lleva el desglose, para que el rótulo pinte los tramos', () => {
    expect(filas().find((f) => f.label.startsWith('Reducción'))?.reduccion?.tramos).toHaveLength(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('supervisión · la tarjeta del inmueble', () => {
  const tarjeta = () => buildInmueblesFiscales(datos())[0];

  it('lleva el desglose en vez de un porcentaje efectivo', () => {
    expect(tarjeta().reduccion.importe).toBe(1390.94);
    expect((tarjeta() as Record<string, unknown>).reduccion_pct).toBeUndefined();
  });

  it('el importe reducido sigue siendo el declarado', () => {
    expect(tarjeta().reduccion_importe).toBe(1390.94);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('el rótulo compartido · el mismo en las cuatro', () => {
  it('ni «26» ni «26,07» en ninguna de sus formas', () => {
    render(<RotuloReduccion desglose={mixto()} etiqueta />);
    expect(texto()).not.toContain('26');
    expect(screen.getByText('larga estancia')).toBeInTheDocument();
    expect(screen.getByText('0% distinto de vivienda')).toBeInTheDocument();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// El mapper de hidratación · el cuarto sitio donde vivía el motor C.
//
// Aquí `pctReduccion` NO es un rótulo: es un parámetro de entrada del modelo de
// `taxSlice`, que calcula la reducción como `rendimiento × pct / 100`. Ninguna
// pantalla lo pinta. Lo que se retira es de dónde salía: leía el % efectivo del
// motor C y, si no lo encontraba, se inventaba un 60 % por ser «habitual».
describe('mapper de hidratación · de dónde sale el porcentaje del formulario', () => {
  it('un tramo único · el nominal exacto, no un cociente', () => {
    expect(
      porcentajeParaElFormulario(
        desgloseDeclarado({
          arrendamientos: [{ tipo: 'larga_estancia', conReduccion: true }],
          reduccion: 3200.81,
          rendimientoAntes: 5334.69,
        }),
      ),
    ).toBe(60);
  });

  it('varios tramos · el que reproduce el importe declarado, para no perder euros', () => {
    // El formulario multiplica, así que necesita un número que devuelva
    // 1.390,94 €. No se enseña en ninguna pantalla: es aritmética interna.
    expect(porcentajeParaElFormulario(mixto())).toBeCloseTo(26.07, 2);
  });

  it('sin reducción · 0, no el 60 % que se inventaba por ser habitual', () => {
    expect(
      porcentajeParaElFormulario(
        desgloseDeclarado({
          arrendamientos: [{ tipo: 'larga_estancia', conReduccion: false }],
          reduccion: 0,
          rendimientoAntes: 5000,
        }),
      ),
    ).toBe(0);
  });

  it('dato ausente · tampoco se rellena', () => {
    expect(porcentajeParaElFormulario(desgloseAusente())).toBe(0);
  });
});
