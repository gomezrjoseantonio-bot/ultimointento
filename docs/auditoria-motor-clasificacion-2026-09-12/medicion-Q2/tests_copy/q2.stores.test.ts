// AUDITORÍA Q2 · pasada (d) con stores simulados · el MISMO camino que el
// orquestador (`analizarLineas`): suggestForLineas + reconocerDeterministasDeLineas
// + contextoDelLote + clasificarLineas · sobre fake-indexeddb (setupTests).
import { initDB } from '../services/db';
import { suggestForLineas } from '../services/movementSuggestionService';
import { reconocerDeterministasDeLineas } from '../services/deterministas/matcheoDeterminista';
import { clasificarLineas, contextoDelLote, type BaseParaClasificar } from '../services/clasificacion/clasificarLote';
import { corpus, lineaDe, informe, FICHEROS, type Fila } from './q2.shared';

const STORES = ['movements', 'lineasExtracto', 'compromisosRecurrentes', 'contracts', 'accounts', 'personalData', 'treasuryEvents', 'prestamos', 'ingresos', 'movementLearningRules', 'tarjetas', 'inversiones', 'property_sales'];

async function limpiar() {
  const d = await initDB();
  for (const s of STORES) { try { await d.clear(s as never); } catch { /* store inexistente */ } }
}
async function sembrar(store: string, filas: unknown[]) {
  const d = await initDB();
  for (const f of filas) await d.put(store as never, f as never);
}

const CUENTAS = [
  { id: 1, iban: 'ES5400490052622110438676', alias: 'Santander', status: 'ACTIVE', activa: true, titular: { nombre: 'Jose Antonio Gomez Ramirez' } },
  { id: 2, iban: 'ES4700812706150003239635', alias: 'Sabadell', status: 'ACTIVE', activa: true, titular: { nombre: 'Jose Antonio Gomez Ramirez' } },
  { id: 3, iban: 'ES6021037003520030084437', alias: 'Unicaja', status: 'ACTIVE', activa: true, titular: { nombre: 'Jose Antonio Gomez Ramirez' } },
];
const PERSONA = [{ id: 1, nombre: 'José Antonio', apellidos: 'Gómez Ramírez', dni: '', direccion: '' }];

function periodos(cuota: number, dia: number) {
  const out = [];
  let n = 1;
  for (let y = 2025; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
    out.push({ periodo: n++, devengoDesde: '', devengoHasta: '', fechaCargo: `${y}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`, cuota, interes: 100, amortizacion: cuota - 100, principalFinal: 0, pagado: false });
  }
  return out;
}
const PRESTAMOS = [
  { id: 'p1', nombre: 'Préstamo Unicaja ····6068', inmuebleId: '4', numeroContrato: '2103 4257 0500106068', cuentaCargoId: '3', planPagos: { prestamoId: 'p1', fechaGeneracion: '', periodos: periodos(454.66, 25), resumen: {} } },
];
const RECURRENTES = [
  { id: 31, alias: 'Luz Iberdrola', ambito: 'inmueble', inmuebleId: 4, proveedor: { nombre: 'Iberdrola', nif: 'A95554630' }, patron: { tipo: 'mensualDiaFijo', dia: 1 }, importe: { modo: 'variable', importeMedio: 50 }, cuentaCargo: 2, conceptoBancario: 'IBERDROLA', metodoPago: 'domiciliacion', familia: 'suministro', subtipo: 'luz', estado: 'activo' },
];

async function pasada(nombre: string) {
  const out: Record<string, Fila[]> = {};
  const todas = corpus();
  const db = (await initDB()) as unknown as BaseParaClasificar;
  const ctx = await contextoDelLote(db);
  process.stdout.write(`${nombre} · contextoDelLote → cuentas=${ctx.cuentas.length} tarjetas=${ctx.tarjetas.length} nombresTitular=${JSON.stringify(ctx.nombresTitular)}\n`);
  let nSug = 0, nSugIdent = 0, nOrig = 0; const fuentes: Record<string, number> = {};
  for (const f of FICHEROS) {
    // Cada fichero es su propio lote (como en producción · un import por fichero).
    const lineas = todas.map((l, i) => ({ l, i })).filter((x) => x.l.fichero === f).map((x) => lineaDe(x.l, x.i));
    const suggestions = await suggestForLineas(lineas);
    const reconocido = await reconocerDeterministasDeLineas(lineas);
    for (const [, s] of suggestions) { if (s.length) nSug++; if (s.some((x) => x.via === 'compromiso_recurrente' && x.metadata?.porIdentidad)) nSugIdent++; }
    for (const [, o] of reconocido.origenes) { nOrig++; fuentes[o.fuente] = (fuentes[o.fuente] ?? 0) + 1; }
    const c = clasificarLineas(lineas, { suggestions, reconocido }, ctx);
    out[f] = lineas.map((ln) => ({ l: todas[(ln.id as number) - 1], c: c.get(ln.id as number)! }));
  }
  process.stdout.write(`${nombre} · líneas con sugerencia=${nSug} (por identidad=${nSugIdent}) · origen reconocido=${nOrig} ${JSON.stringify(fuentes)}\n`);
  informe(nombre, out);
}

beforeEach(limpiar);

it('(d0) stores VACÍOS · control · debe coincidir con (a)', async () => { await pasada('d0_stores_vacios'); });

it('(d1) accounts + personalData (lo que tiene cualquier usuario con cuenta dada de alta)', async () => {
  await sembrar('accounts', CUENTAS); await sembrar('personalData', PERSONA);
  await pasada('d1_cuentas_y_titular');
});

it('(d2) + préstamo 0500106068 + recurrente NIF A95554630', async () => {
  await sembrar('accounts', CUENTAS); await sembrar('personalData', PERSONA);
  await sembrar('prestamos', PRESTAMOS); await sembrar('compromisosRecurrentes', RECURRENTES);
  await pasada('d2_prestamo_y_recurrente');
});
