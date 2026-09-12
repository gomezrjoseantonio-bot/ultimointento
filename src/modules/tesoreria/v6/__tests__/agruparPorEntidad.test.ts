// Agrupar por ENTIDAD · un CUPS, un contrato, una persona, un traspaso.
//
// Lo que se fija: que dos recibos del mismo punto con textos distintos son UNA
// entidad, que dos CUPS de la misma comercializadora son DOS, que los internos
// van juntos aunque el banco los escriba distinto (AHORRO/AHORROS), y que sobre
// el fichero real de Abanca (49 líneas) salen entidades, no montones por texto.

import * as fs from 'fs';
import * as path from 'path';
import { agruparPorEntidad, claveDeEntidad, quienEs, resumenDelFlujo } from '../conciliar/agruparPorEntidad';
import type { LineaExtracto } from '../extractoSesion';
import type { ClasificacionLinea } from '../../../../services/clasificacion/tipos';
import { BankParserService } from '../../../../features/inbox/importers/bankParser';
import { clasificarLinea, type ContextoClasificacion } from '../../../../services/clasificacion/clasificarLinea';
import { traspasosPropios } from '../../../../services/deterministas/traspasosPropios';
import { cuotasDeInversionQueCuadran } from '../../../../services/deterministas/cuotasDeInversion';
import type { Movement } from '../../../../services/db';
import type { Account } from '../../../../services/db/types-contratos';
import type { PosicionInversion } from '../../../../types/inversiones';

const linea = (id: number, extra: Partial<LineaExtracto> = {}): LineaExtracto => ({
  lineaId: 100 + id,
  movementId: id,
  hashLinea: `h${id}`,
  textoBanco: `LINEA ${id}`,
  fecha: '2026-08-03',
  importe: -100,
  veredicto: 'resolver',
  ...extra,
});

const luz = (over: Partial<ClasificacionLinea> = {}): ClasificacionLinea => ({
  naturaleza: 'gasto', familia: 'suministro', subtipo: 'luz', metodo: 'domiciliacion', ambito: 'inmueble',
  origen: { naturaleza: 'concepto', familia: 'concepto', subtipo: 'concepto', metodo: 'concepto', ambito: 'concepto' }, motivos: [], ...over,
});
const ahorro: ClasificacionLinea = { naturaleza: 'movimiento_interno', familia: 'traspaso', subtipo: 'a_ahorro', ambito: 'personal', origen: { naturaleza: 'concepto', ambito: 'defecto', familia: 'concepto' }, motivos: [] };
const soloSigno: ClasificacionLinea = { naturaleza: 'ingreso', ambito: 'personal', origen: { naturaleza: 'defecto', ambito: 'defecto' }, motivos: [] };

