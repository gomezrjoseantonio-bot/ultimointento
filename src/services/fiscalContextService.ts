// ============================================================================
// ATLAS · TAREA 14.2 · fiscalContextService
// ============================================================================
//
// Gateway de lectura del contexto fiscal del titular. Combina las fuentes
// canónicas `personalData` (vía `personalDataService`) y `viviendaHabitual`
// (vía `obtenerViviendaActiva`) en un único objeto tipado `FiscalContext`.
//
// Este servicio NO escribe · NO toca consumidores existentes (eso es 14.4) ·
// NO modifica los servicios subyacentes · solo los compone.
//
// Reglas garantizadas:
//   · `tributacion` siempre tiene valor (default 'individual' si null en source).
//   · Edades calculadas si `fechaNacimiento` disponible (acepta ISO o dd/mm/yyyy).
//   · `viviendaHabitual=null` si no hay ficha activa para el `personalDataId`.
//   · `warnings[]` enumera los campos críticos faltantes.
//   · Cache opcional in-memory con TTL 30s · invalidable vía
//     `invalidateFiscalContext()`.
// ============================================================================

import type {
  PersonalData,
  NivelDiscapacidad,
  TipoTributacion,
} from '../types/personal';
import type {
  ViviendaHabitual,
  ViviendaHabitualData,
} from '../types/viviendaHabitual';
import { personalDataService } from './personalDataService';
import { obtenerViviendaActiva } from './personal/viviendaHabitualService';

// ─── Tipo público ───────────────────────────────────────────────────────────

export interface FiscalContext {
  // Identidad fiscal
  personalDataId: number;
  nombre: string;
  apellidos: string;
  dni: string;

  // Tributación
  tributacion: TipoTributacion;          // garantizado · default 'individual'
  comunidadAutonoma: string | null;      // null si no informada
  fechaNacimiento: string | null;        // ISO · null si no informada
  edadActual: number | null;             // calculada · null si fecha ausente

  // Mínimos personales
  descendientes: Array<{
    nombre: string;
    fechaNacimiento: string;
    edadActual: number;
    discapacidad: NivelDiscapacidad;
  }>;
  ascendientes: Array<{
    nombre: string;
    fechaNacimiento: string;
    edadActual: number;
    discapacidad: NivelDiscapacidad;
  }>;
  discapacidadTitular: NivelDiscapacidad;

  // Vivienda habitual (subset fiscalmente relevante)
  viviendaHabitual: {
    activa: boolean;
    referenciaCatastral: string | null;
    valorCatastral: number | null;
    porcentajeTitularidad: number | null;
    fechaAdquisicion: string | null;
    precioAdquisicion: number | null;
    gastosAdquisicion: number | null;
    ibiAnual: number | null;
  } | null;

  // Metadatos
  fechaActualizacion: string;
  warnings: string[];
}

// ─── Cache in-memory · TTL 30s · invalidable ────────────────────────────────

const CACHE_TTL_MS = 30_000;
let cached: { value: FiscalContext; expiresAt: number } | null = null;

export function invalidateFiscalContext(): void {
  cached = null;
}

// ─── API pública ────────────────────────────────────────────────────────────

/**
 * Obtiene el contexto fiscal completo del titular. Combina `personalData` +
 * `viviendaHabitual` activa en un objeto unificado.
 *
 * @throws Error si no hay `personalData` en el sistema.
 */
export async function getFiscalContext(): Promise<FiscalContext> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const personalData = await personalDataService.getPersonalData();
  if (!personalData) {
    throw new Error(
      'fiscalContextService · no hay personalData en el sistema · usa getFiscalContextSafe() si quieres tolerar ausencia',
    );
  }

  const value = await buildFiscalContext(personalData);
  cached = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

/**
 * Versión que tolera ausencia de `personalData` (devuelve null). Útil en
 * componentes que pueden renderizarse antes del onboarding.
 */
export async function getFiscalContextSafe(): Promise<FiscalContext | null> {
  try {
    return await getFiscalContext();
  } catch {
    return null;
  }
}

// ─── Construcción interna ───────────────────────────────────────────────────

