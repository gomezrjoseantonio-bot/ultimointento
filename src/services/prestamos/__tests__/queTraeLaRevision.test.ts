// Qué trae la revisión que viene · VOCABULARIO §6 ter · ter.
//
// El aviso decía siempre lo mismo, y esa frase solo habla de bonificaciones:
// respuesta entera en un fijo, media en todos los demás. Lo que vigila esto es
// que no se anuncie lo que no toca —un cambio de tramo que ya pasó, un índice
// en un préstamo que no lo tiene— y que no se calle lo que sí.

import { queTraeLaRevision } from '../queTraeLaRevision';
import type { Prestamo } from '../../../types/prestamos';

const HOY = '2026-08-05';

const bonif = () =>
  ({
    id: 'b1',
    tipo: 'SEGURO_HOGAR',
    nombre: 'Seguro de hogar',
    reduccionPuntosPorcentuales: 1,
    impacto: { puntos: -1 },
    lookbackMeses: 12,
    regla: { tipo: 'SEGURO_HOGAR', activo: true },
    estado: 'SELECCIONADO',
  }) as unknown as NonNullable<Prestamo['bonificaciones']>[number];

/** La hipoteca de la escritura · 25-08-2023, 36 meses al 2,600 %, +1,750. */
const unicaja = (over: Partial<Prestamo> = {}): Prestamo =>
  ({
    id: 'u',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    tipo: 'MIXTO',
    tipoNominalAnualMixtoFijo: 2.6,
    tramoFijoMeses: 36,
    indice: 'EURIBOR',
    valorIndiceActual: 2.1,
    diferencial: 1.75,
    bonificaciones: [bonif()],
    bonificacionesDesde: 'TRAMO_VARIABLE',
    ...over,
  }) as unknown as Prestamo;

describe('un préstamo a tipo fijo', () => {
  it('su revisión no mueve ningún índice · no hay nada más que avisar', () => {
    const fijo = unicaja({ tipo: 'FIJO', tipoNominalAnualFijo: 2.6 });

    expect(queTraeLaRevision(fijo, '2026-12-01', HOY)).toEqual({
      elIndice: false,
      indice: 'EURIBOR',
    });
  });
});

describe('un préstamo variable', () => {
  it('su revisión mueve también el índice', () => {
    const variable = unicaja({ tipo: 'VARIABLE' });

    expect(queTraeLaRevision(variable, '2026-12-01', HOY).elIndice).toBe(true);
  });

  // Sin periodicidad ni fecha del banco no hay cita · se responde sobre el
  // tramo de hoy, que es lo que dice «si la revisión fuera hoy».
  it('sin fecha de revisión se responde sobre el tramo de hoy', () => {
    const variable = unicaja({ tipo: 'VARIABLE' });

    expect(queTraeLaRevision(variable, undefined, HOY).elIndice).toBe(true);
  });

  it('no anuncia ningún cambio de tramo · no tiene', () => {
    const variable = unicaja({ tipo: 'VARIABLE' });

    expect(queTraeLaRevision(variable, '2026-12-01', HOY).acabaElTramoFijo).toBeUndefined();
  });
});

// El día que lo cambia todo · el 25 de agosto de 2026 se acaban los 36 meses al
// 2,600 %, entra el Euríbor + 1,750 y las bonificaciones empiezan a rebajar.
describe('el mixto de la escritura, veinte días antes', () => {
  it('anuncia el día, el tipo que se acaba y a qué se pasa', () => {
    expect(queTraeLaRevision(unicaja(), undefined, HOY)).toEqual({
      elIndice: false,
      indice: 'EURIBOR',
      acabaElTramoFijo: '2026-08-25',
      tinQueAcaba: 2.6,
      diferencial: 1.75,
      estrenanLasBonificaciones: true,
    });
  });

  // En un mixto que ya bonifica desde la firma no hay estreno que anunciar ·
  // decirlo sería anunciar algo que el usuario ya está pagando rebajado.
  it('si ya bonificaban desde la firma, no se estrena nada', () => {
    const ing = unicaja({ bonificacionesDesde: 'FIRMA' });

    expect(queTraeLaRevision(ing, undefined, HOY).estrenanLasBonificaciones).toBe(false);
  });

  it('sin bonificaciones tampoco', () => {
    const sinBonis = unicaja({ bonificaciones: [] });

    expect(queTraeLaRevision(sinBonis, undefined, HOY).estrenanLasBonificaciones).toBe(false);
  });
});

// Un cambio de tramo que ya pasó no es un aviso, es historia.
describe('el mismo mixto, ya en su fase variable', () => {
  const despues = '2027-01-15';

  it('no vuelve a anunciar el cambio de tramo', () => {
    expect(queTraeLaRevision(unicaja(), undefined, despues).acabaElTramoFijo).toBeUndefined();
  });

  it('pero sí dice que su revisión mueve el índice', () => {
    expect(queTraeLaRevision(unicaja(), '2028-01-15', despues).elIndice).toBe(true);
  });
});

// La revisión viene en MES Y AÑO cuando la da el banco («Próxima revisión
// 08/2027»), y `tramoVigente` compara cadenas ISO: '2027-08-25' no es menor o
// igual que '2027-08'. Sin completar la fecha, un tramo que empieza dentro de
// ese mes salía como «todavía no ha llegado».
describe('una revisión dicha solo en mes y año', () => {
  const enFaseVariable = (dia: string) =>
    unicaja({ fechaFirma: `2023-08-${dia}`, tramoFijoMeses: 12 });

  it.each(['01', '15', '28'])('ve el tramo que entra el día %s de ese mes', (dia) => {
    // El tramo variable arranca el 2024-08-DD · la revisión, «agosto de 2024».
    expect(queTraeLaRevision(enFaseVariable(dia), '2024-08', '2024-08-30').elIndice).toBe(true);
  });

  // Y no se pasa de lista: el mes anterior sigue siendo tramo fijo.
  it('el mes anterior al cambio todavía no lo ve', () => {
    expect(queTraeLaRevision(enFaseVariable('15'), '2024-07', '2024-07-01').elIndice).toBe(false);
  });
});
