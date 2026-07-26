// Rejilla de doce meses (§2.2 / §3.2). El calendario se guarda como "qué meses
// se cobra", no como una periodicidad cerrada. Los atajos (todos · cada 2 · cada
// 3 · cada 4 · cada 6 · una vez al año) SOLO marcan casillas; cualquier
// combinación rara se marca a mano.
//
// Mapeo con el modelo real (`PatronRecurrente`): un conjunto de meses + un día
// fijo se guarda como `anualMesesConcretos` (o `mensualDiaFijo` si son los 12).
// Cubre los cinco calendarios reales de Jose: mensual día 2 · bimestral desde
// julio (jul·sep·nov) · IBI en junio · dos veces al año (abr·oct) · once meses
// sin agosto.
//
// (Los modos de día relativo —primer hábil · último día · "no lo sé"— viven en
// el selector "día del cargo" del bloque Cuándo, no en la rejilla.)

import type { PatronRecurrente } from '../../../../../types/compromisosRecurrentes';

/** Meses 1-12 en los que el patrón genera cargo (para pintar la rejilla). */
export function patronToMeses(patron: PatronRecurrente): number[] {
  switch (patron.tipo) {
    case 'mensualDiaFijo':
    case 'mensualDiaRelativo':
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    case 'cadaNMeses': {
      const n = Math.max(1, patron.cadaNMeses);
      const out: number[] = [];
      for (let m = 1; m <= 12; m++) {
        if (((m - patron.mesAncla) % n + n) % n === 0) out.push(m);
      }
      return out;
    }
    case 'trimestralFiscal':
      return [1, 4, 7, 10];
    case 'anualMesesConcretos':
    case 'variablePorMes':
      return [...patron.mesesPago].sort((a, b) => a - b);
    case 'pagasExtra':
      return [...patron.mesesExtra].sort((a, b) => a - b);
    case 'puntual': {
      const d = new Date(patron.fecha);
      return Number.isNaN(d.getTime()) ? [] : [d.getMonth() + 1];
    }
  }
}

/**
 * Construye el patrón desde los meses marcados + el día fijo del cargo. Los 12
 * meses → `mensualDiaFijo`; cualquier subconjunto → `anualMesesConcretos`.
 * `dia` se clampa a 1-28 (día seguro en todos los meses).
 */
export function mesesToPatron(meses: number[], dia: number): PatronRecurrente {
  const diaPago = Math.min(28, Math.max(1, Math.trunc(dia) || 1));
  const unicos = Array.from(new Set(meses.filter((m) => m >= 1 && m <= 12))).sort((a, b) => a - b);
  if (unicos.length === 12) return { tipo: 'mensualDiaFijo', dia: diaPago };
  return { tipo: 'anualMesesConcretos', mesesPago: unicos, diaPago };
}

/** El día fijo que lleva un patrón de rejilla (para precargar el input). */
export function diaDePatron(patron: PatronRecurrente): number {
  switch (patron.tipo) {
    case 'mensualDiaFijo':
      return patron.dia;
    case 'cadaNMeses':
      return patron.dia;
    case 'anualMesesConcretos':
    case 'trimestralFiscal':
      return patron.diaPago;
    default:
      return 1;
  }
}

export type AtajoRejilla =
  | 'todos'
  | 'cada2'
  | 'cada3'
  | 'cada4'
  | 'cada6'
  | 'unaVezAlAnio';

/**
 * Meses que marca un atajo, anclado en `desde` (1-12, el mes del primer cobro).
 * Como el patrón se repite año a año, "cada N desde julio" marca TODOS los meses
 * de esa fase en el año (jul→ ene·mar·may·jul·sep·nov), no solo jul-dic. Solo
 * devuelve casillas · no guarda ningún "tipo".
 */
export function mesesDeAtajo(atajo: AtajoRejilla, desde = 1): number[] {
  const start = ((desde - 1 + 12) % 12) + 1;
  if (atajo === 'todos') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (atajo === 'unaVezAlAnio') return [start];
  const step = atajo === 'cada2' ? 2 : atajo === 'cada3' ? 3 : atajo === 'cada4' ? 4 : 6;
  const out: number[] = [];
  for (let m = 1; m <= 12; m++) {
    if (((m - start) % step + step) % step === 0) out.push(m);
  }
  return out;
}