describe('la clave de entidad · de más a menos identificador', () => {
  it('el CUPS manda · dos recibos del mismo punto con texto distinto son UNA entidad', () => {
    const a = linea(1, { textoBanco: 'RECIBO IBERDROLA 08/2026 CUPS ES0021000000614000AB', clasificacion: luz() });
    const b = linea(2, { textoBanco: 'IBERDROLA CLIENTES ref 99321 ES0021000000614000AB', clasificacion: luz() });
    expect(claveDeEntidad(a).clave).toBe(claveDeEntidad(b).clave);
    expect(claveDeEntidad(a).tipo).toBe('identificador');
  });

  it('dos CUPS de la misma comercializadora son DOS entidades · el piso A y el piso B', () => {
    const a = linea(1, { textoBanco: 'IBERDROLA ES0021000000614000AB', clasificacion: luz() });
    const b = linea(2, { textoBanco: 'IBERDROLA ES0031000000999999ZZ', clasificacion: luz() });
    expect(claveDeEntidad(a).clave).not.toBe(claveDeEntidad(b).clave);
  });

  it('lo que casó con un previsto se agrupa por el previsto · sin el número que cambia', () => {
    const a = linea(1, { previsto: { id: 1, descripcion: 'Cuota préstamo 3/240', importe: -454, fecha: '2026-08-01' } });
    const b = linea(2, { previsto: { id: 2, descripcion: 'Cuota préstamo 4/240', importe: -454, fecha: '2026-09-01' } });
    expect(claveDeEntidad(a)).toEqual(claveDeEntidad(b));
    expect(claveDeEntidad(a).tipo).toBe('previsto');
  });

  it('sin identificador, la entidad es la contraparte (P3) · Víctor Lada → sus bizums', () => {
    const a = linea(1, { textoBanco: 'BIZUM A FAVOR DE VICTOR LADA 12/08', importe: -15 });
    const b = linea(2, { textoBanco: 'BIZUM A FAVOR DE VICTOR LADA 20/08', importe: -30 });
    const c = linea(3, { textoBanco: 'BIZUM A FAVOR DE AROA GOMEZ', importe: -80 });
    expect(claveDeEntidad(a).clave).toBe(claveDeEntidad(b).clave);
    expect(claveDeEntidad(a).clave).not.toBe(claveDeEntidad(c).clave);
    expect(claveDeEntidad(a).tipo).toBe('contraparte');
  });

  it('la columna de contraparte, si la hay, manda sobre el concepto', () => {
    const a = linea(1, { textoBanco: 'TRANSFERENCIA RECIBIDA 000123', contraparte: 'Emilio Carrera' });
    const b = linea(2, { textoBanco: 'TRANSFERENCIA RECIBIDA 000124', contraparte: 'Emilio Carrera' });
    expect(claveDeEntidad(a).clave).toBe(claveDeEntidad(b).clave);
    expect(quienEs(a)).toBe('Emilio Carrera');
  });

  it('los internos van juntos aunque el banco los escriba distinto · AHORRO / AHORROS JUNIO', () => {
    const a = linea(1, { textoBanco: 'AHORROS', clasificacion: ahorro });
    const b = linea(2, { textoBanco: 'AHORRO JULIO', clasificacion: ahorro });
    expect(claveDeEntidad(a).clave).toBe('interno:a_ahorro');
    expect(claveDeEntidad(b).clave).toBe('interno:a_ahorro');
  });
});

describe('agruparPorEntidad · lo que lee el usuario', () => {
  it('cuenta, suma y conserva las líneas · ninguna se pierde', () => {
    const g = agruparPorEntidad([
      linea(1, { textoBanco: 'AHORROS', importe: -800, clasificacion: ahorro }),
      linea(2, { textoBanco: 'AHORRO', importe: -1400, clasificacion: ahorro }),
      linea(3, { textoBanco: 'AHORROS JUNIO', importe: -79, clasificacion: ahorro }),
      linea(4, { textoBanco: 'UNIHOUSER S.L.', importe: 1391.25, clasificacion: soloSigno }),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ clave: 'interno:a_ahorro', interno: true, cuantas: 3, icono: 'traspaso' });
    expect(g[0].total).toBeCloseTo(-2279, 2);
    expect(g[0].nombre).toBe('Ahorro · lo que apartas');
    expect(g[0].destino).toMatch(/no cuenta como gasto ni ingreso/);
    expect(g[1]).toMatchObject({ nombre: 'UNIHOUSER S.L.', destino: 'sin clasificar', cuantas: 1 });
    expect(g.reduce((n, e) => n + e.lineas.length, 0)).toBe(4);
  });

  it('el nombre lleva el subtipo detrás · «Iberdrola · luz» · y el destino, el piso si lo sabe', () => {
    const g = agruparPorEntidad(
      [
        linea(1, { textoBanco: 'IBERDROLA ES0021000000614000AB', contraparte: 'Iberdrola', clasificacion: luz({ inmuebleId: 4 }) }),
        linea(2, { textoBanco: 'IBERDROLA ES0021000000614000AB 09/26', contraparte: 'Iberdrola', clasificacion: luz({ inmuebleId: 4 }) }),
      ],
      new Map([[4, 'Fuertes Acevedo 32']]),
    );
    expect(g[0].nombre).toBe('Iberdrola · luz');
    expect(g[0].destino).toBe('Fuertes Acevedo 32 · Gasto · Suministro · Luz');
    expect(g[0].sub).toMatch(/^CUPS ES00…4000AB · domiciliación · /);
    expect(g[0].icono).toBe('suministro');
    expect(g[0].inmuebleId).toBe(4);
  });

  it('orden: más líneas primero, y a igualdad más dinero', () => {
    const g = agruparPorEntidad([
      linea(1, { textoBanco: 'BIZUM AROA', importe: -80 }),
      linea(2, { textoBanco: 'BIZUM LUIS', importe: -15 }),
      linea(3, { textoBanco: 'BIZUM LUIS', importe: -15 }),
    ]);
    expect(g.map((e) => e.nombre)).toEqual(['BIZUM LUIS', 'BIZUM AROA']);
  });
});

