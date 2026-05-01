// ============================================================================
// ATLAS · TAREA 9.2 · compromisoCreationService
// ============================================================================
//
// Toma una lista de `CandidatoCompromiso` (resultado de
// `compromisoDetectionService.detectCompromisos`) y los persiste en
// `compromisosRecurrentes`.
//
// Reglas T9.2:
//   - Idempotente · re-correr no duplica registros (filtro por
//     cuentaCargo + conceptoBancario similar contra el store)
//   - Reusa la validación de invariantes ya existente
//     (`puedeCrearCompromiso` en `compromisosRecurrentesService`)
//   - Reusa la creación canónica (`crearCompromiso`) que ya valida +
//     persiste + regenera `treasuryEvents` (regla de oro #1)
//   - NO toca movementSuggestionService · la vía A se activa "sola" en
//     cuanto el store deja de estar vacío (T17 ya implementó el shell)
//   - NO sube DB_VERSION
//
// API:
//   - createCompromisosFromCandidatos(candidatos, options?) · escribe
//   - detectAndPreview(options?) · proxy a detectCompromisos · útil
//     para refrescar la lista desde la UI
// ============================================================================

import type { CompromisoRecurrente } from '../types/compromisosRecurrentes';
import type {
  CandidatoCompromiso,
  DetectionOptions,
  DetectionReport,
} from './compromisoDetectionService';
import { detectCompromisos } from './compromisoDetectionService';
import {
  crearCompromiso,
  listarCompromisos,
  puedeCrearCompromiso,
} from './personal/compromisosRecurrentesService';

// ─── Tipos públicos · spec §3.2 ────────────────────────────────────────────

export interface CreationOptions {
  /**
   * Map<candidatoId, overrides> · permite que la UI edite la propuesta antes
   * de crear (alias · categoría · responsable · etc.). Los campos no
   * presentes en el override se preservan de la propuesta original.
   */
  ajustesPorCandidato?: Map<string, Partial<CompromisoRecurrente>>;
}

export interface CreationResult {
  creados: CompromisoRecurrente[];
  duplicadosOmitidos: string[];
  erroresValidacion: Array<{
    candidatoId: string;
    motivo: string;
  }>;
}

type PropuestaCompromiso = Omit<
  CompromisoRecurrente,
  'id' | 'createdAt' | 'updatedAt'
>;

// ─── Utilidades internas ───────────────────────────────────────────────────

/**
 * Mezcla shallow + soporte para sub-objeto `proveedor` (nested).
 *
 * Cualquier campo presente en el override sobreescribe el de la propuesta.
 * `proveedor` se mezcla campo-a-campo para no perder el `nombre` original
 * cuando solo se cambia, p.ej., el `nif`.
 */
function mergePropuesta(
  base: PropuestaCompromiso,
  override: Partial<CompromisoRecurrente>,
): PropuestaCompromiso {
  const merged: PropuestaCompromiso = { ...base, ...(override as object) } as PropuestaCompromiso;
  if (override.proveedor) {
    merged.proveedor = { ...base.proveedor, ...override.proveedor };
  }
  // Eliminamos campos meta que no deben venir desde la UI · son de auditoría
  // y los gestiona `crearCompromiso` / la BD.
  delete (merged as Partial<CompromisoRecurrente>).id;
  delete (merged as Partial<CompromisoRecurrente>).createdAt;
  delete (merged as Partial<CompromisoRecurrente>).updatedAt;
  return merged;
}

/**
 * Normalización ligera para comparar conceptos bancarios y detectar
 * duplicados. Misma idea que `compromisoDetectionService.normalizeDescription`
 * pero local (evita acoplar dos servicios por una utilidad de 5 líneas).
 */
function normalizeConcepto(desc: string): Set<string> {
  const tokens = desc
    .toUpperCase()
    .replace(/[0-9]+/g, ' ')
    .replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  return new Set(tokens);
}

