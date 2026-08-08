// El calendario de revisión de un préstamo · UNA periodicidad.
//
// «La hipoteca se revisa una única vez al año o dos al año, y en esa revisión
// se revisa el euríbor + bonificaciones» *(Jose · 8 ago 2026)*.
//
// ATLAS lo tenía partido en dos campos con su propio desplegable «Revisión»
// cada uno en la misma pantalla de alta, y la ficha acababa anunciando dos
// fechas distintas: la del índice arriba y la de bonificaciones en su tarjeta.

import { cadaCuantoRevisa, calendarioDe, proximaRevision, revisionPendiente } from '../revisionDelBanco';

const unicaja = (over: Record<string, unknown> = {}) => ({
  fechaFirma: '2023-08-25',
  periodoRevisionMeses: 12,
  ...over,
});

describe('una sola periodicidad', () => {
  it('la canónica es `periodoRevisionMeses`', () => {
    expect(cadaCuantoRevisa(unicaja())).toBe(12);
  });

  // Los préstamos guardados antes de unificarlas solo tienen la vieja · y en un
  // FIJO es el único sitio donde está, porque el asistente no escribía la
  // canónica dando por hecho que un fijo no revisa nada.
  it('y de respaldo se lee la legada', () => {
    expect(
      cadaCuantoRevisa({ fechaFirma: '2023-08-25', periodoRevisionBonificacionMeses: 6 })
    ).toBe(6);
  });

  // Si las dos están puestas y dicen cosas distintas, decide la canónica · lo
  // que no puede es que una pantalla lea una y otra pantalla la otra.
  it('si las dos están puestas, manda la canónica', () => {
    expect(
      cadaCuantoRevisa(unicaja({ periodoRevisionBonificacionMeses: 6 }))
    ).toBe(12);
  });

  // «No lo dice la escritura» no es «revisa cada cero meses» · de un cero
  // saldría una fecha inventada, y se lee igual que una real.
  it('sin nada guardado, no hay periodicidad', () => {
    expect(cadaCuantoRevisa({ fechaFirma: '2023-08-25' })).toBeNull();
    expect(cadaCuantoRevisa({ fechaFirma: '2023-08-25', periodoRevisionMeses: 0 })).toBeNull();
  });
});

// El candado de fondo: las dos preguntas de la pantalla —«¿cuándo es la
// próxima?» y «¿cuál está esperando respuesta?»— salen del MISMO calendario.
// Antes cada una se montaba a mano en su fichero, con los mismos cuatro campos,
// y bastaba con que una eligiera la otra periodicidad.
describe('las dos preguntas salen del mismo calendario', () => {
  const hoy = '2026-08-08';

  it('la próxima y la pendiente caen en la misma serie', () => {
    const cal = calendarioDe(unicaja());

    expect(proximaRevision(cal, hoy)?.fecha).toBe('2026-08-25');
    expect(revisionPendiente(cal, hoy)?.fecha).toBe('2025-08-25');
  });

  // Un fijo guardado antes de unificar: solo tiene la legada, y aun así tiene
  // calendario. Antes se quedaba sin ninguno.
  it('y un fijo con solo el campo viejo también tiene calendario', () => {
    const cal = calendarioDe({
      fechaFirma: '2023-08-25',
      periodoRevisionBonificacionMeses: 12,
    });

    expect(cal.cadaMeses).toBe(12);
    expect(proximaRevision(cal, hoy)?.fecha).toBe('2026-08-25');
  });

  it('lo que dice el banco sigue mandando sobre la serie deducida', () => {
    const cal = calendarioDe(unicaja({ proximaRevisionBonificaciones: '2026-11' }));

    expect(proximaRevision(cal, hoy)?.fecha).toBe('2026-11');
  });

  it('y el periodo de gracia viaja con el calendario', () => {
    const cal = calendarioDe(unicaja({ graciaMesesBonificaciones: 12 }));

    expect(cal.graciaMeses).toBe(12);
  });
});

// La precisión viaja con la fecha, y hay que mirarla antes de pintarla: una
// revisión que solo se sabe por meses contesta `2026-08`, y un formateador de
// día sobre eso escribe un guion. La pantalla decía «la pierdes el —».
describe('la precisión dice cómo se puede enseñar la fecha', () => {
  const hoy = '2026-08-08';

  it('con la firma sabida, la revisión tiene día', () => {
    const p = proximaRevision(calendarioDe(unicaja()), hoy)!;

    expect(p.precision).toBe('dia');
    expect(p.fecha).toHaveLength(10);
  });

  // Cuando lo que hay es lo que dijo el banco en `YYYY-MM`, no hay día que
  // inventar · y decirlo es lo que permite escribir «en ago 2026».
  it('y lo que da el banco por meses se queda en mes', () => {
    const p = proximaRevision(
      calendarioDe(unicaja({ proximaRevisionBonificaciones: '2026-11' })),
      hoy
    )!;

    expect(p.precision).toBe('mes');
    expect(p.fecha).toHaveLength(7);
  });
});
