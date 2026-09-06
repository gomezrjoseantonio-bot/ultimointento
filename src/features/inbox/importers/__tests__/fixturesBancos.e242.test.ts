// E2.4.2 · los cinco fixtures de Jose, de punta a punta · parser + motor.
//
// Lo que fija: que cada fichero se lee ENTERO (Unicaja con fechas en serie
// Excel, Revolut con fecha-hora, Sabadell con sus dos referencias, ING con su
// comentario) y que el motor rellena lo que se puede rellenar sin inventar.
// Los números de abajo son los «números honestos» del encargo, medidos sobre
// los fixtures y no sobre 4.000 líneas: aquí importa que no bajen.

import * as fs from 'fs';
import * as path from 'path';
import { BankParserService } from '../bankParser';
import { clasificarLinea, type ContextoClasificacion } from '../../../../services/clasificacion/clasificarLinea';
import type { Movement } from '../../../../services/db';

const parser = new BankParserService();
const DIR = path.resolve(__dirname, '../__fixtures__');

const ctx: ContextoClasificacion = {
  cuentas: [
    { id: 1, iban: 'ES6100490052632210412715', status: 'ACTIVE' },
    { id: 2, iban: 'ES4700812706150003239635', status: 'ACTIVE' },
    { id: 3, iban: 'ES6021037003520030084437', status: 'ACTIVE' },
    { id: 4, iban: 'ES7214650100991713720331', status: 'ACTIVE' },
  ],
  tarjetas: [{ id: 9, ultimosCuatro: '0940', activa: true }],
  nombresTitular: ['Nombre Apellido Apellido'],
};

async function clasificarFixture(banco: string, accountId: number) {
  const buffer = fs.readFileSync(path.join(DIR, `${banco}-fixture.csv`));
  const r = await parser.parseFile(new File([buffer], `${banco}.csv`, { type: 'text/csv' }));
  return r.movements.map((m, i) => {
    const mov = {
      id: i + 1,
      accountId,
      date: (m.date as Date).toISOString().slice(0, 10),
      amount: m.amount,
      description: m.description,
      reference: m.reference,
      naturaleza: m.amount >= 0 ? 'ingreso' : 'gasto',
      ambito: 'personal',
    } as Movement;
    return { desc: m.description, c: clasificarLinea(mov, ctx) };
  });
}

const resumen = (filas: Array<{ c: ReturnType<typeof clasificarLinea> }>) => ({
  total: filas.length,
  conFamilia: filas.filter((f) => f.c.familia).length,
  interno: filas.filter((f) => f.c.naturaleza === 'movimiento_interno').length,
  conMetodo: filas.filter((f) => f.c.metodo).length,
  sinFamilia: filas.filter((f) => !f.c.familia).length,
});

describe('Santander · 10 líneas', () => {
  it('cada línea sale con lo que se sabe · y solo con eso', async () => {
    const f = await clasificarFixture('santander', 1);
    expect(f).toHaveLength(10);
    const por = (t: RegExp) => f.find((x) => t.test(x.desc))!.c;
    expect(por(/Liquidacion Periodica Prestamo/)).toMatchObject({ naturaleza: 'gasto', familia: 'prestamo_hipoteca', metodo: 'domiciliacion' });
    expect(por(/A Favor De Nombre Apellido Apellido Concepto Nomina/)).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso' });
    expect(por(/Bizum A Favor De Persona/)).toMatchObject({ naturaleza: 'gasto', metodo: 'bizum', ambito: 'personal' });
    expect(por(/Bizum A Favor De Persona/).familia).toBeUndefined();
    expect(por(/Segurcaixa Adeslas/)).toMatchObject({ familia: 'seguros_alarmas', subtipo: 'salud', metodo: 'domiciliacion' });
    expect(por(/Compra Revolut/)).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_tarjeta' });
    expect(por(/Compra Bizum Renfe/)).toMatchObject({ familia: 'transporte', metodo: 'bizum' });
    expect(por(/Empresa Ejemplo Sa, Concepto Nomina/)).toMatchObject({ naturaleza: 'ingreso', familia: 'nomina' });
    expect(por(/Mercadona/)).toMatchObject({ familia: 'supermercado', metodo: 'tarjeta' });
    expect(por(/Comunidad Propietarios/)).toMatchObject({ familia: 'comunidad', metodo: 'domiciliacion' });
    expect(por(/Cheque/)).toMatchObject({ naturaleza: 'gasto', metodo: 'cheque' });
    expect(resumen(f)).toEqual({ total: 10, conFamilia: 8, interno: 2, conMetodo: 10, sinFamilia: 2 });
  });
});

