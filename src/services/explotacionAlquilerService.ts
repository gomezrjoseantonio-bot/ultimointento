// ============================================================================
// R1 · ALQUILERES · «poner un inmueble en alquiler» (Jose, 20 ago 2026)
// ============================================================================
//
// La explotación NO es un atributo del inmueble: es una entidad propia del
// dominio Alquileres que lo REFERENCIA. Marcar un inmueble como alquilable =
// que exista su `ExplotacionAlquiler`; desmarcarlo = borrarla. El inmueble se
// queda como el activo puro. De aquí se nutren la disponibilidad, el semillado
// de OPEX (al pasar a `operativo`) y la validación de contratos.
//
// Ver docs/MODELO-OPERATIVO-tesoreria-v1.md §9 quinquies bis.
// ============================================================================

import { initDB } from './db';
import type {
  ExplotacionAlquiler,
  ModoExplotacionAlquiler,
  EstadoExplotacion,
  HabitacionAlquiler,
  Property,
} from './db';

// ─── Helpers puros (con tests) ───────────────────────────────────────────────

/**
 * El siguiente id de habitación, respetando el esquema `hab-N` que ya usan los
 * contratos antiguos (`Contract.habitacionId`). Toma el mayor N existente y suma
 * 1, así nunca colisiona ni reusa un id que un contrato pudiera estar apuntando.
 */
