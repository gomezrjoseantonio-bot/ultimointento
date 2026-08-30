// La fecha del extracto salía UN DÍA ANTES.
//
// En el fichero de BBVA, la cuota del préstamo es del `02/02/2026` y la pantalla
// decía «domingo 1 feb 2026». Igual con la retirada de efectivo del `30/01/2026`,
// que salía como «29 ene».
//
// El porqué son dos piezas que por separado están bien:
//   · `bankParser.parseSpanishDate` construye `new Date(año, mes-1, día)`, que es
//     medianoche LOCAL.
//   · `isoDate` hacía `.toISOString()`, que pasa a UTC.
// En España (UTC+1 en invierno, +2 en verano) la medianoche local es siempre el
// día ANTERIOR en UTC. El 2 de febrero a las 00:00 de Madrid es el 1 de febrero
// a las 23:00 en Londres.
//
// Una fecha de cargo no es un instante: es un día del calendario. Se lee con los
// mismos componentes con los que se escribió.
//
// NOTA sobre este fichero: bajo TZ=UTC estas comprobaciones pasan incluso con el
// fallo dentro, porque allí no hay desfase. Se han verificado en rojo con
// `TZ=Europe/Madrid` antes del arreglo; queda dicho para que nadie las lea como
// una garantía más fuerte de lo que son en un CI que corre en UTC.

import { isoDate } from '../bankStatementOrchestrator';

describe('una fecha de cargo es un día del calendario, no un instante', () => {
  it('el 2 de febrero sigue siendo el 2 de febrero', () => {
    // Como lo construye `parseSpanishDate`: medianoche local.
    expect(isoDate(new Date(2026, 1, 2))).toBe('2026-02-02');
  });

  it('la retirada del 30 de enero no se va al 29', () => {
    expect(isoDate(new Date(2026, 0, 30))).toBe('2026-01-30');
  });

  it('el primero de mes no se va al mes anterior', () => {
    expect(isoDate(new Date(2026, 7, 1))).toBe('2026-08-01');
  });

  it('el año nuevo no se va a diciembre', () => {
    expect(isoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('una fecha que ya viene en ISO se respeta tal cual', () => {
    expect(isoDate('2026-02-02')).toBe('2026-02-02');
    expect(isoDate('2026-02-02T00:00:00.000Z')).toBe('2026-02-02');
  });

  it('sin fecha no hay fecha', () => {
    expect(isoDate(undefined)).toBeNull();
    expect(isoDate(new Date('no es una fecha'))).toBeNull();
  });
});
