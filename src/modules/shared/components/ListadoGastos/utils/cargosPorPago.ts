// ============================================================================
// Un gasto con varios cargos al año · el IBI de dos pagos
// ============================================================================
//
// Hasta ahora un gasto recurrente tenía UN importe, así que un IBI que se paga
// en junio y en noviembre por cifras distintas había que darlo de alta dos
// veces («IBI 1», «IBI 2»). El modelo nunca lo exigió: `porPago` guarda un mapa
// mes → importe y `calcularImporte` lo resuelve desde el principio. Lo que
// faltaba era capturarlo.
//
// Y faltaba un sitio para el DÍA de cada cargo. El día NO vive en el importe:
// las fechas de las previsiones salen de expandir el PATRÓN, y el importe solo
// contesta «cuánto toca en esta fecha» (`patronCalendario.ts`). Por eso el día
// por mes es `diaPagoPorMes` dentro de `anualMesesConcretos`, y no un campo
// nuevo del importe: el mismo dato con dos dueños acaba divergiendo.
//
// ── La regla que sostiene todo esto ────────────────────────────────────────
//
// `calcularImporte` LANZA si una fecha del patrón cae en un mes que no está en
// el mapa (`patronCalendario.ts:320-325`), y seis pantallas lo llaman sin
// try/catch (Presupuesto, Panel, la tira de 12 meses, el presupuesto anual, la
// proyección mensual y la generación de previsiones). Un `porPago` incoherente
// no deja un hueco: tumba la pantalla.
//
// Por eso `porPagoDesdeCargos` devuelve el importe Y el patrón juntos, de la
// misma lista. No es comodidad: llamar a uno sin el otro es exactamente cómo se
// construye el gasto que revienta.
// ============================================================================

import type {
  ImporteEvento,
  PatronRecurrente,
} from '../../../../../types/compromisosRecurrentes';
import { diaDePatron } from './rejillaMeses';

/** Los meses, escritos una sola vez para toda la app. */
export const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
] as const;

/** Un cargo del año · «el 15 de junio, 200 €». */
export interface Cargo {
  mes: number; // 1-12
  importe: number;
  dia: number; // 1-31
}

/** Un cargo tal y como se teclea en la ficha, antes de ser número. */
export interface CargoDraft {
  mes: number;
  importe: string;
  dia: string;
}

const acotaDia = (d: number): number => Math.min(31, Math.max(1, Math.trunc(d) || 1));

/** «200,50» → 200.5 · la coma es como se escribe un importe en español. */
function aNumero(v: string): number {
  return parseFloat(String(v).replace(',', '.'));
}

/**
 * Los cargos que sí se pueden guardar.
 *
 * Un cargo a medio escribir NO sale de aquí, y como el importe y el patrón se
 * construyen los dos desde esta lista, tampoco puede acabar como un mes del
 * patrón sin importe en el mapa.
 */
export function parseCargos(draft: CargoDraft[]): Cargo[] {
  const cargos: Cargo[] = [];
  for (const d of draft) {
    const importe = aNumero(d.importe);
    if (!Number.isFinite(importe) || importe <= 0) continue;
    if (!Number.isFinite(d.mes) || d.mes < 1 || d.mes > 12) continue;
    const dia = d.dia.trim() === '' ? 1 : acotaDia(aNumero(d.dia));
    cargos.push({ mes: d.mes, importe, dia });
  }
  return cargos;
}

/**
 * Qué impide guardar esta lista, en una frase · `null` si nada.
 *
 * Los cargos incompletos ya los filtra `parseCargos`, así que persistir sería
 * seguro igualmente. Se avisa porque perder en silencio una línea que el
 * usuario acaba de escribir es peor que no guardar.
 */
export function problemaDeCargos(draft: CargoDraft[]): string | null {
  if (draft.some((d) => d.importe.trim() === '' || !(aNumero(d.importe) > 0))) {
    return 'Cada cargo necesita su importe · complétalo o quita la línea';
  }
  const cargos = parseCargos(draft);
  if (cargos.length === 0) return 'Añade al menos un cargo';
  const meses = new Set(cargos.map((c) => c.mes));
  if (meses.size !== cargos.length) {
    return 'Hay dos cargos en el mismo mes · un mes solo puede tener uno';
  }
  return null;
}

