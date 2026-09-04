// §31 · la apertura derivada, sobre el FICHERO REAL de Santander.
//
// `export202593 (1).xlsx` (raíz del repo) es el extracto tal cual lo descarga
// Jose: cabecera de cuatro filas, 24 movimientos del 27 de agosto al 2 de
// septiembre de 2025 y el banco listando lo más NUEVO primero. Aquí se recorre
// el camino entero —parser → línea del extracto → apertura derivada → saldo—
// para que ninguna de las tres piezas pueda romperse en silencio:
//
//   · el parser trae importe Y saldo de cada línea (fix E1.5-fix-parser);
//   · la apertura se deriva de la línea MÁS ANTIGUA: 56.846,36 − (−100) =
//     56.946,36, y NO su saldo tal cual;
//   · con esa apertura, el saldo que ATLAS calcula a la fecha de la última
//     línea es EXACTAMENTE el que dice el banco: 53.512,05 €.
//
// El fichero de 1.341 líneas del caso original no está en el repo; este es el
// mismo banco, el mismo formato y la misma columna de saldo.

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { BankParserService } from '../../features/inbox/importers/bankParser';
import { isoDate } from '../bankStatementOrchestrator';
import { lineaDesdeFila } from '../lineasExtractoService';
import { calcularApertura, extremosConSaldo } from '../aperturaDerivada';
import { calculateAccountBalanceAtDate } from '../accountBalanceService';
import type { Account } from '../db';
import type { LineaExtractoPersistida } from '../db/types-lineasExtracto';
import type { ParsedMovement } from '../../types/bankProfiles';

const FICHERO = path.join(__dirname, '..', '..', '..', 'export202593 (1).xlsx');
const CUENTA = 42;
const AHORA = '2025-09-03T08:00:00.000Z';

/** Lo que el banco dice en la última línea del fichero. */
const SALDO_DEL_BANCO = 53512.05;
/** §31 · saldo de la línea más antigua (56.846,36) menos su importe (−100). */
const APERTURA_DERIVADA = 56946.36;

const cuenta = (over: Partial<Account>): Account =>
  ({ id: CUENTA, iban: 'ES6100490052632210412715', alias: 'Santander', ...over }) as Account;

/** El saldo de ATLAS el 2 de septiembre de 2025, con el fichero dentro. */
const saldoEl2 = (account: Account, lineas: LineaExtractoPersistida[]): number =>
  Math.round(
    calculateAccountBalanceAtDate({
      account,
      cutoffDate: '2025-09-03',
      treasuryEvents: [],
      movements: [],
      lineas,
    }) * 100
  ) / 100;

describe('el fichero real de Santander · §31', () => {
  let lineas: LineaExtractoPersistida[];

  beforeAll(async () => {
    lineas = await lineasDelFicheroRealAsync();
  });

  // `parseSheet` es asíncrono; se envuelve para poder usarlo en `beforeAll`.
  async function lineasDelFicheroRealAsync(): Promise<LineaExtractoPersistida[]> {
    const wb = XLSX.read(fs.readFileSync(FICHERO), { type: 'buffer' });
    const parser = new BankParserService() as any;
    const res = await parser.parseSheet(wb, wb.SheetNames[0], XLSX);
    expect(res.success).toBe(true);
    return (res.movements as ParsedMovement[]).map((row, i) =>
      lineaDesdeFila(row, {
        accountId: CUENTA,
        importBatchId: 'lote-real',
        fechaOperacion: isoDate(row.date) ?? '',
        fechaValor: isoDate(row.valueDate) ?? isoDate(row.date) ?? '',
        importe: row.amount,
        hashMovement: `real|${i}`,
        ahora: AHORA,
        movementIds: [],
      })
    );
  }

  it('el parser trae las 24 líneas con su importe y su saldo', () => {
    expect(lineas).toHaveLength(24);
    expect(lineas.every((l) => typeof l.saldo === 'number')).toBe(true);
    expect(lineas[0]).toMatchObject({ fechaOperacion: '2025-09-02', importe: -15, saldo: 53512.05 });
    expect(lineas[lineas.length - 1]).toMatchObject({ fechaOperacion: '2025-08-27', importe: -100, saldo: 56846.36 });
  });

  it('los extremos · la más reciente para el cuadre, la más antigua para derivar la apertura', () => {
    expect(extremosConSaldo(lineas)).toEqual({
      masReciente: { fecha: '2025-09-02', saldoBanco: SALDO_DEL_BANCO },
      masAntigua: { fecha: '2025-08-27', saldoBanco: 56846.36, importe: -100 },
    });
  });

  it('la cuenta se creó HOY con «cuánto tienes hoy» · el extracto la lleva al 27 de agosto', () => {
    const hoy = cuenta({ openingBalance: SALDO_DEL_BANCO, openingBalanceDate: '2025-09-03' });
    const p = calcularApertura({ account: hoy, extremos: extremosConSaldo(lineas)!, treasuryEvents: [], movements: [], lineas });

    expect(p.modo).toBe('retroceso');
    expect(p.apertura).toEqual({ fecha: '2025-08-27', saldo: APERTURA_DERIVADA });
    // El saldo de la línea tal cual habría contado su importe dos veces.
    expect(p.apertura.saldo).not.toBe(56846.36);
    expect(p.cuadraTrasAplicar).toBe(true);
    expect(p.saldoAtlasTrasAplicar).toBe(SALDO_DEL_BANCO);
  });

  it('aplicada la apertura derivada, ATLAS dice lo que dice el banco · 53.512,05 €', () => {
    const derivada = cuenta({ openingBalance: APERTURA_DERIVADA, openingBalanceDate: '2025-08-27' });
    expect(saldoEl2(derivada, lineas)).toBe(SALDO_DEL_BANCO);
  });

  it('la apertura puesta a mano «1 ene 2025 = 0 €» descuadra · y la propuesta lo arregla', () => {
    // El caso que rompía: un saldo inventado que nadie sabe.
    const inventada = cuenta({ openingBalance: 0, openingBalanceDate: '2025-01-01' });
    const p = calcularApertura({ account: inventada, extremos: extremosConSaldo(lineas)!, treasuryEvents: [], movements: [], lineas });

    // Sin apertura real, ATLAS solo suma los movimientos del fichero: −3.434,31.
    expect(p.saldoAtlas).toBe(-3434.31);
    expect(p.cuadra).toBe(false);
    expect(p.descuadre).toBe(Math.round((SALDO_DEL_BANCO + 3434.31) * 100) / 100);
    // El fichero empieza DESPUÉS del 1 de enero, así que no retrocede: se
    // ajusta el importe de esa apertura, sin mover su fecha.
    expect(p.modo).toBe('ajuste');
    expect(p.apertura).toEqual({ fecha: '2025-01-01', saldo: APERTURA_DERIVADA });
    expect(p.cuadraTrasAplicar).toBe(true);

    const ajustada = cuenta({ openingBalance: p.apertura.saldo, openingBalanceDate: p.apertura.fecha });
    expect(saldoEl2(ajustada, lineas)).toBe(SALDO_DEL_BANCO);
  });

  it('nada se ancla solo · calcular una propuesta no toca la cuenta', () => {
    const antes = cuenta({ openingBalance: 0, openingBalanceDate: '2025-09-03' });
    calcularApertura({ account: antes, extremos: extremosConSaldo(lineas)!, treasuryEvents: [], movements: [], lineas });
    expect(antes).toMatchObject({ openingBalance: 0, openingBalanceDate: '2025-09-03' });
  });
});