describe('resumenDelFlujo · lo gordo del hero', () => {
  it('entró y salió por familia · los internos aparte · el rango real', () => {
    const r = resumenDelFlujo([
      linea(1, { fecha: '2025-01-13', importe: -29.04, clasificacion: luz({ familia: 'gestion', subtipo: 'gestoria' }) }),
      linea(2, { fecha: '2025-02-12', importe: -29.04, clasificacion: luz({ familia: 'gestion', subtipo: 'gestoria' }) }),
      linea(3, { fecha: '2025-03-14', importe: 4.45, clasificacion: luz({ naturaleza: 'ingreso', familia: 'rendimiento', subtipo: 'interes' }) }),
      linea(4, { fecha: '2025-08-27', importe: -1400, clasificacion: ahorro }),
      linea(5, { fecha: '2025-05-26', importe: 1391.25, clasificacion: soloSigno }),
    ]);
    expect(r).toMatchObject({ desde: '2025-01-13', hasta: '2025-08-27', cuantas: 5, internos: 1 });
    expect(r.salio.total).toBeCloseTo(-58.08, 2);
    expect(r.salio.familias).toEqual([{ familia: 'gestion', etiqueta: 'Gestión', total: -58.08 }]);
    expect(r.entro.total).toBeCloseTo(1395.7, 2);
    // Lo sin familia suma al total pero no sale como familia.
    expect(r.entro.familias).toEqual([{ familia: 'rendimiento', etiqueta: 'Rendimiento', total: 4.45 }]);
  });
});

// ── El fichero real de Abanca · 49 líneas · entidades, no montones por texto ──

