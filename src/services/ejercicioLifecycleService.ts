/**
 * ejercicioLifecycleService.ts
 *
 * Gestiona las transiciones de estado de los ejerciciosFiscales y el procesamiento
 * del XML AEAT sobre un ejercicio ya cerrado por ATLAS (GAP-3).
 *
 * BUG-08 (V5.4): Todas las escrituras van a ejerciciosFiscalesCoord.
 * ejerciciosFiscales (legacy) queda DEPRECATED V5.5 — cero escrituras nuevas.
 *
 * Transiciones válidas:
 *   vivo → en_curso → pendiente_cierre → cerrado → declarado
 *   cualquier estado → prescrito  (automático, 4 años tras presentación)
 */

import { initDB } from './db';
import {
  getOrCreateEjercicio,
  actualizarEstadoEjercicioCoord,
} from './ejercicioResolverService';

// ─── Cerrar ejercicio con ATLAS ──────────────────────────────────────────────

export interface CierreAtlasMetadata {
  totalIngresos: number;
  totalGastos: number;
  cashflowNeto: number;
  cuotaEstimada: number;
  gastosPersonalesEstimados: number;
  gastosPersonalesAjustadosPorUsuario: boolean;
  fuenteDatos: ('xml_aeat' | 'pdf_aeat' | 'print_aeat' | 'atlas_nativo' | 'manual')[];
}

/**
 * @deprecated Writes redirected to ejerciciosFiscalesCoord (BUG-08 · V5.4).
 * ejerciciosFiscales (legacy) is NOT written. cierreAtlasMetadata stored in coord
 * pending field extension in V5.5.
 */
export async function cerrarEjercicioConAtlas(
  año: number,
  metadata: CierreAtlasMetadata
): Promise<void> {
  // BUG-08: redirect to coord (estado → 'pendiente' = cerrado por ATLAS, pendiente declaración)
  await actualizarEstadoEjercicioCoord(año, 'cerrado');
}

// ─── Comparar cierre ATLAS vs XML declarado ──────────────────────────────────

export interface DeclaracionXMLResumen {
  totalIngresos: number;
  totalGastos: number;
  cuotaLiquida: number;
  resultado: number;
  fechaPresentacion: string;
}

export interface ResultadoValidacion {
  hayDiferencias: boolean;
  diferenciaIngresos: number;
  diferenciaGastos: number;
  diferenciaCuota: number;
}

/**
 * @deprecated Writes redirected to ejerciciosFiscalesCoord (BUG-08 · V5.4).
 * Validation metadata is returned but NOT persisted in legacy store.
 */
export async function procesarXMLSobreCierreAtlas(
  año: number,
  declaracionXML: DeclaracionXMLResumen,
  decision: 'actualizar' | 'mantener' | 'revision_parcial'
): Promise<ResultadoValidacion> {
  // BUG-08: read comparison data from coord where available
  const ej = await getOrCreateEjercicio(año, { allowFuture: false });
  const atlasIngresos = (ej as any)?.atlas?.resumen?.baseImponibleGeneral ?? 0;
  const atlasGastos = 0; // coord does not store total gastos separately; use 0
  const atlasCuota = (ej as any)?.atlas?.resumen?.cuotaIntegra ?? 0;

  const diferenciaIngresos = declaracionXML.totalIngresos - atlasIngresos;
  const diferenciaGastos = declaracionXML.totalGastos - atlasGastos;
  const diferenciaCuota = declaracionXML.cuotaLiquida - atlasCuota;
  const hayDiferencias =
    Math.abs(diferenciaIngresos) > 1 ||
    Math.abs(diferenciaGastos) > 1 ||
    Math.abs(diferenciaCuota) > 1;

  // BUG-08: redirect state transition to coord (estado → 'declarado')
  await actualizarEstadoEjercicioCoord(año, 'declarado');

  // If the user decides to update, mark historical treasury events
  if (decision === 'actualizar' && hayDiferencias) {
    const db = await initDB();
    const ahora = new Date().toISOString();
    const todos = await db.getAllFromIndex('treasuryEvents', 'año', año);
    const historicos = todos.filter(e => e.generadoPor === 'historicalTreasuryService');
    for (const evento of historicos) {
      if (evento.id) {
        await db.put('treasuryEvents', {
          ...evento,
          certeza: 'declarado',
          actualizadoPorDeclaracion: true,
          updatedAt: ahora,
        });
      }
    }
  }

  return { hayDiferencias, diferenciaIngresos, diferenciaGastos, diferenciaCuota };
}

// ─── Marcar como pendiente_cierre (automático al pasar el año) ───────────────

/**
 * @deprecated Writes redirected to ejerciciosFiscalesCoord (BUG-08 · V5.4).
 */
export async function marcarPendienteCierre(año: number): Promise<void> {
  const ej = await getOrCreateEjercicio(año, { allowFuture: false });
  if (ej.estado !== 'en_curso') return;
  // BUG-08: redirect to coord
  await actualizarEstadoEjercicioCoord(año, 'pendiente_cierre');
}

// ─── Marcar como prescrito ───────────────────────────────────────────────────

/**
 * @deprecated Writes redirected to ejerciciosFiscalesCoord (BUG-08 · V5.4).
 */
export async function marcarPrescrito(año: number): Promise<void> {
  // BUG-08: redirect to coord
  await actualizarEstadoEjercicioCoord(año, 'prescrito');
}

