// ============================================================================
// ATLAS · T31 · TreasuryBootstrapService
// ============================================================================
//
// Orquestador forward-only que rellena `treasuryEvents` desde el primer día
// del mes en curso hasta hoy + N meses (default 24). Idempotente: invocaciones
// múltiples NO duplican eventos. NO genera eventos retroactivos. NO toca
// `movements` existentes ni eventos confirmed/executed.
//
// Fuentes procesadas:
//   - Nóminas activas      → vía generateMonthlyForecasts
//   - Préstamos / hipotecas → vía generateMonthlyForecasts
//   - Vivienda habitual     → vía regenerarEventosVivienda
//   - Compromisos activos   → vía regenerarEventosCompromiso
//
// Fuera de scope T31 (futuro):
//   - Contratos / alquileres (T31.no)
//   - Autónomos
//   - Inversiones
// ============================================================================

import { initDB } from './db';
import type { TreasuryEvent } from './db';
import { generateMonthlyForecasts } from '../modules/horizon/tesoreria/services/treasurySyncService';
import {
  listarCompromisos,
  regenerarEventosCompromiso,
} from './personal/compromisosRecurrentesService';
import { regenerarEventosVivienda } from './personal/viviendaHabitualService';
import type { ViviendaHabitual } from '../types/viviendaHabitual';

const DEFAULT_HORIZONTE_MESES = 24;
const STORE_VIVIENDA = 'viviendaHabitual';

export interface BootstrapResult {
  mesesProcesados: number;
  eventosCreados: number;
  eventosOmitidos: number;
  errores: Array<{ contexto: string; mensaje: string }>;
  /** ISO date · primer día del mes en curso (YYYY-MM-DD) */
  desde: string;
  /** ISO date · primer día del mes (en curso + horizonteMeses) (YYYY-MM-DD) */
  hasta: string;
}

export interface BootstrapOptions {
  /** Si true · fuerza regeneración aunque no haya gap detectado. Default false. */
  force?: boolean;
  /** Meses hacia adelante desde primer día del mes en curso. Default 24. */
  horizonteMeses?: number;
}

// ─── Helpers de fecha (UTC-safe) ────────────────────────────────────────────

function startOfCurrentMonthUTC(reference: Date = new Date()): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
}

function addMonthsUTC(base: Date, months: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
}

function toIsoDate(date: Date): string {
  return date.toISOString().substring(0, 10);
}

function diffInWholeMonths(later: Date, earlier: Date): number {
  return (
    (later.getUTCFullYear() - earlier.getUTCFullYear()) * 12 +
    (later.getUTCMonth() - earlier.getUTCMonth())
  );
}

// ─── necesitaRegenerar ──────────────────────────────────────────────────────

/**
 * Detecta si hay gap entre el último evento previsto y el horizonte esperado.
 * Devuelve true cuando NO hay predicted events en el horizonte o el evento
 * predicted más lejano queda más de 1 mes por debajo del horizonte esperado.
 */
export async function necesitaRegenerar(
  horizonteMeses: number = DEFAULT_HORIZONTE_MESES,
): Promise<boolean> {
  try {
    const db = await initDB();
    const todos: TreasuryEvent[] = await db.getAll('treasuryEvents');
    const fechasPredicted = todos
      .filter((e) => e.status === 'predicted' && typeof e.predictedDate === 'string')
      .map((e) => e.predictedDate);

    if (fechasPredicted.length === 0) return true;

    const fechaMaximaIso = fechasPredicted.reduce((max, f) => (f > max ? f : max));
    const fechaMaxima = new Date(`${fechaMaximaIso.substring(0, 10)}T00:00:00Z`);
    const horizonteEsperado = addMonthsUTC(startOfCurrentMonthUTC(), horizonteMeses);

    return diffInWholeMonths(horizonteEsperado, fechaMaxima) > 1;
  } catch (err) {
    console.error('[TreasuryBootstrap] necesitaRegenerar falló:', err);
    return false;
  }
}

// ─── regenerateForecastsForward ─────────────────────────────────────────────

/**
 * Genera/actualiza treasuryEvents predicted forward-only desde el primer día
 * del mes en curso hasta hoy + horizonteMeses (default 24).
 *
 * Idempotente · forward-only · resiliente: errores de una fuente NO abortan el
 * resto. Devuelve un BootstrapResult con contadores y lista de errores.
 */
