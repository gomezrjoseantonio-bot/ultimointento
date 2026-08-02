// Candado del formato de importe de §5, que es regla VINCULANTE:
//   miles con punto · dos decimales SOLO si los hay · signo cuando indica
//   dirección. `+1.000 €` · `−38,20 €` · `24.465,80 €`

import { importeConSigno, importeSaldo, nombreMes, mesCorto, rangoMeses, diaYMes } from '../formatoV6';
import { aplicarOrden } from '../ordenCuentas';

describe('§5 · formato de importe', () => {
  it('pone miles con punto y decimales solo si los hay', () => {
    expect(importeSaldo(1000)).toBe('1.000 €');
    expect(importeSaldo(24465.8)).toBe('24.465,80 €');
    expect(importeSaldo(38.2)).toBe('38,20 €');
    expect(importeSaldo(0)).toBe('0 €');
  });

  it('con signo: + para entrar, menos tipográfico para salir, nada para cero', () => {
    expect(importeConSigno(1000)).toBe('+1.000 €');
    // U+2212, no el guion del teclado: en cifras tabulares el guion queda corto.
    expect(importeConSigno(-38.2)).toBe('−38,20 €');
    expect(importeConSigno(0)).toBe('0 €');
  });

  it('el saldo no lleva "+", porque no indica dirección sino cuánto hay', () => {
    expect(importeSaldo(54439)).toBe('54.439 €');
    expect(importeSaldo(-120.5)).toBe('−120,50 €');
  });

  it('redondea a céntimos sin arrastrar coma flotante', () => {
    expect(importeSaldo(0.1 + 0.2)).toBe('0,30 €');
    // 1000.004 → sin decimales; 1000.005 → con ellos.
    expect(importeSaldo(1000.004)).toBe('1.000 €');
  });

  it('puede omitir el símbolo cuando el contexto ya lo da', () => {
    expect(importeSaldo(1000, false)).toBe('1.000');
  });
});

describe('fechas y meses', () => {
  it('nombra los meses en minúscula', () => {
    expect(nombreMes(0)).toBe('enero');
    expect(nombreMes(6)).toBe('julio');
    expect(nombreMes(11)).toBe('diciembre');
  });

  it('tolera índices fuera de rango sin romperse', () => {
    expect(nombreMes(12)).toBe('enero');
    expect(nombreMes(-1)).toBe('diciembre');
  });

  it('abrevia a tres letras', () => {
    expect(mesCorto(6)).toBe('jul');
    expect(mesCorto(8)).toBe('sep');
  });

  it('el rango omite el año repetido y lo pone cuando cambia', () => {
    expect(rangoMeses({ year: 2026, month0: 6 }, { year: 2026, month0: 11 })).toBe('jul – dic 2026');
    expect(rangoMeses({ year: 2026, month0: 10 }, { year: 2027, month0: 3 })).toBe('nov 2026 – abr 2027');
  });

  it('el día del aviso va CORTO · comparte línea con un importe', () => {
    // "22 de julio" entero hacía que "se queda en −36,97 € el 22 de julio" se
    // partiera en tres líneas dentro de la tarjeta de cuenta.
    expect(diaYMes('2026-07-22')).toBe('22 jul');
    expect(diaYMes('2026-09-05')).toBe('5 sep');
  });
});

describe('§4.2 · orden de las tarjetas', () => {
  const c = (id: number) => ({ id });

  it('sin orden guardado, respeta el natural', () => {
    expect(aplicarOrden([c(1), c(2)], [])).toEqual([c(1), c(2)]);
  });

  it('aplica el orden del usuario', () => {
    expect(aplicarOrden([c(1), c(2), c(3)], [3, 1, 2])).toEqual([c(3), c(1), c(2)]);
  });

  it('una cuenta nueva no desaparece: va al final', () => {
    // El orden guardado es de antes del alta; la cuenta 9 no está en él.
    expect(aplicarOrden([c(1), c(9), c(2)], [2, 1])).toEqual([c(2), c(1), c(9)]);
  });

  it('un id de una cuenta ya borrada no deja hueco', () => {
    expect(aplicarOrden([c(1), c(2)], [7, 2, 1])).toEqual([c(2), c(1)]);
  });
});
