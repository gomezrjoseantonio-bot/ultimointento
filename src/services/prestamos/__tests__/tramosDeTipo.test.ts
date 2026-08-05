// A qué tipo se paga cada tramo · VOCABULARIO §6 bis · bis.
//
// Lo que vigila esto es que no se invente un tipo. El Euríbor de mañana no se
// sabe, y un número inventado se lee igual que uno real: de él salen la cuota
// que se enseña, las previsiones de tesorería y los intereses del ejercicio.
//
// Lo que ya pasó sale de las cartas que el usuario haya apuntado. Lo que viene
// se proyecta con el último tipo conocido, y va marcado como estimación.

import { tramosDeTipo } from '../tramosDeTipo';
import type { Prestamo } from '../../../types/prestamos';

const prestamo = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'p1',
    principalInicial: 150000,
    plazoMesesTotal: 360,
    fechaFirma: '2021-06-15',
    tipo: 'FIJO',
    tipoNominalAnualFijo: 2.1,
    ...over,
  }) as unknown as Prestamo;

const mixto = (over: Partial<Prestamo> = {}): Prestamo =>
  prestamo({
    tipo: 'MIXTO',
    tipoNominalAnualFijo: undefined,
    tipoNominalAnualMixtoFijo: 2,
    tramoFijoMeses: 36,
    valorIndiceActual: 2.2,
    diferencial: 0.9,
    ...over,
  });

const variable = (over: Partial<Prestamo> = {}): Prestamo =>
  prestamo({
    tipo: 'VARIABLE',
    tipoNominalAnualFijo: undefined,
    valorIndiceActual: 2.2,
    diferencial: 0.9,
    ...over,
  });

describe('un préstamo fijo', () => {
  it('tiene un solo tramo, y no es una estimación', () => {
    expect(tramosDeTipo(prestamo())).toEqual([
      { desde: '2021-06-15', tinBase: 2.1, estimado: false },
    ]);
  });
});

// Una mixta 3+27 decía que ibas a pagar el tipo fijo durante treinta años. La
// fecha del cambio está en la escritura: no partirla es esconder un dato que sí
// se sabe.
describe('un préstamo mixto', () => {
  it('se parte cuando acaba el tramo fijo', () => {
    expect(tramosDeTipo(mixto())).toEqual([
      { desde: '2021-06-15', tinBase: 2, estimado: false },
      { desde: '2024-06-15', tinBase: 3.1, estimado: true },
    ]);
  });

  // Se sabe CUÁNDO cambia, no a cuánto · el tipo de después es una proyección
  // con el índice de hoy, y la pantalla tiene que poder decirlo.
  it('el tramo variable va marcado como estimación', () => {
    expect(tramosDeTipo(mixto())[1].estimado).toBe(true);
  });

  it('un tramo fijo tan largo como el préstamo no lo parte', () => {
    expect(tramosDeTipo(mixto({ tramoFijoMeses: 360 }))).toHaveLength(1);
  });

  it('sin meses de tramo fijo no se inventa la fecha del cambio', () => {
    expect(tramosDeTipo(mixto({ tramoFijoMeses: undefined }))).toHaveLength(1);
  });
});

describe('un préstamo variable', () => {
  // «El índice actual» es el de hoy · para una hipoteca de hace cinco años no
  // es el que aplicó al firmar, y decir lo contrario sería inventárselo.
  it('sin revisiones apuntadas, su único tramo es una estimación', () => {
    expect(tramosDeTipo(variable())).toEqual([
      { desde: '2021-06-15', tinBase: 3.1, estimado: true },
    ]);
  });

  it('cada revisión apuntada parte el cuadro, y esas sí son hechos', () => {
    const p = variable({
      revisionesDeTipo: [
        { desde: '2023-06-15', valorIndice: 4.007 },
        { desde: '2022-06-15', valorIndice: 0.852 },
      ],
    });

    expect(tramosDeTipo(p)).toEqual([
      { desde: '2021-06-15', tinBase: 3.1, estimado: true },
      { desde: '2022-06-15', tinBase: 1.752, estimado: false },
      { desde: '2023-06-15', tinBase: 4.907, estimado: false },
    ]);
  });

  // Sabemos cuándo revisa el banco, no a cuánto. Partir el cuadro por una fecha
  // futura para volver a poner el MISMO tipo no cambia nada y añade ruido.
  it('después de la última apuntada no se proyecta ninguna más', () => {
    const p = variable({
      periodoRevisionMeses: 12,
      revisionesDeTipo: [{ desde: '2022-06-15', valorIndice: 0.852 }],
    });

    expect(tramosDeTipo(p)).toHaveLength(2);
  });

  // El dato bueno de ese día es el de la carta, no la presunción.
  it('una revisión el día de la firma sustituye a la presunción', () => {
    const p = variable({ revisionesDeTipo: [{ desde: '2021-06-15', valorIndice: -0.484 }] });

    expect(tramosDeTipo(p)).toEqual([
      { desde: '2021-06-15', tinBase: 0.416, estimado: false },
    ]);
  });
});

// Una revisión del índice durante el tramo fijo de un mixto movería una cuota
// que por contrato no se mueve.
describe('las revisiones que no aplican', () => {
  it('una anterior al fin del tramo fijo no cuenta', () => {
    const p = mixto({ revisionesDeTipo: [{ desde: '2022-06-15', valorIndice: 0.852 }] });

    expect(tramosDeTipo(p)).toHaveLength(2);
    expect(tramosDeTipo(p)[1].tinBase).toBe(3.1);
  });

  it('una posterior sí, y sustituye a la estimación si cae el mismo día', () => {
    const p = mixto({ revisionesDeTipo: [{ desde: '2024-06-15', valorIndice: 3.5 }] });

    expect(tramosDeTipo(p)).toEqual([
      { desde: '2021-06-15', tinBase: 2, estimado: false },
      { desde: '2024-06-15', tinBase: 4.4, estimado: false },
    ]);
  });

  it.each([
    ['sin fecha', { desde: '', valorIndice: 2 }],
    ['con fecha inventada', { desde: '15/06/2023', valorIndice: 2 }],
    ['sin valor', { desde: '2023-06-15', valorIndice: undefined }],
    ['con valor no numérico', { desde: '2023-06-15', valorIndice: NaN }],
  ])('una %s no cuenta', (_caso, revision) => {
    const p = variable({ revisionesDeTipo: [revision as never] });

    expect(tramosDeTipo(p)).toHaveLength(1);
  });
});
