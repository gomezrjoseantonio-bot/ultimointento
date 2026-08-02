// ¿Es una retirada de efectivo?
//
// Solo PROPONE: lo que decide es el usuario en §4.7. Por eso el candado mira
// dos cosas distintas — que reconozca lo que de verdad lo es, y sobre todo que
// NO se pase de listo: proponer un traspaso donde no lo hay movería dinero
// entre cuentas por una palabra suelta en el extracto.

import { pareceRetiradaDeCajero } from '../retiradaCajero';

const CARGO = -200;

describe('reconoce cómo lo nombra cada banco', () => {
  it.each([
    'REINTEGRO CAJERO 4B 12345',
    'Reintegro en efectivo',
    'DISPOSICION CAJERO AUTOMATICO',
    'DISP. CAJERO OFICINA 0049',
    'RETIRADA DE EFECTIVO',
    'CAJERO AUTOMATICO PLAZA MAYOR',
    'TELEBANCO 4B MADRID',
    'SERVIRED COMPRA CAJERO',
    'EURO 6000 REINTEGRO',
  ])('%s', (texto) => {
    expect(pareceRetiradaDeCajero(texto, CARGO)).toBe(true);
  });

  // Los extractos llegan en mayúsculas, sin tildes y con la puntuación que a
  // cada banco le parece.
  it('da igual cómo venga escrito', () => {
    expect(pareceRetiradaDeCajero('reintegro', CARGO)).toBe(true);
    expect(pareceRetiradaDeCajero('RE-INTEGRO', CARGO)).toBe(false);
    expect(pareceRetiradaDeCajero('  Reintegro.  ', CARGO)).toBe(true);
  });
});

describe('no se pasa de listo', () => {
  // Un INGRESO en cajero lleva la misma palabra y es lo contrario: dinero que
  // entra. Proponer ahí un traspaso a efectivo lo dejaría del revés.
  it('un ingreso en cajero NO es una retirada', () => {
    expect(pareceRetiradaDeCajero('INGRESO EN CAJERO AUTOMATICO', 300)).toBe(false);
    expect(pareceRetiradaDeCajero('REINTEGRO', 200)).toBe(false);
  });

  it.each([
    'RECIBO IBERDROLA CLIENTES SAU',
    'TRANSFERENCIA A JOSE ANTONIO',
    'COMPRA TARJETA MERCADONA',
    'BIZUM DE ADNAN PARWEZ',
    'NOMINA ORANGE ESPAGNE',
    '',
  ])('%s no es una retirada', (texto) => {
    expect(pareceRetiradaDeCajero(texto, CARGO)).toBe(false);
  });
});
