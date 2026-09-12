// AUDITORÍA Q2 · pasada (a) con todo (contexto vacío) y (c) solo reglas duras · temporal
import { clasificarLinea, type ContextoClasificacion } from '../services/clasificacion/clasificarLinea';
import { porConcepto } from '../services/clasificacion/reglasDuras';
import { metodoDelConcepto } from '../services/clasificacion/metodoDelConcepto';
import { corpus, movementDe, informe, FICHEROS, type Fila } from './q2.shared';

const VACIO: ContextoClasificacion = { cuentas: [], tarjetas: [], nombresTitular: [] };
const CON_TITULAR: ContextoClasificacion = {
  cuentas: [
    { id: 1, iban: 'ES5400490052622110438676', status: 'ACTIVE' },
    { id: 2, iban: 'ES4700812706150003239635', status: 'ACTIVE' },
    { id: 3, iban: 'ES6021037003520030084437', status: 'ACTIVE' },
  ],
  tarjetas: [],
  nombresTitular: ['Jose Antonio Gomez Ramirez'],
};

function pasada(ctx: ContextoClasificacion): Record<string, Fila[]> {
  const out: Record<string, Fila[]> = {};
  corpus().forEach((l, i) => {
    (out[l.fichero] ??= []).push({ l, c: clasificarLinea(movementDe(l, i), ctx) });
  });
  return out;
}

it('(a) con todo · contexto VACÍO (sin stores · sugerencias=[] · origen=undefined)', () => {
  const r = informe('a_con_todo_ctx_vacio', pasada(VACIO));
  expect(r.find((x) => x.fichero === 'TOTAL')!.total).toBe(1078);
});

it('(a2) con todo · contexto con cuentas propias y nombre del titular (accounts+personalData rellenos)', () => {
  informe('a2_con_todo_ctx_titular', pasada(CON_TITULAR));
});

it('(c) SOLO reglas duras · porConcepto() directo, sin motor', () => {
  const out: Record<string, Fila[]> = {};
  let conMetodoSolo = 0;
  corpus().forEach((l, i) => {
    const m = movementDe(l, i);
    const p = porConcepto({ description: m.description ?? '', reference: m.reference, amount: m.amount }, { nombresTitular: [] });
    if (metodoDelConcepto(m.description, m.reference)) conMetodoSolo++;
    // Se simula la salida del motor: familia con origen «concepto», interno por concepto.
    const c = {
      naturaleza: p?.naturaleza ?? (m.amount >= 0 ? 'ingreso' : 'gasto'),
      familia: p?.familia,
      subtipo: p?.subtipo,
      metodo: p?.metodo,
      ambito: 'personal',
      origen: { naturaleza: p?.naturaleza ? 'concepto' : 'defecto', ambito: 'defecto', ...(p?.familia ? { familia: 'concepto' } : {}) },
      motivos: p ? [p.motivo] : [],
    } as never;
    (out[l.fichero] ??= []).push({ l, c });
  });
  informe('c_solo_reglas_duras', out);
  process.stdout.write(`(c) líneas con método por metodoDelConcepto: ${conMetodoSolo} de 1078\n`);
  expect(FICHEROS.length).toBe(4);
});
