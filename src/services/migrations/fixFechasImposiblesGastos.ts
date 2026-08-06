// Migración one-shot: arregla las fechas que no existen en `gastosInmueble`.
//
// `generarOperacionesDesdeRecurrentes` montaba la fecha concatenando
// `${ejercicio}-${mes}-${diaCobro}` sin acotar el día al último del mes, así que
// un recurrente con cargo el 31 escribía `2026-02-31`, `2026-04-31`, `2026-06-31`…
// El generador ya está arreglado (`fechaDeCargo`), pero arreglar el código no
// arregla lo que ya está escrito.
//
// Por qué importa y no es cosmético: `Date` NO rechaza esas fechas, las hace
// RODAR al mes siguiente (`new Date('2026-02-31')` → 3 de marzo). Cualquier
// consumidor que lea la fecha con `Date` cambia el gasto de mes sin avisar —
// incluida `limpiarDuplicadosRecurrentes`, la única herramienta que deduplica
// líneas fiscales, que agrupaba por mes y por tanto deduplicaba mal justo en los
// registros estropeados.
//
// Se ACOTA el día, no se recalcula la fecha: el mes y el ejercicio del registro
// son correctos y hay que conservarlos. El único dato malo es el día, y su
// arreglo es el mismo que aplica el motor de tesorería (`fechaDiaFijoDelMes`):
// día 31 en febrero es el 28, o el 29 si es bisiesto.
//
// Idempotente: una fecha ya válida no se toca, así que la segunda pasada no
// cambia nada. El flag sólo evita releer la tabla entera en cada arranque.

import { initDB } from '../db';
import type { GastoInmueble } from '../db';

const MIGRATION_KEY = 'migration_fix_fechas_imposibles_gastos_v1';

/** ¿La fecha ISO existe en el calendario? `2026-02-31` no. */
export function esFechaImposible(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return false;
  const [, a, mes, dia] = m;
  const d = new Date(Number(a), Number(mes) - 1, Number(dia));
  // Si el día se desborda, `Date` rueda al mes siguiente y deja de coincidir.
  return d.getMonth() !== Number(mes) - 1 || d.getDate() !== Number(dia);
}

/**
 * Baja el día al último del mes, conservando año y mes.
 *
 * Devuelve la misma cadena si ya era válida · así el llamador puede comparar y
 * saltarse la escritura.
 */
export function acotarFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return iso;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12) return iso;
  const ultimo = new Date(anio, mes, 0).getDate();
  if (dia >= 1 && dia <= ultimo) return iso;
  const acotado = Math.min(Math.max(dia, 1), ultimo);
  return `${m[1]}-${m[2]}-${String(acotado).padStart(2, '0')}`;
}

export interface ResultadoFixFechas {
  revisados: number;
  corregidos: number;
  /** `id → [antes, después]` · para poder auditar qué se tocó. */
  cambios: Array<{ id: number; antes: string; despues: string }>;
}

/** Corrige las fechas imposibles. Devuelve qué se tocó. */
export async function fixFechasImposiblesGastos(): Promise<ResultadoFixFechas> {
  const db = await initDB();
  const gastos = ((await db.getAll('gastosInmueble')) ?? []) as GastoInmueble[];

  // Primero se decide qué cambia y luego se escribe, en UNA transacción. Un `put`
  // suelto por fila abre y cierra transacción cada vez, y esto corre en el
  // arranque: con un store grande se nota. Además, si algo falla a medias, una
  // transacción única no deja la tabla medio corregida.
  const cambios: ResultadoFixFechas['cambios'] = [];
  for (const g of gastos) {
    if (g.id == null) continue;
    if (!esFechaImposible(g.fecha)) continue;
    const despues = acotarFecha(g.fecha);
    if (despues === g.fecha) continue;
    cambios.push({ id: g.id, antes: g.fecha, despues });
  }

  if (cambios.length > 0) {
    const porId = new Map(cambios.map((c) => [c.id, c.despues]));
    const ahora = new Date().toISOString();
    const tx = db.transaction('gastosInmueble', 'readwrite');
    const store = tx.objectStore('gastosInmueble');
    for (const g of gastos) {
      const despues = g.id != null ? porId.get(g.id) : undefined;
      if (!despues) continue;
      await store.put({ ...g, fecha: despues, updatedAt: ahora });
    }
    await tx.done;
  }

  return { revisados: gastos.length, corregidos: cambios.length, cambios };
}

/** `localStorage` puede no existir o estar bloqueado (iframes, modo privado). */
function leerFlag(clave: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribirFlag(clave: string, valor: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(clave, valor);
  } catch {
    // Sin flag la migración volverá a correr · es idempotente, así que no pasa
    // nada. Lo que no puede es tumbar el arranque por no poder anotarlo.
  }
}

export async function runMigrationIfNeeded(): Promise<void> {
  if (leerFlag(MIGRATION_KEY)) return;
  try {
    const r = await fixFechasImposiblesGastos();
    if (r.corregidos > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[Migración] fixFechasImposiblesGastos: ${r.corregidos} fecha(s) corregida(s) ` +
          `de ${r.revisados} línea(s) fiscales · ej. ${r.cambios[0].antes} → ${r.cambios[0].despues}`,
      );
    }
    escribirFlag(MIGRATION_KEY, 'done');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[Migración] fixFechasImposiblesGastos falló:', e);
  }
}