export function siguienteIdHabitacion(habitaciones: HabitacionAlquiler[] = []): string {
  let max = 0;
  for (const h of habitaciones) {
    const m = /^hab-(\d+)$/.exec(h.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `hab-${max + 1}`;
}

/** N habitaciones por defecto, nombradas «Habitación 1..N» con ids `hab-1..hab-N`. */
export function habitacionesPorDefecto(n: number): HabitacionAlquiler[] {
  const total = Math.max(1, Math.floor(n) || 1);
  return Array.from({ length: total }, (_, i) => ({
    id: `hab-${i + 1}`,
    nombre: `Habitación ${i + 1}`,
    estado: 'operativo' as EstadoExplotacion,
  }));
}

/**
 * La explotación que le toca a un inmueble a partir de sus campos LEGACY de
 * `Property` (lo que puso el import o la migración V78). Devuelve `null` cuando
 * el inmueble NO es alquilable: su vivienda habitual (uso propio · Personal) o un
 * inmueble sin ninguna señal de alquiler. La migración v90 usa esto para sembrar.
 *
 * Señales de alquiler: `usoTipo` de arrendamiento · alquiler por habitaciones
 * activo · estado operativo puesto · o que ya tenga algún contrato.
 */
export function explotacionDesdeLegacy(
  p: Property,
  tieneContrato = false,
): Omit<ExplotacionAlquiler, 'id' | 'createdAt' | 'updatedAt'> | null {
  if (p.id == null) return null;
  if (p.usoTipo === 'vivienda_habitual') return null; // el hogar · nunca

  const porHabitaciones =
    p.modoExplotacion === 'por_habitaciones' ||
    p.modoExplotacion === 'mixto' ||
    p.alquilerPorHabitaciones?.activo === true;
  const esTuristico = p.usoTipo === 'turistico';
  const usoDeAlquiler =
    p.usoTipo === 'larga_estancia' ||
    p.usoTipo === 'temporada' ||
    p.usoTipo === 'turistico' ||
    p.usoTipo === 'mixto';

  const haySenal =
    usoDeAlquiler ||
    porHabitaciones ||
    p.explotacion?.estadoOperativo === 'operativo' ||
    tieneContrato;
  if (!haySenal) return null;

  const modo: ModoExplotacionAlquiler = esTuristico
    ? 'turistico'
    : porHabitaciones
      ? 'habitaciones'
      : 'completo';

  const estado: EstadoExplotacion =
    p.explotacion?.estadoOperativo === 'en_reforma'
      ? 'en_reforma'
      : p.explotacion?.estadoOperativo === 'vacante'
        ? 'vacante'
        : p.explotacion?.estadoOperativo === 'operativo' || tieneContrato
          ? 'operativo'
          : 'vacante';

  const base: Omit<ExplotacionAlquiler, 'id' | 'createdAt' | 'updatedAt'> = {
    inmuebleId: p.id,
    modo,
    estado,
  };
  if (modo === 'habitaciones') {
    const n = p.alquilerPorHabitaciones?.numeroHabitaciones ?? p.bedrooms ?? 1;
    base.habitaciones = habitacionesPorDefecto(n);
  }
  return base;
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export async function getExplotaciones(): Promise<ExplotacionAlquiler[]> {
  try {
    const db = await initDB();
    return (await db.getAll('explotacionAlquiler')) as ExplotacionAlquiler[];
  } catch (error) {
    console.error('Error leyendo explotaciones de alquiler:', error);
    return [];
  }
}

/** La explotación de un inmueble, o `undefined` si no está marcado como alquilable. */
export async function getExplotacionDeInmueble(
  inmuebleId: number,
): Promise<ExplotacionAlquiler | undefined> {
  const db = await initDB();
  return (await db.getFromIndex('explotacionAlquiler', 'inmuebleId', inmuebleId)) as
    | ExplotacionAlquiler
    | undefined;
}

/** Mapa `inmuebleId → explotación` para pintar toda la lista de un vistazo. */
export async function getExplotacionesPorInmueble(): Promise<Map<number, ExplotacionAlquiler>> {
  const todas = await getExplotaciones();
  const m = new Map<number, ExplotacionAlquiler>();
  for (const e of todas) m.set(e.inmuebleId, e);
  return m;
}

export async function estaAlquilable(inmuebleId: number): Promise<boolean> {
  return (await getExplotacionDeInmueble(inmuebleId)) != null;
}

// ─── Escritura ───────────────────────────────────────────────────────────────

export interface AltaExplotacion {
  modo: ModoExplotacionAlquiler;
  estado?: EstadoExplotacion;
  habitaciones?: HabitacionAlquiler[];
  /** Para `modo: 'habitaciones'` sin lista explícita · siembra N por defecto. */
  numeroHabitaciones?: number;
  cuentaCobroPorDefectoId?: number;
}

/**
 * Marca un inmueble como alquilable (crea su explotación) o la actualiza si ya
 * existe. Idempotente por `inmuebleId`. Al pasar el modo a `habitaciones` sin
 * lista, siembra habitaciones por defecto.
 */
export async function marcarAlquilable(
  inmuebleId: number,
  alta: AltaExplotacion,
): Promise<ExplotacionAlquiler> {
  const db = await initDB();
  const ahora = new Date().toISOString();
  const existente = await getExplotacionDeInmueble(inmuebleId);

  const habitaciones =
    alta.modo === 'habitaciones'
      ? alta.habitaciones ??
        existente?.habitaciones ??
        habitacionesPorDefecto(alta.numeroHabitaciones ?? 1)
      : undefined;

  if (existente?.id != null) {
    const actualizada: ExplotacionAlquiler = {
      ...existente,
      modo: alta.modo,
      estado: alta.estado ?? existente.estado,
      habitaciones,
      cuentaCobroPorDefectoId:
        alta.cuentaCobroPorDefectoId ?? existente.cuentaCobroPorDefectoId,
      updatedAt: ahora,
    };
    await db.put('explotacionAlquiler', actualizada);
    return actualizada;
  }

  const nueva: Omit<ExplotacionAlquiler, 'id'> = {
    inmuebleId,
    modo: alta.modo,
    estado: alta.estado ?? 'vacante',
    habitaciones,
    cuentaCobroPorDefectoId: alta.cuentaCobroPorDefectoId,
    createdAt: ahora,
    updatedAt: ahora,
  };
  const id = (await db.add('explotacionAlquiler', nueva as ExplotacionAlquiler)) as number;
  return { ...nueva, id };
}

/** Aplica un parche a la explotación existente. No-op si no está marcada. */
export async function actualizarExplotacion(
  inmuebleId: number,
  patch: Partial<Omit<ExplotacionAlquiler, 'id' | 'inmuebleId' | 'createdAt' | 'updatedAt'>>,
): Promise<ExplotacionAlquiler | undefined> {
  const db = await initDB();
  const existente = await getExplotacionDeInmueble(inmuebleId);
  if (!existente?.id) return undefined;
  const actualizada: ExplotacionAlquiler = {
    ...existente,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await db.put('explotacionAlquiler', actualizada);
  return actualizada;
}

/** Desmarca un inmueble: borra su explotación. El activo (Property) no se toca. */
export async function desmarcarAlquilable(inmuebleId: number): Promise<void> {
  const db = await initDB();
  const existente = await getExplotacionDeInmueble(inmuebleId);
  if (existente?.id != null) await db.delete('explotacionAlquiler', existente.id);
}

// ─── Habitaciones ────────────────────────────────────────────────────────────

/** Añade una habitación a la explotación (crea la lista si hiciera falta). */
export async function anadirHabitacion(
  inmuebleId: number,
  datos: { nombre?: string; rentaObjetivo?: number } = {},
): Promise<ExplotacionAlquiler | undefined> {
  const existente = await getExplotacionDeInmueble(inmuebleId);
  if (!existente?.id) return undefined;
  const habitaciones = existente.habitaciones ?? [];
  const id = siguienteIdHabitacion(habitaciones);
  const nueva: HabitacionAlquiler = {
    id,
    nombre: datos.nombre?.trim() || `Habitación ${habitaciones.length + 1}`,
    rentaObjetivo: datos.rentaObjetivo,
    estado: 'operativo',
  };
  return actualizarExplotacion(inmuebleId, { habitaciones: [...habitaciones, nueva] });
}

/** Actualiza una habitación por id. */
export async function actualizarHabitacion(
  inmuebleId: number,
  habitacionId: string,
  patch: Partial<Omit<HabitacionAlquiler, 'id'>>,
): Promise<ExplotacionAlquiler | undefined> {
  const existente = await getExplotacionDeInmueble(inmuebleId);
  if (!existente?.id) return undefined;
  const habitaciones = (existente.habitaciones ?? []).map((h) =>
    h.id === habitacionId ? { ...h, ...patch } : h,
  );
  return actualizarExplotacion(inmuebleId, { habitaciones });
}

/** Elimina una habitación por id. */
export async function eliminarHabitacion(
  inmuebleId: number,
  habitacionId: string,
): Promise<ExplotacionAlquiler | undefined> {
  const existente = await getExplotacionDeInmueble(inmuebleId);
  if (!existente?.id) return undefined;
  const habitaciones = (existente.habitaciones ?? []).filter((h) => h.id !== habitacionId);
  return actualizarExplotacion(inmuebleId, { habitaciones });
}
