// Detección de cuenta por IBAN (§4.7, puerta global).
//
// La regla que fija: ante duda NO se adivina. Importar en la cuenta equivocada
// mueve saldos que no son y no se deshace solo, así que todo lo que no sea una
// única coincidencia limpia acaba pidiendo al usuario que elija.

import { cuentaPorIban, ibansEn, normalizarIban } from '../detectarCuenta';
import type { Account } from '../../../../services/db';

const cuenta = (id: number, alias: string, iban: string): Account =>
  ({
    id,
    alias,
    iban,
    ultimosCuatro: iban.slice(-4),
    status: 'ACTIVE',
    activa: true,
    createdAt: '',
    updatedAt: '',
  }) as Account;

const SABADELL = 'ES9100491500051234567891';
const SANTANDER = 'ES7620770024003102575766';

describe('encontrar IBANs en el texto', () => {
  it('los reconoce con espacios, guiones y en minúsculas', () => {
    expect(ibansEn('Titular: ES91 0049 1500 0512 3456 7891')).toEqual([SABADELL]);
    expect(ibansEn('IBAN es91-0049-1500-0512-3456-7891')).toEqual([SABADELL]);
  });

  it('no repite el mismo IBAN escrito de dos formas', () => {
    const texto = `Cuenta ${SABADELL}\nResumen de ES91 0049 1500 0512 3456 7891`;
    expect(ibansEn(texto)).toHaveLength(1);
  });

  it('normalizar quita separadores y sube a mayúsculas', () => {
    expect(normalizarIban('es91 0049-1500 0512 3456 7891')).toBe(SABADELL);
  });
});

describe('cruzar con las cuentas del usuario', () => {
  const cuentas = [cuenta(1, 'Sabadell', SABADELL), cuenta(2, 'Santander', SANTANDER)];

  it('una sola coincidencia · se detecta', () => {
    const d = cuentaPorIban(`Extracto de ${SABADELL} · marzo`, cuentas);
    expect(d).toEqual({ estado: 'detectada', cuenta: cuentas[0] });
  });

  it('el fichero menciona dos cuentas mías · ambigua, no elige', () => {
    const d = cuentaPorIban(`${SABADELL} y ${SANTANDER}`, cuentas);
    expect(d.estado).toBe('ambigua');
  });

  it('IBAN que no es de ninguna cuenta mía · lo dice, no cae en la primera', () => {
    const d = cuentaPorIban('ES2100810001234567890123', cuentas);
    expect(d).toEqual({ estado: 'iban-desconocido', iban: 'ES2100810001234567890123' });
  });

  it('sin IBAN en el texto · sin detectar', () => {
    expect(cuentaPorIban('fecha;concepto;importe', cuentas).estado).toBe('sin-iban');
  });

  it('no propone una cuenta dada de baja', () => {
    const baja = { ...cuenta(1, 'Sabadell', SABADELL), status: 'DELETED' } as Account;
    expect(cuentaPorIban(SABADELL, [baja]).estado).toBe('iban-desconocido');
  });

  it('el mismo IBAN repetido en el fichero sigue siendo UNA cuenta', () => {
    const d = cuentaPorIban(`${SABADELL}\n${SABADELL}\n${SABADELL}`, cuentas);
    expect(d.estado).toBe('detectada');
  });
});

// ─── E2.4.2 · Paso 0 · la cabecera se lee también de un Excel ────────────────
//
// Antes se leían los primeros 64 KB como texto: en un XLSX (un ZIP) el IBAN no
// aparecía y todo lo que no fuera CSV caía al selector. Estos tests fijan que
// los cinco bancos del fixture identifican su cuenta, en CSV y en XLSX.

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { detectarCuenta } from '../detectarCuenta';

const FIXTURES = path.resolve(__dirname, '../../../../features/inbox/importers/__fixtures__');

const IBANS: Record<string, string> = {
  santander: 'ES6100490052632210412715',
  sabadell: 'ES4700812706150003239635',
  unicaja: 'ES6021037003520030084437',
  ing: 'ES7214650100991713720331',
};

const cuentasDeJose = () =>
  Object.entries(IBANS).map(([alias, iban], i) => cuenta(i + 1, alias, iban));

const ficheroCsv = (banco: string): File =>
  new File([fs.readFileSync(path.join(FIXTURES, `${banco}-fixture.csv`))], `${banco}.csv`, { type: 'text/csv' });

/** El mismo contenido, como libro Excel · lo que exportan Sabadell, Unicaja e ING. */
const ficheroXlsx = (banco: string): File => {
  const texto = fs.readFileSync(path.join(FIXTURES, `${banco}-fixture.csv`), 'utf8');
  const filas = texto.split(/\r?\n/).map((l) => l.split(','));
  const ws = XLSX.utils.aoa_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new File([buffer], `${banco}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

describe('E2.4.2 · Paso 0 · cada fichero identifica su cuenta por el IBAN de cabecera', () => {
  const cuentas = cuentasDeJose();

  it.each(['santander', 'sabadell', 'unicaja', 'ing'])('%s · CSV', async (banco) => {
    const d = await detectarCuenta(ficheroCsv(banco), cuentas);
    expect(d.estado).toBe('detectada');
    if (d.estado === 'detectada') expect(d.cuenta.alias).toBe(banco);
  });

  it.each(['sabadell', 'unicaja', 'ing'])('%s · XLSX (antes: sin-iban)', async (banco) => {
    const d = await detectarCuenta(ficheroXlsx(banco), cuentas);
    expect(d.estado).toBe('detectada');
    if (d.estado === 'detectada') expect(d.cuenta.alias).toBe(banco);
  });

  it('Revolut · el CSV no trae IBAN (la cuenta es la tarjeta) · pide elegir, no adivina', async () => {
    const d = await detectarCuenta(ficheroCsv('revolut'), cuentas);
    expect(d.estado).toBe('sin-iban');
  });

  it('IBAN que no es de ninguna cuenta · viaja con banco y titular de la cabecera para poder crearla', async () => {
    const d = await detectarCuenta(ficheroXlsx('sabadell'), [cuenta(9, 'otra', IBANS.santander)]);
    expect(d.estado).toBe('iban-desconocido');
    if (d.estado === 'iban-desconocido') {
      expect(d.iban).toBe(IBANS.sabadell);
      expect(d.cabecera?.banco).toMatch(/Sabadell/);
      expect(d.cabecera?.titular).toBe('NOMBRE*APELLIDO APELLIDO');
    }
  });
});
