// Memo de resúmenes fiscales · ANTI-CUELGUE.
//
// `computeFiscalSummary` (fiscalSummaryService) es caro y además ESCRIBE en
// IndexedDB (materializa operaciones de gastos recurrentes/intereses y arrastres).
// El cálculo de IRPF lo invoca en abanico recursivo: `calculateCarryForwards` →
// `getPropertyFiscalSummaries` lo re-llama por CADA ejercicio con gastos, y la
// proyección lanza ~20 años en paralelo (cache-bypass en años futuros). Como cada
// llamada materializa gastos de años futuros, el conjunto de ejercicios crecía
// durante la propia ejecución → decenas de miles de operaciones IndexedDB
// entrelazadas que en la práctica no terminaban nunca (Presupuesto y Fiscal
// colgados «in eternum»).
//
// El memo cachea la PROMESA por (inmueble, ejercicio): llamadas repetidas o
// concurrentes comparten un ÚNICO cálculo (y sus escrituras se ejecutan una sola
// vez), colapsando el abanico. TTL corto para no servir datos rancios tras editar.

import type { FiscalSummary } from './db';

const summaryMemo = new Map<string, { at: number; promise: Promise<FiscalSummary> }>();
const SUMMARY_MEMO_TTL_MS = 30_000;

/** Limpia el memo de resúmenes fiscales (tras mutar datos fiscales). */
export const clearFiscalSummaryMemo = (): void => {
  summaryMemo.clear();
};

/**
 * Memoiza el cálculo de un resumen fiscal por (inmueble, ejercicio) durante ~30s.
 * Llamadas repetidas/concurrentes comparten una única promesa (y sus escrituras).
 */
export const memoizeFiscalSummary = (
  propertyId: number,
  exerciseYear: number,
  compute: () => Promise<FiscalSummary>,
): Promise<FiscalSummary> => {
  const key = `${propertyId}:${exerciseYear}`;
  const now = Date.now();
  const cached = summaryMemo.get(key);
  if (cached && now - cached.at < SUMMARY_MEMO_TTL_MS) return cached.promise;
  const promise = compute();
  summaryMemo.set(key, { at: now, promise });
  // Si el cálculo falla, no dejamos una promesa rechazada envenenando el memo.
  promise.catch(() => {
    const cur = summaryMemo.get(key);
    if (cur && cur.promise === promise) summaryMemo.delete(key);
  });
  return promise;
};
