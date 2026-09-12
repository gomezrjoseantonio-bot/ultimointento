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
import { traspasosPropios } from '../../../../services/deterministas/traspasosPropios';
import type { Account } from '../../../../services/db/types-contratos';

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

describe('Sabadell · 9 líneas · las dos referencias', () => {
  it('cuota, disposición, devolución de la comercializadora, remuneración', async () => {
    const f = await clasificarFixture('sabadell', 2);
    expect(f).toHaveLength(9);
    const por = (t: RegExp) => f.find((x) => t.test(x.desc))!.c;
    expect(por(/IBERDROLA/)).toMatchObject({ familia: 'suministro', subtipo: 'luz' });
    expect(por(/GAS VISALIA/)).toMatchObject({ familia: 'suministro', subtipo: 'gas' });
    // E2.4.2-fix · la regularización semestral de Curenergía es LUZ en positivo,
    // del mismo punto que la cuota de Iberdrola: resta de la luz, no es un
    // ingreso. Antes caía en «otros ingresos» y descuadraba el neto del piso.
    expect(por(/CURENERGIA/)).toMatchObject({ naturaleza: 'gasto', familia: 'suministro', subtipo: 'luz' });
    expect(por(/ABONO TRANSFERENCIA DE NOMBRE APELLIDO/)).toMatchObject({ naturaleza: 'ingreso', metodo: 'transferencia' });
    // El recibo devuelto es la marcha atrás de un gasto · pero no dice de cuál.
    expect(por(/ABONO POR DOMICILIACI/).naturaleza).toBe('gasto');
    expect(por(/ABONO POR DOMICILIACI/).familia).toBeUndefined();
    expect(por(/ADEUDO CUOTA/)).toMatchObject({ familia: 'prestamo_hipoteca', metodo: 'domiciliacion' });
    expect(por(/REMUN/)).toMatchObject({ familia: 'rendimiento', subtipo: 'interes' });
    expect(por(/SMARTFLIP/).familia).toBeUndefined();
    expect(por(/ABONO DISPOSICI/)).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'disposicion_prestamo', metodo: 'transferencia' });
    // Iberdrola y Visalia no dicen cómo se cobran (ni recibo ni adeudo) · sin señal no se inventa el método.
    //
    // `conFamilia` se queda en 6 y no sube a 7 con la línea nueva, a propósito:
    // Curenergía gana familia (suministro · luz) y el abono de domiciliación la
    // pierde, porque la que tenía —«otros ingresos»— era mentira. Tres sin
    // familia es el número honesto: nadie sabe todavía de qué gasto vuelve ese
    // recibo, y quien lo sepa lo dirá.
    expect(resumen(f)).toEqual({ total: 9, conFamilia: 6, interno: 1, conMetodo: 7, sinFamilia: 3 });
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
    // fix2 · «Ahorros Septiembre» es un traspaso a ahorro (criterio revisado por Jose).
    expect(por(/Ahorros/)).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro' });
    expect(por(/PLAN UNI SEGUR/)).toMatchObject({ familia: 'seguros_alarmas' });
    expect(por(/fianza/)).toMatchObject({ naturaleza: 'movimiento_interno', familia: 'fianza', subtipo: 'devuelve' });
    expect(por(/HONORARIOS/)).toMatchObject({ familia: 'gestion' });
    // Unicaja escribe poco: solo «PRESTAMO» y «CUOTA» dicen cómo se cobran.
    // fix2 · el ahorro gana familia (traspaso) y método (transferencia): 8 de 8.
    expect(resumen(f)).toEqual({ total: 8, conFamilia: 8, interno: 2, conMetodo: 3, sinFamilia: 0 });
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

// ── E2.4.2-fix2 · Abanca · 49 líneas · el fichero real, anonimizado ─────────
//
// Jose (11 sep 2026): «el motor ya clasifica, la clasificación está enterrada».
// Este bloque fija lo que el CONCEPTO resuelve del fichero, más lo que
// reconocen las cuentas propias (`traspasosPropios` · el titular moviéndose
// dinero). Sin recurrentes y sin el préstamo de socio: eso es otra fuente (D5).
//
// Los números honestos, con las decisiones de Jose aplicadas: FINUTIVE es
// gestoría (D3), el IVA NO se clasifica (D4), UNIHOUSER no entra por concepto
// (D3 · las cuotas van por el préstamo del store, las facturas se quedan hasta
// que él las confirme) y «JUNIO 2025» no dice nada. 38 de 49 con sus ejes; las
// 11 que quedan son las que de verdad hay que preguntar.

describe('Abanca · 49 líneas · el concepto y las cuentas propias', () => {
  const TITULAR = ['Jose Antonio Gomez Ramirez'];
  const CUENTAS = [{ id: 5, iban: 'ES0000000000000000000000', status: 'ACTIVE' }] as unknown as Account[];

  async function abanca() {
    const buffer = fs.readFileSync(path.join(DIR, 'abanca-fixture.csv'));
    const r = await parser.parseFile(new File([buffer], 'abanca.csv', { type: 'text/csv' }));
    const movs = r.movements.map((m, i) => ({
      id: i + 1,
      accountId: 5,
      date: (m.date as Date).toISOString().slice(0, 10),
      amount: m.amount,
      description: m.description,
      reference: m.reference,
      naturaleza: m.amount >= 0 ? 'ingreso' : 'gasto',
      ambito: 'personal',
    }) as Movement);
    // Lo que las cuentas propias reconocen · el titular moviéndose dinero.
    const propios = new Map(traspasosPropios(movs, CUENTAS, TITULAR).map((o) => [o.movementId, o]));
    return { parsed: r, filas: movs.map((mov) => ({
      desc: mov.description,
      fecha: mov.date,
      importe: mov.amount,
      c: clasificarLinea(mov, { ...ctx, cuentas: CUENTAS, nombresTitular: TITULAR, origen: propios.get(mov.id as number) }),
    })) };
  }

  it('el parser lee las 49 con saldo y fecha contable', async () => {
    const { parsed, filas } = await abanca();
    expect(filas).toHaveLength(49);
    // «Fecha ctble» es la de cargo · antes caía en la fecha valor y avisaba.
    expect(filas[7].fecha).toBe('2025-02-03');
    expect(parsed.movements.every((m) => typeof m.balance === 'number')).toBe(true);
    expect(parsed.movements[0].balance).toBe(3549.67);
  });

  it('cada concepto sale con sus ejes · y lo que no se sabe, sin inventar', async () => {
    const { filas } = await abanca();
    const todas = (t: RegExp) => filas.filter((x) => t.test(x.desc));
    const cada = (t: RegExp, esperado: Record<string, unknown>, n: number) => {
      const lista = todas(t);
      expect(lista).toHaveLength(n);
      for (const f of lista) expect(f.c).toMatchObject(esperado);
    };
    cada(/FINUTIVE/i, { naturaleza: 'gasto', familia: 'gestion', subtipo: 'gestoria' }, 8);
    cada(/INTERESES CTA/, { naturaleza: 'ingreso', familia: 'rendimiento', subtipo: 'interes' }, 8);
    cada(/^AHORRO/, { naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro' }, 8);
    cada(/T\.G\.S\.S|TGSS/, { naturaleza: 'gasto', familia: 'cuota_reta' }, 9);
    // La regularización de la TGSS entra y es la cuota que vuelve (§7).
    expect(todas(/DDPP de la TGSS/)[0]).toMatchObject({ importe: 283.03, c: { naturaleza: 'gasto', familia: 'cuota_reta' } });
    // El titular moviéndose dinero · reconocido por las cuentas propias.
    cada(/GOMEZ RAMIREZ/, { naturaleza: 'movimiento_interno', familia: 'traspaso' }, 5);
    // El IVA: sin familia a propósito, y diciendo por qué.
    const iva = todas(/IMP:303/);
    expect(iva).toHaveLength(3);
    for (const f of iva) {
      expect(f.c.familia).toBeUndefined();
      expect(f.c.motivos.join(' ')).toMatch(/Hacienda.*IVA/);
    }
    // UNIHOUSER no entra por concepto (D3) · las cuotas las reconoce el préstamo del store.
    for (const f of todas(/UNIHOUSER/)) expect(f.c.familia).toBeUndefined();
    expect(todas(/UNIHOUSER/)).toHaveLength(7);
    // «JUNIO 2025» no dice nada · y no se inventa.
    expect(todas(/^JUNIO 2025$/)[0].c.familia).toBeUndefined();

    const r = resumen(filas);
    expect(r.total).toBe(49);
    // 8 + 8 + 8 + 9 por concepto, + 5 traspasos propios = 38 con sus ejes.
    expect(r.conFamilia).toBe(38);
    expect(r.interno).toBe(13);
    // 7 UNIHOUSER + 3 IVA + 1 JUNIO · las que de verdad hay que preguntar.
    expect(r.sinFamilia).toBe(11);
  });
});
