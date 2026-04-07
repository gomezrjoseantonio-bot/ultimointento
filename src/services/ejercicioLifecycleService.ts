/**
 * ejercicioLifecycleService.ts
 *
 * Gestiona las transiciones de estado de los ejerciciosFiscales y el procesamiento
 * del XML AEAT sobre un ejercicio ya cerrado por ATLAS (GAP-3).
 *
 * Transiciones válidas:
 *   vivo → en_curso → pendiente_cierre → cerrado → declarado
 *   cualquier estado → prescrito  (automático, 4 años tras presentación)
 */

import { initDB, EstadoEjercicio } from './db';
import type { EjercicioFiscal } from './db';

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

export async function cerrarEjercicioConAtlas(
  año: number,
  metadata: CierreAtlasMetadata
): Promise<void> {
  const db = await initDB();
  const ejercicio = await db.get('ejerciciosFiscales', año);
  if (!ejercicio) return;

  const ahora = new Date().toISOString();
  await db.put('ejerciciosFiscales', {
    ...ejercicio,
    estado: 'cerrado' as EstadoEjercicio,
    cierreAtlasMetadata: {
      fechaCierre: ahora,
      confirmadoPorUsuario: true,
      fechaConfirmacion: ahora,
      ...metadata,
    },
    cerradoAt: ahora,
    updatedAt: ahora,
  } satisfies EjercicioFiscal);
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

export async function procesarXMLSobreCierreAtlas(
  año: number,
  declaracionXML: DeclaracionXMLResumen,
  decision: 'actualizar' | 'mantener' | 'revision_parcial'
): Promise<ResultadoValidacion> {
  const db = await initDB();
  const ejercicio = await db.get('ejerciciosFiscales', año);
  if (!ejercicio) throw new Error(`Ejercicio ${año} no encontrado en ejerciciosFiscales`);

  const atlasIngresos = ejercicio.cierreAtlasMetadata?.totalIngresos ?? 0;
  const atlasGastos = ejercicio.cierreAtlasMetadata?.totalGastos ?? 0;
  const atlasCuota = ejercicio.cierreAtlasMetadata?.cuotaEstimada ?? 0;

  const diferenciaIngresos = declaracionXML.totalIngresos - atlasIngresos;
  const diferenciaGastos = declaracionXML.totalGastos - atlasGastos;
  const diferenciaCuota = declaracionXML.cuotaLiquida - atlasCuota;
  const hayDiferencias =
    Math.abs(diferenciaIngresos) > 1 ||
    Math.abs(diferenciaGastos) > 1 ||
    Math.abs(diferenciaCuota) > 1;

  const ahora = new Date().toISOString();
  await db.put('ejerciciosFiscales', {
    ...ejercicio,
    estado: 'declarado' as EstadoEjercicio,
    validacionDeclaracion: {
      fechaValidacion: ahora,
      diferenciaIngresos,
      diferenciaGastos,
      diferenciaCuota,
      hayDiferencias,
      decisionUsuario: decision,
      fechaDecision: ahora,
    },
    declaradoAt: ahora,
    updatedAt: ahora,
  } satisfies EjercicioFiscal);

  // Si el usuario decide actualizar, marcar los eventos históricos del año
  if (decision === 'actualizar' && hayDiferencias) {
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

export async function marcarPendienteCierre(año: number): Promise<void> {
  const db = await initDB();
  const ejercicio = await db.get('ejerciciosFiscales', año);
  if (!ejercicio || ejercicio.estado !== 'en_curso') return;
  await db.put('ejerciciosFiscales', {
    ...ejercicio,
    estado: 'pendiente_cierre' as EstadoEjercicio,
    updatedAt: new Date().toISOString(),
  } satisfies EjercicioFiscal);
}

// ─── Marcar como prescrito ───────────────────────────────────────────────────

export async function marcarPrescrito(año: number): Promise<void> {
  const db = await initDB();
  const ejercicio = await db.get('ejerciciosFiscales', año);
  if (!ejercicio) return;
  await db.put('ejerciciosFiscales', {
    ...ejercicio,
    estado: 'prescrito' as EstadoEjercicio,
    updatedAt: new Date().toISOString(),
  } satisfies EjercicioFiscal);
}
