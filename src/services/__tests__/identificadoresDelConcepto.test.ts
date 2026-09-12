// E2.1 · el extractor de identificadores, contra conceptos REALES.
//
// Los textos son los que traen los ficheros de Jose que viven en la raíz del
// repo (Sabadell `03092025_2706_…xlsx`, Unicaja `Movimientos_Cuenta_4437…xlsx`,
// Santander `export202593…xlsx`, ING `movements-392025.csv`) y las filas BBVA
// de `importador/fixtures/extractoBBVA.ts`. Cambiar un caso aquí es cambiar lo
// que ATLAS reconoce en un extracto de verdad.

import {
  extraerIdentificadores,
  identificadoresDeMovimiento,
  esCif,
  esNifPersona,
  esIban,
} from '../identificadoresDelConcepto';

const ids = (texto: string) => extraerIdentificadores(texto).map((i) => `${i.tipo}:${i.valor}`);

describe('extraerIdentificadores · identificadores ESTABLES', () => {
  it('Sabadell · el nº de contrato del préstamo, sin la fecha que va detrás', () => {
    expect(ids('PRESTAMOS ADEUDO CUOTA N.8078716546 31/08/25')).toEqual(['contrato:8078716546']);
    expect(ids('PRESTAMOS ABONO DISPOSICIÓN N.8078716546')).toEqual(['contrato:8078716546']);
  });

  it('Sabadell · el CIF del acreedor pegado a su sufijo SEPA («B67686782001» = Wekiwi + 001)', () => {
    expect(ids('B67686782001')).toEqual(['nif:B67686782']);
    expect(ids('A95554630001')).toEqual(['nif:A95554630']);
  });

  it('Santander · el contrato del préstamo, de la tarjeta y el mandato del seguro', () => {
    expect(ids('Liquidacion Periodica Prestamo 0049 0052 143 0004926')).toEqual([
      'contrato:004900521430004926',
    ]);
    expect(ids('Liquidacion De Las Tarjetas De Credito Del Contrato 0049 0052 502 0011256')).toEqual([
      'contrato:004900525020011256',
    ]);
    // El nº de recibo («0049 0052 755 Bbrtxrx») cambia cada mes y NO entra; el
    // mandato es el que identifica la póliza. E3.1 · §7.2: lo que el banco
    // etiqueta MANDATO deja de ser un `contrato` genérico y pasa a ser su
    // propio tipo (un recurrente = un mandato), y el nombre del acreedor que
    // va pegado a RECIBO se extrae para poder cruzarlo con el catálogo.
    expect(
      ids('Recibo Segurcaixa, S.a. De Seguros Y Reaseguros Nº Recibo 0049 0052 755 Bbrtxrx Ref. Mandato 07085234611, De')
    ).toEqual(['mandato:07085234611', 'acreedor:SEGURCAIXASADESEGUROSYREASEGUROS']);
  });

  it('Unicaja · el préstamo con su contrato en grupos', () => {
    expect(ids('PRESTAMO  2103 4257 0500106068')).toEqual(['contrato:210342570500106068']);
    expect(ids('PRESTAMO  2103 7003 0500230959')).toEqual(['contrato:210370030500230959']);
  });

  it('BBVA · el contrato con forma de cuenta que viene en la columna Movimiento', () => {
    expect(ids('0182-5322-27-0830842450')).toEqual(['contrato:01825322270830842450']);
  });

  it('ING · los cuatro últimos de la tarjeta', () => {
    expect(ids('Pago en Revolut**9527*')).toEqual(['tarjeta:9527']);
  });

  it('CUPS · con y sin los dos caracteres de frontera', () => {
    // E3.1 · el CUPS sigue mandando; el nombre del acreedor lo acompaña.
    expect(ids('RECIBO IBERDROLA CUPS ES0021000012345678AB0F')).toEqual([
      'cups:ES0021000012345678AB0F',
      'acreedor:IBERDROLA',
    ]);
    expect(ids('CUPS ES0021000012345678AB')).toEqual(['cups:ES0021000012345678AB']);
  });

  it('IBAN · solo si el dígito de control cuadra', () => {
    expect(ids('TRANSFERENCIA DESDE ES60 2103 7003 5200 3008 4437')).toEqual(['iban:ES6021037003520030084437']);
    expect(ids('TRANSFERENCIA DESDE ES6100490052632210412715')).toEqual(['iban:ES6100490052632210412715']);
    // Un dígito cambiado · ya no es un IBAN y no se inventa.
    expect(ids('TRANSFERENCIA DESDE ES61 2103 7003 5200 3008 4437')).toEqual([]);
  });

  it('DNI y NIE · solo con la letra bien', () => {
    expect(ids('TRANSFERENCIA DE 12345678Z')).toEqual(['nif:12345678Z']);
    expect(ids('TRANSFERENCIA DE 12345678A')).toEqual([]);
    expect(ids('X1234567L')).toEqual(['nif:X1234567L']);
  });

  it('varios en el mismo texto · sin repetir', () => {
    expect(ids('CUOTA N.8078716546 CUOTA N.8078716546 B67686782001')).toEqual([
      'nif:B67686782',
      'contrato:8078716546',
    ]);
  });
});