function isDuplicateOfExisting(
  cuentaCargo: number,
  conceptoBancario: string,
  existentes: CompromisoRecurrente[],
): boolean {
  const tokens = normalizeConcepto(conceptoBancario);
  if (tokens.size === 0) return false;
  return existentes.some((c) => {
    if (c.estado !== 'activo') return false;
    if (c.cuentaCargo !== cuentaCargo) return false;
    const existeTokens = normalizeConcepto(c.conceptoBancario ?? '');
    if (existeTokens.size === 0) return false;
    for (const t of existeTokens) {
      if (tokens.has(t)) return true;
    }
    return false;
  });
}

function preValidatePropuesta(
  propuesta: PropuestaCompromiso,
): { ok: true } | { ok: false; motivo: string } {
  // Invariantes que `puedeCrearCompromiso` no chequea explícitamente pero
  // son necesarios para que el modelo funcione end-to-end.
  if (!propuesta.cuentaCargo || propuesta.cuentaCargo <= 0) {
    return { ok: false, motivo: 'cuentaCargo inválido (≤0 o ausente)' };
  }
  if (!propuesta.conceptoBancario || propuesta.conceptoBancario.trim().length === 0) {
    return { ok: false, motivo: 'conceptoBancario vacío' };
  }
  if (!propuesta.alias || propuesta.alias.trim().length === 0) {
    return { ok: false, motivo: 'alias vacío' };
  }
  return { ok: true };
}

// ─── API pública ───────────────────────────────────────────────────────────

export async function createCompromisosFromCandidatos(
  candidatos: CandidatoCompromiso[],
  options?: CreationOptions,
): Promise<CreationResult> {
  const result: CreationResult = {
    creados: [],
    duplicadosOmitidos: [],
    erroresValidacion: [],
  };

  // Pre-cargar compromisos vivos para detección de duplicados · evita N
  // round-trips a la DB al iterar y mantiene la idempotencia entre los
  // candidatos del mismo lote.
  const existentes = await listarCompromisos({ soloActivos: true });

  const overrides = options?.ajustesPorCandidato;

  for (const cand of candidatos) {
    const override = overrides?.get(cand.id);
    const propuesta = override
      ? mergePropuesta(cand.propuesta, override)
      : cand.propuesta;

    // 1. Validaciones locales (cuentaCargo · concepto · alias)
    const pre = preValidatePropuesta(propuesta);
    if (!pre.ok) {
      result.erroresValidacion.push({ candidatoId: cand.id, motivo: pre.motivo });
      continue;
    }

    // 2. Validación canónica del modelo
    const validacion = await puedeCrearCompromiso(propuesta);
    if (!validacion.ok) {
      result.erroresValidacion.push({
        candidatoId: cand.id,
        motivo: validacion.motivo ?? 'no permitido',
      });
      continue;
    }

    // 3. Detección de duplicado contra el store (idempotencia)
    if (isDuplicateOfExisting(propuesta.cuentaCargo, propuesta.conceptoBancario, existentes)) {
      result.duplicadosOmitidos.push(cand.id);
      continue;
    }

    // 4. Crear · `crearCompromiso` valida invariantes (re-chequea), persiste
    //    y regenera `treasuryEvents` (regla de oro #1).
    try {
      const creado = await crearCompromiso(propuesta);
      result.creados.push(creado);
      // Incluir el recién creado en la lista de existentes para que duplicados
      // dentro del mismo lote también se detecten.
      existentes.push(creado);
    } catch (err) {
      result.erroresValidacion.push({
        candidatoId: cand.id,
        motivo: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * Proxy a `detectCompromisos` · útil para que la UI de aprobación (T9.3)
 * pida un refresh sin importar dos servicios distintos.
 */
export async function detectAndPreview(
  options?: DetectionOptions,
): Promise<DetectionReport> {
  return detectCompromisos(options);
}
