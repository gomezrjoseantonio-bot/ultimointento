// ============================================================================
// ATLAS · T31 · TreasuryBootstrapService
// ============================================================================
//
// Orquestador forward-only que rellena `treasuryEvents` desde el primer día
// del mes en curso hasta hoy + N meses (default 24). Idempotente: invocaciones
// múltiples NO duplican eventos. NO genera eventos retroactivos. NO toca
// `movements` existentes ni eventos confirmed/executed.
//
// Forward-only es lo que ESCRIBE, no lo que BORRA: lo ya previsto para un mes
// que pasó se queda donde está. Un previsto vencido sin confirmar es trabajo
// pendiente —lo sigues esperando— y un descartado es la constancia de que algo
// no ocurrió; ni uno ni otro caducan porque cambie el mes (ver el paso 4).
//
// Fuentes procesadas:
//   - Nóminas activas      → vía generateMonthlyForecasts
//   - Préstamos / hipotecas → vía generateMonthlyForecasts
//   - Compromisos activos   → vía regenerarEventosCompromiso (del mes en curso
//                             hacia delante) y reconstruirRecurrentesDelPasado
//                             (del suelo del ejercicio a ayer · como previsto)
//   - Vivienda habitual     → SOLO limpieza (Fase 4 · generador retirado): se
//     borran los eventos previstos que la ficha legacy hubiera dejado, vía
//     borrarEventosFuturosVivienda. Los gastos del hogar viven como compromisos.
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
import { borrarEventosFuturosVivienda } from './personal/viviendaHabitualService';
import { reconstruirRecurrentesDelPasado } from './reconstruccionRecurrentes';
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
  //    Los DESCARTADOS también: descartar no es borrar · el motor tiene que
  //    saber que eso no va a pasar para no volver a proponerlo (V84 · D1). Si
  //    se barren aquí, la regeneración los resucita como pendientes.
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
        ev.descartado !== true &&
        (ev as { executedMovementId?: number | string | null }).executedMovementId == null &&
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

  // 2. (Fase 4 vivienda habitual · generador retirado) La ficha ViviendaHabitual
  //    ya NO genera eventos: los gastos del hogar viven como compromisos
  //    (sección 3) y la cuota de hipoteca la genera Financiación. Aquí solo se
  //    limpian los eventos futuros que la ficha hubiera dejado, para que no
  //    queden previsiones huérfanas duplicando a los compromisos.
  try {
    const db = await initDB();
    const viviendas: ViviendaHabitual[] = await db.getAll(STORE_VIVIENDA);
    for (const v of viviendas) {
      if (v.id == null) continue;
      try {
        await borrarEventosFuturosVivienda(v.id);
      } catch (err) {
        result.errores.push({
          contexto: `borrarEventosFuturosVivienda id=${v.id}`,
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
        // Horizonte del bootstrap → ventana materializada caller-driven.
        const creados = await regenerarEventosCompromiso(c, hasta);
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

  // 3 bis. El PASADO del ejercicio · lo que el motor de arriba no emite.
  //
  // `regenerarEventosCompromiso` proyecta del día 1 del mes en curso hacia
  // delante, así que del suelo del ejercicio a ayer no había nada: ni que
  // confirmar a mano ni contra lo que cuadrar el extracto al subirlo.
  //
  // Va DESPUÉS de la regeneración normal a propósito: así rellena huecos sobre
  // un conjunto ya estable. Solo AÑADE —nunca borra ni reescribe— y lo que
  // emite nace `predicted`, que no entra en el saldo. Un fallo suyo no puede
  // tumbar el resto del bootstrap.
  try {
    const pasado = await reconstruirRecurrentesDelPasado();
    result.eventosCreados += pasado.eventosCreados;
    for (const e of pasado.errores) {
      result.errores.push({
        contexto: `reconstruirRecurrentesDelPasado id=${e.compromisoId}`,
        mensaje: e.mensaje,
      });
    }
  } catch (err) {
    result.errores.push({
      contexto: 'reconstruirRecurrentesDelPasado',
      mensaje: err instanceof Error ? err.message : String(err),
    });
  }

  // 4. Lo VENCIDO se queda.
  //
  //    Aquí había una «defensa final» que borraba, en cada pasada, todo
  //    `predicted` con fecha anterior al primer día del mes en curso. Venía del
  //    principio «forward-only» con el que nació este orquestador (T31): la
  //    proyección mira hacia delante.
  //
  //    Pero un cargo previsto para el 30 de septiembre que a día 1 de octubre
  //    no ha llegado NO es basura: es un pendiente que su dueño sigue
  //    esperando, y el silencio significa justo eso. Barrerlo era decidir por
  //    él que no iba a ocurrir, sin dejar rastro y sin preguntar. Se llevaba
  //    además los DESCARTADOS del mes anterior, que son lo contrario —la
  //    constancia explícita de que algo no ocurrió—, así que la misma pregunta
  //    volvía al mes siguiente.
  //
  //    La pantalla ya contaba con que esto existiera: `limiteMeses.ts` dice que
  //    «el único motivo legítimo para mirar atrás es que quede TRABAJO ahí: un
  //    previsto vencido sin confirmar», y `mesMinimo` retrocede hasta el más
  //    antiguo. Con la purga en medio no podía dispararse nunca.
  //
  //    Un previsto vencido sale ahora de «por confirmar» por donde debe: se
  //    confirma cuando el cargo llega, o se descarta cuando se sabe que no va a
  //    llegar. Lo que evita duplicados sigue siendo el barrido del paso 0, que
  //    cubre el horizonte que la regeneración vuelve a emitir; el pasado no se
  //    regenera, así que dejarlo quieto no duplica nada.

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
