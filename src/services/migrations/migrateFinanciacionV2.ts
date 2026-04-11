/**
 * Migración v2: Destinos y Garantías de préstamos
 *
 * Migra préstamos existentes al nuevo modelo destinos + garantías.
 *
 * Reglas:
 * - Si ya tiene destinos → no migrar (idempotente)
 * - Si tiene afectacionesInmueble (multi) → un DestinoCapital por afectación
 * - Si tiene inmuebleId single → un DestinoCapital ADQUISICION 100%
 * - Si es personal sin inmueble → un DestinoCapital PERSONAL 100%
 * - Garantía por defecto = misma que destino (hipotecaria si inmueble, personal si no)
 * - Idempotente: ejecutar dos veces no duplica datos
 */

import { initDB } from '../db';
import type { DestinoCapital, Garantia } from '../../types/prestamos';

const MIGRATION_FLAG = 'atlas-financiacion-v2-migrated';

function safeLocalStorageGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Safari private mode or quota exceeded — migration will re-run next load, which is safe
  }
}

export async function migrateFinanciacionV2(): Promise<void> {
  // Guard idempotency via localStorage flag
  if (safeLocalStorageGet(MIGRATION_FLAG) === 'true') {
    return;
  }

  const db = await initDB();
  const prestamos = await db.getAll('prestamos');

  let migrated = 0;

  for (const prestamo of prestamos) {
    // Skip if already migrated (has destinos array, even if empty)
    if (Array.isArray(prestamo.destinos)) {
      continue;
    }

    const destinos: DestinoCapital[] = [];
    const garantias: Garantia[] = [];

    if (prestamo.afectacionesInmueble && prestamo.afectacionesInmueble.length > 0) {
      // Multi-property: one DestinoCapital per afectacion
      for (const afectacion of prestamo.afectacionesInmueble) {
        const porcentaje: number = afectacion.porcentaje ?? 0;
        const importe: number = Math.round(prestamo.principalInicial * (porcentaje / 100) * 100) / 100;

        destinos.push({
          id: `dest_${prestamo.id}_${afectacion.inmuebleId}`,
          tipo: 'ADQUISICION',
          inmuebleId: afectacion.inmuebleId,
          importe,
          porcentaje,
        });
      }

      // Garantía hipotecaria sobre los mismos inmuebles (primera afectacion)
      for (const afectacion of prestamo.afectacionesInmueble) {
        garantias.push({
          tipo: 'HIPOTECARIA',
          inmuebleId: afectacion.inmuebleId,
        });
      }
    } else if (prestamo.inmuebleId && typeof prestamo.inmuebleId === 'string' && prestamo.inmuebleId.trim() !== '') {
      // Single property: one ADQUISICION 100%
      destinos.push({
        id: `dest_${prestamo.id}_${prestamo.inmuebleId}`,
        tipo: mapFinalidadToDestinoTipo(prestamo.finalidad),
        inmuebleId: prestamo.inmuebleId,
        importe: prestamo.principalInicial,
        porcentaje: 100,
      });

      garantias.push({
        tipo: 'HIPOTECARIA',
        inmuebleId: prestamo.inmuebleId,
      });
    } else {
      // Personal loan — no property
      destinos.push({
        id: `dest_${prestamo.id}_personal`,
        tipo: 'PERSONAL',
        importe: prestamo.principalInicial,
        porcentaje: 100,
      });

      garantias.push({
        tipo: 'PERSONAL',
      });
    }

    await db.put('prestamos', { ...prestamo, destinos, garantias });
    migrated++;
  }

  safeLocalStorageSet(MIGRATION_FLAG, 'true');

  console.log(`✅ [migrateFinanciacionV2] ${migrated} préstamos migrados al modelo v2 (de ${prestamos.length} totales)`);
}

function mapFinalidadToDestinoTipo(
  finalidad: string | undefined
): DestinoCapital['tipo'] {
  switch (finalidad) {
    case 'ADQUISICION': return 'ADQUISICION';
    case 'REFORMA':     return 'REFORMA';
    case 'INVERSION':   return 'INVERSION';
    case 'PERSONAL':    return 'PERSONAL';
    case 'OTRA':        return 'OTRA';
    default:            return 'ADQUISICION';
  }
}
