// La presunción de índice sale de «Actualizar valores», no de un campo del alta.
//
// El fallo que arregla, visto en pantalla *(Jose · 8 ago 2026)*: la ficha del
// préstamo decía «euríbor 2,850» y «Actualizar valores» decía 4,000. El 2,850
// era `valorIndiceActual`, escrito al dar de alta la hipoteca y nunca tocado
// desde entonces, enseñado con tres decimales como si el banco lo hubiera
// fijado. Y **no hay euríbor fijado hasta que se confirma una revisión**.

import { conIndiceDeHoy } from '../indiceDeHoy';
import { cuadroDe, getCuota } from '../lecturas';
import { tramoVigente } from '../tramosDeTipo';
import type { Prestamo } from '../../../types/prestamos';

const variable = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'v1',
    nombre: 'Hipoteca variable',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    fechaPrimerCargo: '2023-09-25',
    diaCargoMes: 25,
    tipo: 'VARIABLE',
    indice: 'EURIBOR',
    valorIndiceActual: 2.85,
    diferencial: 1.75,
    baseCalculoIntereses: 'ACT/365',
    esquemaPrimerRecibo: 'NORMAL',
    periodoRevisionBonificacionMeses: 12,
    ...over,
  }) as unknown as Prestamo;

describe('la presunción se pone al día', () => {
  it('el índice de valoraciones sustituye al del alta', () => {
    expect(conIndiceDeHoy(variable(), 4).valorIndiceActual).toBe(4);
  });

  it('y eso mueve el tipo que la ficha enseña', () => {
    // 2,850 + 1,750 = 4,600 · 4,000 + 1,750 = 5,750.
    expect(tramoVigente(variable(), '2026-08-08').tinBase).toBeCloseTo(4.6, 3);
    expect(tramoVigente(conIndiceDeHoy(variable(), 4), '2026-08-08').tinBase).toBeCloseTo(5.75, 3);
  });

  it('y la cuota que se enseña', () => {
    const antes = getCuota(cuadroDe(variable()), '2026-08-08');
    const ahora = getCuota(cuadroDe(conIndiceDeHoy(variable(), 4)), '2026-08-08');

    expect(ahora).toBeGreaterThan(antes);
  });
});

describe('lo confirmado NO lo toca', () => {
  const hoy = '2026-12-01';

  // Una revisión apuntada es un hecho de una carta del banco. El euríbor de hoy
  // no la mueve · ese es justo el candado que separa lo confirmado de lo
  // presumido, y sin él «Actualizar valores» reescribiría los doce meses en
  // curso cada vez que alguien apunta el índice del mes.
  it('un tramo venido de una revisión sigue en su índice', () => {
    const revisada = variable({
      revisionesDeTipo: [{ desde: '2026-08-25', valorIndice: 2.0 }],
    } as Partial<Prestamo>);

    expect(tramoVigente(revisada, hoy).tinBase).toBeCloseTo(3.75, 3);
    expect(tramoVigente(conIndiceDeHoy(revisada, 4), hoy).tinBase).toBeCloseTo(3.75, 3);
  });

  // Y la cuota tampoco, CUANDO todo lo anterior a la revisión es un hecho: la
  // mixta de Unicaja va 36 meses al 2,600 % escriturado y revisa justo al
  // salir, así que ni el tipo ni el capital de ese día dependen de presunción
  // ninguna. Es el caso de la pantalla.
  it('y en una mixta la cuota que se paga no se mueve', () => {
    const mixta = variable({
      tipo: 'MIXTO',
      tipoNominalAnualMixtoFijo: 2.6,
      tramoFijoMeses: 36,
      revisionesDeTipo: [{ desde: '2026-08-25', valorIndice: 2.0 }],
    } as Partial<Prestamo>);

    expect(getCuota(cuadroDe(conIndiceDeHoy(mixta, 4)), hoy)).toBe(
      getCuota(cuadroDe(mixta), hoy)
    );
  });

  // Lo que sí se mueve, y tiene que moverse: en una variable pura sin ninguna
  // revisión apuntada, los años anteriores también son presunción. Cambiar el
  // índice cambia cuánto se supone amortizado, y por tanto la cuota de después.
  // No lo arregla una fórmula · lo arregla apuntar las revisiones que hubo.
  it('pero en una variable sin revisiones apuntadas, el pasado también es presunción', () => {
    const soloUnaRevision = variable({
      revisionesDeTipo: [{ desde: '2026-08-25', valorIndice: 2.0 }],
    } as Partial<Prestamo>);

    expect(getCuota(cuadroDe(conIndiceDeHoy(soloUnaRevision, 4)), hoy)).not.toBe(
      getCuota(cuadroDe(soloUnaRevision), hoy)
    );
  });
});

describe('cuándo no hay nada que poner al día', () => {
  it('un fijo no tiene índice', () => {
    const fijo = variable({ tipo: 'FIJO', tipoNominalAnualFijo: 3 } as Partial<Prestamo>);

    expect(conIndiceDeHoy(fijo, 4)).toBe(fijo);
  });

  // Nada de `?? 0`: sin valoraciones leídas se deja lo que hubiera, que al menos
  // alguien escribió. Un euríbor al cero por ciento se lee igual que uno real.
  it('sin índice conocido se deja el préstamo como está', () => {
    const p = variable();

    expect(conIndiceDeHoy(p, null)).toBe(p);
    expect(conIndiceDeHoy(p, undefined)).toBe(p);
    expect(conIndiceDeHoy(p, NaN)).toBe(p);
  });

  // La misma referencia · si no, cada render sería un préstamo nuevo para los
  // `useMemo` que cuelgan de él, y el cuadro se regeneraría entero por gusto.
  it('y si ya coincide, devuelve el mismo objeto', () => {
    const p = variable();

    expect(conIndiceDeHoy(p, 2.85)).toBe(p);
  });
});
