// Fechas que no existen en `gastosInmueble`.
//
// El daño no es cosmético: `Date` no rechaza `2026-02-31`, la hace RODAR al 3
// de marzo. Quien lea la fecha con `Date` imputa el gasto a otro mes sin
// avisar, y eso incluye a `limpiarDuplicadosRecurrentes`, que agrupa por mes.

import { acotarFecha, esFechaImposible } from '../fixFechasImposiblesGastos';

describe('esFechaImposible', () => {
  it('el 31 de febrero no existe', () => {
    expect(esFechaImposible('2026-02-31')).toBe(true);
  });

  it('el 31 de abril, junio, septiembre y noviembre tampoco', () => {
    for (const iso of ['2026-04-31', '2026-06-31', '2026-09-31', '2026-11-31']) {
      expect(esFechaImposible(iso)).toBe(true);
    }
  });

  it('el 29 de febrero SÍ existe en bisiesto', () => {
    expect(esFechaImposible('2028-02-29')).toBe(false);
  });

  it('el 29 de febrero NO existe en año normal', () => {
    expect(esFechaImposible('2026-02-29')).toBe(true);
  });

  it('las fechas válidas se dejan en paz', () => {
    for (const iso of ['2026-01-31', '2026-02-28', '2026-04-30', '2026-12-31']) {
      expect(esFechaImposible(iso)).toBe(false);
    }
  });

  it('lo que no tiene forma de fecha ISO no se juzga', () => {
    // Mejor no tocar algo que no se entiende que arreglarlo a ciegas.
    expect(esFechaImposible('')).toBe(false);
    expect(esFechaImposible('no es una fecha')).toBe(false);
  });
});

describe('acotarFecha', () => {
  it('baja el día al último del mes, conservando año y mes', () => {
    expect(acotarFecha('2026-02-31')).toBe('2026-02-28');
    expect(acotarFecha('2026-04-31')).toBe('2026-04-30');
  });

  it('en bisiesto febrero llega al 29', () => {
    expect(acotarFecha('2028-02-31')).toBe('2028-02-29');
  });

  it('una fecha válida sale idéntica · el llamador se salta la escritura', () => {
    expect(acotarFecha('2026-03-31')).toBe('2026-03-31');
  });

  it('es idempotente · la segunda pasada no cambia nada', () => {
    const una = acotarFecha('2026-02-31');
    expect(acotarFecha(una)).toBe(una);
  });

  it('NO recalcula la fecha · el mes del registro se respeta', () => {
    // `Date` rodaría 2026-02-31 a marzo. Aquí el mes es dato bueno: sólo el
    // día estaba mal, y cambiar el mes movería el gasto de ejercicio o de
    // trimestre.
    expect(acotarFecha('2026-02-31').slice(0, 7)).toBe('2026-02');
  });

  it('lo que no es una fecha ISO se devuelve tal cual', () => {
    expect(acotarFecha('vete a saber')).toBe('vete a saber');
  });

  it('un mes fuera de rango no se toca · no se inventa un arreglo', () => {
    expect(acotarFecha('2026-13-31')).toBe('2026-13-31');
  });
});
