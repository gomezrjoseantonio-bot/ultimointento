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

// Casi todas se pactan «durante los N primeros años». Pasada la ventana la
// comisión es cero, y eso cambia el resultado de cada simulación.
describe('la ventana', () => {
  const conVentana = prestamo({
    fechaFirma: '2021-06-15',
    comisionAmortizacionAnticipada: 0.25,
    comisionAmortizacionVigenciaMeses: 36,
  });

  it('dentro de los tres años se cobra', () => {
    const r = comisionDeReembolso(conVentana, {
      tipo: 'PARCIAL',
      importe: 30000,
      fecha: '2024-01-10',
    });

    expect(r.importe).toBe(75);
    expect(r.fueraDeVentana).toBe(false);
  });

  it('pasados, no', () => {
    const r = comisionDeReembolso(conVentana, {
      tipo: 'PARCIAL',
      importe: 30000,
      fecha: '2024-07-10',
    });

    expect(r.importe).toBe(0);
    expect(r.fueraDeVentana).toBe(true);
  });

  // El día que se cumplen los 36 meses ya está fuera · la ventana son los tres
  // primeros años, no tres años y un día.
  it('el día que se cumplen, ya está fuera', () => {
    expect(
      comisionDeReembolso(conVentana, { tipo: 'PARCIAL', importe: 30000, fecha: '2024-06-15' })
        .fueraDeVentana
    ).toBe(true);
  });

  it('el día anterior todavía dentro', () => {
    expect(
      comisionDeReembolso(conVentana, { tipo: 'PARCIAL', importe: 30000, fecha: '2024-06-14' })
        .importe
    ).toBe(75);
  });

  // Sin ventana dicha, el contrato la cobra siempre.
  it('sin ventana se cobra toda la vida', () => {
    const sinVentana = prestamo({ comisionCancelacionTotal: 0.5 });

    expect(
      comisionDeReembolso(sinVentana, { tipo: 'TOTAL', importe: 30000, fecha: '2050-01-01' })
        .importe
    ).toBe(150);
  });

  // Sin fecha de operación no se puede saber si sigue abierta · se cobra, que
  // es lo que dice el contrato, en vez de un cero inventado.
  it('sin fecha se toma por abierta', () => {
    expect(comisionDeReembolso(conVentana, { tipo: 'PARCIAL', importe: 30000 }).importe).toBe(75);
  });
});

// «No hay comisión» y «la había pero se agotó» son cosas distintas, y la
// pantalla tiene que poder decir cuál.
describe('no cobrar nada tiene dos motivos', () => {
  it('sin comisión pactada no está fuera de ventana, es que no hay', () => {
    const r = comisionDeReembolso(prestamo(), { tipo: 'PARCIAL', importe: 30000 });

    expect(r.importe).toBe(0);
    expect(r.fueraDeVentana).toBe(false);
    expect(r.porcentaje).toBe(0);
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
