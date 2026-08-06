// La fecha de cargo de un recurrente fiscal.
//
// El día de cobro es un número del 1 al 31 que vale para TODOS los meses, así
// que hay que bajarlo cuando el mes se queda corto. Concatenarlo sin acotar
// producía `2026-02-31`, y `Date` no protesta: rueda al mes siguiente.
//
// El criterio tiene que ser el MISMO que el del motor de tesorería
// (`fechaDiaFijoDelMes` en `personal/patronCalendario`), porque los dos generan
// el mismo recibo y tenerlo escrito de dos formas era la razón de que Tesorería
// dijera 2027-02-28 y Fiscalidad 2027-02-31.

import { fechaDeCargo, mesDeISO } from '../operacionFiscalService';

describe('fechaDeCargo', () => {
  it('el día 31 en febrero baja al 28', () => {
    expect(fechaDeCargo(2026, 2, 31)).toBe('2026-02-28');
  });

  it('…y al 29 si el año es bisiesto', () => {
    expect(fechaDeCargo(2028, 2, 31)).toBe('2028-02-29');
  });

  it('el día 31 en los meses de 30 baja al 30', () => {
    expect(fechaDeCargo(2026, 4, 31)).toBe('2026-04-30');
    expect(fechaDeCargo(2026, 6, 31)).toBe('2026-06-30');
    expect(fechaDeCargo(2026, 9, 31)).toBe('2026-09-30');
    expect(fechaDeCargo(2026, 11, 31)).toBe('2026-11-30');
  });

  it('un día que cabe se respeta', () => {
    expect(fechaDeCargo(2026, 1, 31)).toBe('2026-01-31');
    expect(fechaDeCargo(2026, 8, 15)).toBe('2026-08-15');
  });

  it('sin día de cobro se usa el 1 · nunca el día 0', () => {
    expect(fechaDeCargo(2026, 5, 0)).toBe('2026-05-01');
  });

  it('el resultado SIEMPRE es una fecha que existe', () => {
    // La garantía dura, mes a mes y con bisiesto por medio.
    for (const anio of [2026, 2027, 2028]) {
      for (let mes = 1; mes <= 12; mes++) {
        const iso = fechaDeCargo(anio, mes, 31);
        const d = new Date(iso);
        expect(d.getMonth()).toBe(mes - 1);   // no ha rodado al mes siguiente
      }
    }
  });

  it('coincide con lo que produce el motor de tesorería', () => {
    // `fechaDiaFijoDelMes`: new Date(year, month0, Math.min(dia, ultimo)).
    for (let mes = 1; mes <= 12; mes++) {
      const ultimo = new Date(2027, mes, 0).getDate();
      const esperado = `2027-${String(mes).padStart(2, '0')}-${String(Math.min(31, ultimo)).padStart(2, '0')}`;
      expect(fechaDeCargo(2027, mes, 31)).toBe(esperado);
    }
  });
});

describe('mesDeISO', () => {
  it('lee el mes del texto, sin pasar por Date', () => {
    expect(mesDeISO('2026-02-15')).toBe(2);
    expect(mesDeISO('2026-12-01')).toBe(12);
  });

  it('una fecha imposible conserva SU mes · Date la habría rodado', () => {
    // `new Date('2026-02-31').getMonth() + 1` daría 3 (marzo).
    expect(mesDeISO('2026-02-31')).toBe(2);
  });
});
