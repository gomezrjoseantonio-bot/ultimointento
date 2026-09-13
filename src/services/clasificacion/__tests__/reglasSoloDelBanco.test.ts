// E3.3 · §7.5 · las reglas duras bajan a último recurso y el catálogo sube.
//
// Hasta aquí `reglasDuras.ts` llevaba las marcas —Iberdrola, Segurcaixa,
// Simyo…— y era el motor principal. Ya no: esas marcas viven en el catálogo
// nacional, que las reconoce por su CIF o por su nombre, y en las reglas se
// queda solo lo universal que escribe el BANCO.
//
// Se quedan también las cinco marcas que el catálogo NO tiene, comprobadas una
// a una contra las 308 entidades: DIGI, O2, AXA, DKV y GAS NATURAL. Sacar una
// marca que nadie recoge no es simplificar, es perder.
//
// Y los cuatro fallos de acierto de §P2, cada uno con su caso real del corpus.

import { clasificarLinea, type ContextoClasificacion } from '../clasificarLinea';
import { construirCatalogo } from '../../catalogoNacional/catalogoNacional';
import { semillaDelCatalogo } from '../../catalogoNacional/entidadesNacionales';
import { tienePalabra } from '../palabras';
import type { Movement } from '../../db';

const ctx: ContextoClasificacion = {
  cuentas: [{ id: 1, iban: 'ES6100490052632210412715', status: 'ACTIVE' }],
  tarjetas: [],
  nombresTitular: ['Nombre Apellido Apellido'],
  catalogo: construirCatalogo(semillaDelCatalogo()),
};

const c = (description: string, amount = -50) =>
  clasificarLinea(
    { id: 1, accountId: 1, date: '2026-09-01', amount, description } as Movement,
    ctx,
  );

describe('la marca la reconoce el CATÁLOGO, no una palabra de la lista', () => {
  it('Iberdrola, Segurcaixa y Simyo salen igual · y dicen que vienen del catálogo', () => {
    expect(c('ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U')).toMatchObject({ familia: 'suministro' });
    expect(c('Recibo Segurcaixa, S.a. De Seguros')).toMatchObject({ familia: 'seguros_alarmas' });
    expect(c('Simyo     633782 822070552003')).toMatchObject({ familia: 'suministro', subtipo: 'telefonia' });
    expect(c('ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U').motivos.join(' ')).toMatch(/catálogo/);
  });

  it('las cinco que el catálogo no tiene siguen en las reglas', () => {
    // Comprobado contra las 308: ninguna de estas está. Sacarlas sería perderlas.
    expect(c('RECIBO DIGI SPAIN TELECOM')).toMatchObject({ familia: 'suministro', subtipo: 'telefonia' });
    expect(c('RECIBO AXA SEGUROS')).toMatchObject({ familia: 'seguros_alarmas' });
    expect(c('RECIBO DKV SALUD')).toMatchObject({ familia: 'seguros_alarmas', subtipo: 'salud' });
    expect(c('RECIBO GAS NATURAL')).toMatchObject({ familia: 'suministro', subtipo: 'gas' });
  });

  it('el seguro de SALUD se queda en las reglas · el catálogo no tiene esa categoría', () => {
    // Sus categorías son coche, hogar, vida y decesos. Sacar Adeslas daría la
    // familia pero perdería el subtipo, y media verdad no es la verdad.
    expect(c('Recibo Segurcaixa Adeslas')).toMatchObject({ familia: 'seguros_alarmas', subtipo: 'salud' });
    expect(c('RECIBO SANITAS')).toMatchObject({ familia: 'seguros_alarmas', subtipo: 'salud' });
  });

  it('la devolución sigue siendo del gasto · ahora lo dice el catálogo (§7)', () => {
    const devuelto = c('TRANSFERENCIA CURENERGIA SAU', 31.2);
    expect(devuelto).toMatchObject({ naturaleza: 'gasto', familia: 'suministro', subtipo: 'luz' });
    expect(devuelto.motivos.join(' ')).toMatch(/devolución de ese gasto/);
  });

  it('…pero un abono de una FINANCIERA no es la devolución de una cuota', () => {
    // Sería llamar «préstamo» a lo que entra · una disposición o un rendimiento
    // no se tapan con la familia del recibo.
    expect(c('ABONO WIZINK BANK', 300).familia).toBeUndefined();
  });
});

describe('§P2 · los cuatro fallos de acierto', () => {
  it('«GAS» no le gana a la luz · el recibo de Sabadell lleva las dos palabras', () => {
    // «ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA GAS 105»: ahí
    // «GAS» es el final del nombre del emisor, no el gas. 58 recibos del corpus.
    expect(c('ELECTRICIDAD IBERDROLA COMERCIALIZACION DE U IBERDROLA GAS 105'))
      .toMatchObject({ familia: 'suministro', subtipo: 'luz' });
  });

  it('«Santa Catalina» no es el seguro de decesos «Santalucía»', () => {
    expect(c('TRANSFERENCIA A CB Santa Catalina').familia).not.toBe('seguros_alarmas');
    expect(tienePalabra('TRANSFERENCIA A CB SANTA CATALINA', 'SANTALUCIA')).toBe(false);
  });

  it('«COMPRAVENTA» no es el método «COMPRA» · un piso no se paga con tarjeta', () => {
    expect(tienePalabra('COMPRAVENTA INMUEBLE CALLE MAYOR', 'COMPRA')).toBe(false);
    expect(c('COMPRAVENTA INMUEBLE CALLE MAYOR', -120000).metodo).not.toBe('tarjeta');
  });

  it('«FINCAS» a secas no es una comunidad · pero «Administración de Fincas» sí', () => {
    expect(c('Pago en CAFETERIA VIPS FINCA POZUELO ES').familia).not.toBe('comunidad');
    expect(c('Transferencia Inmediata De Gestion Y Ad. De Fincas Candaliga'))
      .toMatchObject({ familia: 'comunidad' });
  });

  it('el recorte del banco sigue valiendo donde el banco recorta', () => {
    // La tolerancia no se ha quitado: se ha acotado a lo que de verdad es un
    // recorte · más corta y al final del texto, que es donde se corta el campo.
    expect(tienePalabra('ELECTRICIDAD IBERDROLA COMERCIALIZA', 'IBERDROLA COMERCIALIZACION')).toBe(true);
  });
});
