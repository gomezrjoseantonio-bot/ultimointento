// ============================================================================
// Alquiler de la vivienda habitual · productor de `alquilerAnual`
// (Fase 3 del modelo de vivienda habitual)
// ============================================================================
//
// El motor de deducciones autonómicas (deduccionesAutonomicasService) espera
// `DatosBaseDeduccion.alquilerAnual` — pero hasta ahora NADIE lo producía, así
// que la deducción autonómica por alquiler estaba muerta por falta de dato.
//
// Fuente del dato · modelo unificado (sin ficha aparte): el alquiler del
// inquilino vive como gasto recurrente personal (CompromisoRecurrente con
// categoria 'vivienda.alquiler'). Semántica default-true del flag
// `esViviendaHabitual`: undefined cuenta como vivienda habitual · false
// explícito la excluye (trastero, segunda vivienda…).
//
// El importe anual se suma de los treasuryEvents generados por ese compromiso
// (índice sourceId · sourceType 'gasto_recurrente') · así refleja variaciones
// (IPC, tramos) sin duplicar la lógica de proyección.
// ============================================================================

import { initDB } from '../db';
import type { TreasuryEvent } from '../db/types-movimientos';
import type { CompromisoRecurrente } from '../../types/compromisosRecurrentes';
import { listarCompromisos } from '../personal/compromisosRecurrentesService';

const STORE_TREASURY = 'treasuryEvents';

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ─── Funciones puras (exportadas para testing) ──────────────────────────────

/** ¿Es este compromiso el alquiler de la vivienda habitual del titular? */
export function esCompromisoAlquilerVH(
  c: Pick<CompromisoRecurrente, 'ambito' | 'categoria' | 'esViviendaHabitual' | 'estado'>,
): boolean {
  return (
    c.ambito === 'personal' &&
    c.categoria === 'vivienda.alquiler' &&
    c.esViviendaHabitual !== false &&
    c.estado === 'activo'
  );
}

/**
 * Suma los eventos de gasto recurrente del ejercicio (importe absoluto).
 * Año por slice del ISO · sin shift de timezone.
 */
export function sumarEventosAlquilerEjercicio(
  eventos: Array<Pick<TreasuryEvent, 'amount' | 'predictedDate' | 'sourceType'>>,
  ejercicio: number,
): number {
  const anio = String(ejercicio);
  let total = 0;
  for (const e of eventos) {
    if (e.sourceType === 'gasto_recurrente' && e.predictedDate?.slice(0, 4) === anio) {
      total += Math.abs(e.amount);
    }
  }
  return round2(total);
}

// ─── Orquestador ────────────────────────────────────────────────────────────

export interface AlquilerVHResult {
  /** € pagados (o proyectados) de alquiler de vivienda habitual en el ejercicio. */
  importeAnual: number;
  /** Ids de los compromisos que lo componen (normalmente uno). */
  compromisoIds: number[];
}

/**
 * Alquiler anual de la vivienda habitual del titular en el ejercicio.
 * Nunca lanza: si algo falla devuelve 0 (el IRPF no debe romperse por esto).
 */
export async function calcularAlquilerVHAnual(ejercicio: number): Promise<AlquilerVHResult> {
  try {
    const personales = await listarCompromisos({ ambito: 'personal', soloActivos: true });
    const alquileres = personales.filter(esCompromisoAlquilerVH);
    if (alquileres.length === 0) return { importeAnual: 0, compromisoIds: [] };

    const db = await initDB();
    const idx = db
      .transaction(STORE_TREASURY, 'readonly')
      .objectStore(STORE_TREASURY)
      .index('sourceId');

    let total = 0;
    const compromisoIds: number[] = [];
    for (const c of alquileres) {
      if (c.id == null) continue;
      const eventos = (await idx.getAll(c.id)) as TreasuryEvent[];
      const suma = sumarEventosAlquilerEjercicio(eventos, ejercicio);
      if (suma > 0) {
        total += suma;
        compromisoIds.push(c.id);
      }
    }
    return { importeAnual: round2(total), compromisoIds };
  } catch (err) {
    console.error('[alquilerViviendaHabitual] error calculando alquiler anual', err);
    return { importeAnual: 0, compromisoIds: [] };
  }
}
