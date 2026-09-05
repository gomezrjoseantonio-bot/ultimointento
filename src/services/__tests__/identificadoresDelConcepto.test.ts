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
    // mandato es el que identifica la póliza.
    expect(
      ids('Recibo Segurcaixa, S.a. De Seguros Y Reaseguros Nº Recibo 0049 0052 755 Bbrtxrx Ref. Mandato 07085234611, De')
    ).toEqual(['contrato:07085234611']);
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
    expect(ids('RECIBO IBERDROLA CUPS ES0021000012345678AB0F')).toEqual(['cups:ES0021000012345678AB0F']);
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
    ['BBVA · nº de recibo con prestamista', 'N 2026126000711287 BANKINTER CONSUMER FINANCE'],
    ['Santander · referencia de compra', 'Transferencia De Jesus Escudero Santiuste, Concepto 4-acevedo-h2 - 7949807tp6074n0006ym.'],
    ['ING · referencia de Amazon', 'Pago en Amazon Prime*Z12968TU5 amazon.espr LU'],
    ['ING · referencia de Prime Video', 'Pago en Prime Video *JI9428475 primevideo.e ES'],
    ['Unicaja · cuota sin número', 'CUOTA AGOSTO  PLAN UNI SEGUR'],
    ['Unicaja · recibo de tarjeta con fecha', 'REC.MCARD 01/09/2025 MOD.ACUM.'],
    ['Sabadell · referencia SLMP', 'SLMP023352742'],
    ['Sabadell · nº de operación', '173518339'],
    ['ING · hipoteca sin número', 'Cargo cuota de Hipoteca ING Direct'],
    ['heurística · cuota sin número', 'RECIBO PRESTAMO UNICAJA 0123 CUOTA 07/2026'],
    ['test antiguo · REF volátil', 'ENDESA ESPAÑA SA RECIBO LUZ ENE2024 REF123456'],
    ['sin nada', 'NETFLIX.COM'],
    ['vacío', ''],
  ])('%s · «%s» → nada', (_nombre, texto) => {
    expect(ids(texto)).toEqual([]);
  });

  it('Unicaja · el código pegado al nombre y el nº de recibo de doce cifras NO se toman por identificador', () => {
    // «CCPP CL TE0146B7 006300001100» → el 0063… cambia cada mes (…1100, …1000,
    // …0900 en el mismo fichero) y «TE0146B7» no tiene forma verificable.
    expect(ids('CCPP CL TE0146B7 006300001100')).toEqual([]);
    expect(ids('FCC AQUALI447497 874010012213')).toEqual([]);
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
