// Lo que cuesta adelantar dinero · VOCABULARIO §6 bis · quater.
//
// Lo que vigila esto es la UNIDAD, que estaba rota de cuatro maneras a la vez:
// dos sitios multiplicaban el campo en crudo —leyéndolo como fracción— y otros
// dos adivinaban por el tamaño. Un 0,25 % pactado salía como un 25 %: en una
// amortización de 30.000 € son 7.500 € en vez de 75 €.
//
// Y la heurística fallaba justo donde más duele: los topes que la ley fija para
// el variable son 0,25 % y 0,15 %, y para el consumo 1 % y 0,5 % — todos por
// debajo de 1, o sea que «≤ 1 es una fracción» erraba en todas las cifras que
// la ley prescribe y acertaba solo en las del fijo.

import { comisionDeReembolso } from '../comisiones';
import type { Prestamo } from '../../../types/prestamos';

const prestamo = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    fechaFirma: '2021-06-15',
    ...over,
  }) as unknown as Prestamo;

describe('la unidad son puntos porcentuales', () => {
  it('0,25 es un 0,25 %, no un 25 %', () => {
    const r = comisionDeReembolso(prestamo({ comisionAmortizacionAnticipada: 0.25 }), {
      tipo: 'PARCIAL',
      importe: 30000,
    });

    expect(r.importe).toBe(75);
  });

  it('2 es un 2 %', () => {
    const r = comisionDeReembolso(prestamo({ comisionAmortizacionAnticipada: 2 }), {
      tipo: 'PARCIAL',
      importe: 30000,
    });

    expect(r.importe).toBe(600);
  });

  // Las cifras que fija la ley para el variable · las que la heurística `<= 1`
  // convertía en un disparate.
  it.each([
    [0.25, 75],
    [0.15, 45],
    [0.5, 150],
    [1, 300],
  ])('%s %% de 30.000 € son %s €', (porcentaje, esperado) => {
    const r = comisionDeReembolso(prestamo({ comisionCancelacionTotal: porcentaje }), {
      tipo: 'TOTAL',
      importe: 30000,
    });

    expect(r.importe).toBe(esperado);
  });
});

// Los topes legales son MÁXIMOS: nada obliga a que parcial y total se pacten
// iguales, y lo normal es que no lo sean.
//
//   «Yo por ejemplo tenía que si cancelaba totalmente la hipoteca era un
//    0,25 % pero parcial era un 0… el propio banco me dijo: cancelas
//    parcialmente todo menos una cuota y listo.» — Jose, 5 ago 2026
describe('parcial y total son dos comisiones', () => {
  const suHipoteca = prestamo({
    comisionAmortizacionAnticipada: 0,
    comisionCancelacionTotal: 0.25,
  });

  it('cancelar del todo cuesta', () => {
    expect(comisionDeReembolso(suHipoteca, { tipo: 'TOTAL', importe: 100000 }).importe).toBe(250);
  });

  it('adelantar una parte no', () => {
    expect(comisionDeReembolso(suHipoteca, { tipo: 'PARCIAL', importe: 100000 }).importe).toBe(0);
  });

  // El truco que le dijo su propio banco · si las dos fueran una sola cifra,
  // ATLAS no podría ni representar esta hipoteca.
  it('dejar viva una cuota convierte la cancelación en una amortización parcial', () => {
    const total = comisionDeReembolso(suHipoteca, { tipo: 'TOTAL', importe: 100000 }).importe;
    const casiTodo = comisionDeReembolso(suHipoteca, { tipo: 'PARCIAL', importe: 99500 }).importe;

    expect(total).toBeGreaterThan(0);
    expect(casiTodo).toBe(0);
  });
});

