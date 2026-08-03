// Las reglas de una tarjeta · VOCABULARIO §3.
//
// Lo que vigilan estos candados son los tres errores que hacen que un cargo
// aparezca el mes que no toca o en la cuenta que no es:
//
//   · una compra pasada la fecha de corte pertenece al periodo SIGUIENTE
//   · el día de cargo puede caer en otro mes que el corte
//   · "día 31" es el último del mes, y febrero no se salta

import {
  bonificaHipoteca,
  corteQueLeToca,
  cuandoSeCobra,
  cuentasQuePuedenLiquidar,
  diaDelMes,
  necesitaCiclo,
  puedeCambiarDeCuenta,
} from '../tarjetasReglas';
import type { CicloTarjeta } from '../../types/tarjetas';
import type { Account } from '../db';

const corriente = { id: 1, alias: 'Santander', tipo: 'CORRIENTE' } as Account;
const efectivo = { id: 2, alias: 'Efectivo', tipo: 'EFECTIVO' } as Account;
const tarjetaCuenta = { id: 3, alias: 'Visa', tipo: 'TARJETA_CREDITO' } as Account;

// "del 25 al 24, se cobra el 31" · el cargo cae el mismo mes del corte.
const del25al24: CicloTarjeta = {
  periodicidad: 'mensual',
  corte: 24,
  diaCargo: 31,
  periodosHastaElCargo: 0,
};

// "del 1 al 31, se cobra el 5" · el cargo cae al mes siguiente.
const delMesEnteroCobraEl5: CicloTarjeta = {
  periodicidad: 'mensual',
  corte: 31,
  diaCargo: 5,
  periodosHastaElCargo: 1,
};

// Unicaja · corta el domingo y cobra el lunes siguiente.
const semanalUnicaja: CicloTarjeta = {
  periodicidad: 'semanal',
  corte: 7,
  diaCargo: 1,
  periodosHastaElCargo: 0,
};

describe('de qué cuenta puede colgar', () => {
  it('solo de una cuenta bancaria propia', () => {
    expect(cuentasQuePuedenLiquidar([corriente, efectivo, tarjetaCuenta])).toEqual([corriente]);
  });
});

describe('qué distingue a la de fuera', () => {
  it('la del banco bonifica · la de fuera nunca', () => {
    expect(bonificaHipoteca({ origen: 'banco' })).toBe(true);
    expect(bonificaHipoteca({ origen: 'externa' })).toBe(false);
  });

  it('la de fuera se re-domicilia · la del banco no tiene sentido moverla', () => {
    expect(puedeCambiarDeCuenta({ origen: 'externa' })).toBe(true);
    expect(puedeCambiarDeCuenta({ origen: 'banco' })).toBe(false);
  });
});

describe('quién necesita ciclo', () => {
  it('el crédito sí · el débito cobra al momento', () => {
    expect(necesitaCiclo({ modalidad: 'credito' })).toBe(true);
    expect(necesitaCiclo({ modalidad: 'debito' })).toBe(false);
  });
});

describe('el día 31 es el último del mes', () => {
  it('febrero no se salta', () => {
    expect(diaDelMes(2026, 1, 31)).toBe(28); // febrero 2026
    expect(diaDelMes(2024, 1, 31)).toBe(29); // bisiesto
    expect(diaDelMes(2026, 3, 31)).toBe(30); // abril
  });
});

describe('en qué periodo cae una compra', () => {
  // Lo que se equivocaba: con corte el 24, la compra del 26 NO es de este
  // periodo. Meterla adelantaría su cargo un mes entero.
  it('antes del corte, este periodo · después, el siguiente', () => {
    expect(corteQueLeToca(del25al24, '2026-01-20')).toBe('2026-01-24');
    expect(corteQueLeToca(del25al24, '2026-01-24')).toBe('2026-01-24');
    expect(corteQueLeToca(del25al24, '2026-01-26')).toBe('2026-02-24');
  });

  it('con corte a fin de mes, febrero corta el 28', () => {
    expect(corteQueLeToca(delMesEnteroCobraEl5, '2026-02-10')).toBe('2026-02-28');
  });

  it('semanal · la compra del miércoles corta el domingo de esa semana', () => {
    // 2026-01-07 es miércoles · el domingo de esa semana es el 11.
    expect(corteQueLeToca(semanalUnicaja, '2026-01-07')).toBe('2026-01-11');
  });
});

describe('cuándo se cobra ese periodo', () => {
  it('el mismo mes cuando el cargo va después del corte', () => {
    expect(cuandoSeCobra(del25al24, '2026-01-24')).toBe('2026-01-31');
  });

  // Corte el 31 de enero, cargo el 5: es el 5 de FEBRERO. Ponerlo en enero
  // sería cobrar antes de cerrar.
  it('el mes siguiente cuando el cargo va antes que el corte', () => {
    expect(cuandoSeCobra(delMesEnteroCobraEl5, '2026-01-31')).toBe('2026-02-05');
  });

  it('el cargo también respeta el último día del mes', () => {
    expect(cuandoSeCobra(del25al24, '2026-02-24')).toBe('2026-02-28');
  });

  it('semanal · corta el domingo, cobra el lunes siguiente', () => {
    // 2026-01-11 es domingo · el lunes siguiente es el 12.
    expect(cuandoSeCobra(semanalUnicaja, '2026-01-11')).toBe('2026-01-12');
  });
});
