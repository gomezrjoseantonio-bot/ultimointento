// E3.3 · §7.5 · el catálogo busca sus marcas con LÍMITE DE PALABRA.
//
// Los alias se comparan sin espacios a propósito: el banco escribe «Orange
// Espagne», «orange-france telecom» y «ORANGEESPAGNE» para la misma empresa, y
// quitando los separadores las tres son iguales.
//
// El precio de quitarlos era perder el límite de palabra, y con él se colaba
// justo lo que `palabras.ts` prohíbe al otro lado de la casa: «Alisser REAL
// Estate» contiene «REALE», la aseguradora. Sobre los diez extractos reales eso
// convertía 18 rentas de un piso en recibos de seguro — y no se veía, porque al
// catálogo solo se le preguntaba con el nombre del acreedor ya recortado. Al
// abrirlo al concepto entero (E3.3) habría salido a la luz de golpe.

import { construirCatalogo, porNombre } from '../catalogoNacional';
import { semillaDelCatalogo, claveConPalabras } from '../entidadesNacionales';

const cat = construirCatalogo(semillaDelCatalogo());
const quien = (texto: string) => porNombre(cat, texto)?.nombre;

describe('el alias tiene que empezar y acabar en palabra', () => {
  it('«Alisser Real Estate» NO es «Reale» · 18 rentas del corpus dependían de esto', () => {
    expect(quien('Transferencia De Alisser Real Estate, S.l., Concepto Renta Septiembre')).toBeUndefined();
    expect(quien('Transferencia Inmediata A Favor De Alisser Real Estate')).toBeUndefined();
  });

  it('pero «Reale» a secas sí es Reale', () => {
    expect(quien('RECIBO REALE SEGUROS GENERALES')).toBe('Reale');
  });

  it('el alias puede cruzar los espacios que el banco se come', () => {
    // Las tres formas del mismo emisor · el alias va sin separadores y estas
    // los traen o no los traen.
    expect(quien('Adeudo orange-france telecom')).toBe('Orange España');
    expect(quien('Transferencia De Orange Espagne S.a.')).toBe('Orange España');
    expect(quien('ORANGEESPAGNE')).toBe('Orange España');
  });

  it('y no puede empezar a media palabra', () => {
    // «CARREFOUR» dentro de «FINANCIERACARREFOUR» es el caso bueno: el alias
    // más largo gana y la financiera no acaba en el supermercado.
    expect(quien('RECIB /FINANCIERA CARREFOUR S.')).toBe('Servicios Financieros Carrefour');
  });
});

describe('la clave con sus palabras', () => {
  it('dice dónde empieza y acaba cada una', () => {
    const { clave, inicios, finales } = claveConPalabras('Alisser Real Estate');

    expect(clave).toBe('ALISSERREALESTATE');
    expect([...inicios].sort((a, b) => a - b)).toEqual([0, 7, 11]);
    expect([...finales].sort((a, b) => a - b)).toEqual([7, 11, 17]);
  });

  it('los separadores del banco no cuentan como palabra', () => {
    expect(claveConPalabras('orange-france telecom').clave).toBe('ORANGEFRANCETELECOM');
    expect(claveConPalabras('S.a. - Nº 1').clave).toBe('SANº1'.replace('º', ''));
  });
});

describe('lo que el catálogo NO debe afirmar', () => {
  it('«Smartflip» ya no está · es donde inviertes, no quien te presta', () => {
    // Entró en E3.1 como financiera de crédito al consumo y es lo contrario:
    // en el corpus salen 45.000 € en tres transferencias y vuelven 607,50 €
    // todos los meses. Con la entrada puesta, cada cobro mensual se contaba
    // como el pago de un préstamo suyo.
    expect(quien('TRANSFERENCIA A SMARTFLIP DEVELOPMENTS')).toBeUndefined();
    expect(quien('Transferencia Inmediata De Smartflip Developments Investments')).toBeUndefined();
  });
});