async function buildFiscalContext(
  personalData: PersonalData,
): Promise<FiscalContext> {
  const warnings: string[] = [];
  const personalDataId = personalData.id ?? 0;

  // Tributación · default 'individual' si null
  let tributacion: TipoTributacion;
  if (
    personalData.tributacion === 'individual' ||
    personalData.tributacion === 'conjunta'
  ) {
    tributacion = personalData.tributacion;
  } else {
    tributacion = 'individual';
    warnings.push('tributacion no informada · default individual');
  }

  // Comunidad autónoma
  const comunidadAutonoma = personalData.comunidadAutonoma?.trim() || null;
  if (!comunidadAutonoma) {
    warnings.push('comunidadAutonoma not informed');
  }

  // Fecha de nacimiento + edad del titular
  const fechaNacimientoRaw = personalData.fechaNacimiento?.trim() || null;
  const fechaNacimiento = fechaNacimientoRaw;
  let edadActual: number | null = null;
  if (fechaNacimiento) {
    edadActual = calcularEdad(fechaNacimiento);
    if (edadActual === null) {
      warnings.push('fechaNacimiento not parseable');
    }
  } else {
    warnings.push('fechaNacimiento not informed');
  }

  // Descendientes · `Descendiente` almacena `id`, `fechaNacimiento` y
  // `discapacidad`. No persiste `nombre` · TODO ampliar tipo en T14.x si Jose
  // confirma que la UI lo capturará.
  const descendientes = (personalData.descendientes ?? []).map((d) => ({
    nombre: '',
    fechaNacimiento: d.fechaNacimiento ?? '',
    edadActual: calcularEdad(d.fechaNacimiento) ?? 0,
    discapacidad: d.discapacidad,
  }));

  // Ascendientes · `Ascendiente` almacena `edad: number` (no fechaNacimiento)
  // · usamos `edad` directa como `edadActual` y dejamos `fechaNacimiento`
  // vacío. TODO ampliar tipo si la UI capturará fecha real.
  const ascendientes = (personalData.ascendientes ?? []).map((a) => ({
    nombre: '',
    fechaNacimiento: '',
    edadActual: a.edad,
    discapacidad: a.discapacidad,
  }));

  const discapacidadTitular: NivelDiscapacidad =
    personalData.discapacidad ?? 'ninguna';

  // Vivienda habitual activa
  let viviendaHabitual: FiscalContext['viviendaHabitual'] = null;
  try {
    const vivienda = await obtenerViviendaActiva(personalDataId);
    if (vivienda && vivienda.activa) {
      viviendaHabitual = mapViviendaHabitual(vivienda);
    } else {
      warnings.push('viviendaHabitual not registered');
    }
  } catch {
    warnings.push('viviendaHabitual not registered');
  }

  return {
    personalDataId,
    nombre: personalData.nombre,
    apellidos: personalData.apellidos,
    dni: personalData.dni,
    tributacion,
    comunidadAutonoma,
    fechaNacimiento,
    edadActual,
    descendientes,
    ascendientes,
    discapacidadTitular,
    viviendaHabitual,
    fechaActualizacion: personalData.fechaActualizacion,
    warnings,
  };
}

function mapViviendaHabitual(
  vivienda: ViviendaHabitual,
): NonNullable<FiscalContext['viviendaHabitual']> {
  const data: ViviendaHabitualData = vivienda.data;

  let referenciaCatastral: string | null = null;
  let valorCatastral: number | null = null;
  let porcentajeTitularidad: number | null = null;
  let fechaAdquisicion: string | null = null;
  let precioAdquisicion: number | null = null;
  let gastosAdquisicion: number | null = null;
  let ibiAnual: number | null = null;

  if (
    data.tipo === 'propietarioSinHipoteca' ||
    data.tipo === 'propietarioConHipoteca'
  ) {
    referenciaCatastral = data.catastro.referenciaCatastral || null;
    valorCatastral = data.catastro.valorCatastral ?? null;
    porcentajeTitularidad = data.catastro.porcentajeTitularidad ?? null;
    fechaAdquisicion = data.adquisicion.fecha || null;
    precioAdquisicion = data.adquisicion.precio ?? null;
    gastosAdquisicion = data.adquisicion.gastosAdquisicion ?? null;
    ibiAnual = data.ibi?.importeAnual ?? null;
  } else if (data.tipo === 'inquilino') {
    referenciaCatastral = data.direccion.referenciaCatastral || null;
  }

  return {
    activa: vivienda.activa,
    referenciaCatastral,
    valorCatastral,
    porcentajeTitularidad,
    fechaAdquisicion,
    precioAdquisicion,
    gastosAdquisicion,
    ibiAnual,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Calcula la edad a partir de una fecha de nacimiento en formato ISO
 * (`YYYY-MM-DD`) o `dd/mm/yyyy`. Devuelve null si la entrada es nula, no
 * parseable o produce una edad negativa.
 */
function calcularEdad(
  fechaNacimiento: string | null | undefined,
): number | null {
  if (!fechaNacimiento) return null;

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento);
  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    const dmyMatch = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(fechaNacimiento);
    if (dmyMatch) {
      day = Number(dmyMatch[1]);
      month = Number(dmyMatch[2]);
      year = Number(dmyMatch[3]);
    }
  }

  if (year === null || month === null || day === null) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const today = new Date();
  let edad = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
    edad--;
  }
  return edad < 0 ? null : edad;
}