// Una comisión no suele ser un número: cambia con el tiempo. «2 % los diez
// primeros años y 1,50 % después» son dos tramos, y con un solo campo no se
// puede escribir.
describe('el calendario', () => {
  const hipotecaFija = prestamo({
    fechaFirma: '2021-06-15',
    comisionReembolsoParcial: {
      tramos: [{ hastaMes: 120, porcentaje: 2 }, { porcentaje: 1.5 }],
      origen: 'ESCRITURA',
    },
  });

  it('el primer tramo rige al principio', () => {
    const r = comisionDeReembolso(hipotecaFija, {
      tipo: 'PARCIAL',
      importe: 30000,
      fecha: '2025-01-10',
    });

    expect(r.porcentaje).toBe(2);
    expect(r.importe).toBe(600);
  });

  it('y el siguiente cuando el primero se agota', () => {
    const r = comisionDeReembolso(hipotecaFija, {
      tipo: 'PARCIAL',
      importe: 30000,
      fecha: '2032-01-10',
    });

    expect(r.porcentaje).toBe(1.5);
    expect(r.importe).toBe(450);
  });

  // El mes 120 ya está fuera del tramo «hasta el mes 120» · son los diez
  // primeros años, no diez años y un mes.
  it('el mes del tope ya es del tramo siguiente', () => {
    expect(
      comisionDeReembolso(hipotecaFija, {
        tipo: 'PARCIAL',
        importe: 30000,
        fecha: '2031-06-15',
      }).porcentaje
    ).toBe(1.5);
  });

  it('el mes anterior todavía no', () => {
    expect(
      comisionDeReembolso(hipotecaFija, {
        tipo: 'PARCIAL',
        importe: 30000,
        fecha: '2031-05-15',
      }).porcentaje
    ).toBe(2);
  });

  // El variable de la Ley 5/2019 · cobra los tres primeros años y después nada.
  it('un calendario que acaba en cero deja de cobrar', () => {
    const variable = prestamo({
      fechaFirma: '2021-06-15',
      comisionReembolsoParcial: {
        tramos: [{ hastaMes: 36, porcentaje: 0.25 }, { porcentaje: 0 }],
        origen: 'ESCRITURA',
      },
    });

    const dentro = comisionDeReembolso(variable, {
      tipo: 'PARCIAL', importe: 30000, fecha: '2023-01-10',
    });
    const fuera = comisionDeReembolso(variable, {
      tipo: 'PARCIAL', importe: 30000, fecha: '2025-01-10',
    });

    expect(dentro.importe).toBe(75);
    expect(fuera.importe).toBe(0);
    expect(fuera.agotada).toBe(true);
  });

  // Sin fecha no se puede saber qué tramo rige · se toma el primero, que es lo
  // que el contrato cobra hoy mientras nadie diga otra cosa.
  it('sin fecha rige el primer tramo', () => {
    expect(comisionDeReembolso(hipotecaFija, { tipo: 'PARCIAL', importe: 30000 }).porcentaje)
      .toBe(2);
  });
});

// Un porcentaje suelto es un calendario de un solo tramo · los préstamos de
// antes lo guardaban así, y mantener dos formas de lo mismo es lo que llevamos
// toda la sesión deshaciendo.
describe('lo que guardaban los préstamos de antes', () => {
  it('un porcentaje suelto se lee como un tramo único', () => {
    const antiguo = prestamo({ comisionCancelacionTotal: 0.5 });
    const r = comisionDeReembolso(antiguo, { tipo: 'TOTAL', importe: 30000 });

    expect(r.importe).toBe(150);
    expect(r.hayPactada).toBe(true);
    expect(r.origen).toBe('ESCRITURA');
  });

  it('y el calendario manda sobre él si existe', () => {
    const p = prestamo({
      comisionCancelacionTotal: 0.5,
      comisionReembolsoTotal: { tramos: [{ porcentaje: 2 }], origen: 'ESCRITURA' },
    });

    expect(comisionDeReembolso(p, { tipo: 'TOTAL', importe: 30000 }).porcentaje).toBe(2);
  });
});

// Una cifra que propuso ATLAS no es una leída de la escritura · la pantalla
// tiene que poder decirlo.
describe('de dónde sale la cifra', () => {
  it('lo propuesto va marcado', () => {
    const p = prestamo({
      comisionReembolsoTotal: {
        tramos: [{ hastaMes: 36, porcentaje: 0.25 }, { porcentaje: 0 }],
        origen: 'TOPE_LEGAL',
      },
    });

    expect(comisionDeReembolso(p, { tipo: 'TOTAL', importe: 30000 }).origen).toBe('TOPE_LEGAL');
  });
});

// «No hay comisión» y «la había pero se agotó» son cosas distintas, y la
// pantalla tiene que poder decir cuál.
describe('no cobrar nada tiene dos motivos', () => {
  it('sin comisión pactada, no es que se agotara · es que no hay', () => {
    const r = comisionDeReembolso(prestamo(), { tipo: 'PARCIAL', importe: 30000 });

    expect(r.importe).toBe(0);
    expect(r.hayPactada).toBe(false);
    expect(r.agotada).toBe(false);
  });

  it('pactada al 0 % tampoco se da por agotada', () => {
    const p = prestamo({
      comisionReembolsoParcial: { tramos: [{ porcentaje: 0 }], origen: 'ESCRITURA' },
    });

    expect(comisionDeReembolso(p, { tipo: 'PARCIAL', importe: 30000 }).agotada).toBe(false);
  });
});

describe('lo que no se puede calcular', () => {
  it.each([0, -1000])('adelantar %s € no cuesta nada', (importe) => {
    const r = comisionDeReembolso(prestamo({ comisionCancelacionTotal: 1 }), {
      tipo: 'TOTAL',
      importe,
    });

    expect(r.importe).toBe(0);
    // Pero la comisión sigue existiendo · el cero es del importe, no del pacto.
    expect(r.porcentaje).toBe(1);
    expect(r.hayPactada).toBe(true);
  });

  it.each([undefined, NaN, -0.5])('un porcentaje %s no cobra nada', (pct) => {
    expect(
      comisionDeReembolso(prestamo({ comisionCancelacionTotal: pct as number }), {
        tipo: 'TOTAL',
        importe: 30000,
      }).importe
    ).toBe(0);
  });
});
