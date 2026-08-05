// Desde qué tramo rebajan las bonificaciones · VOCABULARIO §6 ter.
//
// El caso que da nombre a todo esto es la Unicaja de Jose: 85.000 € a 240 meses
// firmados el 25 de agosto de 2023, «TREINTA Y SEIS MESES al tipo fijo del
// 2,600 por ciento» y después Euríbor 12m + 1,750. Y en la misma cláusula:
//
//   «No obstante, en el SEGUNDO y en los sucesivos períodos de interés… UNICAJA
//    BANCO aplicará bonificaciones al tipo de interés»
//
// El primer periodo de interés son esos 36 meses. Durante ellos se paga el
// 2,600 % entero, con el seguro de hogar contratado y la nómina domiciliada.
// ATLAS rebajaba el punto entero desde el primer recibo.
//
// La ING de Jose dice lo contrario —2,15 % que baja a 1,35 % con las
// bonificaciones ya desde la firma—, así que no vale una regla por defecto para
// los mixtos: hay que preguntarlo.

import { rebajanEnTramo, tinDelTramo, tinDelTramoSiRevisaranHoy } from '../tinDelTramo';
import { tramosDeTipo } from '../tramosDeTipo';
import { generarCuadro } from '../cuadro';
import type { Bonificacion, Prestamo } from '../../../types/prestamos';
import type { Cumplimiento } from '../../bonificaciones/cumplimiento';

const bonif = (over: Partial<Bonificacion> = {}): Bonificacion =>
  ({
    id: 'b1',
    tipo: 'SEGURO_HOGAR',
    nombre: 'Seguro de hogar',
    reduccionPuntosPorcentuales: 1,
    impacto: { puntos: -1 },
    lookbackMeses: 12,
    regla: { tipo: 'SEGURO_HOGAR', activo: true },
    estado: 'SELECCIONADO',
    ...over,
  }) as unknown as Bonificacion;

/** La hipoteca de la escritura · 25-08-2023, 85.000 €, 240 meses, 36+204. */
const unicaja = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'unicaja',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    fechaPrimerCargo: '2023-09-25',
    tipo: 'MIXTO',
    tipoNominalAnualMixtoFijo: 2.6,
    tramoFijoMeses: 36,
    valorIndiceActual: 2.1,
    diferencial: 1.75,
    baseCalculoIntereses: 'ACT/365',
    bonificaciones: [bonif()],
    bonificacionesDesde: 'TRAMO_VARIABLE',
    ...over,
  }) as unknown as Prestamo;

describe('en qué tramos rebajan', () => {
  it('sin respuesta guardada rebajan en todos · es lo que ATLAS venía haciendo', () => {
    const p = unicaja({ bonificacionesDesde: undefined });

    expect(tramosDeTipo(p).map((t) => tinDelTramo(p, t))).toEqual([1.6, 2.85]);
  });

  it('dicho «desde la firma», rebajan también el tramo fijo · el caso ING', () => {
    const p = unicaja({ bonificacionesDesde: 'FIRMA' });

    expect(tramosDeTipo(p).map((t) => tinDelTramo(p, t))).toEqual([1.6, 2.85]);
  });

  // El punto entero de la escritura: 2,600 % durante 36 meses, y a partir de ahí
  // Euríbor + 1,750 ya bonificado.
  it('dicho «al acabar el tramo fijo», el fijo se paga entero', () => {
    const p = unicaja();

    expect(tramosDeTipo(p).map((t) => tinDelTramo(p, t))).toEqual([2.6, 2.85]);
  });

  // Un préstamo que pasa a fijo arrastrando el `TRAMO_VARIABLE` de cuando era
  // mixto se quedaría sin bonificar de por vida, esperando una fase que ya no
  // llega.
  it('en un fijo y en un variable la respuesta guardada no decide nada', () => {
    const fijo = unicaja({ tipo: 'FIJO', tipoNominalAnualFijo: 2.6 });
    const variable = unicaja({ tipo: 'VARIABLE' });

    expect(tramosDeTipo(fijo).every((t) => rebajanEnTramo(fijo, t))).toBe(true);
    expect(tramosDeTipo(variable).every((t) => rebajanEnTramo(variable, t))).toBe(true);
    expect(tinDelTramo(fijo, tramosDeTipo(fijo)[0])).toBe(1.6);
  });
});

// Se puede preguntar «¿y si el banco me quitara estas?» sin fabricar un préstamo
// entero · es lo que hace la ficha de bonificaciones.
describe('con otras bonificaciones', () => {
  it('se responde sobre las que se pasen, no sobre las del préstamo', () => {
    const p = unicaja({ bonificacionesDesde: 'FIRMA' });

    expect(tinDelTramo(p, tramosDeTipo(p)[0], [])).toBe(2.6);
  });
});

// Durante el tramo fijo da igual lo que demuestren los movimientos: ese tipo no
// lo mueve nada. Lo que se juega ahí se cobra en la primera revisión.
describe('si la revisión fuera hoy', () => {
  const noCumple: Cumplimiento[] = [
    { bonificacionId: 'b1', veredicto: 'no_cumple' } as unknown as Cumplimiento,
  ];

  it('en un tramo que todavía no bonifica, el tipo no se mueve', () => {
    const p = unicaja();

    expect(tinDelTramoSiRevisaranHoy(p, tramosDeTipo(p)[0], noCumple)).toBe(2.6);
  });

  it('en uno que sí bonifica, perderla sube el tipo', () => {
    const p = unicaja();

    expect(tinDelTramoSiRevisaranHoy(p, tramosDeTipo(p)[1], noCumple)).toBe(3.85);
  });
});

// El punto entero, en euros y en el cuadro que se guarda.
describe('el cuadro de la Unicaja', () => {
  it('las 36 primeras cuotas van al 2,600 % · no al 1,600 %', () => {
    const { plan } = generarCuadro(unicaja());
    const primera = plan.periodos.find((p) => p.periodo === 1)!;

    // 85.000 × 2,600 % × 31 días ÷ 365 · la fórmula de la escritura.
    expect(primera.interes).toBeCloseTo((85000 * 2.6 * 31) / 36500, 2);
  });

  it('aplicarlas desde la firma abarataba el préstamo casi mil euros al año', () => {
    const conRegla = generarCuadro(unicaja()).resumen;
    const sinRegla = generarCuadro(unicaja({ bonificacionesDesde: 'FIRMA' })).resumen;

    expect(conRegla.tinEfectivo).toBe(2.6);
    expect(sinRegla.tinEfectivo).toBe(1.6);
    expect(conRegla.totalIntereses).toBeGreaterThan(sinRegla.totalIntereses + 2000);
  });
});