describe('Sabadell · 8 líneas · las dos referencias', () => {
  it('cuota, disposición, abono de domiciliación, remuneración', async () => {
    const f = await clasificarFixture('sabadell', 2);
    expect(f).toHaveLength(8);
    const por = (t: RegExp) => f.find((x) => t.test(x.desc))!.c;
    expect(por(/IBERDROLA/)).toMatchObject({ familia: 'suministro', subtipo: 'luz' });
    expect(por(/GAS VISALIA/)).toMatchObject({ familia: 'suministro', subtipo: 'gas' });
    expect(por(/ABONO TRANSFERENCIA DE NOMBRE APELLIDO/)).toMatchObject({ naturaleza: 'ingreso', metodo: 'transferencia' });
    expect(por(/ABONO POR DOMICILIACI/)).toMatchObject({ naturaleza: 'ingreso', familia: 'otros_ingresos' });
    expect(por(/ADEUDO CUOTA/)).toMatchObject({ familia: 'prestamo_hipoteca', metodo: 'domiciliacion' });
    expect(por(/REMUN/)).toMatchObject({ familia: 'rendimiento', subtipo: 'interes' });
    expect(por(/SMARTFLIP/).familia).toBeUndefined();
    expect(por(/ABONO DISPOSICI/)).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'disposicion_prestamo', metodo: 'transferencia' });
    // Iberdrola y Visalia no dicen cómo se cobran (ni recibo ni adeudo) · sin señal no se inventa el método.
    expect(resumen(f)).toEqual({ total: 8, conFamilia: 6, interno: 1, conMetodo: 6, sinFamilia: 2 });
  });
});

describe('Unicaja · 8 líneas · fechas en serie Excel', () => {
  it('antes 0 filas · ahora las 8, y clasificadas', async () => {
    const f = await clasificarFixture('unicaja', 3);
    expect(f).toHaveLength(8);
    const por = (t: RegExp) => f.find((x) => t.test(x.desc))!.c;
    expect(por(/CCPP/)).toMatchObject({ familia: 'comunidad' });
    expect(por(/PRESTAMO 2103/)).toMatchObject({ familia: 'prestamo_hipoteca' });
    expect(por(/Simyo/)).toMatchObject({ familia: 'suministro', subtipo: 'telefonia' });
    expect(por(/AQUALIA/)).toMatchObject({ familia: 'suministro', subtipo: 'agua' });
    expect(por(/Ahorros/).familia).toBeUndefined();
    expect(por(/PLAN UNI SEGUR/)).toMatchObject({ familia: 'seguros_alarmas' });
    expect(por(/fianza/)).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'fianza', subtipo: 'devuelve' });
    expect(por(/HONORARIOS/)).toMatchObject({ familia: 'gestion' });
    // Unicaja escribe poco: solo «PRESTAMO» y «CUOTA» dicen cómo se cobran.
    expect(resumen(f)).toEqual({ total: 8, conFamilia: 7, interno: 1, conMetodo: 2, sinFamilia: 1 });
  });
});

describe('ING · 5 líneas · el comentario y la tarjeta propia', () => {
  it('hipoteca, recarga Revolut, recibo sin familia, nómina, transferencia con comentario', async () => {
    const f = await clasificarFixture('ing', 4);
    expect(f).toHaveLength(5);
    const por = (t: RegExp) => f.find((x) => t.test(x.desc))!.c;
    expect(por(/Hipoteca/)).toMatchObject({ familia: 'prestamo_hipoteca' });
    expect(por(/Pago en Revolut/)).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_tarjeta' });
    expect(por(/Recibo Direccion/).familia).toBeUndefined();
    expect(por(/Recibo Direccion/).metodo).toBe('domiciliacion');
    expect(por(/Empresa Ejemplo/)).toMatchObject({ naturaleza: 'ingreso', metodo: 'transferencia' });
    expect(por(/Feebbo/)).toMatchObject({ naturaleza: 'ingreso', metodo: 'transferencia', ambito: 'personal' });
    expect(resumen(f)).toEqual({ total: 5, conFamilia: 2, interno: 1, conMetodo: 5, sinFamilia: 3 });
  });
});

describe('Revolut · 5 líneas · fecha-hora y la columna Type', () => {
  it('antes 0 filas · ahora las 5, con método por Type', async () => {
    const f = await clasificarFixture('revolut', 9);
    expect(f).toHaveLength(5);
    const por = (t: RegExp) => f.find((x) => t.test(x.desc))!.c;
    expect(por(/Botemania/)).toMatchObject({ familia: 'ocio', metodo: 'tarjeta' });
    expect(por(/Recarga de/)).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso', sentido: 'entra', metodo: 'transferencia' });
    expect(por(/Apple/).familia).toBeUndefined();
    expect(por(/Apple/).metodo).toBe('tarjeta');
    expect(por(/Binance/)).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'aportacion', subtipo: 'inversion' });
    expect(por(/Telpark/)).toMatchObject({ familia: 'transporte', subtipo: 'parking' });
    expect(resumen(f)).toEqual({ total: 5, conFamilia: 4, interno: 2, conMetodo: 5, sinFamilia: 1 });
  });
});