describe('extraerIdentificadores · NO inventa sobre ruido volátil', () => {
  it.each([
    ['BBVA · nº de recibo mensual', 'Adeudo nº 2026036000123456'],
    ['Santander · referencia de compra', 'Transferencia De Jesus Escudero Santiuste, Concepto 4-acevedo-h2 - 7949807tp6074n0006ym.'],
    ['ING · referencia de Amazon', 'Pago en Amazon Prime*Z12968TU5 amazon.espr LU'],
    ['ING · referencia de Prime Video', 'Pago en Prime Video *JI9428475 primevideo.e ES'],
    ['Unicaja · cuota sin número', 'CUOTA AGOSTO  PLAN UNI SEGUR'],
    ['Unicaja · recibo de tarjeta con fecha', 'REC.MCARD 01/09/2025 MOD.ACUM.'],
    ['Sabadell · referencia SLMP', 'SLMP023352742'],
    ['Sabadell · nº de operación', '173518339'],
    ['ING · hipoteca sin número', 'Cargo cuota de Hipoteca ING Direct'],
    ['test antiguo · REF volátil', 'ENDESA ESPAÑA SA RECIBO LUZ ENE2024 REF123456'],
    ['sin nada', 'NETFLIX.COM'],
    ['vacío', ''],
  ])('%s · «%s» → nada', (_nombre, texto) => {
    expect(ids(texto)).toEqual([]);
  });

  it('E3.1 · el nº VOLÁTIL del adeudo se sigue tirando · lo que entra es el NOMBRE de detrás', () => {
    // El 2026·126 de «N 2026126000711287» es año + día juliano: cambia en cada
    // recibo. No entra. El acreedor que va detrás sí, y es un NOMBRE, no una
    // clave: no cierra nada por sí solo, solo permite cruzar el catálogo.
    expect(ids('N 2026126000711287 BANKINTER CONSUMER FINANCE')).toEqual([
      'acreedor:BANKINTERCONSUMERFINANCE',
    ]);
    expect(ids('N 2026126000711287 BANKINTER CONSUMER FINANCE').join()).not.toContain('2026126');
    // «RECIBO PRESTAMO UNICAJA 0123 CUOTA 07/2026»: el 0123 y la fecha siguen
    // fuera (no hay contrato); queda el nombre de quien cobra.
    expect(ids('RECIBO PRESTAMO UNICAJA 0123 CUOTA 07/2026')).toEqual(['acreedor:PRESTAMOUNICAJA']);
  });

  it('E3.1 · CORRIGE E2.1 · las doce cifras de Unicaja son el MANDATO, no un nº de recibo mensual', () => {
    // E2.1 leyó «…1100 / …1000 / …0900 en el mismo fichero» como un número que
    // cambia cada mes. El fichero real dice lo contrario: los tres salen el
    // MISMO día (2025-08-28), así que son TRES acreedores distintos —las tres
    // comunidades de Jose—, no uno cambiando. Y «…0900» reaparece tal cual en
    // otra fecha (`__fixtures__/unicaja-fixture.csv`), o sea que es estable.
    // Eso es exactamente lo que resuelve «¿cuál de mis 3 comunidades?».
    expect(ids('CCPP CL TE0146B7 006300001100')).toEqual(['mandato:006300001100', 'acreedor:CCPPCLTE']);
    expect(ids('CCPP CL TE0146B7 006300001000')).toEqual(['mandato:006300001000', 'acreedor:CCPPCLTE']);
    expect(ids('FCC AQUALI447497 874010012213')).toEqual(['mandato:874010012213', 'acreedor:FCCAQUALI']);
  });
});

