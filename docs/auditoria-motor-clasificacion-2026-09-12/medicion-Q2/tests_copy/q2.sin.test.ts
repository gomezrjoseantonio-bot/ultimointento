// AUDITORÍA Q2 · pasada (b) SIN reglas duras · temporal
// No existe flag para desactivar `reglasDuras`: `clasificarLinea.ts:45` importa
// `porConcepto` directamente, así que se anula el módulo con jest.mock.
jest.mock('../services/clasificacion/reglasDuras', () => ({
  porConcepto: () => undefined,
  esBazarOpaco: () => false,
}));

import { clasificarLinea, type ContextoClasificacion } from '../services/clasificacion/clasificarLinea';
import { corpus, movementDe, informe, type Fila } from './q2.shared';

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

it('(b) SIN reglas duras · contexto vacío', () => {
  const r = informe('b_sin_reglas_duras_ctx_vacio', pasada(VACIO));
  expect(r.find((x) => x.fichero === 'TOTAL')!.total).toBe(1078);
});

it('(b2) SIN reglas duras · contexto con cuentas propias y titular', () => {
  informe('b2_sin_reglas_duras_ctx_titular', pasada(CON_TITULAR));
});