describe('Abanca · 49 líneas · agrupa por entidad', () => {
  const parser = new BankParserService();
  const DIR = path.resolve(__dirname, '../../../../features/inbox/importers/__fixtures__');
  const TITULAR = ['Jose Antonio Gomez Ramirez'];
  const CUENTAS = [{ id: 5, iban: 'ES0000000000000000000000', status: 'ACTIVE' }] as unknown as Account[];
  const PRESTAMO_SOCIO = {
    id: 7, nombre: 'Préstamo Socio', entidad: 'Unihouser', tipo: 'prestamo_p2p', activo: true, total_aportado: 30000, valor_actual: 30000,
    duracion_meses: 60, modalidad_devolucion: 'capital_e_intereses', frecuencia_cobro: 'mensual', retencion_fiscal: 19,
    rendimiento: { tasa_interes_anual: 3.25, frecuencia_pago: 'mensual', fecha_primer_cobro: '2025-03-01T12:00:00.000Z', retencion_porcentaje: 19, pagos_generados: [] },
  } as unknown as PosicionInversion;
  const ctx: ContextoClasificacion = { cuentas: CUENTAS, tarjetas: [], nombresTitular: TITULAR };

  async function lineasDeAbanca(): Promise<LineaExtracto[]> {
    const buffer = fs.readFileSync(path.join(DIR, 'abanca-fixture.csv'));
    const r = await parser.parseFile(new File([buffer], 'abanca.csv', { type: 'text/csv' }));
    const movs = r.movements.map((m, i) => ({
      id: i + 1, accountId: 5, date: (m.date as Date).toISOString().slice(0, 10), amount: m.amount, description: m.description,
      reference: m.reference, naturaleza: m.amount >= 0 ? 'ingreso' : 'gasto', ambito: 'personal',
    }) as Movement);
    const origenes = new Map(
      [...traspasosPropios(movs, CUENTAS, TITULAR), ...cuotasDeInversionQueCuadran(movs, [PRESTAMO_SOCIO])].map((o) => [o.movementId, o]),
    );
    return movs.map((m) => ({
      lineaId: m.id as number, movementId: m.id as number, hashLinea: `h${m.id}`, textoBanco: m.description, fecha: m.date, importe: m.amount,
      veredicto: 'resolver' as const, clasificacion: clasificarLinea(m, { ...ctx, origen: origenes.get(m.id as number) }),
    }));
  }

  it('49 líneas → entidades del mundo de Jose, no 49 montones', async () => {
    const lineas = await lineasDeAbanca();
    const g = agruparPorEntidad(lineas);
    const por = (t: RegExp) => g.find((e) => t.test(e.nombre));
    expect(g).toHaveLength(11);
    expect(g.reduce((n, e) => n + e.cuantas, 0)).toBe(49);
    // AHORRO / AHORROS / AHORRO JULIO · una sola entidad interna.
    expect(por(/^Ahorro/)).toMatchObject({ interno: true, cuantas: 8 });
    // Las 8 gestorías de FINUTIVE · una entidad · gestión · sin la referencia «Y8CSFFT» en el nombre.
    expect(por(/FINUTIVE/i)).toMatchObject({ nombre: 'GC re FINUTIVE · gestoría', cuantas: 8, destino: 'Gasto · Gestión · Gestoría' });
    // Los 8 intereses de la cuenta.
    expect(por(/INTERESES CTA/)).toMatchObject({ cuantas: 8, destino: 'Ingreso · Rendimiento · Interés' });
    // Las cuotas de la TGSS · por el identificador que el banco escribe delante (052107081079).
    const tgss = g.filter((e) => e.clasificacion?.familia === 'cuota_reta');
    expect(tgss.reduce((n, e) => n + e.cuantas, 0)).toBe(9);
    // El préstamo de socio · sus 2 cuotas en su entidad, con la familia que dice el store.
    expect(g.find((e) => e.clasificacion?.familia === 'inversion')).toMatchObject({
      nombre: 'UNIHOUSER S.L. · préstamo p2p', cuantas: 2, destino: 'Ingreso · Inversión · Préstamo P2P', icono: 'inversion',
    });
    // Las 5 facturas de Unihouser · OTRA entidad, sin clasificar · pide decisión.
    expect(por(/^UNIHOUSER S\.L\.$/)).toMatchObject({ cuantas: 5, destino: 'sin clasificar' });
    // Las 5 transferencias del titular · traspasos entre sus cuentas.
    expect(g.find((e) => e.clave === 'interno:a_otra_cuenta')).toMatchObject({ cuantas: 5, interno: true });
    // Los 3 pagos del IVA · una entidad (en el fichero real por el NIF; aquí el
    // NIF está anonimizado y no valida, así que caen por la contraparte) · sin clasificar (D4).
    expect(por(/^IMP/)).toMatchObject({ cuantas: 3, destino: 'sin clasificar' });
    // Y la que no dice nada · «JUNIO 2025» · sola, y sin inventar.
    expect(por(/^JUNIO$/)).toMatchObject({ cuantas: 1, destino: 'sin clasificar' });
  });

  it('el hero de Abanca · entró, salió y los internos aparte', async () => {
    const r = resumenDelFlujo(await lineasDeAbanca());
    expect(r).toMatchObject({ cuantas: 49, desde: '2025-01-13', hasta: '2025-08-29', internos: 13 });
    expect(r.entro.familias.map((f) => f.familia)).toEqual(['inversion', 'cuota_reta', 'rendimiento']);
    expect(r.salio.familias.map((f) => f.familia)).toEqual(['cuota_reta', 'gestion']);
  });
});
