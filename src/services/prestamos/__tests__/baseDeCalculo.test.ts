// Cómo cuenta los días el banco · VOCABULARIO §6 bis · bis.
//
// La cuota sale del tipo entre doce y no depende de esto. Lo que depende es el
// INTERÉS que se liquida cada mes —`capital × TIN × días ÷ base`—, y con él el
// desglose interés/capital de cada recibo, que es lo que hay que poder cuadrar
// contra el papel del banco.
//
// La clásica española es 365/360: cobra un 1,39 % más que sobre 365, y esa
// diferencia es la que hacía imposible cuadrar.

import { baseDe, interesDelPeriodo, interesPorDias, BASE_POR_DEFECTO } from '../baseDeCalculo';
import type { Prestamo } from '../../../types/prestamos';

const prestamo = (base?: unknown): Prestamo =>
  ({ baseCalculoIntereses: base }) as unknown as Prestamo;

// 100.000 € al 3 % · un mes de 31 días.
const CAPITAL = 10_000_000; // céntimos
const TIN = 3;

describe('qué base tiene un préstamo', () => {
  it('la que diga', () => {
    expect(baseDe(prestamo('ACT/360'))).toBe('ACT/360');
    expect(baseDe(prestamo('ACT/365'))).toBe('ACT/365');
  });

  // No se presume la clásica aunque sea la más habitual: movería el cuadro de
  // todo lo ya guardado, y presumir una cláusula que nadie ha leído es
  // inventarse un dato.
  it('y si no dice nada, el mes comercial · lo que ATLAS venía haciendo', () => {
    expect(baseDe(prestamo())).toBe('30/360');
    expect(BASE_POR_DEFECTO).toBe('30/360');
  });

  it('una base que no existe se lee como que no la dice', () => {
    expect(baseDe(prestamo('365/366'))).toBe('30/360');
  });
});

describe('el interés del periodo', () => {
  // 100.000 × 3 % ÷ 12 = 250 €, tenga el mes los días que tenga.
  it('con el mes comercial todos los meses cuestan lo mismo', () => {
    expect(interesDelPeriodo(CAPITAL, TIN, 31, '30/360')).toBe(25_000);
    expect(interesDelPeriodo(CAPITAL, TIN, 28, '30/360')).toBe(25_000);
  });

  // 100.000 × 3 % × 31 ÷ 360 = 258,33 €
  it('sobre 360 se cuentan los días de verdad', () => {
    expect(interesDelPeriodo(CAPITAL, TIN, 31, 'ACT/360')).toBe(25_833);
  });

  // 100.000 × 3 % × 31 ÷ 365 = 254,79 €
  it('y sobre 365 también, pero repartidos en un año más largo', () => {
    expect(interesDelPeriodo(CAPITAL, TIN, 31, 'ACT/365')).toBe(25_479);
  });

  // 365/360 = 1,0139 · es la diferencia que hacía imposible cuadrar con el
  // recibo del banco aunque la cuota coincidiera al céntimo.
  it('la clásica española cobra un 1,39 % más que sobre 365', () => {
    const en360 = interesDelPeriodo(CAPITAL, TIN, 365, 'ACT/360');
    const en365 = interesDelPeriodo(CAPITAL, TIN, 365, 'ACT/365');

    expect(en360 / en365).toBeCloseTo(365 / 360, 4);
  });

  it('un febrero cuesta menos que un enero cuando se cuentan días', () => {
    expect(interesDelPeriodo(CAPITAL, TIN, 28, 'ACT/360'))
      .toBeLessThan(interesDelPeriodo(CAPITAL, TIN, 31, 'ACT/360'));
  });
});

// La prorrata del primer periodo y los días entre la firma y el primer cobro no
// son un mes: llamarlos mes cobraría de más o de menos según cuántos días
// tengan.
describe('los tramos sueltos de días', () => {
  it('con el mes comercial se cuentan igualmente por días, sobre 365', () => {
    expect(interesPorDias(CAPITAL, TIN, 20, '30/360'))
      .toBe(interesDelPeriodo(CAPITAL, TIN, 20, 'ACT/365'));
  });

  it('con una base de días, la suya', () => {
    expect(interesPorDias(CAPITAL, TIN, 20, 'ACT/360'))
      .toBe(interesDelPeriodo(CAPITAL, TIN, 20, 'ACT/360'));
  });

  // La carta del Santander · 78.500 € al 4,99 % por 20 días son 214,64 €, y esa
  // cuenta es sobre 365.
  it('los 214,64 € de la carta del Santander salen sobre 365', () => {
    expect(interesPorDias(7_850_000, 4.99, 20, '30/360')).toBe(21_464);
  });
});

describe('lo que no se puede calcular', () => {
  it.each([0, -100])('un capital de %s no devenga nada', (capital) => {
    expect(interesDelPeriodo(capital, TIN, 30, 'ACT/360')).toBe(0);
  });

  it('un tipo cero tampoco', () => {
    expect(interesDelPeriodo(CAPITAL, 0, 30, 'ACT/360')).toBe(0);
  });

  // Contando días, cero días son cero euros · con el mes comercial no se miran.
  it('cero días no devengan nada si se cuentan días', () => {
    expect(interesDelPeriodo(CAPITAL, TIN, 0, 'ACT/360')).toBe(0);
    expect(interesDelPeriodo(CAPITAL, TIN, 0, '30/360')).toBe(25_000);
  });
});
