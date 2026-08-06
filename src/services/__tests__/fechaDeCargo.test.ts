// Leer el mes de una fecha fiscal.
//
// Parece una tontería y no lo es: `new Date('2026-02-31')` no falla, RUEDA al 3
// de marzo. `limpiarDuplicadosRecurrentes` agrupa por mes, así que leerlo con
// `Date` le hacía creer que una línea de febrero era de marzo — justo en los
// registros que el bug de la fecha había estropeado.
//
// La generación de fechas imposibles ya no es posible: las fechas las produce
// `expandirPatron`, el mismo motor que tesorería, que acota el día al último
// del mes por construcción. Esto cubre la lectura de lo que quedó escrito.

import { mesDeISO } from '../operacionFiscalService';

describe('mesDeISO', () => {
  it('lee el mes del texto', () => {
    expect(mesDeISO('2026-02-15')).toBe(2);
    expect(mesDeISO('2026-12-01')).toBe(12);
  });

  it('una fecha imposible conserva SU mes · Date la habría rodado', () => {
    // `new Date('2026-02-31').getMonth() + 1` daría 3 (marzo).
    expect(mesDeISO('2026-02-31')).toBe(2);
    expect(mesDeISO('2026-04-31')).toBe(4);
  });

  it('acepta una fecha ISO con hora detrás', () => {
    expect(mesDeISO('2026-07-15T00:00:00.000Z')).toBe(7);
  });
});
