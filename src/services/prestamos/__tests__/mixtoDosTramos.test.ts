// ============================================================================
// El mixto se paga en DOS tramos · candado numérico contra la FEIN de Unicaja
// ============================================================================
//
// El peligro que vigila este fichero es concreto: que alguien vuelva a generar
// el cuadro de un mixto **entero al tipo de su tramo fijo**. Es el error
// natural —el tramo fijo es el único tipo que se sabe— y sale barato en
// pantalla: una mixta 36+204 al 2,600 % diría que se pagan 122.929 € y una TAE
// del 2,63 %, cuando lo que dice la escritura es 135.190 € y el 5,079 %. Doce
// mil euros de diferencia, sin ningún síntoma.
//
// Las cifras esperadas salen de la FEIN de Jose (Unicaja, 25-08-2023): 85.000 €
// a 240 meses, 2,600 % los primeros 36, después Euríbor 4,149 + 1,750, ACT/365.
//
// Las tolerancias NO son laxitud, son la diferencia entre bases de cálculo: la
// FEIN redondea sobre mes comercial y el cuadro de ATLAS cuenta días reales
// sobre 365, que es lo que dice la cláusula. Exigir el céntimo obligaría a
// elegir una base falsa para que cuadre un test.
// ============================================================================

import type { Prestamo } from '../../../types/prestamos';
import { generarCuadro } from '../cuadro';

/** La hipoteca de la escritura · 25-08-2023, 85.000 €, 240 meses, 36 + 204. */
const unicaja = (): Prestamo =>
  ({
    id: 'unicaja',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    fechaPrimerCargo: '2023-09-25',
    diaCargoMes: 25,
    tipo: 'MIXTO',
    tipoNominalAnualMixtoFijo: 2.6,
    tramoFijoMeses: 36,
    indice: 'EURIBOR',
    valorIndiceActual: 4.149,
    diferencial: 1.75,
    baseCalculoIntereses: 'ACT/365',
    esquemaPrimerRecibo: 'NORMAL',
  }) as unknown as Prestamo;

describe('el mixto de Unicaja, contra su FEIN', () => {
  const cuadro = () => generarCuadro(unicaja());

  it('la cuota del tramo fijo son los 454,66 € del papel', () => {
    expect(cuadro().plan.periodos[0].cuota).toBeCloseTo(454.66, 0);
    expect(Math.abs(cuadro().plan.periodos[0].cuota - 454.66)).toBeLessThan(0.2);
  });

  // Constante durante los 36 meses · el tramo fijo no se mueve por contrato, y
  // el corte lo decide el DEVENGO: el recibo que se gira el 25-08-2026 paga del
  // 25-07 al 25-08, entero dentro del tramo fijo, y va todavía al 2,600 %.
  it('y no se mueve hasta la cuota 36', () => {
    const p = cuadro().plan.periodos;
    expect(p[35].cuota).toBeCloseTo(p[0].cuota, 2);
  });

  it('en la 37 ya se paga el tramo variable, y es más cara', () => {
    const p = cuadro().plan.periodos;
    expect(p[36].cuota).toBeGreaterThan(p[35].cuota + 100);
  });

  it('el capital pendiente tras 36 meses son los 74.890,22 € del papel', () => {
    expect(Math.abs(cuadro().plan.periodos[35].principalFinal - 74890.22)).toBeLessThan(50);
  });

  // 85.000 + intereses. El defecto que esto vigila daría ~122.929 €.
  it('el total estimado son los 135.190,71 € del papel · no los 122.929 de un solo tramo', () => {
    const total = 85000 + cuadro().resumen.interesesCuadro;
    expect(Math.abs(total - 135190.71) / 135190.71).toBeLessThan(0.005);
    expect(total).toBeGreaterThan(130000);
  });

  it('el cuadro parte en dos tramos, y el segundo va marcado como estimado', () => {
    const { tramos } = cuadro().resumen;
    expect(tramos).toHaveLength(2);
    expect(tramos[0].estimado).toBe(false);
    expect(tramos[1].estimado).toBe(true);
    expect(tramos[1].desde).toBe('2026-08-25');
  });
});
