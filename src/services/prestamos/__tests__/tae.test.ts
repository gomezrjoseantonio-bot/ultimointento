// La TAE · VOCABULARIO §6 bis · quinquies.
//
// Lo que vigila esto es que la TAE sea la TIR de los flujos y no una suma de
// componentes. Lo que había sumaba capitalización del TIN + apertura repartida
// por años + carencia técnica, así que un préstamo con arranque largo salía
// igual que otro sin él, y la comisión de apertura entraba prorrateada en vez
// de descontada del capital el día de la firma.
//
// El candado de verdad es el último bloque: la escritura de Unicaja lleva su
// TAE impresa.

import { flujosDelPrestamo, tae, tir } from '../tae';
import { generarCuadro } from '../cuadro';
import type { Prestamo, SeguroVinculado } from '../../../types/prestamos';

const fijo = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'p',
    principalInicial: 100000,
    plazoMesesTotal: 120,
    fechaFirma: '2024-01-15',
    fechaPrimerCargo: '2024-02-15',
    diaCargoMes: 15,
    tipo: 'FIJO',
    tipoNominalAnualFijo: 3,
    baseCalculoIntereses: '30/360',
    esquemaPrimerRecibo: 'NORMAL',
    ...over,
  }) as unknown as Prestamo;

const seguro = (over: Partial<SeguroVinculado> = {}): SeguroVinculado => ({
  concepto: 'Vida',
  primaAnual: 300,
  exigidoParaElTipo: true,
  naturaleza: 'NO_DEDUCIBLE',
  ...over,
});

const deTae = (p: Prestamo): number => generarCuadro(p).resumen.tae;

describe('sin costes, la TAE es la capitalización del TIN', () => {
  // Un préstamo sin gasto ninguno cuesta lo que dice su tipo, capitalizado:
  // (1 + 0,03/12)^12 − 1 = 3,0416 %. Si esto se mueve, se ha roto la cuenta.
  it('un 3 % nominal mensual da 3,04 % de TAE', () => {
    expect(deTae(fijo())).toBeCloseTo(3.04, 2);
  });

  it('y la TAE siempre está por encima del TIN · pagar cada mes cuesta más', () => {
    expect(deTae(fijo())).toBeGreaterThan(3);
  });
});

describe('lo que el cliente paga sube la TAE', () => {
  const sinNada = () => deTae(fijo());

  it('la comisión de apertura', () => {
    expect(deTae(fijo({ comisionApertura: 1 }))).toBeGreaterThan(sinNada());
  });

  it('la tasación', () => {
    expect(deTae(fijo({ tasacion: 400 }))).toBeGreaterThan(sinNada());
  });

  it('la de mantenimiento, que va en euros al mes', () => {
    expect(deTae(fijo({ comisionMantenimiento: 3 }))).toBeGreaterThan(sinNada());
  });

  // Un seguro contratado por tu cuenta no es precio del préstamo: el banco no
  // te lo cobra por prestarte, y meterlo inflaría la TAE con algo ajeno.
  it('un seguro EXIGIDO para el tipo · pero no uno que contrataste tú', () => {
    expect(deTae(fijo({ segurosVinculados: [seguro()] }))).toBeGreaterThan(sinNada());
    expect(deTae(fijo({ segurosVinculados: [seguro({ exigidoParaElTipo: false })] })))
      .toBe(sinNada());
  });
});

