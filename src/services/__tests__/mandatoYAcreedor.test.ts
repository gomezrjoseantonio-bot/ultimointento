// E3.1 · §7.2 · el mandato SEPA y el nombre del acreedor · sobre texto REAL de
// los ficheros de los cuatro bancos del corpus.
import {
  extraerIdentificadores,
  identificadoresDeMovimiento,
  claveDeIdentificador,
  mandatosDeLaReferencia,
} from '../identificadoresDelConcepto';
import type { Movement } from '../db';

const ids = (t: string) => extraerIdentificadores(t).map(claveDeIdentificador);

describe('E3.1 · §7.2 · el mandato como identificador universal', () => {
  it('UNICAJA · el bloque de emisor da mandato Y nombre · 131 movimientos que hoy no tenían ancla', () => {
    expect(ids('FCC AQUALI447497 874010012213')).toEqual(['mandato:874010012213', 'acreedor:FCCAQUALI']);
    expect(ids('DIGI SPAIN400245 001056800700')).toEqual(['mandato:001056800700', 'acreedor:DIGISPAIN']);
    expect(ids('Simyo     633782 822070552003')).toEqual(['mandato:822070552003', 'acreedor:SIMYO']);
    // Con guion en vez de espacio · es el mismo mandato.
    expect(ids('CCPP CL TE0146B7-006300000900')).toEqual(['mandato:006300000900', 'acreedor:CCPPCLTE']);
    expect(ids('CCPP CL TE0146B7 006300000900')).toEqual(['mandato:006300000900', 'acreedor:CCPPCLTE']);
  });

  it('UNICAJA · dos comunidades distintas del mismo emisor se separan por el mandato', () => {
    const a = ids('CCPP CL TE0146B7 006300000900');
    const b = ids('CCPP CL TE0146B7 006300001100');
    expect(a[0]).not.toBe(b[0]);
  });

  it('UNICAJA · el nº de contrato del préstamo NO se lo lleva el emisor', () => {
    expect(ids('PRESTAMO  2103 4257 0500106068')).toEqual(['contrato:210342570500106068']);
  });

  it('BBVA · el nº de adeudo es VOLÁTIL y se tira · el acreedor de detrás es lo que vale', () => {
    expect(ids('N 2025224000484178 BIP   DRIVE, S.A.')).toEqual(['acreedor:BIPDRIVESA']);
    expect(ids('N 2025218000512711 BANKINTER CONSUMER FINANCE')).toEqual(['acreedor:BANKINTERCONSUMERFINANCE']);
    expect(ids('N 2025199000191883 CANAL DE ISABEL II, SOCIEDAD A')).toEqual(['acreedor:CANALDEISABELIISOCIEDADA']);
    // El nº de adeudo (2025·224 = año + día juliano) no aparece por ningún lado.
    expect(ids('N 2025224000484178 BIP   DRIVE, S.A.').join()).not.toContain('2025224');
  });

  it('SANTANDER · el acreedor va pegado a RECIBO y se corta donde empieza lo que cambia cada mes', () => {
    expect(
      ids('Recibo Segurcaixa, S.a. De Seguros Y Reaseguros Nº Recibo 0049 0052 755 Bbtrfss Ref. Mandato 07085234611, De')
    ).toEqual(['mandato:07085234611', 'acreedor:SEGURCAIXASADESEGUROSYREASEGUROS']);
    expect(ids('Recibo Fcc Aqualia Oviedo Nº Recibo 0049 0052 755 Aabbcc')).toEqual(['acreedor:FCCAQUALIAOVIEDO']);
  });

  it('SABADELL · «Referencia 2» desnuda · el mandato que hoy no daba ancla', () => {
    const m = (reference: string): string[] =>
      identificadoresDeMovimiento({ description: 'ELECTRICIDAD WEKIWI SL', reference } as Partial<Movement> as Movement)
        .map(claveDeIdentificador);
    // El CIF del acreedor con su sufijo SEPA sigue siendo un NIF, no un mandato.
    expect(m('B67686782001 SLMP023352742')).toEqual(expect.arrayContaining(['nif:B67686782', 'mandato:SLMP023352742']));
    expect(mandatosDeLaReferencia('B67686782001').map(claveDeIdentificador)).toEqual([]);
    // Doce cifras desnudas sí son un mandato.
    expect(mandatosDeLaReferencia('236136614000').map(claveDeIdentificador)).toEqual(['mandato:236136614000']);
    // Una referencia corta y volátil (el nº de orden de una transferencia) no.
    expect(mandatosDeLaReferencia('173518339').map(claveDeIdentificador)).toEqual([]);
  });

  it('SABADELL · dos Iberdrola de dos pisos distintos se distinguen SOLOS por su mandato', () => {
    const piso104 = identificadoresDeMovimiento({
      description: 'ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA GAS 104',
      reference: 'A95554630001 206136614000',
    } as Partial<Movement> as Movement).map(claveDeIdentificador);
    const piso105 = identificadoresDeMovimiento({
      description: 'ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA GAS 105',
      reference: 'A95554630001 207136614000',
    } as Partial<Movement> as Movement).map(claveDeIdentificador);

    // Comparten el NIF —es la misma comercializadora— y NO comparten el mandato.
    expect(piso104).toContain('nif:A95554630');
    expect(piso105).toContain('nif:A95554630');
    expect(piso104).toContain('mandato:206136614000');
    expect(piso105).toContain('mandato:207136614000');
    expect(piso104.find((k) => k.startsWith('mandato:'))).not.toBe(piso105.find((k) => k.startsWith('mandato:')));
  });

  it('el guion tras la etiqueta ya no descalifica el número · y una fecha con guiones sigue fuera', () => {
    expect(ids('PRESTAMO 2103-7003-0500230959')).toEqual(['contrato:210370030500230959']);
    expect(ids('CONTRATO: -1450083217')).toEqual(['contrato:1450083217']);
    expect(ids('CUOTA 31-08-25')).toEqual([]);
  });
});