/**
 * El importe y el patrón de un gasto por cargos · **los dos a la vez**.
 *
 * Nunca se separan: los meses del patrón son los meses de los cargos, y cada
 * mes del patrón tiene su importe en el mapa. Esa es la coherencia que evita
 * que `calcularImporte` lance.
 *
 * Ojo con no usar aquí `mesesToPatron`: colapsa los doce meses a
 * `mensualDiaFijo`, que lleva UN día para todos, y perdería justo lo que este
 * módulo viene a guardar.
 */
export function porPagoDesdeCargos(cargos: Cargo[]): {
  importe: ImporteEvento;
  patron: PatronRecurrente;
} {
  const ordenados = [...cargos].sort((a, b) => a.mes - b.mes);
  const importesPorPago: Record<number, number> = {};
  const diaPagoPorMes: Record<number, number> = {};
  for (const c of ordenados) {
    importesPorPago[c.mes] = c.importe;
    diaPagoPorMes[c.mes] = acotaDia(c.dia);
  }
  return {
    importe: { modo: 'porPago', importesPorPago },
    patron: {
      tipo: 'anualMesesConcretos',
      mesesPago: ordenados.map((c) => c.mes),
      // Respaldo para quien lea el patrón sin mirar el mapa de días
      // (`diaDePatron`, la rejilla de la ficha). El del primer cargo.
      diaPago: ordenados.length > 0 ? acotaDia(ordenados[0].dia) : 1,
      diaPagoPorMes,
    },
  };
}

/**
 * El día que le toca a un mes según el patrón.
 *
 * Primero el suyo propio; si no lo tiene, el día fijo del patrón —el mismo que
 * ya lee la rejilla de la ficha (`diaDePatron`), para que un gasto no enseñe
 * aquí un día distinto del que enseña ahí—; y 1 cuando el patrón no fija
 * ninguno (los relativos, «el último hábil»).
 */
function diaDelMes(patron: PatronRecurrente, mes: number): number {
  const propio = patron.tipo === 'anualMesesConcretos' ? patron.diaPagoPorMes?.[mes] : undefined;
  return acotaDia(Number.isFinite(propio) ? (propio as number) : diaDePatron(patron));
}

/**
 * Los cargos de un gasto ya guardado · para reabrirlo en la ficha.
 *
 * También lee un `diferenciadoPorMes` (los doce huecos que propone la detección
 * automática): sus meses con cifra son cargos como cualquier otro, así que
 * pasar uno a `porPago` no obliga a teclear nada de nuevo.
 */
export function cargosDeCompromiso(
  importe: ImporteEvento,
  patron: PatronRecurrente,
): Cargo[] {
  if (importe.modo === 'porPago') {
    return Object.entries(importe.importesPorPago)
      .map(([mes, imp]) => ({ mes: Number(mes), importe: imp, dia: diaDelMes(patron, Number(mes)) }))
      .filter((c) => c.mes >= 1 && c.mes <= 12 && c.importe > 0)
      .sort((a, b) => a.mes - b.mes);
  }
  if (importe.modo === 'diferenciadoPorMes') {
    return importe.importesPorMes
      .map((imp, i) => ({ mes: i + 1, importe: imp, dia: diaDelMes(patron, i + 1) }))
      .filter((c) => c.importe > 0);
  }
  return [];
}

/**
 * Lo que se enseña en la columna de importe de la fila.
 *
 * Un gasto por cargos no tiene «el importe»: tiene varios. Pintar «—» lo hacía
 * parecer un gasto sin cifra. Con `detalle` sale la lista entera, que es lo que
 * va en el `title` para verla sin abrir la ficha.
 */
export function resumenDeCargos(
  importe: ImporteEvento,
  patron: PatronRecurrente,
  detalle = false,
): string {
  const cargos = cargosDeCompromiso(importe, patron);
  if (cargos.length === 0) return '—';
  if (!detalle) return `${cargos.length} ${cargos.length === 1 ? 'cargo' : 'cargos'}`;
  return cargos
    .map((c) => `${c.dia} ${MESES_CORTOS[c.mes - 1]} · ${c.importe} €`)
    .join(' — ');
}