// Notaría, registro, gestoría y AJD los paga el banco desde la Ley 5/2019
// art. 14.1.e) y el RDL 17/2018 · no son coste del cliente y no pueden subir
// su TAE. La lista de conceptos es la doctrina, y por eso se comprueba.
describe('qué conceptos entran', () => {
  it('solo capital, apertura, tasación, recibos y seguros exigidos', () => {
    const p = fijo({
      comisionApertura: 1,
      tasacion: 400,
      segurosVinculados: [seguro(), seguro({ concepto: 'Hogar', exigidoParaElTipo: false })],
    });
    const conceptos = new Set(flujosDelPrestamo(p, generarCuadro(p).plan).map((f) => f.concepto));

    expect(conceptos).toEqual(
      new Set(['Capital', 'Comisión de apertura', 'Tasación', 'Recibo', 'Seguros vinculados'])
    );
  });

  // `esISO` acepta un timestamp con hora, y el orden y el `<=` del calendario
  // de seguros son lexicográficos: '2024-01-15T00:00' no es ≤ '2024-01-15'.
  it('una firma con hora no ensucia el calendario · todo va a día pelado', () => {
    const conHora = fijo({
      fechaFirma: '2024-01-15T09:30:00.000Z',
      segurosVinculados: [seguro()],
    } as Partial<Prestamo>);
    const flujos = flujosDelPrestamo(conHora, generarCuadro(conHora).plan);

    expect(flujos.every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.fecha))).toBe(true);
    // Diez primas · una por cada año que el préstamo vive, la primera el día
    // de la firma. La que caería el día del último recibo NO: ese día se acaba.
    expect(flujos.filter((f) => f.concepto === 'Seguros vinculados')).toHaveLength(10);
    expect(deTae(conHora)).toBeCloseTo(deTae(fijo({ segurosVinculados: [seguro()] })), 2);
  });

  it('el capital entra el día de la firma, y la apertura sale ese mismo día', () => {
    const p = fijo({ comisionApertura: 1 });
    const delDia = flujosDelPrestamo(p, generarCuadro(p).plan).filter(
      (f) => f.fecha === '2024-01-15'
    );

    expect(delDia.find((f) => f.concepto === 'Capital')!.importe).toBe(100000);
    expect(delDia.find((f) => f.concepto === 'Comisión de apertura')!.importe).toBe(-1000);
  });
});

// Lo que la fórmula vieja no podía ver: sumaba componentes, así que el
// calendario le daba igual.
describe('la fecha de cada pago cuenta', () => {
  it('un arranque con días sueltos no da la misma TAE que uno normal', () => {
    const normal = fijo();
    const conDiasSueltos = fijo({
      fechaFirma: '2024-01-02',
      diasSueltosDelArranque: 'CARGO_APARTE',
      baseDiasSueltos: 'ACT/365',
    } as Partial<Prestamo>);

    expect(deTae(conDiasSueltos)).not.toBe(deTae(normal));
  });
});

describe('cuando no hay respuesta, no se inventa una', () => {
  it.each([
    ['sin flujos', []],
    ['con un solo flujo', [{ fecha: '2024-01-15', importe: 100, concepto: 'x' }]],
    ['con una fecha que no lo es', [
      { fecha: 'ayer', importe: 100, concepto: 'x' },
      { fecha: '2024-02-15', importe: -101, concepto: 'y' },
    ]],
    ['si nunca cruza el cero', [
      { fecha: '2024-01-15', importe: -100, concepto: 'x' },
      { fecha: '2024-02-15', importe: -100, concepto: 'y' },
    ]],
  ])('%s → null', (_caso, flujos) => {
    expect(tir(flujos)).toBeNull();
  });

  it('sin plan no hay flujos', () => {
    expect(flujosDelPrestamo(fijo(), null)).toEqual([]);
  });

  it('y sin flujos la TAE es cero, no un número inventado', () => {
    expect(tae(fijo(), null)).toBe(0);
  });
});

// ── El candado · la escritura de Unicaja ────────────────────────────────────
//
// Cláusula QUINTA: «la Tasa Anual Equivalente (TAEVariable) es del 5,079 por
// ciento», calculada conforme a la Ley 5/2019 y bajo la hipótesis de que el
// índice no varía. El Euríbor 12m de julio de 2023 era 4,149 %.
//
// 85.000 € a 240 meses, 2,600 % los primeros 36, después Euríbor + 1,750,
// ACT/365, EXENTA de comisión de apertura, con seguro de daños hogar de 59,98 €
// que la propia escritura incluye en el cálculo.
describe('contra la escritura de Unicaja', () => {
  const real = (): Prestamo =>
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
      segurosVinculados: [
        { concepto: 'Daños hogar', primaAnual: 59.98, exigidoParaElTipo: true, naturaleza: 'GASTO_DEL_INMUEBLE' },
      ],
    }) as unknown as Prestamo;

  it('sale el 5,079 % que dice la cláusula QUINTA', () => {
    expect(deTae(real())).toBeCloseTo(5.08, 2);
  });

  // La escritura informa también de la TAE «con máxima bonificación», y es MÁS
  // ALTA: 5,593 %. No es un error del banco — los productos que hay que
  // contratar para ganar el punto cuestan más de lo que el punto ahorra.
  it('y el punto de bonificación, SOLO, la baja al 4,38 %', () => {
    expect(deTae({ ...real(), diferencial: 0.75 } as Prestamo)).toBeCloseTo(4.38, 2);
  });
});