export async function regenerateForecastsForward(
  options: BootstrapOptions = {},
): Promise<BootstrapResult> {
  const horizonteMeses = options.horizonteMeses ?? DEFAULT_HORIZONTE_MESES;
  const desde = startOfCurrentMonthUTC();
  const hasta = addMonthsUTC(desde, horizonteMeses);

  const result: BootstrapResult = {
    mesesProcesados: 0,
    eventosCreados: 0,
    eventosOmitidos: 0,
    errores: [],
    desde: toIsoDate(desde),
    hasta: toIsoDate(hasta),
  };

  // 0. Wipe forward-looking · borra todos los predicted con fecha >= desde.
  //    Cubre el caso de eventos huérfanos cuyo sourceId/sourceType ya no
  //    existe en el catálogo (ej. compromiso eliminado · contrato baja ·
  //    préstamo cancelado). insertEvent solo upserta por sourceType+sourceId
  //    · NO limpia los huérfanos. Esta limpieza inicial garantiza que la
  //    regeneración produce el conjunto correcto sin dejar fantasmas.
  //    Confirmed/executed se respetan (filtro por status === 'predicted').
  try {
    const db = await initDB();
    const desdeIso = result.desde;
    const tx = db.transaction('treasuryEvents', 'readwrite');
    const store = tx.objectStore('treasuryEvents');
    let cursor = await store.openCursor();
    while (cursor) {
      const ev = cursor.value as TreasuryEvent;
      if (
        ev.status === 'predicted' &&
        typeof ev.predictedDate === 'string' &&
        ev.predictedDate >= desdeIso
      ) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (err) {
    result.errores.push({
      contexto: 'wipe predicted forward (pre-regeneración)',
      mensaje: err instanceof Error ? err.message : String(err),
    });
  }

  // 1. Recorrer cada mes del horizonte e invocar generateMonthlyForecasts.
  //    generateMonthlyForecasts es idempotente: respeta status='confirmed' y
  //    upserta el resto, así que no duplica.
  for (let i = 0; i < horizonteMeses; i++) {
    const mes = addMonthsUTC(desde, i);
    const year = mes.getUTCFullYear();
    const month = mes.getUTCMonth() + 1; // 1-indexed
    try {
      const sync = await generateMonthlyForecasts(year, month);
      result.eventosCreados += sync.created;
      result.eventosOmitidos += sync.skipped;
      result.mesesProcesados += 1;
    } catch (err) {
      result.errores.push({
        contexto: `generateMonthlyForecasts ${year}-${String(month).padStart(2, '0')}`,
        mensaje: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. Recorrer vivienda habitual activa. La vivienda es excepción al modelo
  //    de compromisos: genera eventos directamente vía su propio servicio.
  try {
    const db = await initDB();
    const viviendas: ViviendaHabitual[] = await db.getAll(STORE_VIVIENDA);
    const activas = viviendas.filter((v) => v.activa && v.id != null);
    for (const v of activas) {
      try {
        const creados = await regenerarEventosVivienda(v);
        result.eventosCreados += creados;
      } catch (err) {
        result.errores.push({
          contexto: `regenerarEventosVivienda id=${v.id}`,
          mensaje: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    result.errores.push({
      contexto: 'lectura viviendaHabitual',
      mensaje: err instanceof Error ? err.message : String(err),
    });
  }

  // 3. Recorrer compromisos recurrentes activos.
  try {
    const compromisos = await listarCompromisos({ soloActivos: true });
    for (const c of compromisos) {
      if (c.id == null) continue;
      try {
        const creados = await regenerarEventosCompromiso(c);
        result.eventosCreados += creados;
      } catch (err) {
        result.errores.push({
          contexto: `regenerarEventosCompromiso id=${c.id}`,
          mensaje: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    result.errores.push({
      contexto: 'lectura compromisosRecurrentes',
      mensaje: err instanceof Error ? err.message : String(err),
    });
  }

  // 4. Defensa final · purgar cualquier predicted que quede con fecha anterior
  //    al primer día del mes en curso. Forward-only estricto · NO retroactivo.
  try {
    const db = await initDB();
    const desdeIso = result.desde;
    const tx = db.transaction('treasuryEvents', 'readwrite');
    const store = tx.objectStore('treasuryEvents');
    let cursor = await store.openCursor();
    while (cursor) {
      const ev = cursor.value as TreasuryEvent;
      if (
        ev.status === 'predicted' &&
        typeof ev.predictedDate === 'string' &&
        ev.predictedDate < desdeIso
      ) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch (err) {
    result.errores.push({
      contexto: 'purga predicted retroactivos',
      mensaje: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

// ─── exports auxiliares para tests ──────────────────────────────────────────

export const __testing = {
  startOfCurrentMonthUTC,
  addMonthsUTC,
  diffInWholeMonths,
  toIsoDate,
  DEFAULT_HORIZONTE_MESES,
};