describe('identificadoresDeMovimiento · concepto + contraparte + referencia', () => {
  it('BBVA · el contrato viaja en `reference`, no en el concepto', () => {
    const out = identificadoresDeMovimiento({
      description: 'Cargo por amortizacion de prestamo/credito',
      reference: '0182-5322-27-0830842450',
    });
    expect(out).toEqual([{ tipo: 'contrato', valor: '01825322270830842450' }]);
  });

  it('Sabadell · el NIF viene en la referencia y el contrato en el concepto · ordenados', () => {
    const out = identificadoresDeMovimiento({
      description: 'PRESTAMOS ADEUDO CUOTA N.8078716546 31/08/25',
      reference: 'B67686782001',
    });
    expect(out.map((i) => `${i.tipo}:${i.valor}`)).toEqual(['contrato:8078716546', 'nif:B67686782']);
  });

  it('el mismo identificador en dos campos cuenta una vez', () => {
    const out = identificadoresDeMovimiento({
      description: 'Adeudo nº 2026126000711287 BANKINTER',
      counterparty: 'B67686782001',
      reference: 'B67686782001',
    });
    expect(out).toEqual([{ tipo: 'nif', valor: 'B67686782' }]);
  });
});

describe('validadores', () => {
  it('esCif · control como cifra y como letra', () => {
    expect(esCif('B67686782')).toBe(true);
    expect(esCif('A95554630')).toBe(true);
    expect(esCif('B67686783')).toBe(false);
  });
  it('esNifPersona', () => {
    expect(esNifPersona('12345678Z')).toBe(true);
    expect(esNifPersona('X1234567L')).toBe(true);
    expect(esNifPersona('X1234567A')).toBe(false);
  });
  it('esIban', () => {
    expect(esIban('ES6021037003520030084437')).toBe(true);
    expect(esIban('ES6121037003520030084437')).toBe(false);
  });
});

// E3.1 · la tarjeta escrita ENTERA · Santander y BBVA no la enmascaran.
//
// Antes solo se leía la forma con asteriscos («Revolut**9527*»), así que de
// «Compra Revolut**0940*, Tarjeta 5489010341469623» ATLAS se quedaba con 0940
// —que es el número que Revolut mete en el nombre del comercio— y perdía el de
// la tarjeta que pagaba. Sin él no hay forma de ver que ese cargo y la
// «Recarga de *9623» del extracto de Revolut son el mismo dinero.
//
// Del número completo solo se guardan los cuatro últimos. Los de aquí son
// inventados: un número de tarjeta real no entra en el repositorio.
describe('la tarjeta escrita entera', () => {
  const tarjetasDe = (description: string) =>
    identificadoresDeMovimiento({ description })
      .filter((i) => i.tipo === 'tarjeta')
      .map((i) => i.valor);

  it('se queda con los cuatro últimos, no con el número', () => {
    expect(tarjetasDe('Compra Meson A Reta De Cobas, Tarjeta 4000000000009623')).toEqual(['9623']);
  });

  it('un concepto con las dos formas da las dos tarjetas', () => {
    expect(tarjetasDe('Compra Revolut**0940*, Dublin, Tarjeta 4000000000009623 , Comision 0,00')).toEqual(
      expect.arrayContaining(['0940', '9623'])
    );
  });

  it('«Tarj.», «Tarjeta:» y el número con espacios valen igual', () => {
    expect(tarjetasDe('Pago Tarj. :4000 0000 0000 9623')).toEqual(['9623']);
    expect(tarjetasDe('Adeudo mensual de tarjeta 4000000000006701')).toEqual(['6701']);
  });

  it('sin la palabra delante no se inventa una tarjeta', () => {
    // Dieciséis cifras sueltas pueden ser cualquier cosa · un nº de recibo, un
    // expediente. Una tarjeta inventada es peor que ninguna.
    expect(tarjetasDe('Abono expediente 4000000000009623')).toEqual([]);
  });

  it('un número que no tiene largo de tarjeta no cuenta', () => {
    expect(tarjetasDe('Tarjeta 40000000')).toEqual([]);
  });
});
